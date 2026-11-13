import type { McpApi } from '@/services/mcp';
import type { Market, ResearchInput, Value } from '@/research/types';
import { COMPETITOR_GROUPS, LEXICON_COLUMNS, QA_ROWS, TRAFFIC_COUNT_COLUMNS } from '@/research/schema';

export const DEMO_MARKET: Market = { site: 'US', categoryName: '合成演示类目', categoryNodeId: 'demo-node', periodStart: '2026-06-01', periodEnd: '2026-11-30', query: 'demo organizer' };

/** 全部为合成样本；不读取任何工作簿、客户目录或浏览器存量报告。 */
export function createDemoInput(market: Market = DEMO_MARKET): ResearchInput {
  const products: ResearchInput['products'] = [
    { asin: 'B0DEMO0001', brand: '演示品牌甲', seller: '合成账号甲', sellerType: 'SC', listedAt: '2026-06-01', pack: 2, rating: 4.3, ratings: 125, title: '合成收纳产品 A', tags: { 材质: '合成材质 A', 套装: '双件' } },
    { asin: 'B0DEMO0002', brand: '演示品牌乙', seller: '合成账号乙', listedAt: '2026-05-31', pack: 1, rating: 4.1, ratings: 230, title: '合成收纳产品 B', tags: { 材质: '合成材质 B', 套装: '单件' } },
    { asin: 'B0DEMO0003', brand: '演示品牌甲', listedAt: undefined, pack: 1, rating: 4.4, ratings: 43, title: '合成收纳产品 C', tags: { 材质: '合成材质 A' } },
  ];
  products.forEach((p) => {
    p.category = market.categoryName;
    p.notApplicable = ['发光方向 / 光型', '发光颜色', '色温', '光通量', '感应角度', '运动感应距离'];
    p.competitor = { 中文产品定位: '合成演示：桌面收纳', 竞品分组: '合成对照组', 材质归属: '合成材料' };
    p.qa = Object.fromEntries(QA_ROWS.map((label) => [label, label === '有效正文统计分母' ? 20 : `合成演示：${label}`]));
  });
  const [sy, sm] = market.periodStart.slice(0, 7).split('-').map(Number), [ey, em] = market.periodEnd.slice(0, 7).split('-').map(Number);
  const dates: string[] = [];
  for (let n = sy * 12 + sm - 1; n <= ey * 12 + em - 1; n++) dates.push(`${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`);
  const unitRecords = dates.flatMap((month, n) => products.map((p, a) => ({ asin: p.asin, month, units: a === 2 && n === 0 ? null : 100 + n * 20 + a * 10, scope: 'child' as const, price: 20 + a * 5, rank: a + 1, nodeId: market.categoryNodeId })));
  const revenueRecords = dates.flatMap((month, n) => products.map((p, a) => ({ asin: p.asin, month, revenue: a === 2 && n === 0 ? null : 1800 + n * 350 + a * 120, comparisonPrice: 21 + a * 5 })));
  const couponRecords = products.map((p) => ({ asin: p.asin, afterPrice: 18, current: '合成优惠记录：2 本币', history: Object.fromEntries(COMPETITOR_GROUPS[4].rows.map((label) => [label, `合成演示：${label}`])) }));
  const keywords: ResearchInput['keywords'] = [
    { fields: { 关键词: 'demo organizer', 关键词翻译: '合成收纳词', 月搜索量: 30000, 商品数: 150, 购买率: .08, 前三ASIN转化总占比: .4, PPC竞价: .6, 建议竞价范围: [.4, .8], 点击集中度: .5, 广告竞品数: 25, ABA排名: 2000 }, purchases: 2400 },
    { fields: { 关键词: 'demo storage', 关键词翻译: '合成储物词', 月搜索量: 12000, 商品数: 100, 购买率: .05, 前三ASIN转化总占比: .3, PPC竞价: .5 }, purchases: 600 },
    { fields: { 关键词: 'demo zero', 关键词翻译: '合成零值词', 月搜索量: 0, 商品数: 20, 购买率: 0 }, purchases: 0 },
  ];
  const cost = { 采购成本: 4, 头程: 1, FBA配送费: 3, 平台佣金: 2, 其他费用: 0, '广告CPA（可引用模块 9 推荐档）': 1.5 };
  return {
    market: { ...market }, generatedAt: '2026-11-13T00:00:00.000Z', products,
    units: { status: 'ok', source: 'sif', demo: true, data: { records: unitRecords } },
    revenue: { status: 'ok', source: 'sellersprite', demo: true, data: { records: revenueRecords } },
    coupon: { status: 'ok', source: 'keepa', demo: true, data: { records: couponRecords } },
    keywords, grossMargin: .3,
    trends: { sourceUrl: 'https://trends.google.com/trends/', collectedAt: '2026-11-13', weeks: Array.from({ length: 10 }, (_, n) => ({ start: `2026-${String(8 + Math.floor(n / 4)).padStart(2, '0')}-${String(1 + n % 4 * 7).padStart(2, '0')}`, index: n === 9 ? null : 30 + n * 5, complete: n < 8 })), regions: [{ 地区排名: 1, 地区名称: '合成地区', '区域热度（0—100 相对指数）': 80 }] },
    observations: {
      '8.counts': keywords.map((k, n) => ({ ...Object.fromEntries(TRAFFIC_COUNT_COLUMNS.map((c) => [c, 10])), '#': n + 1, 关键词: k.fields.关键词, 翻译: k.fields.关键词翻译, 搜索量: k.fields.月搜索量 })),
      '9.profit': keywords.map((k) => ({ 关键词: k.fields.关键词, 点击量: 5000, '建议竞价-最低': .4, '建议竞价-推荐': .6, '建议竞价-最高': .8, '产品均价-最低': 18, '产品均价-均价': 20, '产品均价-最高': 25 })),
      '10.landscape': products.map((p) => ({ ASIN: p.asin, 自然流量: .6, 'SP(常规)流量': .2 })),
      '11.lexicon': keywords.map((k, n) => ({ ...Object.fromEntries(LEXICON_COLUMNS.map((c) => [c, null as Value | null])), '#': n + 1, 关键词: k.fields.关键词, 翻译: k.fields.关键词翻译, 周搜索量: 1200, '周ABA 排名': 3000 })),
      '7.complaints': [{ 主题: '合成评论聚类 A', 提及次数: 3, 占比: .15, 说明: '3/20 条合成正文提及' }],
      '7.delights': [{ 主题: '合成评论聚类 B', 提及次数: 5, 占比: .25, 说明: '5/20 条合成正文提及' }],
    }, costs: { B0DEMO0001: cost },
  };
}

