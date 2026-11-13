import { normalizeAspects } from '@/core/normalize';
import { SCORE_DIM_NAMES, type Aspect, type Report } from '@/core/types';
import { cellNumber, cellText, FeishuClient, FIELD_NUMBER, FIELD_TEXT, type FeishuConfig, type FieldType } from './feishu';

/**
 * 团队知识库：四张多维表格，插件第一次连接时自动建表、补字段。
 * - 细分市场：每个“类目节点 × 形态组”一行
 * - 爆款元素：对标爆款和我的产品拆出来的元素，一个元素一行，方便按元素检索、跨类目迁移
 * - 标签体系：每个细分市场锁定一套差评标签，之后同市场复用，保证前后可比
 * - 升级假设：方案卡 + 评分 + 测试状态和结论（团队在表格里直接改状态也行）
 */
export const TABLES = {
  market: '细分市场',
  element: '爆款元素',
  scheme: '标签体系',
  hypo: '升级假设',
} as const;
type TableKey = keyof typeof TABLES;

const T = FIELD_TEXT;
const N = FIELD_NUMBER;
export const SCHEMA: Record<TableKey, { name: string; type: FieldType }[]> = {
  market: [
    { name: '市场ID', type: T },
    { name: '细分市场', type: T },
    { name: '类目路径', type: T },
    { name: '形态', type: T },
    { name: '样本数', type: N },
    { name: '形态组月销占比', type: N },
    { name: '最近诊断ASIN', type: T },
    { name: '更新时间', type: T },
  ],
  element: [
    { name: '元素键', type: T },
    { name: '市场ID', type: T },
    { name: '细分市场', type: T },
    { name: 'ASIN', type: T },
    { name: '角色', type: T },
    { name: '元素类型', type: T },
    { name: '元素', type: T },
    { name: '购买理由', type: T },
    { name: '打法', type: T },
    { name: '月销', type: N },
    { name: '价格', type: N },
    { name: '更新时间', type: T },
  ],
  scheme: [
    { name: '市场ID', type: T },
    { name: '细分市场', type: T },
    { name: '维度数', type: N },
    { name: '标签体系', type: T },
    { name: '锁定时间', type: T },
  ],
  hypo: [
    { name: '卡片ID', type: T },
    { name: '方案', type: T },
    { name: '市场ID', type: T },
    { name: '细分市场', type: T },
    { name: 'ASIN', type: T },
    { name: '杠杆', type: T },
    { name: '唯一变量', type: T },
    { name: '保留不动', type: T },
    { name: '目标人群', type: T },
    { name: '场景', type: T },
    { name: '购买理由', type: T },
    { name: '等级', type: T },
    { name: '需求层次', type: T },
    { name: '证据', type: T },
    { name: '验证动作', type: T },
    { name: '总分', type: N },
    { name: '短板', type: T },
    { name: '状态', type: T },
    { name: '测试指标', type: T },
    { name: '测试结论', type: T },
    { name: '更新人', type: T },
    { name: '更新时间', type: T },
  ],
};

export const HYPO_STATUS = ['待测试', '测试中', '有效', '无效', '放弃'] as const;
export type HypoStatus = (typeof HYPO_STATUS)[number];

export interface KbHypothesis {
  recordId: string;
  cardId: string;
  title: string;
  market: string;
  asin: string;
  lever: string;
  change: string;
  pitch: string;
  level: string;
  score: number;
  weakest: string;
  status: string;
  metrics: string;
  conclusion: string;
  updatedBy: string;
  updatedAt: string;
}

export interface KbElement {
  market: string;
  asin: string;
  role: string;
  type: string;
  value: string;
  pitch: string;
  units: number;
}

export interface KnowledgeBase {
  /** 连接并确保四张表和字段存在，返回说明 */
  ensure(): Promise<string>;
  getTagScheme(marketId: string): Promise<Aspect[] | null>;
  saveReport(r: Report): Promise<string>;
  listHypotheses(): Promise<KbHypothesis[]>;
  updateHypothesis(recordId: string, patch: { status?: string; metrics?: string; conclusion?: string; updatedBy?: string }): Promise<void>;
  listElements(): Promise<KbElement[]>;
}

/** 本地日期时间字符串（不用 toISOString，东八区会差一天） */
export function stamp(ms = Date.now()): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const marketId = (r: Report) => `${r.market.nodeIdPath}|${r.market.myForm}`;
export const marketLabel = (r: Report) => `${r.market.nodeLabelPath.split(/[:›>]/).pop()?.trim() || r.market.nodeLabelPath}·${r.market.myForm}`;

