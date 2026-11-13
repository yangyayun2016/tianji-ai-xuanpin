import { useEffect, useState } from 'react';
import { DataSourceRouter, TIME_MACHINE_TIP } from '@/services/dataSources';
import { DEMO_MARKET } from '@/demo/research';
import { loadResearchInput, mapResearch, MODULE_CATALOG, type Cell, type Market, type ModuleId, type ResearchInput, type ResearchModule, type ResearchSection, type Value } from '@/research';
import { openOptions, pageUrl } from '@/utils/nav';
import { loadSettings, type Settings } from '@/utils/storage';

const STATUS_NAMES = { ok: '有数据', missing: '缺失', unavailable: '不可用', not_applicable: '不适用' } as const;
function DetailView({ value, column }: { value: Value; column: string }) {
  if (value && typeof value === 'object') {
    if ('status' in value && 'value' in value) return <CellView cell={value as Cell} column={column} />;
    if (Array.isArray(value)) return <>{value.map((v, n) => <span key={n}><DetailView value={v} column={column} />{n < value.length - 1 ? '、' : ''}</span>)}</>;
    return <dl className="research-detail">{Object.entries(value).map(([key, v]) => <div key={key}><dt>{key}</dt><dd>{v === null ? '—' : <DetailView value={v} column={key} />}</dd></div>)}</dl>;
  }
  return <>{typeof value === 'boolean' ? value ? '是' : '否' : String(value)}</>;
}
export function CellView({ cell, column }: { cell: Cell; column: string }) {
  const value = cell.value;
  const display = value === null ? '—' : typeof value === 'number' ? column === '每日竞争程度' ? value.toFixed(4) : value.toLocaleString('zh-CN', { maximumFractionDigits: 6 }) : typeof value === 'boolean' ? value ? '是' : '否' : typeof value === 'object' ? JSON.stringify(value) : value;
  return <>{value !== null && typeof value === 'object' ? <DetailView value={value} column={column} /> : <span>{display}</span>}<small className={`research-status ${cell.status}`} title={cell.note}>{STATUS_NAMES[cell.status]}</small>{cell.note && <span className="research-note">{cell.note}</span>}</>;
}

export function SectionTable({ section: s, endMonth }: { section: ResearchSection; endMonth: string }) {
  return <section className="card research-section" aria-label={s.title}>
    <h2>{s.title}</h2>
    {s.summaryHeading && <h3>{s.summaryHeading}</h3>}
    <div className="research-table-scroll"><table className="tbl">
      <thead><tr>{s.columns.map((c) => <th key={c} scope="col">{c.replace('{期末月}', endMonth)}</th>)}</tr></thead>
      <tbody>{s.rows.map((r, n) => <tr key={`${r.label ?? ''}:${n}`}>{s.columns.map((c, j) => <td key={c}>
        {j === 0 && r.label && r.cells[c].value === null && <span>{r.label} </span>}
        <CellView cell={r.cells[c]} column={c} />
      </td>)}</tr>)}</tbody>
    </table></div>
    {!s.rows.length && <p className="small">暂无打标数据；属性维度列结构已保留。</p>}
    {s.dimensions?.map((d) => <SectionTable key={d.id} section={d} endMonth={endMonth} />)}
  </section>;
}

