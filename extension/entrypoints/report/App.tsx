import { useEffect, useRef, useState } from 'react';
import { openOptions, pageUrl } from '@/utils/nav';
import { DEMO_ASIN } from '@/demo/fake';
import type { Report } from '@/core/types';
import { applyMarketEdit, runDiagnosis, runMarket } from '@/services/pipeline';
import { makeDeps } from '@/utils/deps';
import { deleteReport, listReports, loadReport, loadSettings, saveReport, type ReportMeta, type Settings } from '@/utils/storage';
import { MarketView } from './MarketView';
import { ResultView } from './ResultView';

const params = new URLSearchParams(location.search);

export function App() {
  const demo = params.get('demo') === '1';
  const [settings, setSettings] = useState<Settings | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<ReportMeta[] | null>(null);
  const started = useRef(false);

  const progress = (m: string) => setLog((l) => (l.length && l[l.length - 1].split(' ')[0] === m.split(' ')[0] && /\d+\/\d+$/.test(m) ? [...l.slice(0, -1), m] : [...l, m]));

  const persist = async (r: Report) => {
    setReport(r);
    await saveReport(r);
    const q = new URLSearchParams({ id: r.id, ...(demo ? { demo: '1' } : {}) });
    window.history.replaceState(null, '', `?${q}`);
  };

  const guard = (s: Settings) => {
    if (demo) return '';
    const miss = [!s.sellerspriteKey && '卖家精灵密钥', !s.openaiKey && 'OpenAI API Key'].filter(Boolean);
    return miss.length ? `还没有填写${miss.join('、')}，请先到设置页填写` : '';
  };

  const startMarket = async (s: Settings, asin: string) => {
    const g = guard(s);
    if (g) return setError(g);
    setBusy(true);
    setError('');
    setLog([]);
    try {
      await persist(await runMarket(asin, makeDeps(s, demo, progress)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const continueDiagnosis = async () => {
    if (!report || !settings) return;
    setBusy(true);
    setError('');
    setLog([]);
    try {
      await persist(await runDiagnosis(report, makeDeps(settings, demo, progress)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      const id = params.get('id');
      const asin = params.get('asin');
      if (id) {
        const r = await loadReport(id);
        if (r) setReport(r);
        else setError('找不到这份报告，可能已被清理');
      } else if (demo) startMarket(s, DEMO_ASIN);
      else if (asin) startMarket(s, asin.toUpperCase());
      else setHistory(await listReports());
    })();
  }, []);

  return (
    <div className="page">
      <header className="top">
        <div>
          <b>天机AI选品 · 产品升级方向诊断</b>
          {demo && <span className="tag warn" style={{ marginLeft: 8 }}>演示数据</span>}
        </div>
        <nav>
          <a href={pageUrl('/research.html')}>选品调研</a>
          <a href={pageUrl('/report.html')}>历史报告</a>
          <a href={pageUrl('/kb.html')}>团队知识库</a>
          <a href="#" onClick={(e) => (e.preventDefault(), openOptions())}>
            设置
          </a>
        </nav>
      </header>

      {error && (
        <div className="alert err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {busy && (
        <div className="card">
          <h3>正在分析…</h3>
          <ol className="log">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </div>
      )}

      {history && !report && <History list={history} onDelete={async (id) => (await deleteReport(id), setHistory(await listReports()))} />}

      {report && !busy && report.stage === 'market' && <MarketView report={report} onEdit={(e) => persist(applyMarketEdit(report, e))} onContinue={continueDiagnosis} />}

      {report && !busy && report.stage === 'done' && settings && <ResultView report={report} settings={settings} demo={demo} onChange={persist} onBackToMarket={() => persist({ ...report, stage: 'market' })} />}
    </div>
  );
}

function History({ list, onDelete }: { list: ReportMeta[]; onDelete: (id: string) => void }) {
  if (!list.length)
    return (
      <div className="card">
        <h3>还没有报告</h3>
        <p className="small">点浏览器右上角的插件图标，输入自己产品的 ASIN 开始诊断；也可以先看演示。</p>
        <a className="btn" href="?demo=1">
          查看演示
        </a>
      </div>
    );
  return (
    <div className="card">
      <h3>历史报告</h3>
      <table className="tbl">
        <thead>
          <tr>
            <th>时间</th>
            <th>ASIN</th>
            <th>产品</th>
            <th>细分市场</th>
            <th>状态</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.id}>
              <td>{new Date(m.createdAt).toLocaleString()}</td>
              <td>{m.asin}</td>
              <td>
                <a href={`?id=${m.id}`}>{m.title.slice(0, 60)}</a>
              </td>
              <td>{m.market}</td>
              <td>{m.stage === 'done' ? <span className="tag good">{m.hypotheses} 个方案</span> : <span className="tag warn">待确认市场</span>}</td>
              <td>
                <button className="btn sm" onClick={() => onDelete(m.id)}>
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