const ELEMENT_TYPES: [keyof Report['elements'][string], string][] = [
  ['demand', '需求'],
  ['scene', '场景'],
  ['persona', '人群'],
  ['structure', '结构'],
  ['visual', '视觉'],
  ['priceSpec', '价格规格'],
  ['transferable', '可迁移'],
];

/** 把报告转成四张表的行（纯函数，方便测试） */
export function reportRows(r: Report) {
  const mid = marketId(r);
  const label = marketLabel(r);
  const now = stamp();
  const group = r.market.groups.find((g) => g.form === r.market.myForm);
  const market = { 市场ID: mid, 细分市场: label, 类目路径: r.market.nodeLabelPath, 形态: r.market.myForm, 样本数: r.market.asins.length, 形态组月销占比: group?.unitsShare ?? 0, 最近诊断ASIN: r.asin, 更新时间: now };
  const top = new Map(r.top.map((p) => [p.asin, p]));
  const role = (asin: string) => (asin === r.asin ? '我的产品' : `对标·${r.benchmarks.find((b) => b.asin === asin)?.type ?? ''}`);
  const elements = Object.values(r.elements).flatMap((e) =>
    ELEMENT_TYPES.flatMap(([k, type]) =>
      (e[k] as string[]).map((value) => ({
        元素键: `${mid}|${e.asin}|${type}|${value}`,
        市场ID: mid,
        细分市场: label,
        ASIN: e.asin,
        角色: role(e.asin),
        元素类型: type,
        元素: value,
        购买理由: e.realPitch,
        打法: e.playbook,
        月销: top.get(e.asin)?.units ?? 0,
        价格: top.get(e.asin)?.price ?? r.me.price,
        更新时间: now,
      })),
    ),
  );
  const scheme = r.review && !r.review.fromKb ? { 市场ID: mid, 细分市场: label, 维度数: r.review.aspects.length, 标签体系: JSON.stringify({ aspects: r.review.aspects }), 锁定时间: now } : null;
  const gaps = new Map(r.gaps.map((g) => [g.id, g]));
  const hypos = r.hypotheses.map((h) => {
    const s = r.scores[h.id];
    return {
      // 同一 ASIN 重新诊断时，同杠杆同标题的方案更新原卡片（保留团队填的状态和结论），不重复建卡
      卡片ID: `${r.asin}|${h.lever}|${h.title}`,
      方案: h.title,
      市场ID: mid,
      细分市场: label,
      ASIN: r.asin,
      杠杆: h.lever,
      唯一变量: h.change,
      保留不动: h.keep.join('；'),
      目标人群: h.persona,
      场景: h.scene,
      购买理由: h.pitch,
      等级: h.level,
      需求层次: h.need,
      证据: h.evidence.map((id) => (gaps.get(id) ? `${gaps.get(id)!.quadrant}·${gaps.get(id)!.item}` : id)).join('；'),
      验证动作: h.verify,
      总分: s?.total ?? 0,
      短板: s ? SCORE_DIM_NAMES[s.weakest] : '',
      更新时间: now,
    };
  });
  return { market, elements, scheme, hypos };
}

export class FeishuKb implements KnowledgeBase {
  private ids: Partial<Record<TableKey, string>> = {};
  readonly client: FeishuClient;

  constructor(config: FeishuConfig, fetcher?: typeof fetch) {
    if (!config.appToken) throw new Error('还没有填写飞书多维表格链接，请先到设置页填写');
    this.client = new FeishuClient(config, fetcher);
  }

  async ensure(): Promise<string> {
    const tables = await this.client.listTables();
    const created: string[] = [];
    const added: string[] = [];
    for (const key of Object.keys(TABLES) as TableKey[]) {
      const name = TABLES[key];
      const hit = tables.find((t) => t.name === name);
      if (!hit) {
        this.ids[key] = await this.client.createTable(name, SCHEMA[key]);
        created.push(name);
        continue;
      }
      this.ids[key] = hit.table_id;
      const have = new Set((await this.client.listFields(hit.table_id)).map((f) => f.field_name));
      for (const f of SCHEMA[key]) {
        if (have.has(f.name)) continue;
        await this.client.createField(hit.table_id, f.name, f.type);
        added.push(`${name}.${f.name}`);
      }
    }
    return [created.length ? `新建表：${created.join('、')}` : '四张表已存在', added.length ? `补字段：${added.join('、')}` : ''].filter(Boolean).join('；');
  }

  private async id(key: TableKey): Promise<string> {
    if (!this.ids[key]) await this.ensure();
    return this.ids[key]!;
  }

