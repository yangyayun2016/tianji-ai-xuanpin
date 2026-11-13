import { buildBands, buildGroups, dedupe, pickBenchmarks } from '@/core/market';
import { applyMapping, attrRows, buildGaps, normalizeAttrs } from '@/core/matrix';
import { normalizeAspects, normalizeClassified, normalizeElement, normalizeForms, normalizeMapping } from '@/core/normalize';
import { attrMergePrompt, attrsPrompt, classifyPrompt, elementPrompt, formsPrompt, hypothesesPrompt, tagPrompt, taxonomyPrompt } from '@/core/prompts';
import { aspectStats, monthlyNeg, normalizeTags, samples } from '@/core/reviews';
import { normalizeHypotheses, scoreHypothesis } from '@/core/score';
import { ATTR_DIMS, type Classified, type CostInputs, type Product, type ProductAttrs, type Report, type Review, type ReviewTag, type Score, type Weights } from '@/core/types';
import type { Limits } from '@/utils/storage';
import { chunk, pool, type AiApi } from './ai';
import { marketId, type KnowledgeBase } from './kb';
import { categoryTop, fetchReviews, productDetail, resolveNode, type SellerSpriteApi } from './sellersprite';

export interface Deps {
  ss: SellerSpriteApi;
  ai: AiApi;
  kb: KnowledgeBase | null;
  limits: Limits;
  weights: Weights;
  cost: CostInputs;
  autoSync: boolean;
  progress: (msg: string) => void;
  now?: number;
}

const usage = (d: Deps, r?: Report) => ({ sellersprite: (r?.usage.sellersprite ?? 0) + d.ss.calls, ai: (r?.usage.ai ?? 0) + d.ai.calls, tokens: (r?.usage.tokens ?? 0) + d.ai.tokens });

/**
 * 第一阶段：切市场。跑完停下来，让人确认“我真正所在的细分市场”（形态组、增删 ASIN），
 * 再跑第二阶段。所有后续分析都以确认后的样本为准。
 */
export async function runMarket(asin: string, d: Deps): Promise<Report> {
  d.progress('① 读取我的产品和类目节点…');
  const me = await productDetail(d.ss, asin);
  const node = await resolveNode(d.ss, me);
  d.progress(`① 拉取类目 TOP${d.limits.topN}（${node.nodeLabelPath || node.nodeIdPath}）…`);
  let top = await categoryTop(d.ss, node.nodeIdPath, d.limits.topN);
  if (!top.some((p) => p.asin === asin)) {
    top = [...top, { rank: top.length + 1, asin, title: me.title, brand: me.brand, imageUrl: me.imageUrl, price: me.price, units: 0, revenue: 0, rating: me.rating, ratings: me.ratings, availableDate: me.availableDate, variations: me.variations, fulfillment: '', dimension: me.dimensions, weight: me.weight, sellerName: me.sellerName }];
  }
  const { kept: rawKept, duplicates } = dedupe(top);
  const kept = rawKept.some((p) => p.asin === asin) ? rawKept : [...rawKept, top.find((p) => p.asin === asin)!];

  d.progress('① AI 从标题反推形态组…');
  let forms = normalizeForms(await d.ai.run(formsPrompt(me, kept)));
  if (!forms.length) forms = [{ name: '主体', desc: '未能自动区分形态' }];

  d.progress(`① AI 逐条判断配件和形态（${kept.length} 个）…`);
  const valid = new Set(kept.map((p) => p.asin));
  const classified: Record<string, Classified> = {};
  const batches = chunk(kept, 25);
  let done = 0;
  await pool(batches, 4, async (b) => {
    Object.assign(classified, normalizeClassified(await d.ai.run(classifyPrompt(forms, b)), valid, forms));
    d.progress(`① 判断形态 ${(done += b.length)}/${kept.length}`);
  });
  for (const p of kept) classified[p.asin] ??= { asin: p.asin, accessory: false, form: '其他' };
  // 我的产品一定不是配件（否则后面没有样本）
  classified[asin] = { ...classified[asin], accessory: false };
  const myForm = classified[asin].form;

  const report: Report = {
    id: `r${Date.now()}`,
    createdAt: Date.now(),
    asin,
    marketplace: 'US',
    stage: 'market',
    me,
    top: kept,
    classified,
    market: {
      nodeIdPath: node.nodeIdPath,
      nodeLabelPath: node.nodeLabelPath,
      fetched: top.length,
      deduped: kept.length,
      duplicates,
      accessories: kept.filter((p) => classified[p.asin].accessory).map((p) => p.asin),
      forms,
      groups: [],
      myForm,
      asins: [],
      bands: [],
      bandWidth: 0,
      baseShare: 0,
    },
    attrs: {},
    attrRows: [],
    benchmarks: [],
    details: { [asin]: me },
    elements: {},
    review: null,
    gaps: [],
    hypotheses: [],
    scores: {},
    cost: d.cost,
    fit: {},
    weights: d.weights,
    warnings: duplicates.length ? [`按“同品牌 + 标题前 6 词”去重，剔除 ${duplicates.length} 条重复链接（${Math.round((duplicates.length / top.length) * 100)}%）`] : [],
    usage: usage(d),
  };
  return applyMarketEdit(report, {});
}

