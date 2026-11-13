import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDemoInput, DEMO_MARKET } from '@/demo/research';
import { App, ModuleView } from '@/entrypoints/research/App';
import { DataSourceRouter, TIME_MACHINE_TIP } from '@/services/dataSources';
import type { McpApi } from '@/services/mcp';
import { loadSettings } from '@/utils/storage';
import { ATTRIBUTE_COLUMNS, COMPETITOR_GROUPS, MODULE_CATALOG, RESEARCH_SCHEMA, type ModuleId } from './schema';
import { adaptKeepa, adaptRevenue, adaptSif, loadResearchInput } from './load';
import { cell, competitionLevel, concentrationLevel, deduplicateUnits, isNewProduct, mapResearch, MODULE_MAPPERS } from './mappers';
import type { ResearchInput, ResearchModule, ResearchSection } from './types';

afterEach(() => vi.unstubAllGlobals());
const find = (m: ResearchModule, id: string) => m.sections.find((s) => s.id === id)!;
const output = (id: ModuleId, input = createDemoInput()) => MODULE_MAPPERS[id](input);
const sparse = (): ResearchInput => ({
  market: { ...DEMO_MARKET }, generatedAt: '2026-11-13T00:00:00.000Z', products: [{ asin: 'B0DEMO0001' }],
  units: { status: 'ok', source: 'sif', demo: false, data: { records: [] } },
  revenue: { status: 'ok', source: 'sellersprite', demo: false, data: { records: [] } },
  coupon: { status: 'unavailable', source: 'keepa', demo: false, notice: TIME_MACHINE_TIP },
});
function assertSection(s: ResearchSection) {
  expect(new Set(s.columns).size).toBe(s.columns.length);
  for (const r of s.rows) {
    expect(Object.keys(r.cells)).toEqual(s.columns);
    for (const c of Object.values(r.cells)) {
      expect(['ok', 'missing', 'unavailable', 'not_applicable']).toContain(c.status);
      if (c.status === 'ok') expect(c.value).not.toBeNull();
      else expect(c.value).toBeNull();
    }
  }
  s.dimensions?.forEach(assertSection);
}

