import { Fragment, useMemo, useState } from 'react';
import { unitEconomics } from '@/core/score';
import { ATTR_DIM_NAMES, ATTR_DIMS, QUADRANTS, SCORE_DIM_NAMES, SCORE_DIMS, type AttrDim, type CostInputs, type Hypothesis, type Report } from '@/core/types';
import { scoreAll, syncKb } from '@/services/pipeline';
import { makeKb } from '@/utils/deps';
import { exportExcel } from '@/utils/export';
import type { Settings } from '@/utils/storage';
import { Bar, MarketView, ProductCell } from './MarketView';

const TABS = ['概览', '① 细分市场', '④ 对标与元素', '④ 属性矩阵', '⑤ 差评死法', '⑥ 差距矩阵', '⑦⑧ 升级方案', '成本与包装', '⑨ 假设卡'] as const;
type Tab = (typeof TABS)[number];
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function ResultView({ report: r, settings, demo, onChange, onBackToMarket }: { report: Report; settings: Settings; demo: boolean; onChange: (r: Report) => void; onBackToMarket: () => void }) {
  const [tab, setTab] = useState<Tab>('概览');
  const [syncing, setSyncing] = useState(false);
  const ranked = useMemo(() => [...r.hypotheses].sort((a, b) => (r.scores[b.id]?.total ?? 0) - (r.scores[a.id]?.total ?? 0)), [r]);
  const rescore = (patch: Partial<Report>) => {
    const next = { ...r, ...patch };
    onChange({ ...next, scores: scoreAll(next) });
  };
  const sync = async () => {
    const kb = makeKb(settings, demo);
    if (!kb) return onChange({ ...r, kb: { at: Date.now(), ok: false, msg: '还没有配置飞书多维表格，请到设置页填写' } });
    setSyncing(true);
    onChange({ ...r, kb: await syncKb(kb, r) });
    setSyncing(false);
  };
  return (
    <>
      <div className="card head">
        {r.me.imageUrl && <img src={r.me.imageUrl} alt="" />}
        <div style={{ flex: 1 }}>
          <div className="small">
            {r.asin} · ${r.me.price} · 细分市场「{r.market.myForm}」{r.market.asins.length} 个产品 · {new Date(r.createdAt).toLocaleString()}
          </div>
          <b>{r.me.title}</b>
          <div className="small" style={{ marginTop: 4 }}>
            {r.kb ? <span className={`tag ${r.kb.ok ? 'good' : 'bad'}`}>{r.kb.ok ? '已同步知识库' : '知识库同步失败'}</span> : <span className="tag">未同步知识库</span>} {r.kb?.msg}
          </div>
        </div>
        <div className="actions">
          <button className="btn sm" onClick={() => exportExcel(r)}>
            导出 Excel
          </button>
          <button className="btn sm" disabled={syncing} onClick={sync}>
            {syncing ? '同步中…' : '同步到飞书知识库'}
          </button>
          <button className="btn sm" onClick={onBackToMarket}>
            重新确认市场
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === '概览' && <Overview r={r} ranked={ranked} go={setTab} />}
      {tab === '① 细分市场' && <MarketView report={r} onEdit={() => {}} readOnly />}
      {tab === '④ 对标与元素' && <Elements r={r} />}
      {tab === '④ 属性矩阵' && <Matrix r={r} />}
      {tab === '⑤ 差评死法' && <Reviews r={r} />}
      {tab === '⑥ 差距矩阵' && <Gaps r={r} />}
      {tab === '⑦⑧ 升级方案' && <Hypotheses r={r} ranked={ranked} rescore={rescore} />}
      {tab === '成本与包装' && <Cost r={r} onCost={(cost) => onChange({ ...r, cost })} />}
      {tab === '⑨ 假设卡' && <Cards r={r} ranked={ranked} />}
    </>
  );
}

