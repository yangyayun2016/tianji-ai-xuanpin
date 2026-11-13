import type { Prompt } from '@/core/prompts';
import type { Aspect, Report } from '@/core/types';
import type { AiApi } from '@/services/ai';
import { reportRows, stamp, type KbElement, type KbHypothesis, type KnowledgeBase } from '@/services/kb';
import type { SellerSpriteApi } from '@/services/sellersprite';
import { get, set } from '@/utils/storage';

/**
 * 演示 / 测试用的模拟数据：一个“宠物饮水机”细分类目。
 * ?demo=1 和单元测试共用，不调用任何真实接口。
 */
export const DEMO_ASIN = 'B0DEMO0001';
const DAY = 86400000;
const NOW = new Date(2026, 10, 10).getTime();

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const KINDS = [
  { kind: 'pump', n: 110, price: [19, 36], titles: ['Cat Water Fountain, 2.5L Automatic Pet Water Dispenser with Ultra Quiet Pump', 'Stainless Steel Cat Fountain 3.2L Pet Water Fountain for Cats and Dogs', 'Pet Water Fountain with LED Light, Ceramic Top, Dishwasher Safe', 'Cat Water Fountain with Water Level Window, Quiet Pump, Triple Filtration', 'Dog Water Fountain 4L Large Capacity for Multiple Pets, Easy Clean'] },
  { kind: 'wireless', n: 35, price: [32, 55], titles: ['Wireless Cat Water Fountain Battery Operated, Motion Sensor, Stainless Steel', 'Cordless Pet Water Fountain Rechargeable 5000mAh, App Monitoring', 'Battery Cat Fountain Wireless Pump, 30 Days Runtime, Quiet'] },
  { kind: 'gravity', n: 25, price: [9, 18], titles: ['Gravity Pet Water Dispenser 1 Gallon Automatic Waterer for Dogs Cats', 'Gravity Water Bowl for Cats, Stainless Steel Bowl with Bottle'] },
  { kind: 'filter', n: 30, price: [8, 16], titles: ['Replacement Filters for Cat Water Fountain, 8 Pack Carbon Filters', 'Pet Fountain Filters Compatible with 2.5L Cat Fountain, 12 Pack', 'Cat Fountain Pump Replacement Motor'] },
];

export function demoTop(): Record<string, unknown>[] {
  const r = rng(7);
  const items: Record<string, unknown>[] = [];
  let i = 0;
  for (const k of KINDS) {
    for (let j = 0; j < k.n; j++, i++) {
      const asin = i === 3 ? DEMO_ASIN : `B0DM${String(i).padStart(6, '0')}`;
      const units = Math.round(9000 * Math.exp(-i / 35) * (0.6 + r()) + 50);
      const ageDays = j % 9 === 0 ? 60 + Math.round(r() * 100) : 200 + Math.round(r() * 1800);
      const price = Math.round((k.price[0] + r() * (k.price[1] - k.price[0])) * 100) / 100;
      items.push({
        asin,
        title: asin === DEMO_ASIN ? 'Cat Water Fountain 2L, Pet Water Dispenser with Smart Pump, Ultra Quiet, Plastic' : `${['Petlibro', 'Veken', 'Catit', 'Orsda', 'Pawbo', 'Homerunpet', 'Aiaxy', 'Isyunen'][i % 8]} M${i} ${k.titles[j % k.titles.length]}`,
        brand: asin === DEMO_ASIN ? 'MyBrand' : ['Petlibro', 'Veken', 'Catit', 'Orsda', 'Pawbo', 'Homerunpet', 'Aiaxy', 'Isyunen'][i % 8],
        imageUrl: '',
        price: asin === DEMO_ASIN ? 25.99 : price,
        units: asin === DEMO_ASIN ? 1800 : units,
        revenue: units * price,
        rating: 4 + Math.round(r() * 7) / 10,
        ratings: Math.round(ageDays * (units / 300) * (0.5 + r())),
        availableDate: NOW - ageDays * DAY,
        variations: 1 + Math.round(r() * 4),
        fulfillment: 'FBA',
        dimension: '9.1 x 8.3 x 6.6 inches',
        weight: '2.1 pounds',
      });
    }
  }
  // 制造两条重复链接（同一款不同颜色）
  items.push({ ...items[5], asin: 'B0DMDUP001', units: 300 });
  items.push({ ...items[9], asin: 'B0DMDUP002', units: 200 });
  return items.sort((a, b) => (b.units as number) - (a.units as number));
}

