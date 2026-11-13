// ───────────── 卖家精灵原始数据 ─────────────

export interface Product {
  rank: number;
  asin: string;
  title: string;
  brand: string;
  imageUrl: string;
  price: number;
  /** 月销量 */
  units: number;
  revenue: number;
  rating: number;
  ratings: number;
  /** 上架时间（毫秒） */
  availableDate: number | null;
  variations: number;
  fulfillment: string;
  /** 尺寸/重量原文，如 "3.94 x 3.94 x 3.53 inches"、"12 ounces" */
  dimension: string;
  weight: string;
  sellerName: string;
}

export interface ProductDetail {
  asin: string;
  title: string;
  brand: string;
  imageUrl: string;
  price: number;
  rating: number;
  ratings: number;
  availableDate: number | null;
  variations: number;
  features: string[];
  dimensions: string;
  weight: string;
  nodeIdPath: string;
  nodeLabelPath: string;
  sellerName: string;
}

export interface Review {
  /** 报告内唯一编号，如 "B09B8V1LZ3#n3-2"，用于证据回溯 */
  id: string;
  asin: string;
  star: number;
  title: string;
  content: string;
  date: number;
}

// ───────────── ① 切市场 ─────────────

/** AI 对每个商品的判定：是否配件、属于哪个形态组 */
export interface Classified {
  asin: string;
  accessory: boolean;
  form: string;
}

export interface FormDef {
  name: string;
  desc: string;
}

export interface FormGroup {
  form: string;
  asins: string[];
  count: number;
  unitsShare: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  /** 质检：组内价格是否收敛（P80/P20 ≤ 3）、是否吞掉一半以上样本、样本是否 ≥ 30 */
  qa: { priceConverged: boolean; notDominant: boolean; enoughSample: boolean };
}

export interface PriceBand {
  from: number;
  to: number;
  count: number;
  /** 销量占比（%） */
  unitsShare: number;
  /** 单均市占（%）= 销量占比 / 产品数，和 100/样本数 的基准比 */
  avgShare: number;
  /** 区间垄断度（%）= 区间 Top3 销量 / 区间销量 */
  top3Share: number;
  /** 评论占比（%） */
  ratingsShare: number;
  /** 销量占比高而评论占比低 = 近期热销新品；反之 = 老品盘踞 */
  signal: '' | '近期热销' | '老品盘踞';
  mine: boolean;
}

export interface MarketResult {
  nodeIdPath: string;
  nodeLabelPath: string;
  /** 取回的原始样本数 */
  fetched: number;
  /** 去重后 */
  deduped: number;
  duplicates: string[];
  accessories: string[];
  forms: FormDef[];
  groups: FormGroup[];
  myForm: string;
  /** 我的细分市场（我的形态组，可人工增删），后续所有步骤都以它为样本 */
  asins: string[];
  bands: PriceBand[];
  bandWidth: number;
  /** 基准：每个产品平均应占的销量份额（%） */
  baseShare: number;
}

// ───────────── ④ 对标与元素 ─────────────

export const ATTR_DIMS = ['function', 'material', 'size', 'structure', 'scene', 'persona'] as const;
export type AttrDim = (typeof ATTR_DIMS)[number];
export const ATTR_DIM_NAMES: Record<AttrDim, string> = {
  function: '功能',
  material: '材质',
  size: '尺寸规格',
  structure: '结构',
  scene: '场景',
  persona: '人群',
};

export type ProductAttrs = Partial<Record<AttrDim, string[]>>;

export interface AttrRow {
  dim: AttrDim;
  value: string;
  products: number;
  /** 具备该属性的产品占比（%） */
  productShare: number;
  /** 这些产品的销量占比（%） */
  unitsShare: number;
  /** 销量占比 / 产品占比：> 1 说明有它的产品卖得更好 */
  lift: number;
  /** 对标爆款里有几个具备 */
  inBench: number;
  avgPrice: number;
  mine: boolean;
  /** 空白格：销量拉动明显但供给少 */
  gap: boolean;
}

export const BENCH_TYPES = ['新品快速起量', '稳定增长', '头部常青', '同价位对手'] as const;
export type BenchType = (typeof BENCH_TYPES)[number];

export interface Benchmark {
  asin: string;
  type: BenchType;
  reason: string;
}

export interface ElementCard {
  asin: string;
  /** 一句话：它真正在卖什么（不是品类名，而是购买理由） */
  realPitch: string;
  demand: string[];
  scene: string[];
  persona: string[];
  structure: string[];
  visual: string[];
  priceSpec: string[];
  /** 可迁移到其他产品/类目的元素 */
  transferable: string[];
  /** 卖家打法类型 */
  playbook: string;
}

// ───────────── ⑤ 差评死法 ─────────────

export const DEATHS = ['品控寿命', '服务不兜底', '卖点没兑现', '基础体验', '其他'] as const;
export type Death = (typeof DEATHS)[number];
export const FIXES = ['低成本结构件', '需供应链配合', '服务兜底'] as const;
export type FixClass = (typeof FIXES)[number];
export const STAGES = ['购买前', '安装上手', '日常使用', '清洁维护', '长期耐用', '售后'] as const;
export type Stage = (typeof STAGES)[number];

/** 一个市场固定一套标签体系，锁定后存进知识库，保证前后可比 */
export interface Aspect {
  id: string;
  name: string;
  desc: string;
  death: Death;
  fix: FixClass;
  stage: Stage;
}

export interface ReviewTag {
  id: string;
  aspects: { a: string; p: 1 | -1 }[];
  /** 空泛、与产品对不上的疑似恶意差评，不计入统计 */
  spam: boolean;
}

