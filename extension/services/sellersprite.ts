import type { Product, ProductDetail, Review } from '@/core/types';

/**
 * 卖家精灵 MCP 客户端（与 VOC 插件同一套已验证的调用方式）。
 * 服务地址 https://mcp.sellersprite.com/mcp（Streamable HTTP，无状态），密钥放在 secret-key 请求头；
 * 不需要 initialize，直接 tools/call；结果是 content[0].text 里的 JSON：{"code":"OK","data":{...}}
 */
export const SELLERSPRITE_MCP_URL = 'https://mcp.sellersprite.com/mcp';
const PAGE_SIZE = 20;

export class SellerSpriteError extends Error {}

/** 测试和演示用：可以注入假的 callTool */
export interface SellerSpriteApi {
  calls: number;
  callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T>;
}

export class SellerSpriteClient implements SellerSpriteApi {
  calls = 0;
  private seq = 0;
  constructor(
    private secretKey: string,
    private endpoint = SELLERSPRITE_MCP_URL,
  ) {}

  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    if (!this.secretKey) throw new SellerSpriteError('还没有填写卖家精灵密钥，请先到设置页填写');
    this.calls++;
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'secret-key': this.secretKey },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++this.seq, method: 'tools/call', params: { name, arguments: args } }),
      });
    } catch {
      throw new SellerSpriteError('连不上卖家精灵服务，请检查网络');
    }
    if (!res.ok) throw new SellerSpriteError(`卖家精灵服务返回错误（HTTP ${res.status}）`);
    return parseToolResult<T>(await res.text(), res.headers.get('content-type') ?? '');
  }
}

export function parseToolResult<T>(body: string, contentType: string): T {
  let text = body;
  if (contentType.includes('text/event-stream')) {
    const events = body
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    text = events[events.length - 1] ?? '';
  }
  const rpc = JSON.parse(text) as { error?: { message?: string }; result?: { content?: { type: string; text?: string }[]; isError?: boolean } };
  if (rpc.error) throw new SellerSpriteError(`卖家精灵接口错误：${rpc.error.message ?? '未知错误'}`);
  const payload = rpc.result?.content?.find((c) => c.type === 'text')?.text ?? '';
  if (rpc.result?.isError) throw new SellerSpriteError(/addHeader/.test(payload) ? '还没有填写卖家精灵密钥' : `卖家精灵接口错误：${payload.slice(0, 200)}`);
  let data: { code?: string; message?: string; data?: unknown };
  try {
    data = JSON.parse(payload);
  } catch {
    throw new SellerSpriteError(`卖家精灵返回了无法解析的数据：${payload.slice(0, 200)}`);
  }
  if (data.code === 'ERROR_UNAUTHORIZED') throw new SellerSpriteError('卖家精灵密钥无效或已过期，请到设置页检查');
  const detail = typeof data.data === 'string' && data.data ? `（${data.data}）` : '';
  if (data.code !== 'OK') throw new SellerSpriteError(`卖家精灵：${data.message ?? data.code}${detail}`);
  return (data.data ?? {}) as T;
}

// ───────────── 业务封装 ─────────────

type Raw = Record<string, any>;

export function toDetail(d: Raw, asin: string): ProductDetail {
  return {
    asin: String(d.asin ?? asin),
    title: String(d.title ?? ''),
    brand: String(d.brand ?? ''),
    imageUrl: String(d.zoomImageUrl ?? d.imageUrl ?? ''),
    price: Number(d.price ?? 0),
    rating: Number(d.rating ?? 0),
    ratings: Number(d.ratings ?? 0),
    availableDate: d.availableDate ? Number(d.availableDate) : null,
    variations: Number(d.variations ?? 0),
    features: Array.isArray(d.features) ? d.features.map(String) : [],
    dimensions: String(d.dimensions ?? ''),
    weight: String(d.weight ?? ''),
    nodeIdPath: String(d.nodeIdPath ?? ''),
    nodeLabelPath: String(d.nodeLabelPath ?? ''),
    sellerName: String(d.sellerName ?? ''),
  };
}