export function ModuleView({ module: m }: { module: ResearchModule }) {
  return <article>
    <h1>{String(m.moduleId).padStart(2, '0')} · {m.moduleName}</h1>
    <p className="small">{m.market.site}｜{m.market.categoryName} · {m.market.periodStart}—{m.market.periodEnd} · 更新：{m.generatedAt}</p>
    <div className="research-source-notes">{Object.entries(m.sourceNotes).map(([metric, note]) => <p key={metric} className="small">
      {{ units: '销量 / 购买量', revenue: '销售额', coupon: 'Coupon / 优惠 / 历史报价' }[metric]}：{note.source} · {STATUS_NAMES[note.status]}{note.demo && ' · 合成演示'}{note.notice && ` · ${note.notice}`}
    </p>)}</div>
    {m.notes.map((note, n) => <p className="alert" key={n}>{note}</p>)}
    {m.inputs && <p>自定义毛利率：<CellView cell={m.inputs.自定义毛利率} column="自定义毛利率" /></p>}
    {m.sections.map((s) => <SectionTable key={s.id} section={s} endMonth={m.market.periodEnd.slice(0, 7)} />)}
  </article>;
}

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [demo, setDemo] = useState(true);
  const [market, setMarket] = useState<Market>({ ...DEMO_MARKET });
  const [asins, setAsins] = useState('');
  const [input, setInput] = useState<ResearchInput | null>(null);
  const [active, setActive] = useState<ModuleId>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [margin, setMargin] = useState('');
  const [costAsin, setCostAsin] = useState('');
  useEffect(() => { void loadSettings().then(setSettings); }, []);
  const run = async () => {
    if (!settings || busy) return;
    setBusy(true); setError(''); setInput(null);
    try {
      const ids = asins.split(/[\s,，]+/).filter(Boolean).map((s) => s.toUpperCase());
      if (!demo && (!ids.length || ids.some((id) => !/^[A-Z0-9]{10}$/.test(id)))) throw new Error('请填写 10 位 ASIN，多个 ASIN 用逗号或空格分隔');
      if (market.periodStart > market.periodEnd) throw new Error('统计开始日不能晚于结束日');
      const result = await loadResearchInput(new DataSourceRouter(settings, demo), market, ids);
      setInput(result); setMargin(result.grossMargin?.toString() ?? ''); setCostAsin(result.products[0]?.asin ?? '');
    } catch { setError('调研加载失败，请检查统计范围、ASIN 和数据源设置。'); }
    finally { setBusy(false); }
  };
  const modules = input ? mapResearch(input) : [];
  const patchMarket = (key: keyof Market, value: string) => setMarket((m) => ({ ...m, [key]: value }));
  const setCost = (key: string, value: string) => input && setInput({ ...input, costs: { ...input.costs, [costAsin]: { ...input.costs?.[costAsin], [key]: value.trim() === '' ? null : Number(value) } } });
  return <div className="research-page">
    <header className="research-top"><b>天机AI选品 · 选品调研</b><nav><a href={pageUrl('/report.html')}>用爆款做爆款 / 产品升级</a><a href={pageUrl('/kb.html')}>团队知识库</a><button className="btn sm" onClick={openOptions}>设置</button></nav></header>
    <form className="card" onSubmit={(e) => { e.preventDefault(); void run(); }}>
      <fieldset disabled={busy || !settings}>
        <div className="research-inputs">
          {([['site', '站点'], ['categoryName', '类目'], ['categoryNodeId', '目标排名节点'], ['query', '查询词'], ['periodStart', '统计开始日'], ['periodEnd', '统计结束日']] as const).map(([key, label]) => <label className="field" key={key}><span>{label}</span><input required type={key.startsWith('period') ? 'date' : 'text'} value={market[key]} onChange={(e) => patchMarket(key, e.target.value)} /></label>)}
          <label className="field"><span>ASIN</span><input value={asins} required={!demo} onChange={(e) => setAsins(e.target.value)} disabled={demo} /></label>
        </div>
        <div className="research-actions"><label><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> 演示模式（合成数据）</label><button className="btn primary" type="submit">{busy ? '加载中…' : '生成选品调研'}</button></div>
      </fieldset>
      <p className="small">{demo ? '演示模式使用 FakeResearchMcp，不发送外部请求。' : '真实模式仅使用设置中的数据源，未配置或未确认的字段保留为空。'}{TIME_MACHINE_TIP}</p>
    </form>
    {error && <p role="alert" className="alert err">{error}</p>}
    {busy && <p role="status">正在加载选品调研…</p>}
    <div className="research-layout">
      <nav className="research-nav" aria-label="选品调研模块">{MODULE_CATALOG.map((s) => <button key={s.moduleId} aria-current={active === s.moduleId ? 'page' : undefined} className={`btn ${active === s.moduleId ? 'primary' : ''}`} onClick={() => setActive(s.moduleId)}>{s.moduleId}. {s.moduleName}</button>)}</nav>
      <main>
        {input && (active === 9 || active === 16) && <section className="card"><h2>测算输入</h2>
          <label className="field"><span>自定义毛利率（0—1）</span><input type="number" min="0" max="1" step="0.01" value={margin} onChange={(e) => { setMargin(e.target.value); setInput({ ...input, grossMargin: e.target.value === '' ? undefined : Number(e.target.value) }); }} /></label>
          {active === 16 && <><label className="field"><span>ASIN</span><select value={costAsin} onChange={(e) => setCostAsin(e.target.value)}>{input.products.map((p) => <option key={p.asin}>{p.asin}</option>)}</select></label><div className="research-inputs">{['采购成本', '头程', 'FBA配送费', '平台佣金', '其他费用', '广告CPA（可引用模块 9 推荐档）'].map((key) => <label className="field" key={key}><span>{key}</span><input type="number" min="0" step="0.01" value={String(input.costs?.[costAsin]?.[key] ?? '')} onChange={(e) => setCost(key, e.target.value)} /></label>)}</div></>}
        </section>}
        {modules.length ? <ModuleView module={modules[active - 1]} /> : <div className="card"><h1>{MODULE_CATALOG[active - 1].moduleName}</h1><p>生成调研后查看固定列与数据状态。</p></div>}
      </main>
    </div>
  </div>;
}
