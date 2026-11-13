import * as XLSX from 'xlsx';
import { unitEconomics } from '@/core/score';
import { ATTR_DIM_NAMES, SCORE_DIM_NAMES, SCORE_DIMS, type Report } from '@/core/types';

const pct = (x: number) => Math.round(x * 1000) / 10;

/** 每一步一张 sheet，方便团队在 Excel 里继续加工 */
export function reportSheets(r: Report): Record<string, Record<string, unknown>[]> {
  const top = new Map(r.top.map((p) => [p.asin, p]));
  const names = new Map((r.review?.aspects ?? []).map((a) => [a.id, a]));
  const gaps = new Map(r.gaps.map((g) => [g.id, g]));
  const u = unitEconomics(r.me.price, r.me.dimensions, r.me.weight, r.cost);
  return {
    细分市场: r.market.groups.map((g) => ({ 形态: g.form, 我的形态: g.form === r.market.myForm ? '是' : '', 产品数: g.count, '月销占比%': g.unitsShare, 均价: g.avgPrice, 最低价: g.minPrice, 最高价: g.maxPrice, 价格收敛: g.qa.priceConverged ? '是' : '否', 未吞掉一半样本: g.qa.notDominant ? '是' : '否', '样本≥30': g.qa.enoughSample ? '是' : '否' })),
    价格区间: r.market.bands.map((b) => ({ 区间: `$${b.from}–${b.to}`, 我的区间: b.mine ? '是' : '', 产品数: b.count, '销量占比%': b.unitsShare, '单均市占%': b.avgShare, '基准%': r.market.baseShare, '区间垄断度%': b.top3Share, '评论占比%': b.ratingsShare, 信号: b.signal })),
    细分市场样本: r.market.asins.map((a) => {
      const p = top.get(a)!;
      return { ASIN: a, 标题: p.title, 品牌: p.brand, 价格: p.price, 月销: p.units, 评论数: p.ratings, 评分: p.rating, 上架: p.availableDate ? new Date(p.availableDate).toLocaleDateString() : '' };
    }),
    对标与元素: [r.asin, ...r.benchmarks.map((b) => b.asin)].map((a) => {
      const e = r.elements[a];
      const b = r.benchmarks.find((x) => x.asin === a);
      return { ASIN: a, 角色: a === r.asin ? '我的产品' : b?.type, 选取理由: b?.reason ?? '', 真正在卖: e?.realPitch, 需求: e?.demand.join('；'), 场景: e?.scene.join('；'), 人群: e?.persona.join('；'), 结构: e?.structure.join('；'), 视觉: e?.visual.join('；'), 价格规格: e?.priceSpec.join('；'), 可迁移: e?.transferable.join('；'), 打法: e?.playbook };
    }),
    属性矩阵: r.attrRows.map((x) => ({ 维度: ATTR_DIM_NAMES[x.dim], 属性: x.value, 产品数: x.products, '产品占比%': x.productShare, '销量占比%': x.unitsShare, 销量拉动: x.lift, 对标具备: x.inBench, 我有: x.mine ? '是' : '', 空白格: x.gap ? '是' : '' })),
    差评维度: (r.review?.stats ?? []).map((s) => {
      const a = names.get(s.aspect);
      return {
        维度: a?.name,
        死法: a?.death,
        改进类型: a?.fix,
        旅程阶段: a?.stage,
        '我的差评提及率%': pct(s.mineNegRate),
        '对标平均%': pct(s.benchNegRate),
        判断: s.scope,
        '被夸占比%': pct(s.praiseShare),
        体验两极: s.polarized ? '是' : '',
        ...Object.fromEntries(Object.entries(s.perAsin).map(([asin, v]) => [`${asin}%`, pct(v.negRate)])),
      };
    }),
    差距矩阵: r.gaps.map((g) => ({ 编号: g.id, 象限: g.quadrant, 维度: g.dim, 项: g.item, 证据: g.evidence, 强度: g.strength })),
    升级方案: [...r.hypotheses]
      .sort((a, b) => (r.scores[b.id]?.total ?? 0) - (r.scores[a.id]?.total ?? 0))
      .map((h) => {
        const s = r.scores[h.id];
        return {
          方案: h.title,
          杠杆: h.lever,
          唯一变量: h.change,
          保留不动: h.keep.join('；'),
          人群: h.persona,
          场景: h.scene,
          购买理由: h.pitch,
          等级: h.level,
          需求层次: h.need,
          证据: h.evidence.map((id) => `${gaps.get(id)?.quadrant}·${gaps.get(id)?.item}`).join('；'),
          验证动作: h.verify,
          总分: s?.total,
          短板: s ? SCORE_DIM_NAMES[s.weakest] : '',
          ...Object.fromEntries(SCORE_DIMS.map((d) => [SCORE_DIM_NAMES[d], s?.dims[d]])),
          提示: [...(s?.notes ?? [])].join('；'),
        };
      }),
    单件成本: [{ 售价: r.me.price, 尺寸: r.me.dimensions, 重量: r.me.weight, 尺寸分段: u.tier, FBA配送费: u.fba, 计费重量磅: u.shippingLb, 到岸成本: u.landed, 单件利润: u.profit, '利润率%': u.margin, 下一档提示: u.nextTierHint, 缺少: u.missing.join('、') }],
  };
}

export function exportExcel(r: Report): void {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(reportSheets(r))) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ 说明: '无数据' }]), name);
  XLSX.writeFile(wb, `天机AI选品_产品升级诊断_${r.asin}_${new Date(r.createdAt).toLocaleDateString().replace(/\//g, '-')}.xlsx`);
}
