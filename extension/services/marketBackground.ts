import { DataSourceRouter } from './dataSources';

export type BackgroundQuery = { marketPlaceId: string; fields?: unknown } & (
  | { kind: 'category'; amazonCategoryId: string }
  | { kind: 'market'; marketName: string }
);
export type Section<T> = { status: 'ok'; data: T } | { status: 'error'; message: string };
export interface TrendPoints {
  /** 只有 trendPoints 路径已确认；不映射点内未确认的英文字段。 */
  trendPoints: (string | number | null)[];
  received: number;
  pending: boolean;
}
export interface BackgroundReport {
  demo: boolean;
  query: BackgroundQuery;
  actualMarketName?: string;
  insights: Section<{ searchVolume: number | null; clickCount: number | null }> | null;
  detail: Section<{ monthlySales: number | null; averagePrice?: number | null; themeNames?: string[] }>;
  keywords: Section<{ keywordTrends: TrendPoints[] }>;
  sample: Section<TrendPoints>;
}

const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const number = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
export function mapInsights(v: unknown) {
  const r = object(v);
  return { searchVolume: number(r.searchVolume), clickCount: number(r.clickCount) };
}
export function mapCategoryDetail(v: unknown) {
  const r = object(v);
  return { monthlySales: null, averagePrice: number(r.averagePrice) };
}
export function mapMarketDetail(v: unknown) {
  const r = object(v);
  return { monthlySales: null, themeNames: Array.isArray(r.themeNames) ? r.themeNames.filter((x): x is string => typeof x === 'string') : [] };
}
export function mapTrendPoints(v: unknown): TrendPoints {
  if (!Array.isArray(v)) return { trendPoints: [], received: 0, pending: true };
  const valid = (x: unknown): x is string | number | null => x === null || typeof x === 'string' || (typeof x === 'number' && Number.isFinite(x));
  // 对象点仅计数，不把未知键名透传到页面，更不假定时间、数值字段。
  return { trendPoints: v.every(valid) ? v : [], received: v.length, pending: v.some((x) => !valid(x)) };
}
export function mapKeywords(v: unknown) {
  const r = object(v);
  return { keywordTrends: Array.isArray(r.keywordTrends) ? r.keywordTrends.map((k) => mapTrendPoints(object(k).trendPoints)) : [] };
}

async function section<T>(fn: () => Promise<T>): Promise<Section<T>> {
  try { return { status: 'ok', data: await fn() }; }
  catch (e) { return { status: 'error', message: e instanceof Error ? e.message : '数据加载失败，请重试' }; }
}

export async function loadMarketBackground(router: DataSourceRouter, query: BackgroundQuery): Promise<BackgroundReport> {
  const marketPlaceId = query.marketPlaceId.trim();
  if (!marketPlaceId || !(query.kind === 'category' ? query.amazonCategoryId.trim() : query.marketName.trim())) throw new Error('请填写站点，以及类目 ID 或实际市场名称');
  const fetchTool = async (name: string, args: Record<string, unknown>) => {
    const r = await router.call('marketBackground', name, args);
    if (r.status !== 'ok') throw new Error(r.notice);
    return r.data;
  };
  const prefix = `seakerai__selection_${query.kind}`;
  let args: Record<string, unknown> = { marketPlaceId, ...(query.kind === 'category' ? { amazonCategoryId: query.amazonCategoryId.trim() } : { marketName: query.marketName.trim() }) };
  let actualMarketName: string | undefined;
  const detail = section(async () => {
    const raw = await fetchTool(`${prefix}_detail`, args);
    if (query.kind === 'category') return mapCategoryDetail(raw);
    // marketName 已是确认的参数名。只使用服务实际返回的名称，不用搜索词或 themeNames 代替。
    const returned = object(raw).marketName;
    if (typeof returned === 'string' && returned.trim()) actualMarketName = returned;
    return mapMarketDetail(raw);
  });
  const insights = query.kind === 'category' ? section(async () => mapInsights(await fetchTool(`${prefix}_insights`, args))) : null;
  // 市场的后续请求必须等详情返回的真实名称；没有该名称时保留已确认指标并单独报错。
  const resolvedDetail = await detail;
  if (query.kind === 'market') {
    if (!actualMarketName) {
      const unavailable: Section<never> = { status: 'error', message: '服务未返回实际市场名称（字段名待确认），无法请求市场趋势；请从 SeekerAI / Dinzee 返回结果核对名称与 schema。' };
      return { demo: router.isDemo('seeker'), query, detail: resolvedDetail, insights: null, keywords: unavailable, sample: unavailable };
    }
    args = { marketPlaceId, marketName: actualMarketName };
  }
  const keywordTool = `${prefix}_top_5_keyword_search_trends`;
  const [resolvedInsights, keywords, sample] = await Promise.all([
    insights,
    section(async () => {
      // fields 的类型/枚举未在需求中确认：优先用户输入，否则只采用服务 schema 的显式默认值。
      const fields = query.fields !== undefined ? query.fields : (await router.inputProperty(keywordTool, 'fields'))?.default;
      if (fields === undefined) throw new Error('fields 参数取值待确认：请按 MCP 服务 schema 填写 fields JSON 后重试。');
      return mapKeywords(await fetchTool(keywordTool, { ...args, fields }));
    }),
    Promise.resolve<Section<TrendPoints>>({ status: 'error', message: '销量只走 SIF MCP；不使用 Seeker 的销量趋势。' }),
  ]);
  return { demo: router.isDemo('seeker'), query, actualMarketName, detail: resolvedDetail, insights: resolvedInsights, keywords, sample };
}
