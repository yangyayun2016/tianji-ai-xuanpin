import { FakeResearchMcp } from '@/demo/research';
import type { Settings } from '@/utils/storage';
import { isMcpConfigured, McpClient, type McpApi } from './mcp';
import { SellerSpriteClient } from './sellersprite';

export const SOURCE_ROUTES = Object.freeze({ units: 'sif', revenue: 'sellersprite', coupon: 'keepa', marketBackground: 'seeker' } as const);
export type Metric = keyof typeof SOURCE_ROUTES;
export type Source = (typeof SOURCE_ROUTES)[Metric];
export const TIME_MACHINE_TIP = 'Keepa 不可用时，请使用 SIF 插件在前台下载「运营时光机」历史数据。';
export const RESEARCH_TOOLS = [
  'seakerai__selection_category_insights',
  'seakerai__selection_category_detail',
  'seakerai__selection_market_detail',
  'seakerai__selection_category_top_5_keyword_search_trends',
  'seakerai__selection_market_top_5_keyword_search_trends',
] as const;
const TOOLS: Record<Metric, readonly string[]> = {
  units: ['ops_get_asin_sales_list', 'ops_get_asin_sales_trend'],
  revenue: ['asin_sales_trend', 'competitor_lookup', 'asin_prediction'],
  coupon: ['keepa__product', 'keepa__product_details_batch'],
  marketBackground: RESEARCH_TOOLS,
};

export type SourceResult<T> =
  | { status: 'ok'; source: Source; demo: boolean; data: T; notice?: string }
  | { status: 'unavailable'; source: Source; demo: boolean; notice: string };

/** 新调研模块的唯一数据入口。调用方不能自行指定来源，也不能跨口径回退。 */
export class DataSourceRouter {
  private clients: Record<Source, McpApi>;
  private demos: Record<Source, boolean>;
  private configured: Record<Source, boolean>;
  constructor(settings: Settings, forceDemo = false, clients: Partial<Record<Source, McpApi>> = {}) {
    this.demos = {
      sif: forceDemo, keepa: forceDemo, seeker: forceDemo, sellersprite: forceDemo,
    };
    this.configured = { sif: isMcpConfigured(settings.sifMcp), keepa: isMcpConfigured(settings.keepaMcp), seeker: isMcpConfigured(settings.seekerMcp), sellersprite: !!settings.sellerspriteKey.trim() };
    this.clients = {
      sif: new McpClient(settings.sifMcp), keepa: new McpClient(settings.keepaMcp),
      seeker: new McpClient(settings.seekerMcp), sellersprite: new SellerSpriteClient(settings.sellerspriteKey),
      ...clients,
    };
    for (const source of Object.keys(this.demos) as Source[]) {
      if (this.demos[source]) this.clients[source] = new FakeResearchMcp();
    }
  }

  isDemo(source: Source): boolean { return this.demos[source]; }

  async inputProperty(tool: string, field: string): Promise<Record<string, unknown> | undefined> {
    if (!TOOLS.marketBackground.includes(tool)) throw new Error('不支持的市场背景工具');
    if (!this.demos.seeker && !this.configured.seeker) return undefined;
    return this.clients.seeker.inputProperty?.(tool, field);
  }

  async call<T = unknown>(metric: Metric, tool: string, args: Record<string, unknown>): Promise<SourceResult<T>> {
    if (!TOOLS[metric]?.includes(tool)) throw new Error('该工具不符合数据源口径，已阻止调用');
    const source = SOURCE_ROUTES[metric];
    const demo = this.demos[source];
    if (!demo && !this.configured[source]) return { status: 'unavailable', source, demo, notice: metric === 'coupon' ? TIME_MACHINE_TIP : '请先在设置页配置对应数据源。' };
    try {
      const data = await this.clients[source].callTool<T>(tool, args);
      return { status: 'ok', source, demo, data, ...(metric === 'coupon' && demo ? { notice: `当前为演示优惠数据。${TIME_MACHINE_TIP}` } : {}) };
    } catch {
      if (metric === 'coupon') return { status: 'unavailable', source, demo, notice: TIME_MACHINE_TIP };
      return { status: 'unavailable', source, demo, notice: '数据源调用失败，请检查地址、鉴权、参数及服务权限。' };
    }
  }
}
