import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import '@/assets/base.css';
import { SCORE_DIM_NAMES, SCORE_DIMS } from '@/core/types';
import { parseAppToken } from '@/services/feishu';
import { FeishuKb } from '@/services/kb';
import { productDetail, SellerSpriteClient } from '@/services/sellersprite';
import { DEFAULT_LIMITS, loadSettings, saveSettings, type Limits, type Settings } from '@/utils/storage';
import { mcpOrigin, type McpConfig } from '@/services/mcp';

const LIMIT_FIELDS: { key: keyof Limits; label: string; hint: string }[] = [
  { key: 'topN', label: '类目样本数', hint: '取类目 TOP N 再切细分市场（100–400）' },
  { key: 'benchMax', label: '对标爆款个数', hint: '3–8 个' },
  { key: 'negPerAsin', label: '每个 ASIN 差评条数', hint: '1–3 星，越多越准、越费钱' },
  { key: 'posPerAsin', label: '每个 ASIN 好评条数', hint: '4–5 星，用来看“夸 vs 骂”' },
  { key: 'minNeg', label: '差评下结论门槛', hint: '有效差评少于它只报数' },
];

function Options() {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState('');
  const [tests, setTests] = useState<Record<string, string>>({});
  useEffect(() => {
    loadSettings().then(setS);
  }, []);
  if (!s) return null;
  const patch = (p: Partial<Settings>) => {
    setS({ ...s, ...p });
    setSaved('');
  };
  const test = async (k: string, fn: () => Promise<string>) => {
    setTests((t) => ({ ...t, [k]: '测试中…' }));
    try {
      setTests((t) => ({ ...t, [k]: '' }));
      const m = await fn();
      setTests((t) => ({ ...t, [k]: `✓ ${m}` }));
    } catch (e) {
      setTests((t) => ({ ...t, [k]: `✗ ${(e as Error).message}` }));
    }
  };
  const save = async () => {
    try {
      const origins = [...new Set(([s.sifMcp, s.keepaMcp, s.seekerMcp]).filter((c) => c.url.trim()).map((c) => `${mcpOrigin(c.url)}/*`))];
      if (origins.length && !await browser.permissions.request({ origins })) { setSaved('未获得 MCP 域名权限，请授权后保存'); return; }
    } catch { setSaved('MCP 地址无效：需 HTTPS 或本地回环 HTTP，凭据请填在密钥栏'); return; }
    // 非 OpenAI 官方地址需要单独申请域名权限
    try {
      const origin = new URL(s.openaiBase).origin;
      if (origin !== 'https://api.openai.com') await browser.permissions.request({ origins: [`${origin}/*`] });
    } catch {
      /* 地址不合法时保存后由运行报错提示 */
    }
    await saveSettings(s);
    setSaved('已保存');
  };
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 22 }}>天机AI选品 · 设置</h1>
      <p style={{ color: 'var(--muted)' }}>密钥只保存在你的浏览器里。诊断只读数据，不会改动亚马逊后台。</p>

      <section className="card">
        <h3>卖家精灵</h3>
        <label className="field">
          <span>卖家精灵 MCP 密钥（secret-key）</span>
          <input type="password" value={s.sellerspriteKey} onChange={(e) => patch({ sellerspriteKey: e.target.value.trim() })} />
        </label>
        <button className="btn sm" disabled={!s.sellerspriteKey} onClick={() => test('ss', async () => `连接成功：${(await productDetail(new SellerSpriteClient(s.sellerspriteKey), 'B07PGL2N7J')).title.slice(0, 40) || '可用'}`)}>
          测试连接
        </button>{' '}
        <span className="small">{tests.ss}</span>
      </section>

      <section className="card">
        <h3>选品调研 MCP 数据源</h3>
        <p className="small">销量只走 SIF；销售额只走卖家精灵；Coupon / 优惠 / 历史报价只走 Keepa（Dinzee keepa__*）。未配置时保留不可用状态。</p>
        {([['sifMcp', 'SIF'], ['keepaMcp', 'Keepa（Dinzee）'], ['seekerMcp', 'Seeker / Dinzee']] as const).map(([key, name]) => <fieldset key={key} style={{ border: '1px solid var(--line)', marginBottom: 12 }}>
          <legend>{name}</legend>
          <label className="field"><span>MCP 地址</span><input type="url" value={s[key].url} onChange={(e) => patch({ [key]: { ...s[key], url: e.target.value.trim() } })} /></label>
          <label className="field"><span>鉴权</span><select value={s[key].auth} onChange={(e) => patch({ [key]: { ...s[key], auth: e.target.value as McpConfig['auth'] } })}><option value="bearer">Bearer</option><option value="secret-key">secret-key</option><option value="x-api-key">x-api-key</option><option value="none">无鉴权</option></select></label>
          <label className="field"><span>密钥</span><input type="password" autoComplete="off" value={s[key].apiKey} onChange={(e) => patch({ [key]: { ...s[key], apiKey: e.target.value.trim() } })} /></label>
          <label className="field"><span>协议</span><select value={s[key].protocol} onChange={(e) => patch({ [key]: { ...s[key], protocol: e.target.value as McpConfig['protocol'] } })}><option value="streamable">Streamable HTTP</option><option value="direct">直接 tools/call</option></select></label>
        </fieldset>)}
      </section>

      <section className="card">
        <h3>AI（OpenAI 或兼容接口）</h3>
        <label className="field">
          <span>API Key</span>
          <input type="password" value={s.openaiKey} onChange={(e) => patch({ openaiKey: e.target.value.trim() })} />
        </label>
        <label className="field">
          <span>接口地址</span>
          <input value={s.openaiBase} onChange={(e) => patch({ openaiBase: e.target.value.trim() })} />
        </label>
        <label className="field">
          <span>模型</span>
          <input value={s.model} onChange={(e) => patch({ model: e.target.value.trim() })} />
        </label>
        <label className="small">
          <input type="checkbox" checked={s.vision} onChange={(e) => patch({ vision: e.target.checked })} /> 拆解爆款元素时附主图识图（模型需支持识图）
        </label>
      </section>

      <section className="card">
        <h3>团队知识库：飞书多维表格</h3>
        <ol className="small" style={{ paddingLeft: 18 }}>
          <li>
            到 <a href="https://open.feishu.cn/app" target="_blank" rel="noreferrer">飞书开放平台</a> 创建企业自建应用，开通“查看、评论、编辑和管理多维表格”（bitable:app）权限，发布版本。
          </li>
          <li>新建一个多维表格，右上角 … → 添加文档应用，把这个应用加为“可编辑”。</li>
          <li>把多维表格链接粘到下面，点“连接并建表”——插件会自动建好 细分市场 / 爆款元素 / 标签体系 / 升级假设 四张表。</li>
        </ol>
        <label className="field">
          <span>App ID</span>
          <input value={s.feishuAppId} onChange={(e) => patch({ feishuAppId: e.target.value.trim() })} placeholder="cli_xxxxxxxx" />
        </label>
        <label className="field">
          <span>App Secret</span>
          <input type="password" value={s.feishuAppSecret} onChange={(e) => patch({ feishuAppSecret: e.target.value.trim() })} />
        </label>
        <label className="field">
          <span>多维表格链接（或 app_token）</span>
          <input value={s.feishuBase} onChange={(e) => patch({ feishuBase: e.target.value.trim() })} placeholder="https://xxx.feishu.cn/base/bascnXXXX?table=..." />
        </label>
        <label className="field">
          <span>你的名字（写入“更新人”）</span>
          <input value={s.userName} onChange={(e) => patch({ userName: e.target.value })} />
        </label>
        <label className="small">
          <input type="checkbox" checked={s.autoSync} onChange={(e) => patch({ autoSync: e.target.checked })} /> 诊断完成后自动写入知识库
        </label>
        <div style={{ marginTop: 8 }}>
          <button
            className="btn sm"
            disabled={!s.feishuAppId || !s.feishuAppSecret || !s.feishuBase}
            onClick={() => test('fs', () => new FeishuKb({ appId: s.feishuAppId, appSecret: s.feishuAppSecret, appToken: parseAppToken(s.feishuBase) }).ensure())}
          >
            连接并建表
          </button>{' '}
          <span className="small">{tests.fs}</span>
        </div>
      </section>

      <section className="card">
        <h3>样本量</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 12px' }}>
          {LIMIT_FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span>{f.label}</span>
              <input type="number" value={s.limits[f.key]} onChange={(e) => patch({ limits: { ...s.limits, [f.key]: Number(e.target.value) || DEFAULT_LIMITS[f.key] } })} />
              <span className="hint">{f.hint}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>默认评分权重</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0 12px' }}>
          {SCORE_DIMS.map((d) => (
            <label key={d} className="field">
              <span>{SCORE_DIM_NAMES[d]}</span>
              <input type="number" value={s.weights[d]} onChange={(e) => patch({ weights: { ...s.weights, [d]: Number(e.target.value) || 0 } })} />
            </label>
          ))}
        </div>
        <p className="hint">报告里也能临时调整；这里改的是新报告的默认值。</p>
      </section>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn primary" onClick={save}>
          保存
        </button>
        <span className="small">{saved}</span>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Options />);