export interface AsinSample {
  asin: string;
  neg: number;
  pos: number;
  spam: number;
  /** 文字差评样本 ≥ 门槛才下结论 */
  enough: boolean;
}

export type Scope = '本品独有' | '品类共性' | '我的优势' | '';

export interface AspectStat {
  aspect: string;
  /** 每个 ASIN：差评提及率 = 提到该问题的差评数 / 有效差评数；好评提及率同理 */
  perAsin: Record<string, { neg: number; pos: number; negRate: number; posRate: number }>;
  mineNegRate: number;
  benchNegRate: number;
  scope: Scope;
  /** 夸 vs 骂：该维度被夸次数 /（夸 + 骂），接近 0.5 说明体验两极、一致性差 */
  praiseShare: number;
  polarized: boolean;
  /** 证据：评论 id */
  quotes: string[];
}

export interface ReviewResult {
  aspects: Aspect[];
  /** 标签体系是否来自知识库（锁定复用） */
  fromKb: boolean;
  samples: AsinSample[];
  stats: AspectStat[];
  /** 每个 ASIN 每月的差评条数（样本内，看哪个批次开始恶化） */
  monthly: Record<string, { month: string; neg: number }[]>;
  reviews: Review[];
  tags: Record<string, ReviewTag>;
}

// ───────────── ⑥ 差距矩阵 ─────────────

export const QUADRANTS = ['他有我无', '他有我劣', '他无我有', '都没有'] as const;
export type Quadrant = (typeof QUADRANTS)[number];

export interface GapItem {
  id: string;
  quadrant: Quadrant;
  dim: string;
  item: string;
  evidence: string;
  /** 0–100，证据强度 */
  strength: number;
}

// ───────────── ⑦ 升级方向 ─────────────

export const LEVERS = [
  '加部件',
  '可伸缩',
  '可折叠',
  '改规格组合',
  '做减法',
  '补被忽略的场景',
  '换收费购买方式',
  '一品多场景',
  '产业降维',
  '反推重定义',
  '服务兜底',
  '被忽视人群',
  '横向场景迁移',
  '纵向任务链配件',
  '品质超越',
  '解决一个高频差评',
] as const;
export type Lever = (typeof LEVERS)[number];

export const NEED_LEVELS = ['功能', '体验', '安全感', '审美', '身份'] as const;
export type NeedLevel = (typeof NEED_LEVELS)[number];

export interface Hypothesis {
  id: string;
  lever: Lever;
  title: string;
  /** 唯一改变的变量 */
  change: string;
  /** 保留不动的（来自好评元素） */
  keep: string[];
  persona: string;
  scene: string;
  /** 一句购买理由（三秒说清） */
  pitch: string;
  /** 证据：差距项 id */
  evidence: string[];
  level: '补及格线' | '真差异化';
  need: NeedLevel;
  verify: string;
  judge: {
    perceivable: boolean;
    costDelta: '低' | '中' | '高';
    priceUpliftPct: number;
    mold: boolean;
    cert: boolean;
    /** 复制门槛层数 0–5：钱/时间/复杂度/资源/专利合规 */
    moatLayers: number;
    sizeChange: '变小' | '不变' | '变大';
  };
  /** 程序校验留下的问题（如证据缺失） */
  issues: string[];
}

// ───────────── ⑧ 评分 ─────────────

export const SCORE_DIMS = ['demand', 'position', 'value', 'cost', 'moat', 'risk', 'fit'] as const;
export type ScoreDim = (typeof SCORE_DIMS)[number];
export const SCORE_DIM_NAMES: Record<ScoreDim, string> = {
  demand: '需求证据',
  position: '竞争与位置',
  value: '感知价值/增本',
  cost: '总成本影响',
  moat: '复制门槛',
  risk: '实施风险',
  fit: '资源匹配',
};
export type Weights = Record<ScoreDim, number>;
export const DEFAULT_WEIGHTS: Weights = { demand: 25, position: 15, value: 15, cost: 15, moat: 15, risk: 10, fit: 5 };

export interface Score {
  dims: Record<ScoreDim, number>;
  total: number;
  /** 最低的维度（短板） */
  weakest: ScoreDim;
  notes: string[];
}

/** 成本：采购、包装、头程手动填，其余程序估算 */
export interface CostInputs {
  purchaseCny: number;
  packCny: number;
  /** 头程（元/kg，按体积重和实重取大） */
  freightCnyPerKg: number;
  fx: number;
  commissionPct: number;
  adPct: number;
  returnPct: number;
}

export const DEFAULT_COST: CostInputs = { purchaseCny: 0, packCny: 0, freightCnyPerKg: 12, fx: 7.1, commissionPct: 15, adPct: 15, returnPct: 5 };

export interface UnitEconomics {
  tier: string;
  fba: number;
  shippingLb: number;
  landed: number;
  profit: number;
  margin: number;
  nextTierHint: string;
  missing: string[];
}

// ───────────── 报告 ─────────────

export interface Report {
  id: string;
  createdAt: number;
  asin: string;
  marketplace: 'US';
  stage: 'market' | 'done';
  me: ProductDetail;
  top: Product[];
  classified: Record<string, Classified>;
  market: MarketResult;
  attrs: Record<string, ProductAttrs>;
  attrRows: AttrRow[];
  benchmarks: Benchmark[];
  details: Record<string, ProductDetail>;
  elements: Record<string, ElementCard>;
  review: ReviewResult | null;
  gaps: GapItem[];
  hypotheses: Hypothesis[];
  scores: Record<string, Score>;
  cost: CostInputs;
  fit: Record<string, number>;
  weights: Weights;
  warnings: string[];
  usage: { sellersprite: number; ai: number; tokens: number };
  kb?: { at: number; ok: boolean; msg: string };
}
