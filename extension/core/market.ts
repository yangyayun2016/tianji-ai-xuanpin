import type { Benchmark, BenchType, Classified, FormGroup, PriceBand, Product } from './types';

const DAY = 86400000;
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** 标题归一：小写、去符号、取前 6 个词，用来识别同一款产品的重复链接（颜色/尺码拆开上架） */
export function titleKey(p: Pick<Product, 'brand' | 'title'>): string {
  const words = p.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^\d+(pcs|pack|count|ct|oz|in|inch|ft|lb)?$/.test(w));
  return `${p.brand.toLowerCase().trim()}|${words.slice(0, 6).join(' ')}`;
}

/**
 * 去重：同品牌、标题前 6 个词相同、价格相差 ≤ 15% 视为同一款（颜色/尺码拆开上架），保留销量最高的那条。
 * 卖家精灵商品列表没有稳定的父体字段，用这个近似（AI+MCP 选品实战：实测约 14% 是重复）。
 */
export function dedupe(products: Product[]): { kept: Product[]; duplicates: string[] } {
  const clusters: Product[][] = [];
  const byKey = new Map<string, Product[][]>();
  for (const p of [...products].sort((a, b) => b.units - a.units)) {
    const k = titleKey(p);
    const list = byKey.get(k) ?? [];
    const hit = list.find((c) => Math.abs(c[0].price - p.price) <= Math.max(c[0].price, p.price) * 0.15);
    if (hit) hit.push(p);
    else {
      const c = [p];
      list.push(c);
      clusters.push(c);
      byKey.set(k, list);
    }
  }
  const keep = new Set(clusters.map((c) => c[0].asin));
  return { kept: products.filter((p) => keep.has(p.asin)), duplicates: products.filter((p) => !keep.has(p.asin)).map((p) => p.asin) };
}

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** 按形态分组并做三条质检（组内均价收敛、没有一组吞掉一半样本、每组至少 30 条） */
export function buildGroups(products: Product[], classified: Record<string, Classified>): FormGroup[] {
  const main = products.filter((p) => classified[p.asin] && !classified[p.asin].accessory);
  const totalUnits = main.reduce((a, p) => a + p.units, 0) || 1;
  const by = new Map<string, Product[]>();
  for (const p of main) {
    const f = classified[p.asin].form || '其他';
    by.set(f, [...(by.get(f) ?? []), p]);
  }
  return [...by.entries()]
    .map(([form, ps]) => {
      const prices = ps.map((p) => p.price).filter((x) => x > 0).sort((a, b) => a - b);
      const p20 = quantile(prices, 0.2);
      const p80 = quantile(prices, 0.8);
      return {
        form,
        asins: ps.map((p) => p.asin),
        count: ps.length,
        unitsShare: round((ps.reduce((a, p) => a + p.units, 0) / totalUnits) * 100),
        avgPrice: prices.length ? round(prices.reduce((a, b) => a + b, 0) / prices.length, 2) : 0,
        minPrice: prices[0] ?? 0,
        maxPrice: prices[prices.length - 1] ?? 0,
        qa: { priceConverged: p20 > 0 ? p80 / p20 <= 3 : true, notDominant: ps.length <= main.length / 2 || by.size === 1, enoughSample: ps.length >= 30 },
      };
    })
    .sort((a, b) => b.unitsShare - a.unitsShare);
}

/** 区间宽度：约切成 6–8 段，至少 2 美元，取 1/2/3/5/10/20/50 这样的整数 */
export function autoBandWidth(prices: number[]): number {
  const s = prices.filter((x) => x > 0).sort((a, b) => a - b);
  const span = quantile(s, 0.9) - quantile(s, 0.1);
  const raw = Math.max(2, span / 7);
  return [2, 3, 5, 10, 20, 50, 100].find((w) => w >= raw) ?? 100;
}

/**
 * 价格区间切割（竞卖调研篇）：每个区间算销量占比、单均市占、区间垄断度、评论占比，
 * 销量占比明显高于评论占比 = 近期热销新品；反过来 = 老品盘踞。
 */
