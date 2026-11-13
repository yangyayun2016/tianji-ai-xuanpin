import { describe, expect, it } from 'vitest';
import { buildBands, buildGroups, dedupe, pickBenchmarks } from './market';
import { attrRows, buildGaps } from './matrix';
import { aspectStats, monthKey, samples } from './reviews';
import { fbaFee, normalizeHypotheses, parseDims, parseWeightLb, scoreHypothesis, unitEconomics } from './score';
import { DEFAULT_COST, DEFAULT_WEIGHTS, type Aspect, type GapItem, type Product, type Review, type ReviewTag } from './types';

const P = (asin: string, o: Partial<Product> = {}): Product => ({ rank: 1, asin, title: `Brand Cat Fountain ${asin}`, brand: 'B', imageUrl: '', price: 20, units: 100, revenue: 0, rating: 4.5, ratings: 100, availableDate: null, variations: 1, fulfillment: 'FBA', dimension: '', weight: '', sellerName: '', ...o });
const DAY = 86400000;

describe('切市场', () => {
  it('同品牌 + 标题前 6 词相同视为重复，保留销量高的', () => {
    const a = P('A', { title: 'Veken Cat Water Fountain 2.5L Quiet Pump Black', brand: 'Veken', units: 500 });
    const b = P('B', { title: 'Veken Cat Water Fountain 2.5L Quiet Pump White', brand: 'Veken', units: 900 });
    const c = P('C', { title: 'Catit Flower Fountain', brand: 'Catit' });
    const r = dedupe([a, b, c]);
    expect(r.kept.map((p) => p.asin)).toEqual(['B', 'C']);
    expect(r.duplicates).toEqual(['A']);
  });

  it('分组剔除配件，并做三条质检', () => {
    const ps = [...Array.from({ length: 40 }, (_, i) => P(`m${i}`, { price: 20 + (i % 5) })), P('acc', { price: 9 }), ...Array.from({ length: 5 }, (_, i) => P(`g${i}`, { price: 10 }))];
    const cls = Object.fromEntries(ps.map((p) => [p.asin, { asin: p.asin, accessory: p.asin === 'acc', form: p.asin.startsWith('g') ? '重力' : '插电' }]));
    const g = buildGroups(ps, cls);
    expect(g[0].form).toBe('插电');
    expect(g[0].count).toBe(40);
    expect(g[0].qa.enoughSample).toBe(true);
    expect(g[0].qa.notDominant).toBe(false);
    expect(g[1].qa.enoughSample).toBe(false);
    expect(g.flatMap((x) => x.asins)).not.toContain('acc');
  });

  it('价格区间：单均市占、垄断度、近期热销信号', () => {
    const ps = [P('a', { price: 10, units: 100, ratings: 1000 }), P('b', { price: 11, units: 100, ratings: 1000 }), P('c', { price: 21, units: 800, ratings: 100 })];
    const bands = buildBands(ps, 21.5, 5);
    const hot = bands.find((b) => b.from === 20)!;
    expect(hot.mine).toBe(true);
    expect(hot.unitsShare).toBe(80);
    expect(hot.avgShare).toBe(80);
    expect(hot.top3Share).toBe(100);
    expect(hot.signal).toBe('近期热销');
    expect(bands.find((b) => b.from === 10)!.signal).toBe('老品盘踞');
  });

  it('对标按用户的爆款选取标准分类型，排除自己', () => {
    const now = Date.now();
    const ps = [P('me', { units: 5000 }), P('new', { units: 1500, ratings: 50, availableDate: now - 90 * DAY }), P('grow', { units: 1200, ratings: 300, availableDate: now - 300 * DAY }), P('head', { units: 9000, ratings: 9000, availableDate: now - 2000 * DAY })];
    const b = pickBenchmarks(ps, 'me', undefined, now, 3);
    expect(b.map((x) => [x.asin, x.type])).toEqual([
      ['new', '新品快速起量'],
      ['grow', '稳定增长'],
      ['head', '头部常青'],
    ]);
  });
});

