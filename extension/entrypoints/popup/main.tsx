import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import '@/assets/base.css';
import { loadSettings } from '@/utils/storage';

const ASIN_RE = /(?:\/dp\/|\/gp\/product\/|asin=)([A-Z0-9]{10})/i;

function Popup() {
  const [asin, setAsin] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  useEffect(() => {
    loadSettings().then((s) => setMissing([!s.sellerspriteKey && '卖家精灵密钥', !s.openaiKey && 'OpenAI Key', !s.feishuBase && '飞书多维表格'].filter(Boolean) as string[]));
  }, []);
  useEffect(() => {
    browser.tabs
      ?.query({ active: true, currentWindow: true })
      .then(([t]) => {
        const m = t?.url?.match(ASIN_RE);
        if (m) setAsin(m[1].toUpperCase());
      })
      .catch(() => {});
  }, []);
  const open = (path: string) => {
    browser.tabs.create({ url: browser.runtime.getURL(path as '/report.html') });
    window.close();
  };
  const valid = /^[A-Z0-9]{10}$/.test(asin);
  return (
    <div style={{ width: 280, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <b>天机AI选品</b>
      <button className="btn dark" onClick={() => open('/research.html')}>超级产品开发 · 选品调研</button>
      <span className="small">16 个选品调研模块 · 支持无密钥演示</span>
      <b>用爆款做爆款 · 产品升级方向诊断</b>
      {missing.length > 0 && (
        <div className="alert warn">
          还没填写：{missing.join('、')}
          <button className="btn primary sm" style={{ width: '100%', marginTop: 6 }} onClick={() => (browser.runtime.openOptionsPage(), window.close())}>
            去填写密钥
          </button>
        </div>
      )}
      <span className="hint">输入自己的老品 ASIN（美国站），找出它还能怎么升级</span>
      <input className="input" value={asin} onChange={(e) => setAsin(e.target.value.trim().toUpperCase())} placeholder="B0XXXXXXXX" onKeyDown={(e) => e.key === 'Enter' && valid && open(`/report.html?asin=${asin}`)} />
      <button className="btn primary" disabled={!valid} onClick={() => open(`/report.html?asin=${asin}`)}>
        开始诊断
      </button>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn sm" style={{ flex: 1 }} onClick={() => open('/report.html')}>
          历史报告
        </button>
        <button className="btn sm" style={{ flex: 1 }} onClick={() => open('/kb.html')}>
          团队知识库
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn sm" style={{ flex: 1 }} onClick={() => open('/report.html?demo=1')}>
          查看演示
        </button>
        <button className="btn sm" style={{ flex: 1 }} onClick={() => browser.runtime.openOptionsPage()}>
          设置
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Popup />);