export function buildBands(products: Product[], myPrice: number, width = autoBandWidth(products.map((p) => p.price))): PriceBand[] {
  const ps = products.filter((p) => p.price > 0);
  if (!ps.length) return [];
  const totalUnits = ps.reduce((a, p) => a + p.units, 0) || 1;
  const totalRatings = ps.reduce((a, p) => a + p.ratings, 0) || 1;
  const start = Math.floor(Math.min(...ps.map((p) => p.price)) / width) * width;
  const end = Math.max(...ps.map((p) => p.price));
  const bands: PriceBand[] = [];
  for (let from = start; from <= end; from += width) {
    const to = from + width;
    const inBand = ps.filter((p) => p.price >= from && p.price < to);
    if (!inBand.length) continue;
    const units = inBand.reduce((a, p) => a + p.units, 0);
    const top3 = [...inBand].sort((a, b) => b.units - a.units).slice(0, 3).reduce((a, p) => a + p.units, 0);
    const unitsShare = (units / totalUnits) * 100;
    const ratingsShare = (inBand.reduce((a, p) => a + p.ratings, 0) / totalRatings) * 100;
    let signal: PriceBand['signal'] = '';
    if (unitsShare >= 5 && unitsShare >= ratingsShare * 1.3) signal = '近期热销';
    else if (ratingsShare >= 5 && ratingsShare >= unitsShare * 1.3) signal = '老品盘踞';
    bands.push({
      from,
      to,
      count: inBand.length,
      unitsShare: round(unitsShare),
      avgShare: round(unitsShare / inBand.length, 2),
      top3Share: units ? round((top3 / units) * 100) : 0,
      ratingsShare: round(ratingsShare),
      signal,
      mine: myPrice >= from && myPrice < to,
    });
  }
  return bands;
}

/**
 * 挑对标爆款（用户《竞品爆款反向拆解模板》的“爆款选取标准”）：
 * 新品快速起量（≤180 天、评论 ≤100、月销 ≥1000）、稳定增长（180–365 天、评论 100–500）、
 * 头部常青（销量最高的老链接）、同价位对手（我所在价格区间里卖得最好的）。原则：可学习、可超越。
 */
export function pickBenchmarks(products: Product[], me: string, myBand: PriceBand | undefined, now = Date.now(), max = 6): Benchmark[] {
  const pool = products.filter((p) => p.asin !== me && p.units > 0).sort((a, b) => b.units - a.units);
  const age = (p: Product) => (p.availableDate ? (now - p.availableDate) / DAY : Infinity);
  const out: Benchmark[] = [];
  const used = new Set<string>();
  const take = (p: Product | undefined, type: BenchType, reason: string) => {
    if (!p || used.has(p.asin) || out.length >= max) return;
    used.add(p.asin);
    out.push({ asin: p.asin, type, reason });
  };
  pool
    .filter((p) => age(p) <= 180 && p.ratings <= 100 && p.units >= 1000)
    .slice(0, 2)
    .forEach((p) => take(p, '新品快速起量', `上架 ${Math.round(age(p))} 天、评论 ${p.ratings}、月销 ${p.units}`));
  pool
    .filter((p) => age(p) > 180 && age(p) <= 365 && p.ratings >= 100 && p.ratings <= 500)
    .slice(0, 1)
    .forEach((p) => take(p, '稳定增长', `上架 ${Math.round(age(p))} 天、评论 ${p.ratings}、月销 ${p.units}`));
  if (myBand) {
    pool
      .filter((p) => p.price >= myBand.from && p.price < myBand.to)
      .slice(0, 1)
      .forEach((p) => take(p, '同价位对手', `同在 $${myBand.from}–${myBand.to} 区间、月销 ${p.units}`));
  }
  for (const p of pool) take(p, '头部常青', `细分市场月销第 ${pool.indexOf(p) + 1}、月销 ${p.units}`);
  return out;
}
