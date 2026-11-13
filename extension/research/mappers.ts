import { TIME_MACHINE_TIP, type SourceResult } from '@/services/dataSources';
import { ATTRIBUTE_COLUMNS, BACKGROUND_SCOPE_ROWS, COMPETITOR_GROUPS, MARKET_ASIN_COLUMNS, MODULE_CATALOG, NEW_PRODUCT_RULES, RESEARCH_SCHEMA, type ModuleId } from './schema';
import type { Cell, Product, RawRow, ResearchInput, ResearchModule, ResearchRow, ResearchSection, Status, UnitRecord, Value } from './types';

export const cell = (value: Value | Cell | null | undefined, status: Status = 'missing', note?: string): Cell => {
  if (value && typeof value === 'object' && 'status' in value && 'value' in value) {
    const c = value as Cell;
    return c.status === 'ok' ? cell(c.value, 'missing', c.note) : { value: null, status: c.status, ...(c.note && { note: c.note }) };
  }
  const valid = value !== undefined && value !== null && !(typeof value === 'number' && !Number.isFinite(value));
  return { value: valid ? value as Value : null, status: valid ? 'ok' : status, ...(note && { note }) };
};
const num = (value: unknown): number | null => {
  const v = value && typeof value === 'object' && 'value' in value ? (value as Cell).value : value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const sum = (values: (number | null | undefined)[]): number | null => {
  const known = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
};
const ratio = (a: number | null, b: number | null) => a !== null && b !== null && b > 0 ? a / b : null;
const calc = (values: Cell[], fn: (...args: number[]) => number | null): Cell => {
  const missing = values.find((v) => v.status !== 'ok' || num(v) === null);
  return missing ? cell(null, missing.status === 'ok' ? 'missing' : missing.status, missing.note) : cell(fn(...values.map((v) => num(v)!)));
};
const sourceCell = (r: SourceResult<unknown>, value: Value | null | undefined) => cell(r.status === 'ok' ? value : null, r.status === 'ok' ? 'missing' : 'unavailable', r.notice);
export function monthsBetween(start: string, end: string): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])/.test(start) || !/^\d{4}-(0[1-9]|1[0-2])/.test(end)) return [];
  const [sy, sm] = start.slice(0, 7).split('-').map(Number), [ey, em] = end.slice(0, 7).split('-').map(Number);
  const result: string[] = [];
  for (let n = sy * 12 + sm - 1; n <= ey * 12 + em - 1; n++) result.push(`${Math.floor(n / 12)}-${String(n % 12 + 1).padStart(2, '0')}`);
  return result;
}
const months = (i: ResearchInput) => monthsBetween(i.market.periodStart, i.market.periodEnd);
const endMonth = (i: ResearchInput) => i.market.periodEnd.slice(0, 7);
const units = (i: ResearchInput) => i.units.status === 'ok' ? i.units.data.records : [];
const revenues = (i: ResearchInput) => i.revenue.status === 'ok' ? i.revenue.data.records : [];
const coupons = (i: ResearchInput) => i.coupon.status === 'ok' ? i.coupon.data.records : [];
const unit = (i: ResearchInput, asin: string, month = endMonth(i)) => units(i).find((r) => r.asin === asin && r.month === month);
const revenue = (i: ResearchInput, asin: string, month = endMonth(i)) => revenues(i).find((r) => r.asin === asin && r.month === month);
const coupon = (i: ResearchInput, asin: string) => coupons(i).find((r) => r.asin === asin);
const latestPrice = (i: ResearchInput, asin: string) => [...units(i)].filter((r) => r.asin === asin && r.month <= endMonth(i) && num(r.price) !== null).sort((a, b) => (b.priceDate ?? b.month).localeCompare(a.priceDate ?? a.month))[0]?.price;
const priceCell = (i: ResearchInput, asin: string) => sourceCell(i.units, latestPrice(i, asin));