const aspects: Aspect[] = [
  { id: 'noise', name: '噪音', desc: '', death: '基础体验', fix: '需供应链配合', stage: '日常使用' },
  { id: 'clean', name: '清洗', desc: '', death: '基础体验', fix: '低成本结构件', stage: '清洁维护' },
];

function mkReviews(asin: string, n: number, noise: number, clean: number) {
  const reviews: Review[] = [];
  const tags: Record<string, ReviewTag> = {};
  for (let i = 0; i < n; i++) {
    const id = `${asin}#${i}`;
    reviews.push({ id, asin, star: 1, title: '', content: '', date: new Date(2026, i % 3, 5).getTime() });
    const a: ReviewTag['aspects'] = [];
    if (i < noise) a.push({ a: 'noise', p: -1 });
    if (i < clean) a.push({ a: 'clean', p: -1 });
    tags[id] = { id, aspects: a, spam: false };
  }
  return { reviews, tags };
}

describe('差评死法', () => {
  it('区分本品独有和品类共性，提及率由程序计数', () => {
    const me = mkReviews('me', 40, 16, 12);
    const b1 = mkReviews('b1', 40, 1, 10);
    const b2 = mkReviews('b2', 40, 2, 12);
    const reviews = [...me.reviews, ...b1.reviews, ...b2.reviews];
    const tags = { ...me.tags, ...b1.tags, ...b2.tags };
    const s = samples(reviews, tags, ['me', 'b1', 'b2'], 30);
    expect(s.every((x) => x.enough)).toBe(true);
    const stats = aspectStats(reviews, tags, aspects, 'me', ['b1', 'b2'], s);
    const noise = stats.find((x) => x.aspect === 'noise')!;
    const clean = stats.find((x) => x.aspect === 'clean')!;
    expect(noise.mineNegRate).toBe(0.4);
    expect(noise.scope).toBe('本品独有');
    expect(clean.scope).toBe('品类共性');
    expect(noise.quotes[0].startsWith('me#')).toBe(true);
  });

  it('疑似恶意差评不计入样本', () => {
    const { reviews, tags } = mkReviews('me', 10, 0, 0);
    tags['me#0'].spam = true;
    expect(samples(reviews, tags, ['me'], 30)[0]).toMatchObject({ neg: 9, spam: 1, enough: false });
  });

  it('月份用本地日期', () => {
    expect(monthKey(new Date(2026, 0, 1, 0, 30).getTime())).toBe('2026-01');
  });
});

describe('属性矩阵与差距矩阵', () => {
  it('lift 和空白格、四象限归类', () => {
    const ps = Array.from({ length: 10 }, (_, i) => P(`p${i}`, { units: i < 2 ? 1000 : 100 }));
    const attrs: Record<string, Record<string, string[]>> = Object.fromEntries(ps.map((p, i) => [p.asin, { function: i < 2 ? ['水位窗'] : [], material: i < 7 ? ['不锈钢'] : ['塑料'] }]));
    attrs.me = { material: ['塑料'], function: ['夜灯'] };
    const rows = attrRows([...ps, P('me', { units: 100 })], attrs, ['p0', 'p1', 'p2'], 'me');
    const level = rows.find((r) => r.value === '水位窗')!;
    expect(level.gap).toBe(true);
    expect(level.inBench).toBe(2);
    const gaps = buildGaps(rows, [], [], 3);
    expect(gaps.find((g) => g.item === '不锈钢')?.quadrant).toBe('他有我无');
    expect(gaps.find((g) => g.item === '夜灯')?.quadrant).toBe('他无我有');
    expect(gaps.find((g) => g.item === '水位窗')?.quadrant).toBe('他有我无');
  });

  it('只有我一家用的材质不算优势', () => {
    const ps = Array.from({ length: 10 }, (_, i) => P(`p${i}`));
    const attrs: Record<string, Record<string, string[]>> = Object.fromEntries(ps.map((p) => [p.asin, { material: ['不锈钢'] }]));
    attrs.me = { material: ['塑料'] };
    const gaps = buildGaps(attrRows([...ps, P('me')], attrs, [], 'me'), [], [], 0);
    expect(gaps.some((g) => g.item === '塑料')).toBe(false);
  });
});