function Overview({ r, ranked, go }: { r: Report; ranked: Hypothesis[]; go: (t: Tab) => void }) {
  const names = new Map((r.review?.aspects ?? []).map((a) => [a.id, a.name]));
  const mine = r.review?.stats.filter((s) => s.scope === '本品独有') ?? [];
  const common = r.review?.stats.filter((s) => s.scope === '品类共性') ?? [];
  const band = r.market.bands.find((b) => b.mine);
  return (
    <>
      {r.warnings.length > 0 && (
        <div className="alert warn" style={{ marginBottom: 14 }}>
          {r.warnings.map((w, i) => (
            <div key={i}>· {w}</div>
          ))}
        </div>
      )}
      <div className="grid4">
        <Kpi label="细分市场样本" value={`${r.market.asins.length}`} sub={`从 ${r.market.fetched} 个里切出`} />
        <Kpi label="我的价格区间" value={band ? `$${band.from}–${band.to}` : '—'} sub={band ? `单均市占 ${band.avgShare}%（基准 ${r.market.baseShare}%）` : ''} />
        <Kpi label="差距项" value={`${r.gaps.length}`} sub={QUADRANTS.map((q) => `${q} ${r.gaps.filter((g) => g.quadrant === q).length}`).join(' · ')} />
        <Kpi label="升级方案" value={`${r.hypotheses.length}`} sub={`最高分 ${ranked[0] ? r.scores[ranked[0].id]?.total : '—'}`} />
      </div>
      <div className="grid2">
        <div className="card">
          <h3>我自己的问题（本品独有）</h3>
          {mine.length ? (
            mine.map((s) => (
              <div key={s.aspect} className="line">
                <b>{names.get(s.aspect)}</b> 我的差评提及率 <b style={{ color: 'var(--bad)' }}>{pct(s.mineNegRate)}</b>，对标平均 {pct(s.benchNegRate)}
              </div>
            ))
          ) : (
            <p className="small">没有明显高于对标的差评维度。</p>
          )}
          <h3 style={{ marginTop: 14 }}>全品类都没解决（品类共性）</h3>
          {common.length ? (
            common.map((s) => (
              <div key={s.aspect} className="line">
                <b>{names.get(s.aspect)}</b> 对标平均 {pct(s.benchNegRate)}，我 {pct(s.mineNegRate)}——谁先解决谁拿口碑
              </div>
            ))
          ) : (
            <p className="small">没有半数以上对标都高发的差评维度。</p>
          )}
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => go('⑤ 差评死法')}>
            看差评死法 →
          </button>
        </div>
        <div className="card">
          <h3>得分最高的升级方案（看短板，不只看总分）</h3>
          {ranked.slice(0, 5).map((h) => {
            const s = r.scores[h.id];
            return (
              <div key={h.id} className="line">
                <span className="score">{s?.total}</span> <span className="tag blue">{h.lever}</span> <b>{h.title}</b>
                <div className="small">
                  {h.pitch} · 短板：{s ? SCORE_DIM_NAMES[s.weakest] : ''}（{s?.dims[s.weakest]}）
                </div>
              </div>
            );
          })}
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => go('⑦⑧ 升级方案')}>
            看全部方案 →
          </button>
        </div>
      </div>
      <p className="small">
        调用量：卖家精灵 {r.usage.sellersprite} 次 · AI {r.usage.ai} 次（约 {Math.round(r.usage.tokens / 1000)}k tokens）。AI 只负责打标签和写方案，所有占比、提及率、分数都由程序计算。
      </p>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card kpi">
      <div className="small">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="small">{sub}</div>}
    </div>
  );
}

const LIST: [keyof Report['elements'][string], string][] = [
  ['demand', '需求'],
  ['scene', '场景'],
  ['persona', '人群'],
  ['structure', '结构'],
  ['visual', '视觉'],
  ['priceSpec', '价格规格'],
  ['transferable', '可迁移'],
];

