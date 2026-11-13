/**
 * 飞书多维表格（Bitable）开放接口的最小封装。
 * 鉴权：自建应用 app_id + app_secret 换 tenant_access_token（有效期约 2 小时，提前 5 分钟刷新）。
 * 多维表格需要把该应用添加为协作者（多维表格右上角 … → 添加文档应用），否则会报无权限。
 */
export const FEISHU_BASE = 'https://open.feishu.cn/open-apis';

export class FeishuError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
  }
}

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  /** 多维表格 app_token：链接 https://xxx.feishu.cn/base/<app_token>?table=... 里 base/ 后面那段 */
  appToken: string;
}

export const FIELD_TEXT = 1;
export const FIELD_NUMBER = 2;
export type FieldType = typeof FIELD_TEXT | typeof FIELD_NUMBER;

export interface FeishuRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

type Fetch = typeof fetch;

/** 从多维表格链接里提取 app_token；直接粘 token 也可以 */
export function parseAppToken(input: string): string {
  const s = input.trim();
  const m = s.match(/\/base\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  // 知识库（wiki）里的多维表格：先记下节点 token，连接时再换成多维表格的 app_token
  const w = s.match(/\/wiki\/([A-Za-z0-9]+)/);
  if (w) return `wiki:${w[1]}`;
  return s.replace(/[?#].*$/, '');
}

const WIKI_TIP = '也可以在多维表格右上角 … → 在新窗口打开，复制地址里带 /base/ 的链接填进来';

const hint = (code: number, msg: string): string => {
  if (code === 10003 || code === 10014 || /app secret|app_id/i.test(msg)) return '飞书 App ID 或 App Secret 不正确';
  if (code === 91402 || code === 1254003 || /NOTEXIST|not exist/i.test(msg)) return '找不到这个多维表格，请检查链接（知识库里的多维表格需用“在新窗口打开”后的 base 链接）';
  if (code === 91403 || code === 1254302 || /forbidden|permission/i.test(msg)) return '应用没有这个多维表格的权限：请在多维表格右上角 … → 添加文档应用，把应用加为可编辑';
  if ((code === 99991672 || /scope/i.test(msg)) && /wiki/i.test(msg)) {
    const link = msg.match(/https:\/\/open\.feishu\.cn\/app\/[^\s，。]+/)?.[0];
    return `应用缺少知识库权限：${link ? `打开 ${link} 一键开通` : '在权限管理开通“查看知识库”（wiki:wiki:readonly）'}，再创建并发布新版本`;
  }
  if (code === 99991672 || /scope/i.test(msg)) return `应用缺少权限：请在飞书开放平台 → 权限管理开通“查看、评论、编辑和管理多维表格”（bitable:app），再到版本管理与发布里创建并发布新版本。飞书原话：${msg.slice(0, 300)}`;
  return `飞书接口错误（${code}）：${msg}`;
};

export class FeishuClient {
  calls = 0;
  private token = '';
  private expireAt = 0;
  private resolved = '';

  constructor(
    private config: FeishuConfig,
    private fetcher: Fetch = (...a) => fetch(...a),
  ) {}

  private async tenantToken(): Promise<string> {
    if (this.token && Date.now() < this.expireAt) return this.token;
    const { appId, appSecret } = this.config;
    if (!appId || !appSecret) throw new FeishuError('还没有填写飞书 App ID / App Secret，请先到设置页填写');
    const res = await this.fetcher(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const d = (await res.json()) as { code: number; msg: string; tenant_access_token?: string; expire?: number };
    if (d.code !== 0 || !d.tenant_access_token) throw new FeishuError(hint(d.code, d.msg), d.code);
    this.token = d.tenant_access_token;
    this.expireAt = Date.now() + Math.max(60, (d.expire ?? 7200) - 300) * 1000;
    return this.token;
  }

  async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, query: Record<string, string | number | undefined> = {}): Promise<T> {
    const token = await this.tenantToken();
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    const url = `${FEISHU_BASE}${path}${qs ? `?${qs}` : ''}`;
    for (let attempt = 0; ; attempt++) {
      this.calls++;
      let res: Response;
      try {
        res = await this.fetcher(url, {
          method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        throw new FeishuError('连不上飞书开放平台，请检查网络');
      }
      // 频率限制：稍等重试
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      let d: { code: number; msg: string; data?: T };
      try {
        d = await res.json();
      } catch {
        throw new FeishuError(res.status === 404 ? `飞书接口地址不存在（HTTP 404），多半是多维表格链接不对。${WIKI_TIP}` : `飞书返回了无法解析的数据（HTTP ${res.status}）`);
      }
      if (d.code !== 0) throw new FeishuError(hint(d.code, d.msg), d.code);
      return (d.data ?? {}) as T;
    }
  }

  /** 多维表格的 app_token；知识库链接通过 wiki/v2/spaces/get_node 换成 obj_token */
  async appToken(): Promise<string> {
    if (this.resolved) return this.resolved;
    const t = this.config.appToken;
    if (!t.startsWith('wiki:')) return (this.resolved = t);
    let node: { obj_type?: string; obj_token?: string } | undefined;
    try {
      node = (await this.request<{ node?: { obj_type?: string; obj_token?: string } }>('GET', '/wiki/v2/spaces/get_node', undefined, { token: t.slice(5) })).node;
    } catch (e) {
      throw new FeishuError(`读取知识库链接失败：${(e as Error).message}。或者${WIKI_TIP.replace(/^也可以/, '')}`);
    }
    if (node?.obj_type !== 'bitable' || !node.obj_token) throw new FeishuError(`这个知识库页面不是多维表格（类型：${node?.obj_type ?? '未知'}），请换成多维表格的链接`);
    return (this.resolved = node.obj_token);
  }

  private async app() {
    return `/bitable/v1/apps/${await this.appToken()}`;
  }

  async listTables(): Promise<{ table_id: string; name: string }[]> {
    const out: { table_id: string; name: string }[] = [];
    let page_token: string | undefined;
    do {
      const d = await this.request<{ items?: { table_id: string; name: string }[]; has_more?: boolean; page_token?: string }>('GET', `${await this.app()}/tables`, undefined, { page_size: 100, page_token });
      out.push(...(d.items ?? []));
      page_token = d.has_more ? d.page_token : undefined;
    } while (page_token);
    return out;
  }

  async createTable(name: string, fields: { name: string; type: FieldType }[]): Promise<string> {
    const d = await this.request<{ table_id: string }>('POST', `${await this.app()}/tables`, {
      table: { name, default_view_name: '全部', fields: fields.map((f) => ({ field_name: f.name, type: f.type })) },
    });
    return d.table_id;
  }

  async listFields(tableId: string): Promise<{ field_name: string; type: number }[]> {
    const d = await this.request<{ items?: { field_name: string; type: number }[] }>('GET', `${await this.app()}/tables/${tableId}/fields`, undefined, { page_size: 100 });
    return d.items ?? [];
  }

  async createField(tableId: string, name: string, type: FieldType): Promise<void> {
    await this.request('POST', `${await this.app()}/tables/${tableId}/fields`, { field_name: name, type });
  }

  /** 按字段等值筛选（field 为空则取全部），自动翻页，最多 max 条 */
  async search(tableId: string, field?: string, value?: string, max = 2000): Promise<FeishuRecord[]> {
    const out: FeishuRecord[] = [];
    let page_token: string | undefined;
    const body = field ? { filter: { conjunction: 'and', conditions: [{ field_name: field, operator: 'is', value: [value] }] } } : {};
    do {
      const d = await this.request<{ items?: FeishuRecord[]; has_more?: boolean; page_token?: string }>('POST', `${await this.app()}/tables/${tableId}/records/search`, body, { page_size: 500, page_token });
      out.push(...(d.items ?? []));
      page_token = d.has_more && out.length < max ? d.page_token : undefined;
    } while (page_token);
    return out;
  }

  async batchCreate(tableId: string, rows: Record<string, unknown>[]): Promise<void> {
    for (let i = 0; i < rows.length; i += 500) {
      await this.request('POST', `${await this.app()}/tables/${tableId}/records/batch_create`, { records: rows.slice(i, i + 500).map((fields) => ({ fields })) });
    }
  }

  async batchUpdate(tableId: string, rows: { record_id: string; fields: Record<string, unknown> }[]): Promise<void> {
    for (let i = 0; i < rows.length; i += 500) {
      await this.request('POST', `${await this.app()}/tables/${tableId}/records/batch_update`, { records: rows.slice(i, i + 500) });
    }
  }
}

/** 多维表格文本字段读出来可能是字符串，也可能是 [{type:'text',text:'…'}] 片段数组 */
export function cellText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x ? String((x as { text?: unknown }).text ?? '') : String(x))).join('');
  if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text?: unknown }).text ?? '');
  return '';
}

export const cellNumber = (v: unknown): number => (typeof v === 'number' ? v : Number(cellText(v)) || 0);
