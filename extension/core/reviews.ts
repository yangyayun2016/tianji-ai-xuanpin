import type { Aspect, AspectStat, AsinSample, Review, ReviewTag, Scope } from './types';

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** 每个 ASIN 的有效样本：剔除疑似恶意差评；文字差评不足门槛只报数、不下结论 */
export function samples(reviews: Review[], tags: Record<string, ReviewTag>, asins: string[], minNeg: number): AsinSample[] {
  return asins.map((asin) => {
    const own = reviews.filter((r) => r.asin === asin);
    const spam = own.filter((r) => tags[r.id]?.spam).length;
    const valid = own.filter((r) => !tags[r.id]?.spam);
    const neg = valid.filter((r) => r.star <= 3).length;
    return { asin, neg, pos: valid.filter((r) => r.star >= 4).length, spam, enough: neg >= minNeg };
  });
}

/**
 * 标签统计全部由程序计数：
 * - 差评提及率 = 该 ASIN 提到此问题（负向）的 1–3 星评论数 / 有效 1–3 星评论数
 * - 好评提及率 = 提到此点（正向）的 4–5 星评论数 / 有效 4–5 星评论数
 * - 本品独有：我 ≥10% 且 ≥ 对标均值 2 倍；品类共性：半数以上对标 ≥10% 且我也 ≥10%；
 *   我的优势：半数以上对标 ≥10% 而我 <5%
 * - 一致性：同一维度被夸占比在 30%–70% 且提及 ≥10 次 → 体验两极
 */
export function aspectStats(reviews: Review[], tags: Record<string, ReviewTag>, aspects: Aspect[], mine: string, bench: string[], sample: AsinSample[]): AspectStat[] {
  const valid = reviews.filter((r) => tags[r.id] && !tags[r.id].spam);
  const bySample = new Map(sample.map((s) => [s.asin, s]));
  const asins = [mine, ...bench];
  return aspects
    .map((a) => {
      const perAsin: AspectStat['perAsin'] = {};
      let pos = 0;
      let neg = 0;
      const quotes: { id: string; mine: boolean }[] = [];
      for (const asin of asins) {
        const own = valid.filter((r) => r.asin === asin);
        const n = own.filter((r) => r.star <= 3 && tags[r.id].aspects.some((x) => x.a === a.id && x.p === -1)).length;
        const p = own.filter((r) => r.star >= 4 && tags[r.id].aspects.some((x) => x.a === a.id && x.p === 1)).length;
        const s = bySample.get(asin);
        perAsin[asin] = { neg: n, pos: p, negRate: s?.neg ? r3(n / s.neg) : 0, posRate: s?.pos ? r3(p / s.pos) : 0 };
        for (const r of own) {
          for (const x of tags[r.id].aspects) {
            if (x.a !== a.id) continue;
            if (x.p === 1) pos++;
            else {
              neg++;
              quotes.push({ id: r.id, mine: asin === mine });
            }
          }
        }
      }
      const mineNegRate = perAsin[mine]?.negRate ?? 0;
      const benchRates = bench.filter((b) => (bySample.get(b)?.neg ?? 0) > 0).map((b) => perAsin[b].negRate);
      const benchNegRate = benchRates.length ? r3(benchRates.reduce((x, y) => x + y, 0) / benchRates.length) : 0;
      const benchHigh = benchRates.filter((x) => x >= 0.1).length;
      const half = Math.max(1, Math.ceil(benchRates.length / 2));
      let scope: Scope = '';
      if (mineNegRate >= 0.1 && mineNegRate >= benchNegRate * 2) scope = '本品独有';
      else if (benchHigh >= half && mineNegRate >= 0.1) scope = '品类共性';
      else if (benchHigh >= half && mineNegRate < 0.05) scope = '我的优势';
      const total = pos + neg;
      const praiseShare = total ? r3(pos / total) : 0;
      return {
        aspect: a.id,
        perAsin,
        mineNegRate,
        benchNegRate,
        scope,
        praiseShare,
        polarized: total >= 10 && praiseShare >= 0.3 && praiseShare <= 0.7,
        quotes: [...quotes.filter((q) => q.mine), ...quotes.filter((q) => !q.mine)].slice(0, 6).map((q) => q.id),
      };
    })
    .sort((x, y) => Math.max(y.mineNegRate, y.benchNegRate) - Math.max(x.mineNegRate, x.benchNegRate));
}

/** 本地日期的 yyyy-MM（不用 toISOString，东八区会差一天） */
export function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthlyNeg(reviews: Review[], asins: string[]): Record<string, { month: string; neg: number }[]> {
  const out: Record<string, { month: string; neg: number }[]> = {};
  for (const asin of asins) {
    const m = new Map<string, number>();
    for (const r of reviews) if (r.asin === asin && r.star <= 3 && r.date) m.set(monthKey(r.date), (m.get(monthKey(r.date)) ?? 0) + 1);
    out[asin] = [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, neg]) => ({ month, neg }));
  }
  return out;
}

/** 校验 AI 打的标签：只保留存在的评论和标签体系里的维度 */
export function normalizeTags(raw: unknown, validIds: Set<string>, aspectIds: Set<string>): Record<string, ReviewTag> {
  const out: Record<string, ReviewTag> = {};
  const items = (raw as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) return out;
  for (const it of items) {
    const o = (it ?? {}) as Record<string, unknown>;
    const id = String(o.id ?? '');
    if (!validIds.has(id)) continue;
    const aspects = (Array.isArray(o.aspects) ? o.aspects : [])
      .map((x) => (x ?? {}) as Record<string, unknown>)
      .filter((x) => aspectIds.has(String(x.a)))
      .map((x) => ({ a: String(x.a), p: (Number(x.p) < 0 ? -1 : 1) as 1 | -1 }));
    out[id] = { id, aspects: dedupeAspects(aspects), spam: o.spam === true };
  }
  return out;
}

function dedupeAspects(list: { a: string; p: 1 | -1 }[]) {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = `${x.a}${x.p}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