/** 人工调整细分市场：换形态组、改配件判定、增删 ASIN。纯函数，重算分组、价格区间 */
export function applyMarketEdit(r: Report, e: { form?: string; toggleAccessory?: string; include?: string; exclude?: string }): Report {
  const classified = { ...r.classified };
  if (e.toggleAccessory && classified[e.toggleAccessory] && e.toggleAccessory !== r.asin) {
    classified[e.toggleAccessory] = { ...classified[e.toggleAccessory], accessory: !classified[e.toggleAccessory].accessory };
  }
  const myForm = e.form ?? r.market.myForm;
  if (e.form) classified[r.asin] = { ...classified[r.asin], form: e.form };
  if (e.include && classified[e.include]) classified[e.include] = { ...classified[e.include], form: myForm, accessory: false };
  if (e.exclude && classified[e.exclude] && e.exclude !== r.asin) classified[e.exclude] = { ...classified[e.exclude], form: classified[e.exclude].form === myForm ? '其他' : classified[e.exclude].form };
  const groups = buildGroups(r.top, classified);
  const asins = groups.find((g) => g.form === myForm)?.asins ?? [r.asin];
  const products = r.top.filter((p) => asins.includes(p.asin));
  const bands = buildBands(products, r.me.price);
  return {
    ...r,
    classified,
    market: {
      ...r.market,
      accessories: r.top.filter((p) => classified[p.asin].accessory).map((p) => p.asin),
      groups,
      myForm,
      asins,
      bands,
      bandWidth: bands.length ? bands[0].to - bands[0].from : 0,
      baseShare: products.length ? Math.round((100 / products.length) * 100) / 100 : 0,
    },
  };
}

const marketProducts = (r: Report): Product[] => r.top.filter((p) => r.market.asins.includes(p.asin));

