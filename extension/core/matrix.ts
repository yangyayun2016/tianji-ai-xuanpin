import { ATTR_DIMS, ATTR_DIM_NAMES, type AspectStat, type Aspect, type AttrDim, type AttrRow, type GapItem, type Product, type ProductAttrs } from './types';

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const clean = (s: unknown) =>
  String(s ?? '')
    .trim()
    .replace(/[。，,.;；]$/, '');

/** 校验 AI 抽取的属性：只认六个维度、每维最多 4 个、每个 ≤ 12 字 */
export function normalizeAttrs(raw: unknown, valid: Set<string>): Record<string, ProductAttrs> {
  const out: Record<string, ProductAttrs> = {};
  const items = (raw as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) return out;
  for (const it of items) {
    const o = (it ?? {}) as Record<string, unknown>;
    const asin = String(o.asin ?? '');
    if (!valid.has(asin)) continue;
    const attrs: ProductAttrs = {};
    for (const d of ATTR_DIMS) {
      const vals = (Array.isArray(o[d]) ? (o[d] as unknown[]) : []).map(clean).filter((v) => v && v.length <= 12);
      if (vals.length) attrs[d] = [...new Set(vals)].slice(0, 4);
    }
    out[asin] = attrs;
  }
  return out;
}

/** 同义词归并：mapping[维度][原词] = 标准词 */
export function applyMapping(attrs: Record<string, ProductAttrs>, mapping: Partial<Record<AttrDim, Record<string, string>>>): Record<string, ProductAttrs> {
  const out: Record<string, ProductAttrs> = {};
  for (const [asin, a] of Object.entries(attrs)) {
    const n: ProductAttrs = {};
    for (const d of ATTR_DIMS) {
      const vals = (a[d] ?? []).map((v) => mapping[d]?.[v] ?? v);
      if (vals.length) n[d] = [...new Set(vals)];
    }
    out[asin] = n;
  }
  return out;
}

/**
 * 属性矩阵（Dreamer：属性出现频次 × 销量交叉，做市场填空）：
 * lift = 销量占比 / 产品占比；lift ≥ 1.3 且产品占比 ≤ 25% 且至少 2 个产品 → 空白格（有需求、供给少）
 */
export function attrRows(products: Product[], attrs: Record<string, ProductAttrs>, bench: string[], mine: string): AttrRow[] {
  const ps = products.filter((p) => attrs[p.asin]);
  const n = ps.length || 1;
  const totalUnits = ps.reduce((a, p) => a + p.units, 0) || 1;
  const rows: AttrRow[] = [];
  for (const dim of ATTR_DIMS) {
    const values = new Set(ps.flatMap((p) => attrs[p.asin][dim] ?? []));
    for (const value of values) {
      const has = ps.filter((p) => attrs[p.asin][dim]?.includes(value));
      if (has.length < 2 && !attrs[mine]?.[dim]?.includes(value)) continue;
      const productShare = (has.length / n) * 100;
      const unitsShare = (has.reduce((a, p) => a + p.units, 0) / totalUnits) * 100;
      const lift = productShare ? unitsShare / productShare : 0;
      const prices = has.map((p) => p.price).filter((x) => x > 0);
      rows.push({
        dim,
        value,
        products: has.length,
        productShare: round(productShare),
        unitsShare: round(unitsShare),
        lift: round(lift, 2),
        inBench: bench.filter((b) => attrs[b]?.[dim]?.includes(value)).length,
        avgPrice: prices.length ? round(prices.reduce((a, b) => a + b, 0) / prices.length, 2) : 0,
        mine: !!attrs[mine]?.[dim]?.includes(value),
        gap: lift >= 1.3 && productShare <= 25 && has.length >= 2,
      });
    }
  }
  return rows.sort((a, b) => b.unitsShare - a.unitsShare);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const UNIQUE_OK = new Set<AttrDim>(['function', 'structure', 'scene', 'persona']);

/**
 * 差距矩阵：我 vs 元素地图。
 * 他有我无：半数以上对标具备、或销量拉动明显且普及（lift ≥ 1.2、产品占比 ≥ 30%），我没有
 * 他无我有：我具备而市场产品占比 < 15%；以及差评维度上“我的优势”
 * 他有我劣：差评“本品独有”的维度
 * 都没有：差评“品类共性”的维度 + 属性空白格（有需求、供给少、我也没有）
 */
export function buildGaps(rows: AttrRow[], stats: AspectStat[], aspects: Aspect[], benchCount: number): GapItem[] {
  const out: Omit<GapItem, 'id'>[] = [];
  const name = new Map(aspects.map((a) => [a.id, a.name]));
  const bc = Math.max(1, benchCount);
  for (const r of rows) {
    const label = ATTR_DIM_NAMES[r.dim];
    if (!r.mine && (r.inBench / bc >= 0.5 || (r.lift >= 1.2 && r.productShare >= 30))) {
      out.push({ quadrant: '他有我无', dim: label, item: r.value, evidence: `${r.inBench}/${benchCount} 个对标具备；产品占比 ${r.productShare}%、销量占比 ${r.unitsShare}%`, strength: Math.min(100, Math.round(Math.max((r.inBench / bc) * 100, r.unitsShare))) });
    } else if (r.mine && r.productShare < 15 && (r.products >= 3 ? r.lift >= 0.8 : UNIQUE_OK.has(r.dim))) {
      // 样本够时要求“具备它的产品卖得不差”；只有我一两家有时，材质/尺寸无法判断好坏，不当优势
      out.push({ quadrant: '他无我有', dim: label, item: r.value, evidence: `只有 ${r.productShare}% 的产品具备（${r.products} 个）——检查主图和五点有没有讲出来`, strength: Math.round(100 - r.productShare * 4) });
    } else if (r.gap && !r.mine) {
      out.push({ quadrant: '都没有', dim: `属性空白·${label}`, item: r.value, evidence: `只有 ${r.productShare}% 的产品具备，却拿走 ${r.unitsShare}% 的销量（lift ${r.lift}）`, strength: Math.min(100, Math.round(r.lift * 40)) });
    }
  }
  for (const s of stats) {
    const item = name.get(s.aspect) ?? s.aspect;
    if (s.scope === '本品独有') out.push({ quadrant: '他有我劣', dim: '差评', item, evidence: `我的差评提及率 ${pct(s.mineNegRate)}，对标平均 ${pct(s.benchNegRate)}`, strength: Math.min(100, Math.round(s.mineNegRate * 300)) });
    else if (s.scope === '品类共性') out.push({ quadrant: '都没有', dim: '差评', item, evidence: `对标平均差评提及率 ${pct(s.benchNegRate)}，我 ${pct(s.mineNegRate)}——全品类都没解决`, strength: Math.min(100, Math.round(Math.max(s.benchNegRate, s.mineNegRate) * 300)) });
    else if (s.scope === '我的优势') out.push({ quadrant: '他无我有', dim: '口碑', item, evidence: `对标平均差评提及率 ${pct(s.benchNegRate)}，我只有 ${pct(s.mineNegRate)}——可以做成卖点`, strength: Math.min(100, Math.round(s.benchNegRate * 300)) });
  }
  return out.sort((a, b) => b.strength - a.strength).map((g, i) => ({ ...g, id: `g${i + 1}` }));
}