/** 汇总用父体字段每月只计一次；模块 1 的逐行原始取样单独保留。 */
export function deduplicateUnits(records: UnitRecord[]): UnitRecord[] {
  const seen = new Set<string>();
  const childParents = new Set(records.filter((r) => r.scope !== 'parent' && r.parentAsin).map((r) => `${r.month}:${r.parentAsin}`));
  return [...records].sort((a, b) => Number(a.units === null) - Number(b.units === null)).filter((r) => {
    // scope=parent 却缺父体身份时不能证明是否重复，不纳入汇总。
    if (r.scope === 'parent' && !r.parentAsin) return false;
    if (r.scope === 'parent' && childParents.has(`${r.month}:${r.parentAsin}`)) return false;
    const k = `${r.month}:${r.scope === 'parent' ? `parent:${r.parentAsin}` : `child:${r.asin}`}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}
const aggregateUnits = (i: ResearchInput, records: UnitRecord[]) => sourceCell(i.units, sum(deduplicateUnits(records).map((r) => r.units)));
const childUnits = (i: ResearchInput, asin: string, month = endMonth(i)) => {
  const r = unit(i, asin, month);
  return sourceCell(i.units, r?.scope === 'parent' ? null : r?.units);
};
const row = (columns: readonly string[], data: RawRow = {}, status: Status = 'missing', label?: string): ResearchRow => ({
  ...(label !== undefined && { label }), cells: Object.fromEntries(columns.map((key) => [key, cell(data[key], status)])),
});
function base(id: ModuleId, i: ResearchInput): ResearchModule {
  const schema = RESEARCH_SCHEMA[id];
  return {
    moduleId: id, moduleName: schema.moduleName, generatedAt: i.generatedAt, market: { ...i.market },
    sourceNotes: Object.fromEntries((['units', 'revenue', 'coupon'] as const).map((metric) => {
      const { source, status, demo, notice } = i[metric];
      return [metric, { source, status, demo, ...(notice && { notice }) }];
    })) as ResearchModule['sourceNotes'],
    notes: [], sections: schema.sections.map((s) => ({
      id: s.id, title: s.title, columns: [...s.columns],
      ...(s.summaryHeading && { summaryHeading: s.summaryHeading }),
      rows: s.rowLabels.length ? s.rowLabels.map((label) => row(s.columns, { ...i.observations?.[`${id}.${s.id}`]?.find((r) => r[s.columns[0]] === label), [s.columns[0]]: label }, 'missing', label)) : (i.observations?.[`${id}.${s.id}`] ?? [{}]).map((r) => row(s.columns, r)),
      ...(s.kind === 'dimensions' && { rows: [], dimensions: [] }),
    })),
  };
}
const section = (m: ResearchModule, id: string) => m.sections.find((s) => s.id === id)!;
function fill(m: ResearchModule, id: string, rows: RawRow[], status: Status = 'missing') {
  const s = section(m, id), labels = RESEARCH_SCHEMA[m.moduleId].sections.find((spec) => spec.id === id)!.rowLabels;
  s.rows = (rows.length ? rows : [{}]).map((r, n) => row(s.columns, r, status, labels[n]));
}
function items(m: ResearchModule, id: string, data: RawRow) {
  const s = section(m, id); s.rows = s.rows.map((r) => row(s.columns, { 项目: r.label, 内容: r.label! in data ? data[r.label!] : r.cells.内容 }, 'missing', r.label));
}
const NEW_DEFINITION = '上架月为统计月及前 5 个月；不查询父体最早上架日，不选择父体代表值。';
const THRESHOLDS = '品牌 CR3：<30% 低、30%—<50% 中、≥50% 高；链接/卖家 CR10：<45% 低、45%—<70% 中、≥70% 高。';
const STOCK_LIMIT = '报价中断仅为疑似断货线索，不能确认实物库存为零；新品报价不可用不能直接证明库存为零。';
const MISSING_REASON = '接口返回无该月记录，具体原因未披露';

export function mapMarketBackground(i: ResearchInput): ResearchModule {
  const m = base(1, i);
  items(m, 'title', { 市场名: `${i.market.site}｜${i.market.categoryName}` });
  const samples = months(i).map((month) => {
    const candidates = units(i).filter((r) => r.month === month);
    const selected = candidates.filter((r) => r.nodeId === i.market.categoryNodeId && r.rank !== undefined && r.rank >= 1 && r.rank <= 100);
    const rev = selected.map((r) => revenue(i, r.asin, month)?.revenue);
    return { month, selected, rev, candidates };
  });
  fill(m, 'sampling', samples.map(({ month, selected, rev, candidates }) => ({
    月份: month, 入选记录数: sourceCell(i.units, candidates.length ? selected.length : null),
    月销量合计: sourceCell(i.units, sum(selected.map((r) => r.units))),
    '月销售额合计（已知）': sourceCell(i.revenue, sum(rev)),
    金额字段完整率: sourceCell(i.revenue, selected.length ? rev.filter((v) => num(v) !== null).length / selected.length : null),
    销量缺失条数: sourceCell(i.units, selected.length ? selected.filter((r) => r.units === null).length : null),
    销售额缺失条数: sourceCell(i.revenue, selected.length ? rev.filter((v) => num(v) === null).length : null),
    无目标类目排名而未纳入的候选数: sourceCell(i.units, candidates.length ? candidates.filter((r) => r.nodeId !== i.market.categoryNodeId || r.rank === undefined).length : null),
    缺失说明: selected.length ? '只汇总已知字段；原始父体字段逐行保留，此表不作为父体去重后的市场销量。' : MISSING_REASON,
  })));
  const year = Number(endMonth(i).slice(0, 4));
  section(m, 'yoy').title = `${year}年较${year - 1}年（仅比较可比月份）`;
  fill(m, 'yoy', samples.filter((s) => s.month.startsWith(String(year)) && s.selected.length && samples.some((p) => p.month === `${year - 1}${s.month.slice(4)}` && p.selected.length)).map((s) => {
    const previous = samples.find((p) => p.month === `${year - 1}${s.month.slice(4)}`)!;
    const current = sum(s.selected.map((r) => r.units)), last = sum(previous.selected.map((r) => r.units));
    return { 月份: s.month, 本年销量: sourceCell(i.units, current), 上年销量: sourceCell(i.units, last), 同比: sourceCell(i.units, current !== null && last !== null && last > 0 ? current / last - 1 : null) };
  }));
  const scope = Object.fromEntries(BACKGROUND_SCOPE_ROWS.map((r) => [r, r]));
  Object.assign(scope, { '范围（站点；类目）': `${i.market.site}；${i.market.categoryName}`, 目标排名节点: i.market.categoryNodeId, 期间: `${i.market.periodStart}—${i.market.periodEnd}`, '新品定义（见总规则）': NEW_DEFINITION });
  items(m, 'scope', scope);
  items(m, 'persona', { 用户需求: cell(null, 'missing', '无人口特征数据，暂不能判断'), 正面反馈主题: null, 主要投诉主题: null });
  return m;
}

export function mapGoogleTrends(i: ResearchInput): ResearchModule {
  const m = base(2, i), t = i.trends;
  const title = `${i.market.site} ${i.market.query} 谷歌趋势分析`;
  section(m, 'title').title = title; items(m, 'title', { 标题: title });
  items(m, 'metadata', { 查询词: i.market.query, 国家: i.market.site, '类型（Google 网页搜索）': 'Google 网页搜索', 类别: i.market.categoryName, '时间范围（过去 5 年）': '过去 5 年', 采集日期: t?.collectedAt });
  m.notes.push('指数为 0—100 相对搜索热度，不等于搜索量、销量或购买力。');
  fill(m, 'regions', t?.regions ?? [], t ? 'missing' : 'unavailable');
  const weeks = [...(t?.weeks ?? [])].sort((a, b) => a.start.localeCompare(b.start));
  const validIndex = (n: number | null) => n !== null && n >= 0 && n <= 100 ? num(n) : null;
  fill(m, 'weeks', weeks.map((w) => ({ 五年周起始日: w.start, 热度指数: validIndex(w.index), '数据状态（完整周 / 未完整周 / 缺值）': validIndex(w.index) === null ? '缺值' : w.complete ? '完整周' : '未完整周', 曲线标签: w.label, 完整周指数: w.complete ? validIndex(w.index) : null })), t ? 'missing' : 'unavailable');
  const complete = weeks.filter((w) => w.complete && validIndex(w.index) !== null);
  const avg = (w: typeof complete) => w.length ? sum(w.map((v) => v.index))! / w.length : null;
  const last4 = complete.length >= 4 ? avg(complete.slice(-4)) : null, prev4 = complete.length >= 8 ? avg(complete.slice(-8, -4)) : null;
  const high = [...complete].sort((a, b) => b.index! - a.index!)[0], low = [...complete].sort((a, b) => a.index! - b.index!)[0];
  const point = (w: typeof high) => w ? { 日期: w.start, 指数: w.index } : null;
  items(m, 'stats', { 完整周数量: t ? complete.length : cell(null, 'unavailable'), 完整周均值: avg(complete), 最高完整周: point(high), 最低完整周: point(low), 最新完整周: point(complete.at(-1)!), '最近 4 周均值': last4, '此前 4 周均值': prev4, '近 4 周变化': last4 !== null && prev4 !== null && prev4 > 0 ? last4 / prev4 - 1 : null });
  items(m, 'method', { '来源 URL': t?.sourceUrl, 计算口径: '统计剔除未完整周及缺值；不足 4/8 个完整周时不计算相应窗口均值；指数不换算销量。' });
  return m;
}

export function competitionLevel(value: number | null): string | null {
  return value === null ? null : value < 3 ? '异常激烈' : value < 5 ? '较激烈' : value < 10 ? '一般' : value < 20 ? '不激烈' : '相对不饱和';
}
function keywordRows(i: ResearchInput): RawRow[] {
  return (i.keywords ?? []).map((k) => {
    const search = num(k.fields.月搜索量), count = num(k.fields.商品数);
    return { ...k.fields, 月购买量: sourceCell(i.units, k.purchases), 每日竞争程度: search !== null && count !== null && count > 0 ? search / count / 30 : null };
  });
}
export function mapKeywords(i: ResearchInput): ResearchModule {
  const m = base(3, i); fill(m, 'keywords', keywordRows(i)); return m;
}
export function mapAdDifficulty(i: ResearchInput): ResearchModule {
  const m = base(4, i), words = keywordRows(i);
  fill(m, 'words', words.map((r) => ({ ...r, 翻译: r.关键词翻译, 竞争程度分级: competitionLevel(num(r.每日竞争程度)), 广告轮播页数: cell(null, 'unavailable', '契约及参考源码未提供轮播页数经验阈值，待核实后启用。') })));
  const stats = (key: string): Value => {
    const known = words.filter((r) => num(r[key]) !== null), weighted = known.filter((r) => num(r.月搜索量) !== null && num(r.月搜索量)! >= 0);
    const weight = sum(weighted.map((r) => num(r.月搜索量)));
    return { 样本数: cell(known.length), 简单均值: cell(known.length ? sum(known.map((r) => num(r[key])))! / known.length : null), 搜索量加权均值: cell(ratio(sum(weighted.map((r) => num(r[key])! * num(r.月搜索量)!)), weight)) };
  };
  items(m, 'summary', { 词池规模: i.keywords ? words.length : null, 筛选说明: '使用模块 3 的完整词集合；缺数不补零。', 类目平均转化率预估: { 购买率: stats('购买率'), 前三ASIN转化总占比: stats('前三ASIN转化总占比') }, 判定口径全文: '每日竞争程度 = 月搜索量 ÷ 商品数 ÷ 30；<3 异常激烈；3至<5 较激烈；5至<10 一般；10至<20 不激烈；≥20 相对不饱和。属于需求/供给代理指标，不是官方竞争分数。广告轮播页数：原模板经验阈值未在契约及参考源码披露，暂为 unavailable，不推测。' });
  return m;
}

interface Group { name: string; amount: number }
function grouped(i: ResearchInput, month: string, by: 'brand' | 'seller', measure: 'units' | 'revenue' | 'listings'): Group[] {
  const records = measure === 'revenue' ? revenues(i).filter((r) => r.month === month).map((r) => ({ asin: r.asin, amount: r.revenue }))
    : (measure === 'listings' ? [...new Map(units(i).filter((r) => r.month === month && r.units !== null).map((r) => [r.asin, r])).values()] : deduplicateUnits(units(i).filter((r) => r.month === month && r.units !== null))).map((r) => ({ asin: r.asin, amount: measure === 'listings' ? 1 : r.units }));
  const groups = new Map<string, number>();
  for (const r of records) {
    const name = i.products.find((p) => p.asin === r.asin)?.[by];
    if (!name || num(r.amount) === null) continue;
    groups.set(name, (groups.get(name) ?? 0) + r.amount!);
  }
  return [...groups].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'zh-CN'));
}
function denominator(i: ResearchInput, month: string, measure: 'units' | 'revenue' | 'listings'): number | null {
  if (measure === 'revenue') return sum(revenues(i).filter((r) => r.month === month).map((r) => r.revenue));
  if (measure === 'listings') { const count = new Set(units(i).filter((r) => r.month === month && r.units !== null).map((r) => r.asin)).size; return count || null; }
  const rows = deduplicateUnits(units(i).filter((r) => r.month === month && r.units !== null));
  return sum(rows.map((r) => r.units));
}
export function concentrationLevel(value: number | null, seller = false): string | null {
  return value === null ? null : value < (seller ? .45 : .3) ? '低' : value < (seller ? .7 : .5) ? '中' : '高';
}
export function concentrationRows(i: ResearchInput): RawRow[] {
  return (['brand', 'seller'] as const).map((by) => {
    const r: RawRow = { 对象: by === 'brand' ? '品牌' : 'Buybox卖家' };
    for (const [measure, label] of [['units', '销量'], ['revenue', '销售额'], ['listings', 'Listing']] as const) {
      const values = grouped(i, endMonth(i), by, measure), total = denominator(i, endMonth(i), measure);
      const src = measure === 'revenue' ? i.revenue : i.units;
      for (const n of [3, 10]) r[`Top${n}${label}占比`] = sourceCell(src, ratio(sum(values.slice(0, n).map((g) => g.amount)), total));
    }
    const cr = num(r[by === 'brand' ? 'Top3销售额占比' : 'Top10销售额占比']);
    r.垄断率 = concentrationLevel(cr, by === 'seller');
    r.切入判断 = cr === null ? null : `${by === 'brand' ? '品牌 CR3' : '卖家 CR10'} 销售额口径集中度${r.垄断率}；需结合差异化与成本判断切入。`;
    return r;
  });
}
export function mapMarketOverview(i: ResearchInput): ResearchModule {
  const m = base(5, i);
  m.notes.push(`销量＝SIF购买量下限，销售额＝卖家精灵子体销售额；样本期 ${i.market.periodStart}—${i.market.periodEnd}；更新日 ${i.generatedAt.slice(0, 10)}。`);
  fill(m, 'monthly', months(i).map((month) => {
    const u = units(i).filter((r) => r.month === month), r = revenues(i).filter((r) => r.month === month);
    return { 月份: month, 月销量下限: aggregateUnits(i, u), 月销售额: sourceCell(i.revenue, sum(r.map((x) => x.revenue))), SIF有值ASIN: sourceCell(i.units, u.length ? new Set(u.filter((x) => x.units !== null).map((x) => x.asin)).size : null), 销售额有值ASIN: sourceCell(i.revenue, r.length ? new Set(r.filter((x) => x.revenue !== null).map((x) => x.asin)).size : null), 缺失说明: u.length && r.length ? '父体销量按月去重；仅汇总已知值，缺失不补零。' : MISSING_REASON };
  }));
  for (const [id, measure, column, share] of [['brandsUnits', 'units', 'SIF购买量下限', '销量占比'], ['brandsRevenue', 'revenue', '卖家精灵销售额', '销售额占比'], ['brandsListings', 'listings', 'Listing数', 'Listing占比']] as const) {
    fill(m, id, months(i).flatMap((month) => {
      const top = grouped(i, month, 'brand', measure).slice(0, 10), total = denominator(i, month, measure), src = measure === 'revenue' ? i.revenue : i.units;
      return [...top.map((g) => ({ 月份: month, 品牌: g.name, [column]: sourceCell(src, g.amount), [share]: sourceCell(src, ratio(g.amount, total)) })), { 月份: month, 品牌: 'top10合计', [column]: sourceCell(src, sum(top.map((g) => g.amount))), [share]: sourceCell(src, ratio(sum(top.map((g) => g.amount)), total)) }];
    }));
  }
  fill(m, 'concentration', concentrationRows(i));
  const tagNames = [...new Set(i.products.flatMap((p) => Object.keys(p.tags ?? {})))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  section(m, 'attributes').dimensions = tagNames.map((tag, n) => {
    const categories = [...new Set(i.products.map((p) => p.tags?.[tag]).filter((v) => v !== undefined && v !== null).map(String))].sort();
    const totalUnits = denominator(i, endMonth(i), 'units'), totalRevenue = denominator(i, endMonth(i), 'revenue');
    const data: RawRow[] = categories.map((category) => {
      const ps = i.products.filter((p) => p.tags?.[tag] != null && String(p.tags[tag]) === category), ids = new Set(ps.map((p) => p.asin));
      const us = sum(deduplicateUnits(units(i).filter((r) => r.scope !== 'parent' && ids.has(r.asin) && r.month === endMonth(i))).map((r) => r.units));
      const rev = sum(revenues(i).filter((r) => ids.has(r.asin) && r.month === endMonth(i)).map((r) => r.revenue));
      return { 分类: category, SIF月销量下限: sourceCell(i.units, us), 卖家精灵销售额: sourceCell(i.revenue, rev), Listing数: ps.length, 销量占比: sourceCell(i.units, ratio(us, totalUnits)), 销售额占比: sourceCell(i.revenue, ratio(rev, totalRevenue)), Listing占比: ratio(ps.length, i.products.length), 合计行: false };
    });
    data.push({ 分类: '合计', SIF月销量下限: sourceCell(i.units, sum(data.map((r) => num(r.SIF月销量下限)))), 卖家精灵销售额: sourceCell(i.revenue, sum(data.map((r) => num(r.卖家精灵销售额)))), Listing数: sum(data.map((r) => num(r.Listing数))), 销量占比: sourceCell(i.units, ratio(sum(data.map((r) => num(r.SIF月销量下限))), totalUnits)), 销售额占比: sourceCell(i.revenue, ratio(sum(data.map((r) => num(r.卖家精灵销售额))), totalRevenue)), Listing占比: ratio(sum(data.map((r) => num(r.Listing数))), i.products.length), 合计行: true });
    return { id: `dimension:${tag}`, title: `维度${n + 1}｜${tag}`, columns: ATTRIBUTE_COLUMNS, rows: data.map((r) => row(ATTRIBUTE_COLUMNS, r)) };
  });
  items(m, 'method', { 样本: `${i.market.site}｜${i.market.categoryName}｜${i.products.length} ASIN`, 销量: 'SIF购买量下限；父体字段按月去重，不重复累计。', 销售额: '卖家精灵子体销售额；不与 SIF 销量相除充当客单价。', 缺失原因: MISSING_REASON, 图表口径: '类别属性纳入全部分类，不合并其他；有序分组用柱形图；高基数数值属性条形图仅绘前 10 类。', 历史: `${i.market.periodStart}—${i.market.periodEnd}`, 'Top100 Listing占比': cell(null, 'unavailable', '当月 SIF 有值 ASIN 的品牌 Listing 份额；无历史 Top100 榜单，不计算历史 Top100 占比。'), 竞争阈值: THRESHOLDS, 来源: '销量 SIF；销售额 卖家精灵；优惠 Keepa（Dinzee keepa__*）', 更新: i.generatedAt });
  const s = section(m, 'asins');
  // 固定列 key 保留期末模板占位；显示标签由 renderer 展开。属性后再按月展开。
  s.columns = [...MARKET_ASIN_COLUMNS, ...tagNames.map((t) => `属性｜${t}`), ...months(i).flatMap((month) => [`${month} SIF购买量下限`, `${month} SIF缺失原因`, `${month} 卖家精灵销售额`, `${month} 销售额缺失原因`])];
  fill(m, 'asins', i.products.map((p) => {
    const u = unit(i, p.asin), r = revenue(i, p.asin), price = priceCell(i, p.asin);
    const values: RawRow = { ASIN: p.asin, 品牌: p.brand, 卖家名称: p.seller, 卖家类型: p.sellerType, 配送方式: p.fulfillment, 卖家国家: p.sellerCountry, 评分: p.rating, 评分数: p.ratings, 套装数: p.pack, 价格: price, '1个装价格': calc([price, cell(p.pack)], ratio), '{期末月} SIF购买量下限': sourceCell(i.units, u?.units), SIF缺失原因: u?.units != null ? cell(null, 'not_applicable') : u?.reason ?? MISSING_REASON, '{期末月} 卖家精灵销量(核对)': sourceCell(i.revenue, r?.verificationUnits), '{期末月} 销量差异率(核对)': calc([sourceCell(i.units, u?.units), sourceCell(i.revenue, r?.verificationUnits)], (a, b) => a > 0 ? (b - a) / a : null), '{期末月} 卖家精灵销售额': sourceCell(i.revenue, r?.revenue), 销售额缺失原因: r?.revenue != null ? cell(null, 'not_applicable') : r?.reason ?? MISSING_REASON, '所属类目（点击榜单）': p.category };
    tagNames.forEach((t) => { values[`属性｜${t}`] = p.tags?.[t]; });
    months(i).forEach((month) => {
      const um = unit(i, p.asin, month), rm = revenue(i, p.asin, month);
      Object.assign(values, { [`${month} SIF购买量下限`]: sourceCell(i.units, um?.units), [`${month} SIF缺失原因`]: um?.units != null ? cell(null, 'not_applicable') : um?.reason ?? MISSING_REASON, [`${month} 卖家精灵销售额`]: sourceCell(i.revenue, rm?.revenue), [`${month} 销售额缺失原因`]: rm?.revenue != null ? cell(null, 'not_applicable') : rm?.reason ?? MISSING_REASON });
    }); return values;
  }));
  return m;
}

function cards(m: ResearchModule, s: ResearchSection, i: ResearchInput, get: (p: Product) => RawRow, defaults: Status = 'missing') {
  const schema = RESEARCH_SCHEMA[m.moduleId].sections.find((x) => x.id === s.id)!;
  s.columns = ['项目', ...(i.products.length ? i.products.map((p) => p.asin) : ['{ASIN}'])];
  s.rows = schema.rowLabels.map((label) => row(s.columns, { 项目: label, ...Object.fromEntries(i.products.map((p) => [p.asin, get(p)[label]])) }, defaults, label));
}
export function mapCompetitors(i: ResearchInput): ResearchModule {
  const m = base(6, i);
  const get = (p: Product): RawRow => {
    const price = priceCell(i, p.asin), comparison = sourceCell(i.revenue, revenue(i, p.asin)?.comparisonPrice), u = unit(i, p.asin), c = coupon(i, p.asin);
    const fields: RawRow = { ...p.competitor, ASIN: p.asin, 商品序号: i.products.indexOf(p) + 1, 产品图片: p.image, 品牌: p.brand, 父ASIN: p.parentAsin, 履约方式: p.fulfillment, 卖家名称: p.seller, '卖家所在国（快照）': p.sellerCountry, '所属叶子类目 / 节点': p.category, 上架记录日: p.listedAt,
      '套装售价（SIF 最新可得）': price, 卖家精灵对照价: comparison, 差值: calc([price, comparison], (a, b) => a - b), 套装数: p.pack, 折算单只售价: calc([price, cell(p.pack)], ratio), '当前Coupon / 活动记录': sourceCell(i.coupon, c?.current), '历史父体月销量估算（套）': sourceCell(i.units, u?.parentUnits ?? (u?.scope === 'parent' ? u.units : null)), 近30天销量档位: sourceCell(i.units, u?.tier), 星级: p.rating, '评分人数（非文字评论数）': p.ratings,
      '变体购买量贡献 / 范围': childUnits(i, p.asin),
    };
    // 所有历史报价/活动/Keepa 图只由 Keepa 填充；调用方补充字段不得改变来源。
    COMPETITOR_GROUPS[4].rows.forEach((label) => { fields[label] = sourceCell(i.coupon, c?.history?.[label] as Value | undefined); });
    fields['站外促销证据'] = sourceCell(i.coupon, c?.history?.['站外促销证据'] as Value | undefined);
    p.notApplicable?.filter((label) => (COMPETITOR_GROUPS[3].rows as readonly string[]).includes(label)).forEach((label) => { fields[label] = cell(null, 'not_applicable'); });
    if (p.listedAt && !Number.isNaN(Date.parse(p.listedAt))) fields.上架天数 = Math.max(0, Math.floor((Date.parse(i.generatedAt) - Date.parse(p.listedAt)) / 86400000));
    return fields;
  };
  m.sections.forEach((s) => cards(m, s, i, get)); m.notes.push(STOCK_LIMIT);
  if (i.coupon.status !== 'ok') m.notes.push(TIME_MACHINE_TIP);
  return m;
}
export function mapQaReviews(i: ResearchInput): ResearchModule {
  const m = base(7, i);
  cards(m, section(m, 'analysis'), i, (p) => ({ ...p.qa, ASIN: p.asin, 商品图片: p.image, '品牌 / 父ASIN': { 品牌: cell(p.brand), 父ASIN: cell(p.parentAsin) }, '评分数 / 星级': { 评分数: cell(p.ratings), 星级: cell(p.rating) }, '首次上架 / 变体数': { 上架记录日: cell(p.listedAt), 变体数: cell(null) }, '整套价格 / 折合单只': { 整套价格: priceCell(i, p.asin), 折合单只: calc([priceCell(i, p.asin), cell(p.pack)], ratio) } }));
  return m;
}
export function mapTrafficCounts(i: ResearchInput): ResearchModule {
  const m = base(8, i), observed = i.observations?.['8.counts'] ?? [];
  fill(m, 'counts', (i.keywords ?? []).length ? i.keywords!.map((k, n) => ({ '#': n + 1, 关键词: k.fields.关键词, 翻译: k.fields.关键词翻译, ABA排名: k.fields.ABA排名, 搜索量: k.fields.月搜索量, 在售商品数: k.fields.商品数, 'ABA Top3集中度-点击': k.fields.点击集中度, 'ABA Top3集中度-转化': k.fields.前三ASIN转化总占比, ...observed.find((r) => r.关键词 === k.fields.关键词) })) : observed);
  return m;
}
export function mapAdvertisingProfit(i: ResearchInput): ResearchModule {
  const m = base(9, i); m.inputs = { 自定义毛利率: cell(i.grossMargin) };
  const observations = i.observations?.['9.profit'] ?? [];
  fill(m, 'profit', (i.keywords ?? []).map((k, n) => {
    const f = observations.find((r) => r.关键词 === k.fields.关键词) ?? {}, purchase = sourceCell(i.units, k.purchases);
    const r: RawRow = { ...f, '#': n + 1, 关键词: k.fields.关键词, 翻译: k.fields.关键词翻译, 搜索量: k.fields.月搜索量, 购买量: purchase };
    r.搜索转化率 = calc([purchase, cell(r.搜索量)], ratio);
    const cvr = calc([purchase, cell(r.点击量)], ratio); r.点击转化率 = cvr;
    for (const [tier, acos] of [['最低', '最低'], ['推荐', '均价'], ['最高', '最高']] as const) {
      const cpa = calc([cell(r[`建议竞价-${tier}`]), cvr], ratio); r[`CPA-${tier}`] = cpa;
      r[`ACOS-${acos}`] = calc([cpa, cell(r[`产品均价-${acos}`])], ratio);
      r[`广告盈亏预估-${tier}`] = calc([cell(r[`产品均价-${acos}`]), cell(i.grossMargin), cpa], (p, margin, cost) => p * margin - cost);
    }
    return r;
  }));
  m.notes.push('自定义毛利率按 0—1 输入；CPA=竞价÷点击转化率；ACOS=CPA÷相应价格；广告盈亏=价格×毛利率−CPA。购买量只取 SIF，同周期缺数不补零。');
  return m;
}
export function mapTrafficLandscape(i: ResearchInput): ResearchModule {
  const m = base(10, i), obs = i.observations?.['10.landscape'] ?? [];
  fill(m, 'landscape', i.products.map((p, n) => ({ ...obs.find((r) => r.ASIN === p.asin), '#': n + 1, ASIN: p.asin, 图片: p.image, 标题: p.title, 价格: priceCell(i, p.asin), 评论: p.ratings, 评分: p.rating, 子体月订单量: childUnits(i, p.asin) }))); return m;
}
export function mapLexicon(i: ResearchInput): ResearchModule {
  const m = base(11, i); fill(m, 'lexicon', i.observations?.['11.lexicon'] ?? []);
  m.notes.push('周搜索量与周 ABA 排名按原统计周保留，不把月搜索量换算为周搜索量。'); return m;
}

function evidenceModule(id: 12 | 15, i: ResearchInput): ResearchModule {
  const m = base(id, i), s = section(m, 'checks'), evidence = id === 12 ? i.compliance : i.ip;
  s.rows = s.rows.map((r) => {
    const e = evidence?.[r.label!];
    if (e?.notApplicable) return row(s.columns, {}, 'not_applicable', r.label);
    if (!e?.evidence?.trim()) return row(s.columns, {}, 'unavailable', r.label);
    return row(s.columns, { ...e.fields, 检查项: r.label, [id === 12 ? '证据' : '证据链接']: e.evidence }, 'missing', r.label);
  });
  m.notes.push(id === 12 ? '仅按已提供证据呈现；无证据 unavailable，不推断合规结论。' : '仅按检索证据呈现；无证据 unavailable，不推断侵权结论。'); return m;
}
export const mapCompliance = (i: ResearchInput) => evidenceModule(12, i);
export function mapMonopoly(i: ResearchInput): ResearchModule {
  const m = base(13, i); fill(m, 'concentration', concentrationRows(i)); m.notes.push(THRESHOLDS, '垄断率按品牌 CR3 / 卖家 CR10 的销售额份额分级；未知身份保留在分母，不参与头部排名。'); return m;
}
export function isNewProduct(listedAt: string | undefined, month: string): boolean | null {
  if (!listedAt || !/^\d{4}-(0[1-9]|1[0-2])(?:-|$)/.test(listedAt) || Number.isNaN(Date.parse(listedAt))) return null;
  const [y, mo] = month.split('-').map(Number), [ly, lm] = listedAt.slice(0, 7).split('-').map(Number);
  const age = y * 12 + mo - ly * 12 - lm;
  return age < 0 ? null : age <= 5;
}
export function mapNewProducts(i: ResearchInput): ResearchModule {
  const m = base(14, i);
  const summary = (month: string) => {
    const fresh = i.products.filter((p) => isNewProduct(p.listedAt, month) === true), mature = i.products.filter((p) => isNewProduct(p.listedAt, month) === false);
    const selected = (ps: Product[]) => units(i).filter((r) => r.scope !== 'parent' && ps.some((p) => p.asin === r.asin) && r.month === month);
    const rev = (ps: Product[]) => sum(revenues(i).filter((r) => ps.some((p) => p.asin === r.asin) && r.month === month).map((r) => r.revenue));
    const freshUnits = aggregateUnits(i, selected(fresh));
    return { fresh, mature, freshUnits, freshRevenue: sourceCell(i.revenue, rev(fresh)), matureUnits: aggregateUnits(i, selected(mature)), matureRevenue: sourceCell(i.revenue, rev(mature)), share: calc([freshUnits, aggregateUnits(i, units(i).filter((r) => r.month === month))], ratio) };
  };
  const last = summary(endMonth(i));
  items(m, 'summary', { '新品 Listing 数': i.products.length ? last.fresh.length : null, '成熟 Listing 数': i.products.length ? last.mature.length : null, '新品 SIF购买量下限及占比': last.freshUnits.status === 'ok' ? { 下限: last.freshUnits, 占比: last.share } : last.freshUnits, 新品销售额及占比: last.freshRevenue.status === 'ok' ? { 销售额: last.freshRevenue, 占比: sourceCell(i.revenue, ratio(num(last.freshRevenue), denominator(i, endMonth(i), 'revenue'))) } : last.freshRevenue, 覆盖说明: `上架日期未知或晚于统计月的记录不归为成熟品；期末未知 ${i.products.length - last.fresh.length - last.mature.length} 条。` });
  fill(m, 'monthly', months(i).map((month) => {
    const s = summary(month); return { 月份: month, 新品Listing数: i.products.length ? s.fresh.length : null, 新品销量下限: s.freshUnits, 新品销售额: s.freshRevenue, 成熟销量下限: s.matureUnits, 成熟销售额: s.matureRevenue, 新品销量占比: s.share };
  }));
  fill(m, 'asins', i.products.map((p) => ({ ASIN: p.asin, 品牌: p.brand, 上架记录日: p.listedAt, 上架月: p.listedAt?.slice(0, 7), 是否新品: isNewProduct(p.listedAt, endMonth(i)), SIF购买量下限: childUnits(i, p.asin), 销售额: sourceCell(i.revenue, revenue(i, p.asin)?.revenue), 评分: p.rating, 评分数: p.ratings })));
  items(m, 'method', Object.fromEntries(NEW_PRODUCT_RULES.map((r) => [r, r.startsWith('新品') ? NEW_DEFINITION : '不查询父体最早上架日，不选择父体代表值。']))); return m;
}
export const mapIntellectualProperty = (i: ResearchInput) => evidenceModule(15, i);
export function mapProfit(i: ResearchInput): ResearchModule {
  const m = base(16, i);
  fill(m, 'profit', i.products.map((p) => {
    const costs = i.costs?.[p.asin] ?? {}, price = priceCell(i, p.asin), after = sourceCell(i.coupon, coupon(i, p.asin)?.afterPrice);
    const gross = calc([after, ...['采购成本', '头程', 'FBA配送费', '平台佣金', '其他费用'].map((k) => cell(costs[k]))], (sale, ...expenses) => sale - expenses.reduce((a, b) => a + b, 0));
    const cpa = cell(costs['广告CPA（可引用模块 9 推荐档）']), profit = calc([gross, cpa], (a, b) => a - b);
    return { ...costs, ASIN: p.asin, '套装售价（SIF）': price, 卖家精灵对照价: sourceCell(i.revenue, revenue(i, p.asin)?.comparisonPrice), Coupon后价格: after, 套装数: p.pack, 折算单只售价: calc([price, cell(p.pack)], ratio), 自定义毛利率: costs.自定义毛利率 ?? i.grossMargin, 毛利额: gross, 广告后利润: profit, 广告后利润率: calc([profit, after], ratio) };
  }));
  m.notes.push('金额按站点本币、同套装口径填写；缺少成本不计算利润。Coupon后价格只取 Keepa；未确认无优惠时不以现价代替。'); return m;
}

export const MODULE_MAPPERS: Record<ModuleId, (i: ResearchInput) => ResearchModule> = {
  1: mapMarketBackground, 2: mapGoogleTrends, 3: mapKeywords, 4: mapAdDifficulty, 5: mapMarketOverview,
  6: mapCompetitors, 7: mapQaReviews, 8: mapTrafficCounts, 9: mapAdvertisingProfit, 10: mapTrafficLandscape,
  11: mapLexicon, 12: mapCompliance, 13: mapMonopoly, 14: mapNewProducts, 15: mapIntellectualProperty, 16: mapProfit,
};
export const mapResearch = (input: ResearchInput): ResearchModule[] => MODULE_CATALOG.map((s) => MODULE_MAPPERS[s.moduleId](input));