const REVIEW_TEXT: { aspect: string; neg: string; pos: string }[] = [
  { aspect: 'noise', neg: 'The pump is so loud at night, buzzing noise keeps me awake.', pos: 'Super quiet pump, I can not hear it at all.' },
  { aspect: 'cleaning', neg: 'Hard to clean, slime builds up in corners and the pump is impossible to take apart.', pos: 'Easy to take apart and clean, dishwasher safe top.' },
  { aspect: 'leak', neg: 'Started leaking after two weeks, water all over the floor.', pos: 'No leaks at all after months of use.' },
  { aspect: 'pump_life', neg: 'Pump died after 3 months, stopped working completely.', pos: 'Still running strong after a year.' },
  { aspect: 'filter_cost', neg: 'Filters are expensive and hard to find, proprietary design.', pos: 'Filters are cheap and easy to replace.' },
  { aspect: 'water_level', neg: 'Cannot see the water level, it ran dry and burned the pump.', pos: 'Love the water level window, easy to check.' },
  { aspect: 'cat_use', neg: 'My cat refuses to drink from it.', pos: 'My cats love it and drink much more water now.' },
  { aspect: 'service', neg: 'Customer service never replied to my warranty claim.', pos: 'Seller replaced the pump quickly, great support.' },
];

/** 每个 ASIN 的差评倾向：我的产品噪音问题独有，清洗难是全品类共性 */
function negWeights(asin: string): Record<string, number> {
  const base: Record<string, number> = { noise: 0.06, cleaning: 0.3, leak: 0.1, pump_life: 0.15, filter_cost: 0.12, water_level: 0.08, cat_use: 0.1, service: 0.05 };
  if (asin === DEMO_ASIN) return { ...base, noise: 0.35, water_level: 0.2, leak: 0.03 };
  return base;
}

function demoReviews(asin: string, stars: number[], page: number): Record<string, unknown>[] {
  const r = rng(asin.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + page * 13 + stars[0]);
  const neg = stars[0] <= 3;
  const w = negWeights(asin);
  return Array.from({ length: 20 }, (_, i) => {
    const parts = REVIEW_TEXT.filter((t) => r() < (neg ? w[t.aspect] * 1.6 : 0.25)).map((t) => (neg ? t.neg : t.pos));
    const spam = neg && r() < 0.05;
    return {
      star: neg ? 1 + Math.floor(r() * 3) : 4 + Math.floor(r() * 2),
      title: neg ? 'Disappointed' : 'Great fountain',
      content: spam ? 'Worst thing ever. Do not buy!!!' : parts.join(' ') || (neg ? 'Not as expected.' : 'Works fine.'),
      date: NOW - (page * 20 + i) * 3 * DAY,
    };
  });
}

export class FakeSellerSprite implements SellerSpriteApi {
  calls = 0;
  private top = demoTop();
  async callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
    this.calls++;
    const req = (args.request ?? {}) as Record<string, unknown>;
    if (name === 'asin_detail') {
      const asin = String(args.asin);
      const p = this.top.find((x) => x.asin === asin) ?? this.top[0];
      return {
        ...p,
        asin,
        nodeIdPath: '2619533011:2975312011:2975321011',
        nodeLabelPath: 'Pet Supplies:Cats:Feeding & Watering Supplies:Fountains',
        features: ['Ultra quiet pump for peaceful sleep', 'Triple filtration keeps water fresh', 'Large capacity for multiple cats', 'Easy to assemble'],
        dimensions: '9.1 x 8.3 x 6.6 inches',
        weight: '2.1 pounds',
      } as T;
    }
    if (name === 'competitor_lookup') {
      const page = Number(req.page ?? 1);
      const size = Number(req.size ?? 100);
      const items = this.top.slice((page - 1) * size, page * size);
      return { items, hasNextPage: page * size < this.top.length } as T;
    }
    if (name === 'review') {
      const page = Number(args.page ?? 1);
      return { items: demoReviews(String(args.asin), args.starList as number[], page), hasNextPage: page < 5 } as T;
    }
    throw new Error(`演示数据没有模拟 ${name}`);
  }
}