  async getTagScheme(mid: string): Promise<Aspect[] | null> {
    const rows = await this.client.search(await this.id('scheme'), '市场ID', mid, 50);
    if (!rows.length) return null;
    const latest = rows.sort((a, b) => cellText(b.fields['锁定时间']).localeCompare(cellText(a.fields['锁定时间'])))[0];
    try {
      const aspects = normalizeAspects(JSON.parse(cellText(latest.fields['标签体系'])));
      return aspects.length ? aspects : null;
    } catch {
      return null;
    }
  }

  /** 按键字段 upsert：已有就更新（保留团队手填的状态/结论），没有就新建 */
  private async upsert(key: TableKey, keyField: string, rows: Record<string, unknown>[], scope?: { field: string; value: string }) {
    if (!rows.length) return { created: 0, updated: 0 };
    const tid = await this.id(key);
    const existing = scope ? await this.client.search(tid, scope.field, scope.value) : await this.client.search(tid);
    const byKey = new Map(existing.map((e) => [cellText(e.fields[keyField]), e.record_id]));
    const create = rows.filter((r) => !byKey.has(String(r[keyField])));
    const update = rows.filter((r) => byKey.has(String(r[keyField]))).map((r) => ({ record_id: byKey.get(String(r[keyField]))!, fields: r }));
    await this.client.batchCreate(tid, create);
    await this.client.batchUpdate(tid, update);
    return { created: create.length, updated: update.length };
  }

  async saveReport(r: Report): Promise<string> {
    const { market, elements, scheme, hypos } = reportRows(r);
    const mid = market.市场ID;
    await this.upsert('market', '市场ID', [market]);
    const e = await this.upsert('element', '元素键', elements, { field: '市场ID', value: mid });
    if (scheme) await this.client.batchCreate(await this.id('scheme'), [scheme]);
    const h = await this.upsert('hypo', '卡片ID', hypos.map((x) => ({ ...x })), { field: 'ASIN', value: r.asin });
    // 新建的假设卡默认“待测试”
    const tid = await this.id('hypo');
    const fresh = (await this.client.search(tid, 'ASIN', r.asin)).filter((x) => !cellText(x.fields['状态']));
    if (fresh.length) await this.client.batchUpdate(tid, fresh.map((x) => ({ record_id: x.record_id, fields: { 状态: '待测试' } })));
    return `已写入飞书：元素 新增 ${e.created}/更新 ${e.updated}，假设卡 新增 ${h.created}/更新 ${h.updated}${scheme ? '，已锁定本市场标签体系' : ''}`;
  }

  async listHypotheses(): Promise<KbHypothesis[]> {
    const rows = await this.client.search(await this.id('hypo'));
    return rows.map((x) => {
      const f = (k: string) => cellText(x.fields[k]);
      return {
        recordId: x.record_id,
        cardId: f('卡片ID'),
        title: f('方案'),
        market: f('细分市场'),
        asin: f('ASIN'),
        lever: f('杠杆'),
        change: f('唯一变量'),
        pitch: f('购买理由'),
        level: f('等级'),
        score: cellNumber(x.fields['总分']),
        weakest: f('短板'),
        status: f('状态') || '待测试',
        metrics: f('测试指标'),
        conclusion: f('测试结论'),
        updatedBy: f('更新人'),
        updatedAt: f('更新时间'),
      };
    });
  }

  async updateHypothesis(recordId: string, p: { status?: string; metrics?: string; conclusion?: string; updatedBy?: string }): Promise<void> {
    const fields: Record<string, string> = { 更新时间: stamp() };
    if (p.status !== undefined) fields['状态'] = p.status;
    if (p.metrics !== undefined) fields['测试指标'] = p.metrics;
    if (p.conclusion !== undefined) fields['测试结论'] = p.conclusion;
    if (p.updatedBy !== undefined) fields['更新人'] = p.updatedBy;
    await this.client.batchUpdate(await this.id('hypo'), [{ record_id: recordId, fields }]);
  }

  async listElements(): Promise<KbElement[]> {
    const rows = await this.client.search(await this.id('element'), undefined, undefined, 5000);
    return rows.map((x) => ({
      market: cellText(x.fields['细分市场']),
      asin: cellText(x.fields['ASIN']),
      role: cellText(x.fields['角色']),
      type: cellText(x.fields['元素类型']),
      value: cellText(x.fields['元素']),
      pitch: cellText(x.fields['购买理由']),
      units: cellNumber(x.fields['月销']),
    }));
  }
}