export function toProduct(x: Raw, rank: number): Product {
  return {
    rank,
    asin: String(x.asin),
    title: String(x.title ?? ''),
    brand: String(x.brand ?? ''),
    imageUrl: String(x.imageUrl ?? '').replace(/\._AC_US\d+_|\._SS\d+_/, '._AC_SR300,300_'),
    price: Number(x.price ?? 0),
    units: Number(x.units ?? 0),
    revenue: Number(x.revenue ?? 0),
    rating: Number(x.rating ?? 0),
    ratings: Number(x.ratings ?? 0),
    availableDate: x.availableDate ? Number(x.availableDate) : null,
    variations: Number(x.variations ?? 0),
    fulfillment: String(x.fulfillment ?? ''),
    dimension: String(x.dimension ?? x.dimensions ?? ''),
    weight: String(x.weight ?? ''),
    sellerName: String(x.sellerName ?? x.seller ?? ''),
  };
}

export async function productDetail(api: SellerSpriteApi, asin: string): Promise<ProductDetail> {
  return toDetail(await api.callTool<Raw>('asin_detail', { marketplace: 'US', asin }), asin);
}

/** asin_detail 有时没有类目节点，用商品列表接口按 ASIN 反查（VOC 插件实测） */
export async function resolveNode(api: SellerSpriteApi, detail: ProductDetail): Promise<{ nodeIdPath: string; nodeLabelPath: string }> {
  if (detail.nodeIdPath) return { nodeIdPath: detail.nodeIdPath, nodeLabelPath: detail.nodeLabelPath };
  const list = await api.callTool<{ items?: Raw[] }>('competitor_lookup', { request: { marketplace: 'US', asins: [detail.asin], size: 1 } });
  const hit = list.items?.find((x) => x.nodeIdPath);
  if (!hit) throw new SellerSpriteError(`卖家精灵查不到 ${detail.asin} 的类目，请换一个 ASIN`);
  return { nodeIdPath: String(hit.nodeIdPath), nodeLabelPath: String(hit.nodeLabelPath ?? '') };
}

/** 细分类目按月销量排序的前 N 个商品（只精确匹配该节点） */
export async function categoryTop(api: SellerSpriteApi, nodeIdPath: string, n: number): Promise<Product[]> {
  const out: Raw[] = [];
  for (let page = 1; out.length < n; page++) {
    const d = await api.callTool<{ items?: Raw[]; hasNextPage?: boolean }>('competitor_lookup', {
      request: { marketplace: 'US', nodeIdPath, nodeIdPathEqual: true, order: { field: 'total_units', desc: true }, variation: 'Y', size: 100, page },
    });
    out.push(...(d.items ?? []));
    if (!d.hasNextPage || !d.items?.length) break;
  }
  return out.slice(0, n).map((x, i) => toProduct(x, i + 1));
}

/** 按星级取评论（按时间倒序，每页 20 条） */
export async function fetchReviews(api: SellerSpriteApi, asin: string, stars: number[], limit: number, tag: string): Promise<Review[]> {
  const out: Review[] = [];
  for (let page = 1; out.length < limit; page++) {
    const d = await api.callTool<{ items?: Raw[]; hasNextPage?: boolean }>('review', { marketplace: 'US', asin, starList: stars, page, size: PAGE_SIZE });
    const items = d.items ?? [];
    items.forEach((r, i) =>
      out.push({
        id: `${asin}#${tag}${page}-${i}`,
        asin,
        star: Number(r.star ?? 0),
        title: String(r.title ?? ''),
        content: String(r.content ?? '')
          .replace(/<br\s*\/?>/gi, '\n')
          .trim(),
        date: Number(r.date ?? 0),
      }),
    );
    if (!d.hasNextPage || !items.length) break;
  }
  return out.slice(0, limit);
}