const DEMO_ASPECTS: Aspect[] = [
  { id: 'noise', name: '水泵噪音', desc: '水泵运行声音、嗡嗡声', death: '基础体验', fix: '需供应链配合', stage: '日常使用' },
  { id: 'cleaning', name: '清洗难度', desc: '拆洗是否方便、死角积垢', death: '基础体验', fix: '低成本结构件', stage: '清洁维护' },
  { id: 'leak', name: '漏水', desc: '底座、接缝漏水', death: '品控寿命', fix: '需供应链配合', stage: '长期耐用' },
  { id: 'pump_life', name: '水泵寿命', desc: '水泵几个月就坏', death: '品控寿命', fix: '需供应链配合', stage: '长期耐用' },
  { id: 'filter_cost', name: '滤芯成本', desc: '滤芯贵、难买、专用设计', death: '卖点没兑现', fix: '低成本结构件', stage: '售后' },
  { id: 'water_level', name: '水位可视', desc: '看不到水位、干烧', death: '基础体验', fix: '低成本结构件', stage: '日常使用' },
  { id: 'cat_use', name: '猫咪接受度', desc: '猫愿不愿意喝', death: '卖点没兑现', fix: '服务兜底', stage: '安装上手' },
  { id: 'service', name: '客服保修', desc: '保修兑现、客服响应', death: '服务不兜底', fix: '服务兜底', stage: '售后' },
];

const KEYWORDS: Record<string, RegExp> = {
  noise: /loud|quiet|noise/i,
  cleaning: /clean/i,
  leak: /leak/i,
  pump_life: /pump died|stopped working|running strong/i,
  filter_cost: /filter/i,
  water_level: /water level/i,
  cat_use: /refuses|drink/i,
  service: /service|support|warranty|replaced/i,
};

function attrsOf(title: string) {
  const t = title.toLowerCase();
  const a: Record<string, string[]> = { function: [], material: [], size: [], structure: [], scene: [], persona: [] };
  if (/quiet/.test(t)) a.function.push('静音');
  if (/filtration|filter/.test(t)) a.function.push('多重过滤');
  if (/led/.test(t)) a.function.push('夜灯');
  if (/level window/.test(t)) a.function.push('水位窗');
  if (/app/.test(t)) a.function.push('App监控');
  if (/motion sensor/.test(t)) a.function.push('感应出水');
  if (/stainless/.test(t)) a.material.push('不锈钢');
  if (/ceramic/.test(t)) a.material.push('陶瓷');
  if (/plastic/.test(t)) a.material.push('塑料');
  if (/4l|large capacity|gallon|3.2l/.test(t)) a.size.push('大容量');
  if (/2l|2.5l/.test(t)) a.size.push('2–2.5L');
  if (/dishwasher|easy clean/.test(t)) a.structure.push('可拆洗');
  if (/wireless|battery|cordless/.test(t)) a.structure.push('无线');
  if (/multiple pets|dogs/.test(t)) a.persona.push('多宠家庭');
  if (/cat/.test(t)) a.persona.push('养猫');
  return a;
}

