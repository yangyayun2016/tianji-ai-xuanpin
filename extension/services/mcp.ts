/** 可配置的 Streamable HTTP MCP；密钥仅由本地设置传入。 */
export interface McpConfig {
  url: string;
  apiKey: string;
  auth: 'bearer' | 'secret-key' | 'x-api-key' | 'none';
  protocol: 'streamable' | 'direct';
}

export const EMPTY_MCP: McpConfig = { url: '', apiKey: '', auth: 'bearer', protocol: 'streamable' };
export const isMcpConfigured = (c: McpConfig): boolean => !!c.url.trim() && (c.auth === 'none' || !!c.apiKey.trim());

export function mcpOrigin(value: string): string {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password) {
    throw new Error('MCP 地址需使用 HTTPS，或本地回环 HTTP 地址；凭据请填写在密钥栏');
  }
  return url.origin;
}

export interface McpApi {
  callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T>;
  inputProperty?(name: string, field: string): Promise<Record<string, unknown> | undefined>;
}

type Rpc = { id?: number; error?: { code?: number }; result?: unknown };
type ToolResult = { isError?: boolean; structuredContent?: unknown; content?: { type: string; text?: string }[] };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 不把服务错误原文带到界面：部分网关会在错误中回显请求头。 */
export function unwrapMcpResult(result: ToolResult): unknown {
  if (result.isError) throw new Error('MCP 工具执行失败，请检查设置、工具参数和服务权限');
  let data = result.structuredContent;
  if (data === undefined) {
    const text = result.content?.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n');
    if (!text) throw new Error('MCP 工具没有返回 JSON 数据');
    try { data = JSON.parse(text); } catch { throw new Error('MCP 工具返回格式不支持，需要 JSON 数据'); }
  }
  if (record(data) && 'code' in data) {
    if (!['OK', 0, 200].includes(data.code as string | number)) throw new Error('MCP 数据服务返回失败，请检查配置或额度');
    return data.data;
  }
  return data;
}

async function readRpc(res: Response, id: number): Promise<Rpc> {
  if (!res.headers.get('content-type')?.includes('text/event-stream')) return await res.json() as Rpc;
  if (!res.body) throw new Error('MCP 返回空响应');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done }).replace(/\r\n/g, '\n');
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      if (chunk.done && buffer) events.push(buffer);
      for (const event of events) {
        const data = event.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        const rpc = JSON.parse(data) as Rpc;
        if (rpc.id === id) return rpc;
      }
      if (chunk.done) throw new Error('MCP 事件流缺少请求结果');
    }
  } finally { await reader.cancel(); }
}

export class McpClient implements McpApi {
  private seq = 0;
  private session = '';
  private version = '2025-03-26';
  private ready?: Promise<void>;
  constructor(private config: McpConfig, private fetcher: typeof fetch = (...args) => fetch(...args)) {}

  private async rpc(method: string, params: Record<string, unknown>, notification = false): Promise<unknown> {
    if (!isMcpConfigured(this.config)) throw new Error('请先在设置页配置 MCP 地址和鉴权，或使用演示模式');
    mcpOrigin(this.config.url);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
    if (this.config.auth === 'bearer') headers.Authorization = `Bearer ${this.config.apiKey}`;
    else if (this.config.auth !== 'none') headers[this.config.auth] = this.config.apiKey;
    if (this.session) headers['Mcp-Session-Id'] = this.session;
    if (method !== 'initialize' && this.config.protocol === 'streamable') headers['MCP-Protocol-Version'] = this.version;
    const id = ++this.seq;
    try {
      const res = await this.fetcher(this.config.url, {
        method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({ jsonrpc: '2.0', ...(!notification && { id }), method, params }),
      });
      if (!res.ok) throw new Error(`MCP 服务返回 HTTP ${res.status}`);
      if (notification) { await res.body?.cancel(); return; }
      const rpc = await readRpc(res, id);
      if (rpc.id !== id || rpc.error || rpc.result === undefined) throw new Error('MCP 协议错误，请检查接口地址与协议模式');
      if (method === 'initialize') this.session = res.headers.get('Mcp-Session-Id') ?? '';
      return rpc.result;
    } catch (e) {
      if (e instanceof Error && /^MCP /.test(e.message)) throw e;
      throw new Error('MCP 连接失败、超时或响应无效，请检查地址、鉴权和域名权限');
    }
  }

  private async initialize(): Promise<void> {
    if (this.config.protocol === 'direct') return;
    if (!this.ready) this.ready = (async () => {
      const r = await this.rpc('initialize', { protocolVersion: this.version, capabilities: {}, clientInfo: { name: 'tianji-ai-extension', version: '0.1.0' } });
      if (record(r) && typeof r.protocolVersion === 'string') this.version = r.protocolVersion;
      await this.rpc('notifications/initialized', {}, true);
    })().catch((e) => { this.ready = undefined; throw e; });
    await this.ready;
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    await this.initialize();
    return unwrapMcpResult(await this.rpc('tools/call', { name, arguments: args }) as ToolResult) as T;
  }

  async inputProperty(name: string, field: string): Promise<Record<string, unknown> | undefined> {
    await this.initialize();
    let cursor: string | undefined;
    do {
      const r = await this.rpc('tools/list', cursor ? { cursor } : {}) as { tools?: { name: string; inputSchema?: { properties?: Record<string, Record<string, unknown>> } }[]; nextCursor?: string };
      const hit = r.tools?.find((t) => t.name === name);
      if (hit) return hit.inputSchema?.properties?.[field];
      cursor = r.nextCursor;
    } while (cursor);
  }
}
