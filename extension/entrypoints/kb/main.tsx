import { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { openOptions, pageUrl } from '@/utils/nav';
import '@/assets/base.css';
import '../report/style.css';
import { HYPO_STATUS, type KbElement, type KbHypothesis, type KnowledgeBase } from '@/services/kb';
import { makeKb } from '@/utils/deps';
import { loadSettings, type Settings } from '@/utils/storage';

const demo = new URLSearchParams(location.search).get('demo') === '1';

/** 团队知识库：升级假设的测试状态回写 + 爆款元素地图（跨市场检索） */
function Kb() {
  const [s, setS] = useState<Settings | null>(null);
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [tab, setTab] = useState<'hypo' | 'element'>('hypo');
  const [hypos, setHypos] = useState<KbHypothesis[]>([]);
  const [elements, setElements] = useState<KbElement[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const refresh = async (k = kb) => {
    if (!k) return;
    setLoading(true);
    setMsg('');
    try {
      const [h, e] = await Promise.all([k.listHypotheses(), k.listElements()]);
      setHypos(h.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setElements(e);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings().then((x) => {
      setS(x);
      const k = makeKb(x, demo);
      setKb(k);
      if (k) refresh(k);
    });
  }, []);

  const shown = hypos.filter((h) => (!status || h.status === status) && (!q || `${h.title}${h.market}${h.asin}${h.lever}${h.pitch}`.toLowerCase().includes(q.toLowerCase())));

  if (!s) return null;
  return (
    <div className="page">
      <header className="top">
        <div>
          <b>天机AI选品 · 团队知识库</b> <span className="small">{demo ? '演示知识库（本地）' : '飞书多维表格'}</span>
        </div>
        <nav>
          <a href={pageUrl('/report.html')}>历史报告</a>
          <a href="#" onClick={(e) => (e.preventDefault(), openOptions())}>
            设置
          </a>
        </nav>
      </header>
      {!kb && (
        <div className="alert warn">
          还没有配置飞书多维表格。到设置页填写 App ID、App Secret 和多维表格链接后，诊断结果会自动写进知识库。<a href="?demo=1">先看演示知识库</a>
        </div>
      )}
      {msg && <div className="alert err">{msg}</div>}
      {kb && (
        <>
          <div className="tabs">
            <button className={tab === 'hypo' ? 'on' : ''} onClick={() => setTab('hypo')}>
              升级假设（{hypos.length}）
            </button>
            <button className={tab === 'element' ? 'on' : ''} onClick={() => setTab('element')}>
              爆款元素地图（{elements.length}）
            </button>
            <button onClick={() => refresh()} disabled={loading}>
              {loading ? '加载中…' : '刷新'}
            </button>
          </div>
          {tab === 'hypo' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input className="input" placeholder="搜索方案 / 市场 / ASIN / 杠杆" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="input" style={{ width: 140 }} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">全部状态</option>
                  {HYPO_STATUS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
              <p className="small">测试完把状态改成“有效 / 无效”，填上指标和结论——下次诊断同类产品时，团队就知道哪些元素已经被验证过。</p>
              {shown.map((h) => (
                <HypoRow key={h.recordId} h={h} userName={s.userName} onSave={async (p) => (await kb.updateHypothesis(h.recordId, p), refresh())} />
              ))}
            </>
          )}
          {tab === 'element' && <ElementMap elements={elements} hypos={hypos} />}
        </>
      )}
    </div>
  );
}

function HypoRow({ h, userName, onSave }: { h: KbHypothesis; userName: string; onSave: (p: { status: string; metrics: string; conclusion: string; updatedBy: string }) => Promise<void> }) {
  const [st, setSt] = useState(h.status);
  const [metrics, setMetrics] = useState(h.metrics);
  const [conclusion, setConclusion] = useState(h.conclusion);
  const [saving, setSaving] = useState(false);
  const dirty = st !== h.status || metrics !== h.metrics || conclusion !== h.conclusion;
  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 12 }}>
        <span className="score big">{h.score}</span>
        <div style={{ flex: 1 }}>
          <span className="tag blue">{h.lever}</span> <span className="tag">{h.level}</span> <b>{h.title}</b>
          <div className="small">
            {h.market} · {h.asin} · 短板 {h.weakest} · 更新 {h.updatedAt}
            {h.updatedBy && ` · ${h.updatedBy}`}
          </div>
          <div>唯一变量：{h.change}</div>
          <div className="pitch">“{h.pitch}”</div>
          <div className="weights" style={{ gridTemplateColumns: '120px 1fr 1fr auto', alignItems: 'end' }}>
            <label className="field">
              <span>状态</span>
              <select value={st} onChange={(e) => setSt(e.target.value)}>
                {HYPO_STATUS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>测试指标</span>
              <input value={metrics} onChange={(e) => setMetrics(e.target.value)} placeholder="如 CTR 0.42%→0.61%，转化 9%→11%" />
            </label>
            <label className="field">
              <span>测试结论</span>
              <input value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="有效 / 无效的原因" />
            </label>
            <button
              className="btn primary sm"
              style={{ marginBottom: 12 }}
              disabled={!dirty || saving}
              onClick={async () => {
                setSaving(true);
                await onSave({ status: st, metrics, conclusion, updatedBy: userName });
                setSaving(false);
              }}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 按元素聚合：同一元素出现在几个细分市场、几个爆款里，附带已测结论 */
function ElementMap({ elements, hypos }: { elements: KbElement[]; hypos: KbHypothesis[] }) {
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const types = [...new Set(elements.map((e) => e.type))];
  const rows = useMemo(() => {
    const m = new Map<string, { type: string; value: string; markets: Set<string>; asins: Set<string>; units: number; bench: number; pitches: Set<string> }>();
    for (const e of elements) {
      if (type && e.type !== type) continue;
      if (q && !`${e.value}${e.market}`.toLowerCase().includes(q.toLowerCase())) continue;
      const k = `${e.type}|${e.value}`;
      const x = m.get(k) ?? { type: e.type, value: e.value, markets: new Set(), asins: new Set(), units: 0, bench: 0, pitches: new Set() };
      x.markets.add(e.market);
      x.asins.add(e.asin);
      x.units += e.units;
      if (e.role.startsWith('对标')) x.bench++;
      if (e.pitch) x.pitches.add(e.pitch);
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => b.markets.size - a.markets.size || b.units - a.units);
  }, [elements, type, q]);
  const tested = (v: string) => hypos.filter((h) => h.status === '有效' || h.status === '无效').filter((h) => `${h.title}${h.change}`.includes(v));
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="input" placeholder="搜索元素或市场，如 可折叠 / 礼品" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ width: 140 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">全部类型</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <p className="small">出现在越多细分市场的元素，越可能是可以跨类目迁移的“已验证购买理由”。</p>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>类型</th>
              <th>元素</th>
              <th className="num">细分市场数</th>
              <th className="num">爆款数</th>
              <th className="num">合计月销</th>
              <th>出现在</th>
              <th>已测结论</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((x) => (
              <tr key={`${x.type}${x.value}`}>
                <td className="small">{x.type}</td>
                <td>
                  <b>{x.value}</b>
                </td>
                <td className="num">{x.markets.size}</td>
                <td className="num">{x.bench}</td>
                <td className="num">{x.units.toLocaleString()}</td>
                <td className="small">{[...x.markets].join('、')}</td>
                <td>
                  {tested(x.value).map((h) => (
                    <span key={h.recordId} className={`tag ${h.status === '有效' ? 'good' : 'bad'}`} title={h.conclusion}>
                      {h.status}·{h.title}
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

ReactDOM.createRoot(document.getElementById('root')!).render(<Kb />);