export class FakeAi implements AiApi {
  calls = 0;
  tokens = 0;
  async run(p: Prompt): Promise<unknown> {
    this.calls++;
    this.tokens += 800;
    const lines = p.user.split('\n');
    switch (p.task) {
      case 'forms':
        return { forms: [{ name: '插电循环饮水机', desc: '插电水泵循环过滤；pump, fountain' }, { name: '无线电池饮水机', desc: 'wireless, battery, cordless' }, { name: '重力饮水器', desc: 'gravity, waterer' }] };
      case 'classify':
        return {
          items: lines.map((l) => {
            const [asin, , title = ''] = l.split('\t');
            const t = title.toLowerCase();
            const accessory = /replacement|filters (for|compatible)/.test(t);
            return { asin, accessory, form: /wireless|battery|cordless/.test(t) ? '无线电池饮水机' : /gravity/.test(t) ? '重力饮水器' : '插电循环饮水机' };
          }),
        };
      case 'attrs':
        return {
          items: [...p.user.matchAll(/【(\w+)】([^\n]*)/g)].map(([, asin, title]) => ({ asin, ...attrsOf(title) })),
        };
      case 'attrMerge':
        return { mapping: {} };
      case 'element': {
        const asin = /ASIN (\w+)/.exec(p.user)?.[1] ?? '';
        const a = attrsOf(p.user);
        return {
          realPitch: asin === DEMO_ASIN ? '一台能让猫多喝水的静音饮水机' : a.material.includes('不锈钢') ? '不锈钢、好清洗、多猫家庭也够喝的饮水机' : '安静、过滤干净、放卧室也不吵的饮水机',
          demand: ['让猫多喝水', '保持水质新鲜'],
          scene: ['卧室', '客厅'],
          persona: a.persona.length ? a.persona : ['养猫'],
          structure: a.structure.length ? a.structure : ['一体式'],
          visual: [a.material[0] ? `${a.material[0]}质感` : '白色塑料', '场景图展示猫喝水'],
          priceSpec: ['单机 + 2 个滤芯'],
          transferable: ['水位窗', '可拆洗结构', '静音卖点前置'],
          playbook: a.material.includes('不锈钢') ? '品质溢价型' : '性价比型',
        };
      }
      case 'taxonomy':
        return { aspects: DEMO_ASPECTS };
      case 'tag':
        return {
          items: lines.map((l) => {
            const [id, text = ''] = l.split('\t');
            const neg = /\[(1|2|3)星\]/.test(text);
            return { id, spam: /Worst thing ever/.test(text), aspects: Object.entries(KEYWORDS).filter(([, re]) => re.test(text)).map(([a]) => ({ a, p: neg ? -1 : 1 })) };
          }),
        };
      case 'hypotheses': {
        const gaps = [...p.user.matchAll(/(g\d+)｜([^｜]+)｜([^｜]+)｜([^｜]+)｜/g)].map(([, id, q, , item]) => ({ id, q, item }));
        const find = (re: RegExp) => gaps.find((g) => re.test(g.item))?.id;
        const any = (q: string) => gaps.find((g) => g.q === q)?.id;
        return {
          items: [
            { lever: '解决一个高频差评', title: '换静音无刷水泵', change: '水泵换成无刷静音泵', keep: ['2L 容量', '多重过滤'], persona: '卧室放饮水机的上班族', scene: '夜间卧室', pitch: '放卧室也听不见的饮水机', evidence: [find(/噪音/) ?? any('他有我劣')], level: '补及格线', need: '体验', verify: '主图把“<25dB 夜间实测”放第一张，跑 2 周 CTR', judge: { perceivable: true, costDelta: '中', priceUpliftPct: 8, mold: false, cert: false, moatLayers: 1, sizeChange: '不变' } },
            { lever: '加部件', title: '加透明水位窗', change: '水箱侧面加透明水位窗', keep: ['静音定位'], persona: '经常出差的养猫人', scene: '出门前检查', pitch: '一眼看到还剩多少水，不怕干烧', evidence: [find(/水位/) ?? any('他有我无')], level: '补及格线', need: '安全感', verify: '五点第一条测试“水位可视”，看转化', judge: { perceivable: true, costDelta: '低', priceUpliftPct: 5, mold: true, cert: false, moatLayers: 1, sizeChange: '不变' } },
            { lever: '解决一个高频差评', title: '免工具三件拆洗结构', change: '出水盘改成卡扣三件式，可进洗碗机', keep: ['2L 容量'], persona: '嫌清洗麻烦的养猫人', scene: '每周清洗', pitch: '30 秒拆完，扔进洗碗机', evidence: [find(/清洗/) ?? any('都没有')], level: '真差异化', need: '体验', verify: '先做拆洗 GIF 副图测 CTR，再打样', judge: { perceivable: true, costDelta: '中', priceUpliftPct: 12, mold: true, cert: false, moatLayers: 2, sizeChange: '不变' } },
            { lever: '换收费购买方式', title: '通用滤芯 + 一年滤芯套装', change: '滤芯改成通用规格，并推出含 12 个滤芯的年包', keep: ['静音泵'], persona: '在意长期成本的家庭', scene: '补货', pitch: '一年不用再买滤芯', evidence: [find(/滤芯/) ?? any('都没有')], level: '真差异化', need: '安全感', verify: '新增年包变体，看变体占比', judge: { perceivable: true, costDelta: '低', priceUpliftPct: 20, mold: false, cert: false, moatLayers: 1, sizeChange: '变大' } },
            { lever: '服务兜底', title: '水泵 2 年质保', change: '水泵质保从 1 年延长到 2 年并写进主图', keep: ['现有结构'], persona: '怕水泵坏的买家', scene: '购买决策', pitch: '水泵坏了 2 年内免费换', evidence: [find(/寿命/) ?? any('都没有')], level: '补及格线', need: '安全感', verify: '主图加质保徽章 A/B', judge: { perceivable: true, costDelta: '低', priceUpliftPct: 3, mold: false, cert: false, moatLayers: 0, sizeChange: '不变' } },
            { lever: '品质超越', title: '不锈钢出水盘', change: '塑料出水盘换成 304 不锈钢', keep: ['静音泵', '2L 容量'], persona: '担心塑料卫生的买家', scene: '日常', pitch: '不锈钢不长黏液，下巴不长黑头', evidence: [find(/不锈钢/) ?? any('他有我无')], level: '真差异化', need: '安全感', verify: '新增不锈钢变体，对比转化和客单价', judge: { perceivable: true, costDelta: '中', priceUpliftPct: 15, mold: true, cert: false, moatLayers: 2, sizeChange: '不变' } },
            { lever: '可折叠', title: '可折叠旅行饮水机', change: '水箱改成硅胶可折叠', keep: ['静音泵'], persona: '带猫旅行的人', scene: '旅行/露营', pitch: '折起来塞进行李箱', evidence: [], level: '真差异化', need: '功能', verify: '概念图投票', judge: { perceivable: true, costDelta: '高', priceUpliftPct: 10, mold: true, cert: false, moatLayers: 3, sizeChange: '变小' } },
          ],
        };
      }
    }
  }
}