/** 第二阶段：对标 → 元素 → 属性矩阵 → 差评死法 → 差距矩阵 → 升级方案 → 评分 → 写知识库 */
export async function runDiagnosis(input: Report, d: Deps): Promise<Report> {
  const r: Report = { ...input, warnings: [...input.warnings], details: { ...input.details } };
  const products = marketProducts(r);
  const myBand = r.market.bands.find((b) => b.mine);
  if (products.length < 30) r.warnings.push(`细分市场只有 ${products.length} 个产品（< 30），比率类指标只能定性参考`);

  d.progress('④ 挑选对标爆款…');
  r.benchmarks = pickBenchmarks(products, r.asin, myBand, d.now ?? Date.now(), d.limits.benchMax);
  const bench = r.benchmarks.map((b) => b.asin);
  await pool(bench, 3, async (a) => {
    try {
      r.details[a] = await productDetail(d.ss, a);
    } catch (e) {
      r.warnings.push(`读取对标 ${a} 详情失败：${(e as Error).message}`);
    }
  });

  // ── 属性矩阵 ──
  const attrTargets = [...products].sort((a, b) => b.units - a.units).slice(0, 150);
  if (!attrTargets.some((p) => p.asin === r.asin)) attrTargets.push(products.find((p) => p.asin === r.asin) ?? r.top.find((p) => p.asin === r.asin)!);
  d.progress(`④ AI 抽取属性（${attrTargets.length} 个产品）…`);
  const valid = new Set(attrTargets.map((p) => p.asin));
  let attrs: Record<string, ProductAttrs> = {};
  let done = 0;
  await pool(chunk(attrTargets, 15), 4, async (b) => {
    const raw = await d.ai.run(attrsPrompt(b.map((p) => ({ asin: p.asin, title: p.title, features: r.details[p.asin]?.features }))));
    Object.assign(attrs, normalizeAttrs(raw, valid));
    d.progress(`④ 抽取属性 ${(done += b.length)}/${attrTargets.length}`);
  });
  const values: Record<string, string[]> = {};
  for (const dim of ATTR_DIMS) values[dim] = [...new Set(Object.values(attrs).flatMap((a) => a[dim] ?? []))];
  d.progress('④ 归并同义属性…');
  attrs = applyMapping(attrs, normalizeMapping(await d.ai.run(attrMergePrompt(values))));
  r.attrs = attrs;
  r.attrRows = attrRows(attrTargets, attrs, bench, r.asin);

  // ── 元素卡 ──
  d.progress('④ AI 拆解爆款元素（标题 + 五点 + 主图）…');
  const units = new Map(r.top.map((p) => [p.asin, p]));
  r.elements = {};
  await pool([r.asin, ...bench].filter((a) => r.details[a]), 3, async (a) => {
    const p = units.get(a);
    r.elements[a] = normalizeElement(await d.ai.run(elementPrompt(r.details[a], p?.price ?? r.details[a].price, p?.units ?? 0, a === r.asin)), a);
  });

  // ── 差评 ──
  const asins = [r.asin, ...bench];
  d.progress(`⑤ 拉取评论（${asins.length} 个 ASIN，每个差评 ${d.limits.negPerAsin} 条、好评 ${d.limits.posPerAsin} 条）…`);
  const reviews: Review[] = [];
  await pool(asins, 2, async (a) => {
    try {
      reviews.push(...(await fetchReviews(d.ss, a, [1, 2, 3], d.limits.negPerAsin, 'n')), ...(await fetchReviews(d.ss, a, [4, 5], d.limits.posPerAsin, 'p')));
    } catch (e) {
      r.warnings.push(`拉取 ${a} 评论失败：${(e as Error).message}`);
    }
  });

  let aspects = null as ReturnType<typeof normalizeAspects> | null;
  let fromKb = false;
  if (d.kb) {
    try {
      aspects = await d.kb.getTagScheme(marketId(r));
      fromKb = !!aspects;
      if (fromKb) d.progress('⑤ 复用知识库里已锁定的本市场标签体系');
    } catch (e) {
      r.warnings.push(`读取知识库标签体系失败，改为重新生成：${(e as Error).message}`);
    }
  }
  if (!aspects) {
    d.progress('⑤ AI 建立本市场的差评标签体系…');
    const sample = asins.flatMap((a) => [...reviews.filter((x) => x.asin === a && x.star <= 3).slice(0, 25), ...reviews.filter((x) => x.asin === a && x.star >= 4).slice(0, 5)]);
    aspects = normalizeAspects(await d.ai.run(taxonomyPrompt(sample)));
  }
  const aspectIds = new Set(aspects.map((a) => a.id));
  const ids = new Set(reviews.map((x) => x.id));
  const tags: Record<string, ReviewTag> = {};
  done = 0;
  if (aspects.length) {
    await pool(chunk(reviews, 20), 4, async (b) => {
      Object.assign(tags, normalizeTags(await d.ai.run(tagPrompt(aspects!, b)), ids, aspectIds));
      d.progress(`⑤ 评论打标 ${(done += b.length)}/${reviews.length}`);
    });
  } else r.warnings.push('没能建立差评标签体系，跳过差评分析');
  const sample = samples(reviews, tags, asins, d.limits.minNeg);
  for (const s of sample) if (!s.enough) r.warnings.push(`${s.asin === r.asin ? '我的产品' : s.asin} 有效差评只有 ${s.neg} 条（< ${d.limits.minNeg}），相关比率只报数、不下结论`);
  const stats = aspectStats(reviews, tags, aspects, r.asin, bench, sample);
  r.review = { aspects, fromKb, samples: sample, stats, monthly: monthlyNeg(reviews, asins), reviews, tags };

  // ── 差距矩阵 + 方案 ──
  d.progress('⑥ 计算差距矩阵…');
  r.gaps = buildGaps(r.attrRows, stats, aspects, bench.length);
  const names = new Map(aspects.map((a) => [a.id, a.name]));
  const keep = stats
    .filter((s) => Object.values(s.perAsin).some((x) => x.posRate >= 0.15))
    .slice(0, 5)
    .map((s) => names.get(s.aspect) ?? s.aspect);
  d.progress('⑦ AI 生成单变量升级方案…');
  r.hypotheses = normalizeHypotheses(
    await d.ai.run(
      hypothesesPrompt({
        me: r.me,
        mine: r.elements[r.asin],
        gaps: r.gaps.slice(0, 30),
        keep,
        benchPitches: bench.map((a) => r.elements[a]?.realPitch).filter(Boolean),
        transferable: [...new Set(bench.flatMap((a) => r.elements[a]?.transferable ?? []))].slice(0, 12),
      }),
    ),
    r.gaps,
  );
  d.progress('⑧ 评分…');
  r.scores = scoreAll(r);
  r.stage = 'done';
  r.usage = usage(d, input);

  if (d.kb && d.autoSync) {
    d.progress('⑨ 写入飞书知识库…');
    r.kb = await syncKb(d.kb, r);
  }
  return r;
}

export function scoreAll(r: Report): Record<string, Score> {
  const band = r.market.bands.find((b) => b.mine);
  return Object.fromEntries(r.hypotheses.map((h) => [h.id, scoreHypothesis(h, { gaps: r.gaps, band, baseShare: r.market.baseShare, price: r.me.price, fit: r.fit[h.id] }, r.weights)]));
}

export async function syncKb(kb: KnowledgeBase, r: Report): Promise<NonNullable<Report['kb']>> {
  try {
    return { at: Date.now(), ok: true, msg: await kb.saveReport(r) };
  } catch (e) {
    return { at: Date.now(), ok: false, msg: (e as Error).message };
  }
}
