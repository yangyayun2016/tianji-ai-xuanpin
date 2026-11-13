import { describe, expect, it } from 'vitest';
import { DEMO_ASIN, FakeAi, FakeSellerSprite, MemoryKb } from '@/demo/fake';
import { DEFAULT_COST, DEFAULT_WEIGHTS } from '@/core/types';
import { DEFAULT_LIMITS } from '@/utils/storage';
import { cellText, FeishuClient, parseAppToken } from './feishu';
import { FeishuKb, reportRows } from './kb';
import { applyMarketEdit, runDiagnosis, runMarket, type Deps } from './pipeline';

const deps = (kb = new MemoryKb()): Deps => ({ ss: new FakeSellerSprite(), ai: new FakeAi(), kb, limits: DEFAULT_LIMITS, weights: DEFAULT_WEIGHTS, cost: DEFAULT_COST, autoSync: true, progress: () => {}, now: new Date(2026, 10, 10).getTime() });

describe('主流程（演示数据）', () => {
  it('切市场：去重、剔配件、我的形态组、价格区间', async () => {
    const r = await runMarket(DEMO_ASIN, deps());
    expect(r.stage).toBe('market');
    expect(r.market.duplicates).toHaveLength(2);
    expect(r.market.accessories.length).toBeGreaterThan(20);
    expect(r.market.myForm).toBe('插电循环饮水机');
    expect(r.market.asins).toContain(DEMO_ASIN);
    expect(r.market.bands.some((b) => b.mine)).toBe(true);
  });

  it('人工调整：把一个产品移出细分市场', async () => {
    const r = await runMarket(DEMO_ASIN, deps());
    const out = r.market.asins.find((a) => a !== DEMO_ASIN)!;
    const r2 = applyMarketEdit(r, { exclude: out });
    expect(r2.market.asins).not.toContain(out);
    expect(r2.market.asins.length).toBe(r.market.asins.length - 1);
  });

  it('诊断：差评独有/共性、差距矩阵、方案评分、写知识库', async () => {
    const d = deps();
    const r = await runDiagnosis(await runMarket(DEMO_ASIN, d), d);
    expect(r.stage).toBe('done');
    expect(r.benchmarks.length).toBeGreaterThan(2);
    const noise = r.review!.stats.find((s) => s.aspect === 'noise')!;
    expect(noise.scope).toBe('本品独有');
    expect(r.review!.stats.find((s) => s.aspect === 'cleaning')!.scope).toBe('品类共性');
    expect(r.gaps.some((g) => g.quadrant === '他有我劣' && g.item === '水泵噪音')).toBe(true);
    expect(r.hypotheses.length).toBeGreaterThan(4);
    expect(Object.keys(r.scores)).toHaveLength(r.hypotheses.length);
    expect(r.kb?.ok).toBe(true);
    // 第二次跑同一市场：复用已锁定的标签体系
    const d2 = deps((d.kb as MemoryKb) ?? undefined);
    const again = await runDiagnosis(await runMarket(DEMO_ASIN, d2), d2);
    expect(again.review!.fromKb).toBe(true);
  });

  it('知识库行：元素按类型拆行，假设卡带评分和短板', async () => {
    const d = { ...deps(), kb: null };
    const r = await runDiagnosis(await runMarket(DEMO_ASIN, d), d);
    const rows = reportRows(r);
    expect(rows.market.细分市场).toContain('插电循环饮水机');
    expect(rows.elements.some((e) => e.元素类型 === '可迁移')).toBe(true);
    expect(rows.hypos[0].总分).toBeGreaterThan(0);
    expect(rows.scheme).not.toBeNull();
  });
});

describe('飞书多维表格', () => {
  it('从链接提取 app_token', () => {
    expect(parseAppToken('https://abc.feishu.cn/base/bascnXYZ123?table=tbl1&view=vew1')).toBe('bascnXYZ123');
    expect(parseAppToken('bascnXYZ123')).toBe('bascnXYZ123');
    expect(parseAppToken('https://x.feishu.cn/wiki/AepJwgjt123?table=tbl1&view=v')).toBe('wiki:AepJwgjt123');
  });

  it('知识库链接先换成多维表格 app_token', async () => {
    const urls: string[] = [];
    const fetcher = (async (url: string) => {
      const u = String(url);
      urls.push(u);
      const json = (o: unknown) => new Response(JSON.stringify(o));
      if (u.includes('tenant_access_token')) return json({ code: 0, tenant_access_token: 't', expire: 7200 });
      if (u.includes('/wiki/v2/spaces/get_node?token=AepJ')) return json({ code: 0, data: { node: { obj_type: 'bitable', obj_token: 'basREAL' } } });
      return json({ code: 0, data: { items: [] } });
    }) as typeof fetch;
    const c = new FeishuClient({ appId: 'a', appSecret: 's', appToken: 'wiki:AepJ' }, fetcher);
    await c.listTables();
    expect(urls.some((u) => u.includes('/bitable/v1/apps/basREAL/tables'))).toBe(true);
  });

  it('读文本字段兼容片段数组', () => {
    expect(cellText([{ type: 'text', text: '水位' }, { type: 'text', text: '窗' }])).toBe('水位窗');
    expect(cellText(12)).toBe('12');
  });

  it('自动建表、补字段，token 复用，错误码给出中文提示', async () => {
    const calls: string[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      const u = String(url);
      calls.push(`${init?.method} ${u.replace('https://open.feishu.cn/open-apis', '')}`);
      const json = (o: unknown) => new Response(JSON.stringify(o));
      if (u.includes('tenant_access_token')) return json({ code: 0, msg: 'ok', tenant_access_token: 't', expire: 7200 });
      if (u.endsWith('/tables?page_size=100')) return json({ code: 0, data: { items: [{ table_id: 'tblH', name: '升级假设' }] } });
      if (u.includes('/tables/tblH/fields')) return init?.method === 'GET' ? json({ code: 0, data: { items: [{ field_name: '卡片ID', type: 1 }] } }) : json({ code: 0, data: {} });
      if (u.endsWith('/tables') && init?.method === 'POST') return json({ code: 0, data: { table_id: `tbl${calls.length}` } });
      return json({ code: 91403, msg: 'Forbidden' });
    }) as typeof fetch;
    const kb = new FeishuKb({ appId: 'a', appSecret: 's', appToken: 'bas' }, fetcher);
    const msg = await kb.ensure();
    expect(msg).toContain('新建表：细分市场、爆款元素、标签体系');
    expect(msg).toContain('补字段：升级假设.方案');
    expect(calls.filter((c) => c.includes('tenant_access_token'))).toHaveLength(1);
    const c = new FeishuClient({ appId: 'a', appSecret: 's', appToken: 'bas' }, fetcher);
    await expect(c.search('tblX')).rejects.toThrow('添加文档应用');
  });
});