describe('成本与 FBA', () => {
  it('解析尺寸和重量', () => {
    expect(parseDims('9.1 x 8.3 x 6.6 inches')).toEqual([9.1, 8.3, 6.6]);
    expect(parseDims('20 x 10 x 2 cm')![0]).toBeCloseTo(7.874, 2);
    expect(parseWeightLb('12 ounces')).toBe(0.75);
    expect(parseWeightLb('500 grams')).toBeCloseTo(1.102, 2);
  });

  it('尺寸分段与下一档提示', () => {
    expect(fbaFee([10, 8, 0.5], 0.4).tier).toBe('小号标准');
    const large = fbaFee([9.1, 8.3, 6.6], 2.1);
    expect(large.tier).toBe('大号标准');
    expect(large.shippingLb).toBeCloseTo(3.59, 2);
    // 离小号标准太远，不给“改到 0.75 英寸”这种做不到的建议
    expect(large.nextTierHint).not.toContain('小号标准');
    expect(fbaFee([16, 11, 0.8], 0.9).nextTierHint).toContain('可进入小号标准');
    const bulky = fbaFee([20, 10, 6], 5);
    expect(bulky.tier).toBe('大号大件');
    expect(bulky.nextTierHint).toContain('最长边');
  });

  it('单件利润，缺采购价时提示', () => {
    const u = unitEconomics(25.99, '9.1 x 8.3 x 6.6 inches', '2.1 pounds', DEFAULT_COST);
    expect(u.missing).toEqual(['采购价']);
    const u2 = unitEconomics(25.99, '9.1 x 8.3 x 6.6 inches', '2.1 pounds', { ...DEFAULT_COST, purchaseCny: 45, packCny: 3 });
    expect(u2.profit).toBeLessThan(u.profit);
  });
});

describe('方案校验与评分', () => {
  const gaps: GapItem[] = [{ id: 'g1', quadrant: '他有我劣', dim: '差评', item: '噪音', evidence: '', strength: 90 }];
  const raw = {
    items: [
      { lever: '解决一个高频差评', title: '换静音泵', change: '换无刷泵', evidence: ['g1'], level: '补及格线', need: '体验', judge: { perceivable: true, costDelta: '中', priceUpliftPct: 8, mold: false, cert: false, moatLayers: 1, sizeChange: '不变' } },
      { lever: '加部件', title: '加灯加折叠', change: '加夜灯同时可折叠', evidence: ['g9'] },
      { lever: '乱写', title: 'x', change: 'y' },
      { lever: '解决一个高频差评', title: '换静音泵', change: '重复' },
    ],
  };
  it('只保留杠杆库里的方案，去重，标出多变量和无证据', () => {
    const hs = normalizeHypotheses(raw, gaps);
    expect(hs).toHaveLength(2);
    expect(hs[1].issues).toEqual(['没有对应的差距证据', '改动里疑似包含多个变量，建议拆开测试']);
  });
  it('评分看短板，无门槛方案复制门槛低', () => {
    const [h] = normalizeHypotheses(raw, gaps);
    const s = scoreHypothesis(h, { gaps, baseShare: 1, price: 25.99 }, DEFAULT_WEIGHTS);
    expect(s.dims.demand).toBe(90);
    expect(s.dims.moat).toBe(20);
    expect(s.weakest).toBe('moat');
    expect(s.notes.join()).toContain('7–15 天');
  });
});