/** 仅有演示数值；不含凭据，不向外部服务发送请求。 */
export class FakeResearchMcp implements McpApi {
  constructor(private input: ResearchInput = createDemoInput()) {}
  async inputProperty() { return { default: [] }; }
  async callTool<T = unknown>(name: string): Promise<T> {
    let data: unknown;
    if (name === 'ops_get_asin_sales_list' || name === 'ops_get_asin_sales_trend') data = this.input.units.status === 'ok' ? this.input.units.data : {};
    else if (['asin_sales_trend', 'competitor_lookup', 'asin_prediction'].includes(name)) data = this.input.revenue.status === 'ok' ? this.input.revenue.data : {};
    else if (name.startsWith('keepa__')) data = this.input.coupon.status === 'ok' ? this.input.coupon.data : {};
    else if (name.endsWith('category_insights')) data = { searchVolume: 128000, clickCount: 46000 };
    else if (name.endsWith('category_detail')) data = { monthlySales: 18000, averagePrice: 29.5 };
    else if (name.endsWith('market_detail')) data = { marketName: '演示智能市场', monthlySales: 7600, themeNames: ['便携', '易清洁'] };
    // 点内部 schema 未确认，使用无字段名的序列演示，不猜测 date/value 等英文字段。
    else if (name.includes('keyword_search_trends')) data = { keywordTrends: [{ trendPoints: [80, 92, 105, 98, 120, 128] }, { trendPoints: [60, 58, 65, 78, 85, 89] }] };
    else if (name.includes('top_100_asin')) data = { trendPoints: [5200, 5600, 6100, 5900, 7100, 7600] };
    else data = { demo: true };
    return data as T;
  }
}
