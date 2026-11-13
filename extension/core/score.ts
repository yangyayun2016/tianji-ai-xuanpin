import {
  LEVERS,
  NEED_LEVELS,
  SCORE_DIMS,
  type CostInputs,
  type GapItem,
  type Hypothesis,
  type Lever,
  type PriceBand,
  type Score,
  type ScoreDim,
  type UnitEconomics,
  type Weights,
} from './types';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

// ───────────── 尺寸、重量、FBA ─────────────

/** "3.94 x 3.94 x 3.53 inches" / "10 x 8 x 2 cm" → 英寸，从大到小排 */
export function parseDims(s: string): [number, number, number] | null {
  const nums = (s.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  if (nums.length < 3) return null;
  const k = /\bcm|centimet/i.test(s) ? 1 / 2.54 : /\bmm|millimet/i.test(s) ? 1 / 25.4 : 1;
  return nums
    .slice(0, 3)
    .map((n) => n * k)
    .sort((a, b) => b - a) as [number, number, number];
}

/** "12 ounces" / "1.2 pounds" / "500 grams" / "0.5 kg" → 磅 */
export function parseWeightLb(s: string): number | null {
  const m = s.match(/(\d+(\.\d+)?)\s*(ounces?|oz|pounds?|lbs?|grams?|g\b|kilograms?|kg)/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[3].toLowerCase();
  if (u.startsWith('o')) return n / 16;
  if (u.startsWith('p') || u.startsWith('lb')) return n;
  if (u.startsWith('k')) return n * 2.2046;
  return n / 453.6;
}

/**
 * 美国站 FBA 配送费（非旺季、非服装）参考表，按年核对后可在设置里改。
 * 小号标准：≤ 15×12×0.75 英寸且 ≤ 16 盎司；大号标准：≤ 18×14×8 英寸且 ≤ 20 磅；
 * 大号大件：最长边 ≤ 59 英寸且 ≤ 50 磅。大号标准及以上按 max(实重, 体积重 = 长×宽×高/139) 计费。
 */
export const FBA_TABLE = {
  small: [
    [2 / 16, 3.06],
    [4 / 16, 3.15],
    [6 / 16, 3.24],
    [8 / 16, 3.33],
    [10 / 16, 3.43],
    [12 / 16, 3.53],
    [14 / 16, 3.6],
    [1, 3.65],
  ],
  large: [
    [4 / 16, 3.68],
    [8 / 16, 3.9],
    [12 / 16, 4.15],
    [1, 4.55],
    [1.25, 4.99],
    [1.5, 5.37],
    [1.75, 5.52],
    [2, 5.77],
    [2.25, 5.87],
    [2.5, 6.05],
    [2.75, 6.21],
    [3, 6.62],
  ],
  /** 大号标准 3 磅以上：基础 + 每 4 盎司加价 */
  largeOver3: { base: 6.92, per4oz: 0.08 },
  bulky: { base: 9.61, perLb: 0.38 },
} as const;

export interface FbaResult {
  tier: '小号标准' | '大号标准' | '大号大件' | '超大件';
  shippingLb: number;
  fee: number;
  nextTierHint: string;
}

export function fbaFee(dims: [number, number, number], weightLb: number): FbaResult {
  const [l, w, h] = dims;
  const dimWeight = (l * w * h) / 139;
  if (l <= 15 && w <= 12 && h <= 0.75 && weightLb <= 1) {
    const fee = FBA_TABLE.small.find(([lim]) => weightLb <= lim)![1];
    return { tier: '小号标准', shippingLb: r2(weightLb), fee, nextTierHint: '已是最小档' };
  }
  const ship = Math.max(weightLb, dimWeight);
  const smallHint = reachHint([
    [l, 15, '最长边', '英寸'],
    [w, 12, '次长边', '英寸'],
    [h, 0.75, '最短边', '英寸'],
    [weightLb * 16, 16, '重量', '盎司'],
  ], '小号标准');
  if (l <= 18 && w <= 14 && h <= 8 && ship <= 20) {
    let fee: number;
    if (ship <= 3) fee = FBA_TABLE.large.find(([lim]) => ship <= lim)![1];
    else fee = FBA_TABLE.largeOver3.base + Math.ceil((ship - 3) * 4) * FBA_TABLE.largeOver3.per4oz;
    // 计费重量刚好跨过某一档时，提示压缩体积能省多少
    const step = ship <= 3 ? FBA_TABLE.large.find(([lim]) => ship <= lim)! : null;
    const prev = step ? FBA_TABLE.large[FBA_TABLE.large.indexOf(step) - 1] : null;
    const weightHint = prev && dimWeight > weightLb && ship - prev[0] < 0.25 ? `计费重量 ${r2(ship)} 磅（体积重为主），体积缩小 ${Math.ceil(((ship - prev[0]) / ship) * 100)}% 可降一档，省 $${r2(fee - prev[1])}` : '';
    return { tier: '大号标准', shippingLb: r2(ship), fee: r2(fee), nextTierHint: [smallHint, weightHint].filter(Boolean).join('；') || '离下一档较远' };
  }
  if (l <= 59 && ship <= 50) {
    const hint = reachHint([
      [l, 18, '最长边', '英寸'],
      [w, 14, '次长边', '英寸'],
      [h, 8, '最短边', '英寸'],
    ], '大号标准（折叠 / 平板化 / 套叠）');
    return {
      tier: '大号大件',
      shippingLb: r2(ship),
      fee: r2(FBA_TABLE.bulky.base + Math.max(0, Math.ceil(ship) - 1) * FBA_TABLE.bulky.perLb),
      nextTierHint: hint || '离下一档较远',
    };
  }
  return { tier: '超大件', shippingLb: r2(ship), fee: 0, nextTierHint: '超大件费率差异大，请按后台实际费用核对' };
}

/** 只有每项超出都在 20% 以内时才提示“改到多少能降档”，否则是改不到的 */
function reachHint(items: [number, number, string, string][], target: string): string {
  const over = items.filter(([v, lim]) => v > lim);
  if (!over.length || over.some(([v, lim]) => v > lim * 1.2)) return '';
  return `${over.map(([v, lim, name, unit]) => `${name} ${r2(v)}→${lim} ${unit}`).join('、')} 可进入${target}`;
}

/** 单件利润：售价 − 佣金 − FBA − 采购 − 包装 − 头程 − 广告 − 退货损失 */
export function unitEconomics(price: number, dimText: string, weightText: string, c: CostInputs): UnitEconomics {
  const missing: string[] = [];
  const dims = parseDims(dimText);
  const lb = parseWeightLb(weightText);
  if (!dims) missing.push('尺寸');
  if (lb == null) missing.push('重量');
  if (!c.purchaseCny) missing.push('采购价');
  const fba = dims && lb != null ? fbaFee(dims, lb) : null;
  const shipKg = fba ? fba.shippingLb / 2.2046 : 0;
  const landed = (c.purchaseCny + c.packCny + c.freightCnyPerKg * shipKg) / (c.fx || 7);
  const fee = fba?.fee ?? 0;
  const profit = price - price * (c.commissionPct / 100) - fee - landed - price * (c.adPct / 100) - price * (c.returnPct / 100);
  return {
    tier: fba?.tier ?? '未知',
    fba: fee,
    shippingLb: fba?.shippingLb ?? 0,
    landed: r2(landed),
    profit: r2(profit),
    margin: price ? Math.round((profit / price) * 1000) / 10 : 0,
    nextTierHint: fba?.nextTierHint ?? '',
    missing,
  };
}

// ───────────── 升级方案校验 ─────────────

const str = (v: unknown) => String(v ?? '').trim();
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
/** 一个方案里出现多个“改动连接词”，多半是一次改了好几样 */
const MULTI_CHANGE = /(同时|并且|以及|再加|外加|还有|\+)/;

/**
 * 程序校验 AI 给的方案：杠杆必须在杠杆库里、证据必须指向真实的差距项、
 * 唯一变量不能写成“同时改 A 和 B”，同杠杆同标题去重。
 */
export function normalizeHypotheses(raw: unknown, gaps: GapItem[]): Hypothesis[] {
  const items = (raw as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) return [];
  const gapIds = new Set(gaps.map((g) => g.id));
  const seen = new Set<string>();
  const out: Hypothesis[] = [];
  for (const it of items) {
    const o = (it ?? {}) as Record<string, unknown>;
    const lever = str(o.lever) as Lever;
    const title = str(o.title);
    const change = str(o.change);
    if (!LEVERS.includes(lever) || !title || !change) continue;
    const key = `${lever}|${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const issues: string[] = [];
    const evidence = strs(o.evidence).filter((e) => gapIds.has(e));
    if (!evidence.length) issues.push('没有对应的差距证据');
    if (MULTI_CHANGE.test(change)) issues.push('改动里疑似包含多个变量，建议拆开测试');
    const j = (o.judge ?? {}) as Record<string, unknown>;
    const cost = str(j.costDelta);
    const size = str(j.sizeChange);
    const need = str(o.need);
    out.push({
      id: `h${out.length + 1}`,
      lever,
      title,
      change,
      keep: strs(o.keep).slice(0, 4),
      persona: str(o.persona),
      scene: str(o.scene),
      pitch: str(o.pitch),
      evidence,
      level: str(o.level) === '补及格线' ? '补及格线' : '真差异化',
      need: (NEED_LEVELS as readonly string[]).includes(need) ? (need as Hypothesis['need']) : '功能',
      verify: str(o.verify),
      judge: {
        perceivable: j.perceivable !== false,
        costDelta: cost === '高' ? '高' : cost === '中' ? '中' : '低',
        priceUpliftPct: clamp(Number(j.priceUpliftPct) || 0, 0, 100),
        mold: j.mold === true,
        cert: j.cert === true,
        moatLayers: clamp(Math.round(Number(j.moatLayers) || 0), 0, 5),
        sizeChange: size === '变小' ? '变小' : size === '变大' ? '变大' : '不变',
      },
      issues,
    });
  }
  return out;
}

// ───────────── 评分 ─────────────

/** 增加成本的估算（美元/件）：低 0.3、中 1、高 3 */
const COST_USD = { 低: 0.3, 中: 1, 高: 3 } as const;

/**
 * 七维评分，全部由程序算，AI 只提供方案自身的判断项（是否开模、增本档位、可提价幅度等）。
 * 看短板不看总分：weakest 是得分最低的维度。
 */
export function scoreHypothesis(h: Hypothesis, ctx: { gaps: GapItem[]; band?: PriceBand; baseShare: number; price: number; fit?: number }, weights: Weights): Score {
  const notes: string[] = [];
  const ev = ctx.gaps.filter((g) => h.evidence.includes(g.id));
  const demand = ev.length ? Math.max(...ev.map((g) => g.strength)) : 10;
  if (!ev.length) notes.push('无证据支撑，需求分按 10 计');

  let position = 50;
  if (ctx.band) {
    const ratio = ctx.baseShare ? ctx.band.avgShare / ctx.baseShare : 1;
    position = clamp(40 + ratio * 30 - Math.max(0, ctx.band.top3Share - 60));
    if (ctx.band.signal === '近期热销') position = clamp(position + 10);
    if (ctx.band.signal === '老品盘踞') position = clamp(position - 10);
  }
  if (h.level === '补及格线') position = clamp(position - 10);

  const uplift = (ctx.price * h.judge.priceUpliftPct) / 100;
  const ratio = uplift / COST_USD[h.judge.costDelta];
  let value = clamp(ratio * 30);
  if (!h.judge.perceivable) {
    value = clamp(value - 40);
    notes.push('三秒内看不懂差异，感知价值打折');
  }

  const cost = h.judge.sizeChange === '变小' ? 90 : h.judge.sizeChange === '不变' ? 60 : 25;

  let moat = h.judge.moatLayers * 20;
  if (h.level === '补及格线') moat = Math.min(moat, 40);
  if (!h.judge.mold && h.judge.moatLayers <= 1) {
    moat = Math.min(moat, 20);
    notes.push('不开模、门槛低，同行 7–15 天可复刻');
  }
  if (ctx.price > 0 && ctx.price < 15 && !h.judge.mold) {
    moat = clamp(moat - 15);
    notes.push('低价且无门槛，易被铺货公司抓取跟进');
  }

  const risk = clamp(100 - (h.judge.mold ? 30 : 0) - (h.judge.cert ? 30 : 0) - (h.judge.costDelta === '高' ? 15 : 0));
  const fit = clamp(ctx.fit ?? 60);

  const dims: Record<ScoreDim, number> = { demand: Math.round(demand), position: Math.round(position), value: Math.round(value), cost, moat: Math.round(moat), risk: Math.round(risk), fit: Math.round(fit) };
  const wsum = SCORE_DIMS.reduce((a, d) => a + (weights[d] || 0), 0) || 1;
  const total = Math.round(SCORE_DIMS.reduce((a, d) => a + dims[d] * (weights[d] || 0), 0) / wsum);
  const weakest = SCORE_DIMS.reduce((a, d) => (dims[d] < dims[a] ? d : a), SCORE_DIMS[0]);
  if (h.issues.length) notes.push(...h.issues);
  return { dims, total, weakest, notes };
}