describe('16 模块模板稳定性', () => {
  it('冻结全部模块名、章节顺序、列 key 和行标签', () => {
    expect(MODULE_CATALOG).toHaveLength(16);
    expect(MODULE_CATALOG).toMatchSnapshot();
    expect(Object.isFrozen(RESEARCH_SCHEMA)).toBe(true);
    expect(Object.isFrozen(RESEARCH_SCHEMA[6].sections[3].rowLabels)).toBe(true);
  });
  for (const schema of MODULE_CATALOG) {
    it(`${schema.moduleId}. ${schema.moduleName}：演示与稀疏输入保持固定 shape`, () => {
      for (const input of [createDemoInput(), sparse()]) {
        const m = MODULE_MAPPERS[schema.moduleId](input);
        expect(m.moduleName).toBe(schema.moduleName);
        expect(m.market).toEqual(input.market);
        expect(Object.keys(m.sourceNotes)).toEqual(['units', 'revenue', 'coupon']);
        expect(m.sections.map((s) => s.id)).toEqual(schema.sections.map((s) => s.id));
        m.sections.forEach((s, n) => {
          assertSection(s);
          const spec = schema.sections[n];
          if (spec.kind === 'cards') expect(s.columns).toEqual(['项目', ...input.products.map((p) => p.asin)]);
          else expect(s.columns.slice(0, spec.columns.length)).toEqual(spec.columns);
          if (spec.rowLabels.length) expect(s.rows.map((r) => r.label)).toEqual(spec.rowLabels);
        });
      }
    });
  }
  it('缺数保持 null + status；不把未填成本视为 0', () => {
    const row = find(output(16, sparse()), 'profit').rows[0];
    for (const key of ['套装售价（SIF）', '卖家精灵对照价', '采购成本', '头程', '平台佣金', '自定义毛利率']) expect(row.cells[key]).toMatchObject({ value: null, status: 'missing' });
    expect(row.cells.Coupon后价格).toMatchObject({ value: null, status: 'unavailable' });
    expect(row.cells.广告后利润.value).toBeNull();
  });
  it('空打标仍保留度量列与空维度数组', () => {
    const s = find(output(5, sparse()), 'attributes');
    expect(s.columns).toEqual(ATTRIBUTE_COLUMNS); expect(s.dimensions).toEqual([]);
  });
  it('打标名动态生成，维度不写死；月份与属性列按约定位置展开', () => {
    const m = output(5), s = find(m, 'attributes');
    expect(s.dimensions!.map((d) => d.title)).toEqual(['维度1｜材质', '维度2｜套装']);
    s.dimensions!.forEach((d) => expect(d.columns).toEqual(ATTRIBUTE_COLUMNS));
    expect(find(m, 'asins').columns.slice(18)).toMatchSnapshot();
  });
  it('类目不适用的性能行保留 not_applicable', () => {
    const s = find(output(6), 'group3');
    expect(s.rows.map((r) => r.label)).toEqual(COMPETITOR_GROUPS[3].rows);
    expect(s.rows.find((r) => r.label === '色温')!.cells.B0DEMO0001).toEqual({ value: null, status: 'not_applicable' });
  });
  it('合规和知识产权无证据整行不可用；明确不适用独立处理', () => {
    for (const id of [12, 15] as const) find(output(id), 'checks').rows.forEach((r) => Object.values(r.cells).forEach((c) => expect(c).toEqual({ value: null, status: 'unavailable' })));
    const i = sparse(); i.compliance = { 说明书语言: { notApplicable: true }, 警告语: { fields: { 要求摘要: '无证据的输入不采纳' } } };
    const rows = find(output(12, i), 'checks').rows;
    expect(rows[1].cells.要求摘要.status).toBe('not_applicable'); expect(rows[2].cells.要求摘要.status).toBe('unavailable');
  });
  it('16 模块共用 renderer 按 schema 的列顺序呈现（缺数也不删表头）', () => {
    for (const m of mapResearch(sparse())) {
      const el = document.createElement('div'); el.innerHTML = renderToStaticMarkup(createElement(ModuleView, { module: m }));
      const tables = el.querySelectorAll('table'); expect(tables).toHaveLength(m.sections.length);
      m.sections.forEach((s, n) => expect([...tables[n].querySelectorAll('th')].map((th) => th.textContent)).toEqual(s.columns.map((c) => c.replace('{期末月}', '2026-11'))));
    }
  });
  it('页面可生成演示并切换全部 16 个模块，清空成本恢复缺失状态', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const network = vi.fn(() => { throw new Error('不允许外发'); }); vi.stubGlobal('fetch', network);
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    try {
      await act(async () => { root.render(createElement(App)); });
      await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
      const buttons = [...host.querySelectorAll<HTMLButtonElement>('[aria-label="选品调研模块"] button')];
      expect(buttons).toHaveLength(16);
      for (const [n, button] of buttons.entries()) {
        await act(async () => button.click());
        expect(host.querySelector('article h1')!.textContent).toContain(MODULE_CATALOG[n].moduleName);
      }
      expect(host.querySelector('article')!.textContent).toContain('6.5');
      const costField = [...host.querySelectorAll('label')].find((label) => label.querySelector('span')?.textContent === '采购成本')!.querySelector('input')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(costField, '');
        costField.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const profitRow = [...host.querySelectorAll('article tbody tr')][0];
      expect(profitRow.children[6].textContent).toContain('缺失'); expect(profitRow.children[14].textContent).toContain('缺失');
      expect(network).not.toHaveBeenCalled();
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
});

describe('计算口径和缺数边界', () => {
  it('每日竞争程度使用原始值而非舍入供需比；零与缺失不同', () => {
    const i = sparse(); i.keywords = [{ fields: { 关键词: '精度', 月搜索量: 10000, 商品数: 333, 供需比: 30 } }, { fields: { 月搜索量: 0, 商品数: 20 } }, { fields: { 月搜索量: 10, 商品数: 0 } }, { fields: { 商品数: 20 } }];
    const rows = find(output(3, i), 'keywords').rows;
    expect(rows[0].cells.每日竞争程度.value).toBe(10000 / 333 / 30);
    expect(rows[1].cells.每日竞争程度).toEqual(cell(0));
    expect(rows[2].cells.每日竞争程度).toEqual(cell(null)); expect(rows[3].cells.每日竞争程度).toEqual(cell(null));
    expect([2.999, 3, 5, 10, 20, null].map(competitionLevel)).toEqual(['异常激烈', '较激烈', '一般', '不激烈', '相对不饱和', null]);
  });
  it('均值和搜索加权均值分别按有效样本计算', () => {
    const i = sparse(); i.keywords = [{ fields: { 月搜索量: 100, 购买率: .1, 前三ASIN转化总占比: .4 } }, { fields: { 月搜索量: 300, 购买率: .3 } }, { fields: { 月搜索量: 99999 } }];
    const r = find(output(4, i), 'summary').rows.find((r) => r.label === '类目平均转化率预估')!;
    expect(r.cells.内容.value).toEqual({ 购买率: { 样本数: cell(2), 简单均值: cell(.2), 搜索量加权均值: cell(.25) }, 前三ASIN转化总占比: { 样本数: cell(1), 简单均值: cell(.4), 搜索量加权均值: cell(.4) } });
  });
  it('周统计排除缺失和未完整周，包括真实 0', () => {
    const i = sparse(); i.trends = { weeks: [{ start: '2026-01-01', index: 0, complete: true }, { start: '2026-01-08', index: 100, complete: false }, { start: '2026-01-15', index: null, complete: true }] };
    const stats = find(output(2, i), 'stats').rows;
    expect(stats[0].cells.内容.value).toBe(1); expect(stats[1].cells.内容.value).toBe(0); expect(stats[5].cells.内容.value).toBeNull();
  });
  it('新品按统计月及前 5 个月，跨年边界，不取父体日期', () => {
    expect(isNewProduct('2026-06-01', '2026-11')).toBe(true); expect(isNewProduct('2026-05-31', '2026-11')).toBe(false);
    expect(isNewProduct('2025-10-01', '2026-03')).toBe(true); expect(isNewProduct('2026-12-01', '2026-11')).toBeNull(); expect(isNewProduct(undefined, '2026-11')).toBeNull();
  });
  it('父体销量不重复；模块 1 逐月选样可超 100 行，原始逐行值保留', () => {
    const i = sparse(); i.products = Array.from({ length: 101 }, (_, n) => ({ asin: `SYNTH${n}`, parentAsin: 'SYNTH-PARENT' }));
    const records = i.products.map((p) => ({ asin: p.asin, parentAsin: p.parentAsin, month: '2026-11', units: 50, scope: 'parent' as const, rank: 1, nodeId: 'demo-node' }));
    i.units = { status: 'ok', source: 'sif', demo: true, data: { records } };
    expect(deduplicateUnits(records)).toHaveLength(1);
    const sample = find(output(1, i), 'sampling').rows.at(-1)!;
    expect(sample.cells.入选记录数.value).toBe(101); expect(sample.cells.月销量合计.value).toBe(5050);
    expect(find(output(5, i), 'monthly').rows.at(-1)!.cells.月销量下限.value).toBe(50);
    expect(find(output(5, i), 'monthly').rows.at(-1)!.cells.SIF有值ASIN.value).toBe(101);
    expect(find(output(10, i), 'landscape').rows[0].cells.子体月订单量.value).toBeNull();
  });
  it('模块 5 和 13 共用同一集中度结果；阈值边界一致', () => {
    expect(find(output(5), 'concentration').rows).toEqual(find(output(13), 'concentration').rows);
    expect([.2999, .3, .5].map((v) => concentrationLevel(v))).toEqual(['低', '中', '高']);
    expect([.4499, .45, .7].map((v) => concentrationLevel(v, true))).toEqual(['低', '中', '高']);
  });
  it('利润按已知成本计算，真实零成本有效，不使用销售额÷销量', () => {
    const row = find(output(16), 'profit').rows[0];
    expect(row.cells['套装售价（SIF）'].value).toBe(20); expect(row.cells.其他费用.value).toBe(0);
    expect(row.cells.毛利额.value).toBe(8); expect(row.cells.广告后利润.value).toBe(6.5); expect(row.cells.广告后利润率.value).toBe(6.5 / 18);
  });
  it('调用方观测不能替代受保护的购买量和优惠来源', () => {
    const i = sparse(); i.keywords = [{ fields: { 关键词: 'demo', 月购买量: 999 } }];
    i.products[0].competitor = { '当前Coupon / 活动记录': '非法替代', 近30天最低报价: 1 };
    expect(find(output(3, i), 'keywords').rows[0].cells.月购买量.value).toBeNull();
    expect(find(output(6, i), 'group2').rows.find((r) => r.label === '当前Coupon / 活动记录')!.cells.B0DEMO0001.status).toBe('unavailable');
  });
});

async function configured() {
  const s = await loadSettings();
  const config = { url: 'https://example.test/mcp', apiKey: '', auth: 'none' as const, protocol: 'direct' as const };
  return { ...s, sifMcp: config, keepaMcp: config, seekerMcp: config, sellerspriteKey: 'synthetic-test-credential' };
}
function client(data: unknown = {}) { return { callTool: vi.fn(async () => data) } as unknown as McpApi & { callTool: ReturnType<typeof vi.fn> }; }

describe('DataSourceRouter 来源不可改口', () => {
  it('销量仅 SIF；销售额仅卖家精灵；不能用 metric 为跨来源工具改口', async () => {
    const sif = client(), ss = client(), keepa = client(), seeker = client();
    const r = new DataSourceRouter(await configured(), false, { sif, sellersprite: ss, keepa, seeker });
    expect((await r.call('units', 'ops_get_asin_sales_list', {})).source).toBe('sif');
    expect((await r.call('revenue', 'asin_sales_trend', {})).source).toBe('sellersprite');
    for (const [metric, tool] of [['units', 'competitor_lookup'], ['revenue', 'ops_get_asin_sales_trend'], ['coupon', 'asin_coupon_trend'], ['coupon', 'asin_detail_with_coupon_trend'], ['marketBackground', 'seakerai__selection_category_top_100_asin_monthly_sales_trends']] as const) await expect(r.call(metric, tool, {})).rejects.toThrow('不符合数据源口径');
    expect(sif.callTool.mock.calls.map((a) => a[0])).toEqual(['ops_get_asin_sales_list']); expect(ss.callTool.mock.calls.map((a) => a[0])).toEqual(['asin_sales_trend']); expect(keepa.callTool).not.toHaveBeenCalled(); expect(seeker.callTool).not.toHaveBeenCalled();
  });
  it('Keepa 失败不调用卖家精灵优惠工具，并给出运营时光机提示', async () => {
    const keepa = client(), ss = client(); keepa.callTool.mockRejectedValue(new Error('服务失败'));
    const r = new DataSourceRouter(await configured(), false, { keepa, sellersprite: ss });
    expect(await r.call('coupon', 'keepa__product', {})).toEqual({ status: 'unavailable', source: 'keepa', demo: false, notice: TIME_MACHINE_TIP });
    expect(ss.callTool).not.toHaveBeenCalled();
  });
  it('未配置返回 unavailable，不能悄悄使用 FakeResearchMcp', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const r = new DataSourceRouter(await loadSettings());
    for (const [metric, tool] of [['units', 'ops_get_asin_sales_list'], ['revenue', 'asin_sales_trend'], ['coupon', 'keepa__product']] as const) expect((await r.call(metric, tool, {})).status).toBe('unavailable');
    expect((await r.call('coupon', 'keepa__product', {})).notice).toContain('请使用 SIF 插件在前台下载「运营时光机」历史数据'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('演示端到端不发送请求，即使存在真实配置或注入外部 client', async () => {
    const fetcher = vi.fn(() => { throw new Error('演示禁止网络'); }); vi.stubGlobal('fetch', fetcher);
    const real = client(); const router = new DataSourceRouter(await configured(), true, { sif: real, sellersprite: real, keepa: real, seeker: real });
    const result = await loadResearchInput(router, DEMO_MARKET, []);
    const report = mapResearch(result); expect(report).toHaveLength(16); report.forEach((m) => m.sections.forEach(assertSection));
    expect(result.units.status).toBe('ok'); expect(result.revenue.status).toBe('ok'); expect(result.coupon.status).toBe('ok');
    expect(fetcher).not.toHaveBeenCalled(); expect(real.callTool).not.toHaveBeenCalled();
  });
});

describe('真实数据边界', () => {
  it('SIF 序列按下标对齐，前导缺数和档位文本不解析为零或精确销量', () => {
    const r = adaptSif({ boughtHistoryDates: ['2026-09-01', '2026-10-01', '2026-11-01'], asins: [{ asin: 'SYNTH', boughtHistory: [null, 0, 20], pasinBoughtHistory: [100, 100, 100], boughtInPastMonth: '5,000+' }] }).records;
    expect(r.map((r) => r.units)).toEqual([null, 0, 20]); expect(r[2].tier).toBe('5,000+');
  });
  it('销售额只取子体 totalAmount；不读父体金额、销量和优惠字段', () => {
    const r = adaptRevenue({ items: [{ asin: 'SYNTH', totalAmount: 500, totalUnits: 20, parentTotalAmount: 9999, coupon: 99 }, { asin: 'UNKNOWN', totalUnits: 10 }] }, '2026-11').records;
    expect(r[0]).toEqual({ asin: 'SYNTH', month: '2026-11', revenue: 500, comparisonPrice: undefined }); expect(r[1].revenue).toBeNull();
  });
  it('未知 Keepa 响应不可用，规范化的真实零报价不会被丢弃', () => {
    expect(adaptKeepa({ source: 'keepa', status: 'ok', demo: false, data: { unknown: 1 } })).toMatchObject({ status: 'unavailable', notice: expect.stringContaining('运营时光机') });
    const r = adaptKeepa({ source: 'keepa', status: 'ok', demo: false, data: { records: [{ asin: 'SYNTH', afterPrice: 0, current: '无优惠（证据）' }] } });
    expect(r.status === 'ok' && r.data.records[0].afterPrice).toBe(0);
  });
});
