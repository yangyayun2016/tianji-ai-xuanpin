import { createDemoInput } from '@/demo/research';
import { DataSourceRouter, TIME_MACHINE_TIP, type SourceResult } from '@/services/dataSources';
import type { CouponRecord, Market, Product, ResearchInput, RevenueRecord, UnitRecord } from './types';
import { COMPETITOR_GROUPS } from './schema';
import { monthsBetween } from './mappers';

const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const number = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

/** SIF 明确披露的平行数组；不解析前台档位文本，不使用父体序列替代子体缺数。 */
export function adaptSif(raw: unknown): { records: UnitRecord[] } {
  const data = object(raw), records: UnitRecord[] = [];
  for (const item of Array.isArray(data.asins) ? data.asins : []) {
    const r = object(item), dates = Array.isArray(r.boughtHistoryDates) ? r.boughtHistoryDates : data.boughtHistoryDates;
    if (typeof r.asin !== 'string' || !Array.isArray(dates)) continue;
    dates.forEach((date, n) => {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}/.test(date)) return;
      records.push({ asin: r.asin as string, month: date.slice(0, 7), units: number(Array.isArray(r.boughtHistory) ? r.boughtHistory[n] : null), scope: 'child', price: number(r.price) ?? undefined, tier: typeof r.boughtInPastMonth === 'string' ? r.boughtInPastMonth : undefined });
    });
  }
  return { records };
}
/** competitor_lookup 按月请求，显式读取子体 totalAmount；不读取 totalUnits 或促销字段。 */
export function adaptRevenue(raw: unknown, month: string): { records: RevenueRecord[] } {
  const data = object(raw);
  return { records: (Array.isArray(data.items) ? data.items : []).flatMap((item) => {
    const r = object(item);
    return typeof r.asin === 'string' ? [{ asin: r.asin, month, revenue: number(r.totalAmount), comparisonPrice: number(r.price) ?? undefined }] : [];
  }) };
}
/** 接受已确认的规范化 Keepa 网关记录；未知 Dinzee 返回形状保持不可用，绝不猜字段。 */
export function adaptKeepa(result: SourceResult<unknown>): ResearchInput['coupon'] {
  if (result.status !== 'ok') return result;
  const data = object(result.data);
  if (!Array.isArray(data.records)) return { status: 'unavailable', source: 'keepa', demo: result.demo, notice: `当前 Keepa 响应尚无已确认的字段映射。${TIME_MACHINE_TIP}` };
  const records: CouponRecord[] = data.records.flatMap((item) => {
    const r = object(item), history = object(r.history);
    if (typeof r.asin !== 'string') return [];
    return [{ asin: r.asin, afterPrice: number(r.afterPrice) ?? undefined, current: typeof r.current === 'string' || typeof r.current === 'number' ? r.current : undefined,
      history: Object.fromEntries([...COMPETITOR_GROUPS[4].rows, '站外促销证据'].map((key) => [key, typeof history[key] === 'string' || typeof history[key] === 'number' ? history[key] : null])) }];
  });
  return { ...result, data: { records } };
}
export async function loadResearchInput(router: DataSourceRouter, market: Market, asins: string[]): Promise<ResearchInput> {
  if (monthsBetween(market.periodStart, market.periodEnd).length === 0) throw new Error('请填写有效的统计期间');
  if (asins.length > 40) throw new Error('本轮最多输入 40 个 ASIN');
  const demo = router.isDemo('sif');
  const seed = demo ? createDemoInput(market) : undefined;
  const ids = seed ? seed.products.map((p) => p.asin) : [...new Set(asins)];
  if (!ids.length) throw new Error('请填写 ASIN');
  const products: Product[] = seed?.products ?? ids.map((asin) => ({ asin }));
  const [u, r, c] = await Promise.all([
    router.call('units', 'ops_get_asin_sales_list', { asins: ids, country: market.site, dimension: 'asin', timePieceType: 'month', timePieceValue: `${market.periodEnd.slice(0, 7)}-01`, pageSize: 100 }),
    demo ? router.call('revenue', 'competitor_lookup', { request: { marketplace: market.site, asins: ids } }) : Promise.all(monthsBetween(market.periodStart, market.periodEnd).map((month) => router.call('revenue', 'competitor_lookup', { request: { marketplace: market.site, asins: ids, month: month.replace('-', ''), variation: 'N', size: 100, returnFields: 'asin,price,totalAmount' } }))).then((results): SourceResult<{ records: RevenueRecord[] }> => {
      const available = results.filter((v) => v.status === 'ok');
      if (!available.length) return { status: 'unavailable', source: 'sellersprite', demo: false, notice: '销售额数据源不可用。' };
      return { status: 'ok', source: 'sellersprite', demo: false, data: { records: results.flatMap((v, n) => v.status === 'ok' ? adaptRevenue(v.data, monthsBetween(market.periodStart, market.periodEnd)[n]).records : []) }, ...(available.length !== results.length && { notice: '部分月份不可用，已保留缺失列。' }) };
    }),
    router.call('coupon', 'keepa__product_details_batch', { asins: ids, domain: market.site }),
  ]);
  // FakeResearchMcp 的合成记录独立于真实响应格式；真实未知 Keepa schema 不猜测报价/优惠字段。
  const input: ResearchInput = {
    ...(seed ?? {}), market: { ...market }, generatedAt: new Date().toISOString(), products,
    units: u.status === 'ok' ? { ...u, data: demo ? u.data as { records: UnitRecord[] } : adaptSif(u.data) } : u,
    revenue: r.status === 'ok' ? { ...r, data: r.data as { records: RevenueRecord[] } } : r,
    coupon: adaptKeepa(c),
  };
  return input;
}