function Elements({ r }: { r: Report }) {
  const top = new Map(r.top.map((p) => [p.asin, p]));
  const asins = [r.asin, ...r.benchmarks.map((b) => b.asin)];
  return (
    <>
      <p className="small">对标按你的《竞品爆款反向拆解模板》爆款选取标准挑：新品快速起量、稳定增长、头部常青、同价位对手——选“可学习、可超越”的，不选无法企及的。</p>
      <div className="elements">
        {asins.map((a) => {
          const p = top.get(a);
          const e = r.elements[a];
          const b = r.benchmarks.find((x) => x.asin === a);
          return (
            <div key={a} className={`card el ${a === r.asin ? 'me' : ''}`}>
              {p && <ProductCell p={p} mine={a === r.asin} />}
              <div style={{ margin: '6px 0' }}>
                {b && <span className="tag blue">{b.type}</span>} <span className="small">{b?.reason ?? (p ? `$${p.price} · 月销 ${p.units}` : '')}</span>
              </div>
              {e ? (
                <>
                  <div className="pitch">“{e.realPitch}”</div>
                  {LIST.map(([k, label]) => (
                    <div key={k} className="kv">
                      <span>{label}</span>
                      <div>
                        {(e[k] as string[]).map((v) => (
                          <span key={v} className={`tag ${k === 'transferable' ? 'good' : ''}`}>
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="kv">
                    <span>打法</span>
                    <div>{e.playbook}</div>
                  </div>
                </>
              ) : (
                <p className="small">没有拆解结果</p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Matrix({ r }: { r: Report }) {
  const [dim, setDim] = useState<AttrDim | 'all'>('all');
  const rows = r.attrRows.filter((x) => dim === 'all' || x.dim === dim);
  return (
    <div className="card">
      <h3>属性矩阵：属性 × 频次 × 销量（做市场填空）</h3>
      <p className="small">销量拉动 = 销量占比 ÷ 产品占比，大于 1 说明具备该属性的产品卖得更好；拉动 ≥ 1.3 且产品占比 ≤ 25% = 空白格（有需求、供给少）。</p>
      <div className="tabs sm">
        {(['all', ...ATTR_DIMS] as const).map((d) => (
          <button key={d} className={d === dim ? 'on' : ''} onClick={() => setDim(d)}>
            {d === 'all' ? '全部' : ATTR_DIM_NAMES[d]}
          </button>
        ))}
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>维度</th>
            <th>属性</th>
            <th className="num">产品数</th>
            <th className="num">产品占比</th>
            <th className="num">销量占比</th>
            <th className="num">销量拉动</th>
            <th className="num">对标具备</th>
            <th>我有</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={`${x.dim}${x.value}`} className={x.mine ? 'mine' : ''}>
              <td className="small">{ATTR_DIM_NAMES[x.dim]}</td>
              <td>
                <b>{x.value}</b>
              </td>
              <td className="num">{x.products}</td>
              <td className="num">{x.productShare}%</td>
              <td className="num">
                <Bar v={x.unitsShare} /> {x.unitsShare}%
              </td>
              <td className="num" style={{ color: x.lift >= 1.3 ? 'var(--good)' : x.lift < 0.8 ? 'var(--bad)' : undefined }}>
                {x.lift}
              </td>
              <td className="num">
                {x.inBench}/{r.benchmarks.length}
              </td>
              <td>{x.mine ? '✓' : ''}</td>
              <td>{x.gap && <span className="tag good">空白格</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reviews({ r }: { r: Report }) {
  const [open, setOpen] = useState<string | null>(null);
  const rv = r.review;
  if (!rv) return <div className="card">没有差评分析</div>;
  const asins = [r.asin, ...r.benchmarks.map((b) => b.asin)];
  const byId = new Map(rv.reviews.map((x) => [x.id, x]));
  const label = (a: string) => (a === r.asin ? '我' : a.slice(-4));
  return (
    <>
      <div className="card">
        <h3>样本口径</h3>
        <p className="small">
          每个 ASIN 取最近的 1–3 星和 4–5 星文字评论（按时间倒序）；疑似恶意差评剔除；有效差评不足门槛（设置里可改，默认 30 条）只报数、不下结论。标签体系{rv.fromKb ? '复用知识库里本市场已锁定的版本' : '本次新建，同步后锁定，下次同市场复用'}。
        </p>
        <table className="tbl">
          <thead>
            <tr>
              <th>ASIN</th>
              <th className="num">有效差评</th>
              <th className="num">有效好评</th>
              <th className="num">剔除恶意</th>
              <th>结论可信</th>
            </tr>
          </thead>
          <tbody>
            {rv.samples.map((s) => (
              <tr key={s.asin} className={s.asin === r.asin ? 'mine' : ''}>
                <td>{s.asin === r.asin ? `${s.asin}（我）` : s.asin}</td>
                <td className="num">{s.neg}</td>
                <td className="num">{s.pos}</td>
                <td className="num">{s.spam}</td>
                <td>{s.enough ? <span className="tag good">够</span> : <span className="tag warn">样本不足</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>差评维度（我 vs 对标，差评提及率）</h3>
        <p className="small">四种死法：品控寿命 / 服务不兜底 / 卖点没兑现 / 基础体验。改进分三类：低成本结构件（最值钱）、需供应链配合（先算货值）、服务兜底（改不动就用保修兜住）。点一行看买家原话。</p>
        <table className="tbl">
          <thead>
            <tr>
              <th>维度</th>
              <th>死法</th>
              <th>改进类型</th>
              <th>旅程</th>
              {asins.map((a) => (
                <th key={a} className="num" title={a}>
                  {label(a)}
                </th>
              ))}
              <th>判断</th>
              <th>夸/骂</th>
            </tr>
          </thead>
          <tbody>
            {rv.stats.map((s) => {
              const a = rv.aspects.find((x) => x.id === s.aspect)!;
              return (
                <Fragment key={s.aspect}>
                  <tr onClick={() => setOpen(open === s.aspect ? null : s.aspect)} style={{ cursor: 'pointer' }}>
                    <td>
                      <b>{a.name}</b>
                      <div className="small">{a.desc}</div>
                    </td>
                    <td>
                      <span className="tag">{a.death}</span>
                    </td>
                    <td className="small">{a.fix}</td>
                    <td className="small">{a.stage}</td>
                    {asins.map((x) => {
                      const v = s.perAsin[x]?.negRate ?? 0;
                      return (
                        <td key={x} className="num heat" style={{ background: `rgba(220,38,38,${Math.min(0.6, v * 1.5)})` }}>
                          {pct(v)}
                        </td>
                      );
                    })}
                    <td>{s.scope && <span className={`tag ${s.scope === '本品独有' ? 'bad' : s.scope === '我的优势' ? 'good' : 'warn'}`}>{s.scope}</span>}</td>
                    <td className="small">
                      被夸 {pct(s.praiseShare)}
                      {s.polarized && <div className="tag warn">体验两极</div>}
                    </td>
                  </tr>
                  {open === s.aspect && (
                    <tr>
                      <td colSpan={6 + asins.length}>
                        {s.quotes.map((id) => {
                          const q = byId.get(id);
                          return q ? (
                            <div key={id} className="quote">
                              <span className="tag">{q.asin === r.asin ? '我' : q.asin} · {q.star}星</span> {q.content.slice(0, 300)}
                            </div>
                          ) : null;
                        })}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>每月差评条数（样本内，看哪个批次开始恶化）</h3>
        <table className="tbl">
          <tbody>
            {asins.map((a) => (
              <tr key={a}>
                <td style={{ whiteSpace: 'nowrap' }}>{a === r.asin ? '我' : a}</td>
                <td>
                  {(rv.monthly[a] ?? []).slice(-12).map((m) => (
                    <span key={m.month} className="month" title={m.month}>
                      <i style={{ height: `${Math.min(40, m.neg * 3)}px` }} />
                      <em>{m.month.slice(2)}</em>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const Q_DESC: Record<string, string> = {
  他有我无: '爆款普遍具备、我没有：要补的短板',
  他有我劣: '同一维度我的差评明显更多：要优化的点',
  他无我有: '我独有的优势：检查主图和五点有没有讲出来',
  都没有: '全品类都没解决 / 有需求供给少：最大的机会',
};

function Gaps({ r }: { r: Report }) {
  return (
    <div className="quad">
      {QUADRANTS.map((q) => (
        <div key={q} className="card">
          <h3>{q}</h3>
          <p className="small">{Q_DESC[q]}</p>
          {r.gaps
            .filter((g) => g.quadrant === q)
            .map((g) => (
              <div key={g.id} className="gap">
                <span className="small">{g.id}</span> <span className="tag">{g.dim}</span> <b>{g.item}</b> <Bar v={g.strength} color="var(--blue)" />
                <div className="small">{g.evidence}</div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

function Hypotheses({ r, ranked, rescore }: { r: Report; ranked: Hypothesis[]; rescore: (p: Partial<Report>) => void }) {
  const gaps = new Map(r.gaps.map((g) => [g.id, g]));
  return (
    <>
      <div className="card">
        <h3>评分权重（改完立即重算）</h3>
        <div className="weights">
          {SCORE_DIMS.map((d) => (
            <label key={d} className="field">
              <span>{SCORE_DIM_NAMES[d]}</span>
              <input type="number" min={0} max={100} value={r.weights[d]} onChange={(e) => rescore({ weights: { ...r.weights, [d]: Number(e.target.value) || 0 } })} />
            </label>
          ))}
        </div>
        <p className="small">每个方案只改一个变量（程序检查）。资源匹配度（供应链、拍摄、资金、团队擅长打法）由你在每张卡上拖动调整，默认 60。</p>
      </div>
      {ranked.map((h) => {
        const s = r.scores[h.id];
        return (
          <div key={h.id} className="card hyp">
            <div className="hyp-head">
              <span className="score big">{s?.total}</span>
              <div style={{ flex: 1 }}>
                <span className="tag blue">{h.lever}</span> <span className={`tag ${h.level === '真差异化' ? 'good' : ''}`}>{h.level}</span> <span className="tag">{h.need}</span> <b style={{ fontSize: 15 }}>{h.title}</b>
                <div>
                  唯一变量：<b>{h.change}</b>
                </div>
                <div className="small">
                  保留不动：{h.keep.join('、') || '—'} · 人群：{h.persona} · 场景：{h.scene}
                </div>
                <div className="pitch">“{h.pitch}”</div>
                <div className="small">
                  证据：
                  {h.evidence.length
                    ? h.evidence.map((id) => (
                        <span key={id} className="tag" title={gaps.get(id)?.evidence}>
                          {id} {gaps.get(id)?.quadrant}·{gaps.get(id)?.item}
                        </span>
                      ))
                    : '无'}
                </div>
                <div className="small">验证：{h.verify}</div>
                {s?.notes.length ? <div className="small" style={{ color: 'var(--warn)' }}>⚠ {s.notes.join('；')}</div> : null}
              </div>
              <div className="dims">
                {SCORE_DIMS.map((d) => (
                  <div key={d} className={`dim ${s?.weakest === d ? 'weak' : ''}`}>
                    <span>{SCORE_DIM_NAMES[d]}</span>
                    <Bar v={s?.dims[d] ?? 0} color={s?.weakest === d ? 'var(--bad)' : 'var(--good)'} />
                    <em>{s?.dims[d]}</em>
                  </div>
                ))}
                <label className="small">
                  拖动调整资源匹配 <input type="range" min={0} max={100} value={r.fit[h.id] ?? 60} onChange={(e) => rescore({ fit: { ...r.fit, [h.id]: Number(e.target.value) } })} />
                </label>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

const COST_FIELDS: { key: keyof CostInputs; label: string; hint: string }[] = [
  { key: 'purchaseCny', label: '采购价（元/件）', hint: '手动填写' },
  { key: 'packCny', label: '包装（元/件）', hint: '彩盒、说明书、配件袋' },
  { key: 'freightCnyPerKg', label: '头程（元/kg）', hint: '按计费重量' },
  { key: 'fx', label: '汇率', hint: '' },
  { key: 'commissionPct', label: '佣金 %', hint: '' },
  { key: 'adPct', label: '广告占比 %', hint: '' },
  { key: 'returnPct', label: '退货损失 %', hint: '按售价' },
];

function Cost({ r, onCost }: { r: Report; onCost: (c: CostInputs) => void }) {
  const u = unitEconomics(r.me.price, r.me.dimensions, r.me.weight, r.cost);
  const shrink = r.hypotheses.filter((h) => h.judge.sizeChange === '变小');
  return (
    <div className="grid2">
      <div className="card">
        <h3>成本输入（采购、包装、头程手动填，其余估算）</h3>
        <div className="weights">
          {COST_FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span>{f.label}</span>
              <input type="number" step="0.1" value={r.cost[f.key]} onChange={(e) => onCost({ ...r.cost, [f.key]: Number(e.target.value) || 0 })} />
            </label>
          ))}
        </div>
        <p className="small">总成本 = 采购 + 包装 + 头程 + FBA + 佣金 + 广告 + 退货。采购价降五毛，不如包装体积减少 15%。</p>
      </div>
      <div className="card">
        <h3>单件经济账</h3>
        {u.missing.length > 0 && <div className="alert warn">缺少：{u.missing.join('、')}，结果不完整</div>}
        <table className="tbl">
          <tbody>
            <tr>
              <td>售价</td>
              <td className="num">${r.me.price}</td>
            </tr>
            <tr>
              <td>尺寸 / 重量</td>
              <td className="num">
                {r.me.dimensions || '—'} / {r.me.weight || '—'}
              </td>
            </tr>
            <tr>
              <td>尺寸分段</td>
              <td className="num">
                <b>{u.tier}</b>（计费 {u.shippingLb} 磅）
              </td>
            </tr>
            <tr>
              <td>FBA 配送费（参考表）</td>
              <td className="num">${u.fba}</td>
            </tr>
            <tr>
              <td>到岸成本</td>
              <td className="num">${u.landed}</td>
            </tr>
            <tr>
              <td>单件利润</td>
              <td className="num" style={{ color: u.profit < 0 ? 'var(--bad)' : 'var(--good)' }}>
                <b>${u.profit}</b>（{u.margin}%）
              </td>
            </tr>
          </tbody>
        </table>
        <div className="alert ok" style={{ marginTop: 10 }}>
          包装卡位：{u.nextTierHint || '—'}
        </div>
        <p className="small">FBA 费用为美国站非旺季参考价，请按当年费率表核对。压缩 / 套叠 / 平板化 / 真空 都是缩小体积的方向，但不能牺牲保护性。</p>
        {shrink.length > 0 && <p className="small">能缩小包装的方案：{shrink.map((h) => h.title).join('、')}</p>}
      </div>
    </div>
  );
}

function Cards({ r, ranked }: { r: Report; ranked: Hypothesis[] }) {
  const gaps = new Map(r.gaps.map((g) => [g.id, g]));
  return (
    <>
      <p className="small">
        老品先测卖点（主图 / 五点 / 广告按需求分组），有响应再打样、改模。同步到飞书后，团队在“升级假设”表里改状态、填测试指标和结论，结果会沉淀到知识库，下次诊断可以参考。
      </p>
      <div className="cards">
        {ranked.map((h, i) => (
          <div key={h.id} className="card pcard">
            <div className="small">
              假设卡 #{i + 1} · {h.lever} · 总分 {r.scores[h.id]?.total}
            </div>
            <h3>{h.title}</h3>
            <dl>
              <dt>目标人群</dt>
              <dd>{h.persona}</dd>
              <dt>场景</dt>
              <dd>{h.scene}</dd>
              <dt>唯一变量</dt>
              <dd>{h.change}</dd>
              <dt>保留不动</dt>
              <dd>{h.keep.join('、') || '—'}</dd>
              <dt>购买理由</dt>
              <dd>{h.pitch}</dd>
              <dt>差异来源</dt>
              <dd>{h.evidence.map((id) => `${gaps.get(id)?.quadrant}·${gaps.get(id)?.item}`).join('；') || '—'}</dd>
              <dt>价格逻辑</dt>
              <dd>
                预计可提价 {h.judge.priceUpliftPct}%，增本 {h.judge.costDelta}
                {h.judge.mold ? '，需开模' : ''}
                {h.judge.cert ? '，涉及认证' : ''}
              </dd>
              <dt>验证动作</dt>
              <dd>{h.verify}</dd>
              <dt>止损边界</dt>
              <dd>测试 2 周 CTR / 转化无提升即停，不进入打样</dd>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