/** 演示用知识库：存在浏览器本地，结构和飞书多维表格一致 */
export class MemoryKb implements KnowledgeBase {
  private key = 'pu:demoKb';
  private async load() {
    return (await get<{ hypos: KbHypothesis[]; elements: KbElement[]; schemes: Record<string, Aspect[]> }>(this.key)) ?? { hypos: [], elements: [], schemes: {} };
  }
  async ensure() {
    return '演示知识库（本地）';
  }
  async getTagScheme(mid: string) {
    return (await this.load()).schemes[mid] ?? null;
  }
  async saveReport(r: Report) {
    const db = await this.load();
    const { market, elements, hypos } = reportRows(r);
    if (r.review && !r.review.fromKb) db.schemes[market.市场ID] = r.review.aspects;
    db.elements = [...db.elements.filter((e) => !(e.market === market.细分市场 && elements.some((x) => x.ASIN === e.asin))), ...elements.map((e) => ({ market: e.细分市场, asin: e.ASIN, role: e.角色, type: e.元素类型, value: e.元素, pitch: e.购买理由, units: e.月销 }))];
    const old = new Map(db.hypos.map((h) => [h.cardId, h]));
    for (const h of hypos) {
      const prev = old.get(h.卡片ID);
      old.set(h.卡片ID, { recordId: prev?.recordId ?? `rec${old.size + 1}`, cardId: h.卡片ID, title: h.方案, market: h.细分市场, asin: h.ASIN, lever: h.杠杆, change: h.唯一变量, pitch: h.购买理由, level: h.等级, score: h.总分, weakest: h.短板, status: prev?.status ?? '待测试', metrics: prev?.metrics ?? '', conclusion: prev?.conclusion ?? '', updatedBy: prev?.updatedBy ?? '', updatedAt: h.更新时间 });
    }
    db.hypos = [...old.values()];
    await set(this.key, db);
    return `已写入演示知识库：元素 ${elements.length} 条，假设卡 ${hypos.length} 张`;
  }
  async listHypotheses() {
    return (await this.load()).hypos;
  }
  async updateHypothesis(recordId: string, p: { status?: string; metrics?: string; conclusion?: string; updatedBy?: string }) {
    const db = await this.load();
    db.hypos = db.hypos.map((h) => (h.recordId === recordId ? { ...h, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)), updatedAt: stamp() } : h));
    await set(this.key, db);
  }
  async listElements() {
    return (await this.load()).elements;
  }
}
