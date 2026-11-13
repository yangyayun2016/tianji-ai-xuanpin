import type { ScoreDims } from '../lib/calc'

export const PRODUCT_CONTEXT = {
  title: '天机AI选品',
  subtitle: '亚马逊超级产品开发辅助工具 · Demo',
  category:
    'Cell Phones & Accessories › Accessories › Smartwatch Accessories › Smartwatch Bands',
  myAsin: 'B095W1SBNB',
  myPrice: 6.99,
  myPriceBand: '$6-8',
  caseName: '弹力尼龙 Apple Watch 表带',
}

export const overview = {
  alerts: [
    '数据已按品牌与标题前 6 词过滤；细分市场样本较小（25 个产品），占比类指标仅作定性参考。',
    'ASIN B09JP22MLJ 缺少有效评论，相关差评指标请谨慎解读。',
  ],
  stats: {
    nicheSample: { analyzed: 25, pool: 200 },
    myPriceBand: { range: '$6–8', share: 4.07, benchmark: 4 },
    gapItems: {
      total: 7,
      heHasIDont: 0,
      heHasImWeak: 1,
      heDoesntIHave: 0,
      neither: 6,
    },
    upgrades: { count: 10, topScore: 64 },
  },
  myProblems: [
    { name: '弹性恢复', me: 13, bench: 7, kind: '本品独有' as const },
  ],
  categoryCommons: [
    { name: '尺寸适配', me: 29, bench: 23 },
    { name: '材质质量', me: 21, bench: 16 },
    { name: '耐用性', me: 11, bench: 18 },
    { name: '松紧保持', me: 13, bench: 13 },
  ],
  topUpgrades: [
    {
      score: 64,
      title: '重定义：定位专业运动弹力表带',
      note: '标准化轻量与防滑卖点',
    },
    {
      score: 63,
      title: '被忽视场景：高强度运动设计',
      note: '强调防汗与长效弹力',
    },
    {
      score: 62,
      title: '改变购买方式：单条售卖可自选',
      note: '从 3 包装改为单品定制',
    },
    {
      score: 61,
      title: '被忽视人群：儿童/青少年尺码',
      note: '补齐小尺寸段',
    },
    {
      score: 58,
      title: '跨场景迁移：适配 Fitbit 等品牌',
      note: '非 Apple 用户扩展',
    },
  ],
}

export const morphGroups = [
  {
    name: '硅胶运动表带',
    count: 60,
    salesShare: 29.7,
    avgPrice: 11.1,
    priceRange: '$6–18',
    qc: ['价格收敛', '占比正常', '样本够'],
    definition: 'Silicone / Sport Band / Breathable',
  },
  {
    name: '金属环形表带',
    count: 34,
    salesShare: 17.5,
    avgPrice: 14.02,
    priceRange: '$8–22',
    qc: ['价格收敛', '占比正常', '样本够'],
    definition: 'Milanese Loop / Metal Band / Mesh Loop',
  },
  {
    name: '弹力尼龙表带',
    count: 28,
    salesShare: 21.2,
    avgPrice: 7.4,
    priceRange: '$5–12',
    qc: ['价格收敛', '占比正常', '样本够'],
    definition: 'Elastic / Nylon / Stretch Band',
  },
  {
    name: '编织表带',
    count: 22,
    salesShare: 12.8,
    avgPrice: 9.6,
    priceRange: '$6–16',
    qc: ['样本<30'],
    definition: 'Braided / Solo Loop',
  },
  {
    name: '树脂/时尚表带',
    count: 18,
    salesShare: 8.4,
    avgPrice: 16.5,
    priceRange: '$12–28',
    qc: ['样本<30'],
    definition: 'Resin / Fashion Strap',
  },
  {
    name: '其他',
    count: 38,
    salesShare: 10.4,
    avgPrice: 10.2,
    priceRange: '$4–30',
    qc: ['占比正常'],
    definition: 'Leather / Hybrid / Mixed',
  },
]

export const priceBands = [
  {
    range: '$4-6',
    count: 4,
    salesShare: 6.2,
    avgShare: 1.55,
    concentration: 78,
    reviewShare: 5.1,
    signal: '老品盘踞',
    isMine: false,
  },
  {
    range: '$6-8',
    count: 8,
    salesShare: 24.4,
    avgShare: 4.07,
    concentration: 69.5,
    reviewShare: 22.0,
    signal: '老品盘踞',
    isMine: true,
  },
  {
    range: '$8-10',
    count: 11,
    salesShare: 41.8,
    avgShare: 3.8,
    concentration: 54.2,
    reviewShare: 38.5,
    signal: '近期热销',
    isMine: false,
  },
  {
    range: '$10-12',
    count: 7,
    salesShare: 14.1,
    avgShare: 2.01,
    concentration: 61.0,
    reviewShare: 16.2,
    signal: '老品盘踞',
    isMine: false,
  },
  {
    range: '$12-14',
    count: 5,
    salesShare: 7.3,
    avgShare: 1.46,
    concentration: 72.4,
    reviewShare: 9.0,
    signal: '老品盘踞',
    isMine: false,
  },
  {
    range: '$14-16',
    count: 3,
    salesShare: 3.6,
    avgShare: 1.2,
    concentration: 100,
    reviewShare: 4.8,
    signal: '近期热销',
    isMine: false,
  },
  {
    range: '$16-18',
    count: 2,
    salesShare: 2.6,
    avgShare: 1.3,
    concentration: 100,
    reviewShare: 4.4,
    signal: '近期热销',
    isMine: false,
  },
]

export type BenchmarkProduct = {
  asin: string
  role: string
  rankLabel: string
  title: string
  price: number
  monthlySales: number
  slogan: string
  tags: Record<string, string[]>
  transferable: string[]
  play: string
}

export const benchmarkProducts: BenchmarkProduct[] = [
  {
    asin: 'B095W1SBNB',
    role: '我的产品',
    rankLabel: '细分市场销售 #—',
    title:
      'Daqin Stretchy Solo Loop Nylon Bands Compatible with Apple Watch 3 Pack',
    price: 6.99,
    monthlySales: 6998,
    slogan: '舒适透气、可调尺码弹力尼龙表带 3 包装，满足多场景佩戴需求。',
    tags: {
      需求: ['透气', '可调', '耐用', '多色'],
      场景: ['日常', '运动/健身', '送礼'],
      人群: ['Apple Watch 用户', '男女通用', '运动爱好者'],
      结构: ['弹力织物', '可调节扣', '3 包装'],
      视觉: ['黑/军绿/灰', '编织纹理', '极简风'],
      价格规格: ['3 包装', '低价策略'],
    },
    transferable: ['多色组合套装', '耐用透气材质'],
    play: '性价比型',
  },
  {
    asin: 'B09JP22MLJ',
    role: '同价位对手',
    rankLabel: '同价段热销',
    title: '4 Pack Elastic Watch Bands Soft Breathable Nylon',
    price: 7.49,
    monthlySales: 5120,
    slogan: '4 包装弹力表带，覆盖更多颜色组合，强调日常与运动双场景。',
    tags: {
      需求: ['透气', '多色', '柔软'],
      场景: ['日常', '通勤'],
      人群: ['男女通用'],
      结构: ['弹力带', '4 包装'],
      视觉: ['彩色组合'],
      价格规格: ['4 包装'],
    },
    transferable: ['多包装颜色矩阵'],
    play: '套装引流型',
  },
  {
    asin: 'B08XYZTOP1',
    role: '头部常青',
    rankLabel: '细分市场销售 #1',
    title: '10 Pack Sport Bands Compatible with Apple Watch',
    price: 9.99,
    monthlySales: 17200,
    slogan: '10 包装硅胶运动表带，覆盖全尺寸，主打囤货与家庭共享。',
    tags: {
      需求: ['囤货', '全尺寸', '易清洗'],
      场景: ['运动', '日常'],
      人群: ['家庭用户'],
      结构: ['硅胶', '标准扣', '10 包装'],
      视觉: ['多色硅胶'],
      价格规格: ['10 包装'],
    },
    transferable: ['大包装囤货逻辑'],
    play: '头部囤货型',
  },
  {
    asin: 'B08XYZTOP2',
    role: '头部常青',
    rankLabel: '细分市场销售 #2',
    title: '10 Pack Braided Solo Loop Stretch Bands',
    price: 11.99,
    monthlySales: 12100,
    slogan: '编织弹力环带，强调无感与一体成型佩戴体验。',
    tags: {
      需求: ['无感佩戴', '弹性'],
      场景: ['睡眠', '运动'],
      人群: ['追求舒适用户'],
      结构: ['编织环', '无表扣'],
      视觉: ['编织纹理'],
      价格规格: ['10 包装'],
    },
    transferable: ['无扣一体环结构'],
    play: '体验升级型',
  },
  {
    asin: 'B08XYZTOP5',
    role: '头部常青',
    rankLabel: '细分市场销售 #5',
    title: 'Resin Strap Luxury Replacement Band',
    price: 15.99,
    monthlySales: 4300,
    slogan: '树脂时尚表带，视觉更高端，瞄准礼品与搭配场景。',
    tags: {
      需求: ['颜值', '礼品'],
      场景: ['正式场合', '送礼'],
      人群: ['时尚用户'],
      结构: ['树脂', '金属扣'],
      视觉: ['高光泽', '撞色'],
      价格规格: ['单条'],
    },
    transferable: ['高端视觉语言'],
    play: '视觉溢价型',
  },
  {
    asin: 'B0COMPFIT1',
    role: '同价位对手',
    rankLabel: '同价段潜力',
    title: 'Elastic Nylon Band with Anti-Slip Pattern',
    price: 6.49,
    monthlySales: 2880,
    slogan: '强调防滑纹理与运动稳固，针对高强度训练人群。',
    tags: {
      需求: ['防滑', '稳固'],
      场景: ['高强度训练'],
      人群: ['专业健身'],
      结构: ['防滑纹', '弹力带'],
      视觉: ['运动风'],
      价格规格: ['单条/3 包装'],
    },
    transferable: ['防滑纹理'],
    play: '场景深挖型',
  },
]

export type AttrRow = {
  dimension: string
  attribute: string
  productCount: number
  productShare: number
  salesShare: number
  competitorHave: string
  iHave: boolean
}

export const attributeRows: AttrRow[] = [
  {
    dimension: '人群',
    attribute: '男女通用',
    productCount: 22,
    productShare: 88,
    salesShare: 101.2,
    competitorHave: '6/6',
    iHave: true,
  },
  {
    dimension: '材质',
    attribute: '尼龙',
    productCount: 14,
    productShare: 56,
    salesShare: 62.0,
    competitorHave: '4/6',
    iHave: true,
  },
  {
    dimension: '结构',
    attribute: '弹性带',
    productCount: 2,
    productShare: 8,
    salesShare: 21.0,
    competitorHave: '1/6',
    iHave: true,
  },
  {
    dimension: '功能',
    attribute: '透气',
    productCount: 16,
    productShare: 64,
    salesShare: 71.0,
    competitorHave: '5/6',
    iHave: true,
  },
  {
    dimension: '尺寸规格',
    attribute: '可调节',
    productCount: 18,
    productShare: 72,
    salesShare: 78.0,
    competitorHave: '5/6',
    iHave: true,
  },
  {
    dimension: '场景',
    attribute: '运动健身',
    productCount: 12,
    productShare: 48,
    salesShare: 55.0,
    competitorHave: '4/6',
    iHave: true,
  },
  {
    dimension: '结构',
    attribute: '弹力',
    productCount: 2,
    productShare: 8,
    salesShare: 13.3,
    competitorHave: '2/6',
    iHave: true,
  },
  {
    dimension: '人群',
    attribute: '儿童青少年',
    productCount: 1,
    productShare: 4,
    salesShare: 2.1,
    competitorHave: '0/6',
    iHave: false,
  },
  {
    dimension: '场景',
    attribute: '高强度训练',
    productCount: 3,
    productShare: 12,
    salesShare: 18.5,
    competitorHave: '1/6',
    iHave: false,
  },
  {
    dimension: '结构',
    attribute: '防滑纹',
    productCount: 2,
    productShare: 8,
    salesShare: 11.2,
    competitorHave: '1/6',
    iHave: false,
  },
  {
    dimension: '材质',
    attribute: '硅胶',
    productCount: 10,
    productShare: 40,
    salesShare: 36.0,
    competitorHave: '3/6',
    iHave: false,
  },
  {
    dimension: '功能',
    attribute: '防汗',
    productCount: 5,
    productShare: 20,
    salesShare: 28.0,
    competitorHave: '2/6',
    iHave: false,
  },
]

export const attrDimensions = [
  '全部',
  '功能',
  '材质',
  '尺寸规格',
  '结构',
  '场景',
  '人群',
] as const

export const negativeCompetitors = [
  '2MLJ',
  'VRZF',
  'TS6F',
  'H51V',
  'C6SJ',
  'WJS5',
] as const

export type NegativeRow = {
  dimension: string
  deathType: string
  improveType: string
  journey: string
  me: number
  competitors: Record<string, number>
  judgment: '品类共性' | '本品独有'
  praiseScold: string
  quotes: string[]
}

export const negativeRows: NegativeRow[] = [
  {
    dimension: '尺寸适配',
    deathType: '基础体验',
    improveType: '低成本结构件',
    journey: '购买前/日常使用',
    me: 29,
    competitors: { '2MLJ': 18, VRZF: 37, TS6F: 22, H51V: 15, C6SJ: 20, WJS5: 12 },
    judgment: '品类共性',
    praiseScold: '夸 41% / 体验两极',
    quotes: [
      'Too small for my wrist, even on the largest setting.',
      'Size chart was confusing — ended up returning.',
    ],
  },
  {
    dimension: '材质质量',
    deathType: '品控寿命',
    improveType: '需供应链配合',
    journey: '长期使用',
    me: 21,
    competitors: { '2MLJ': 16, VRZF: 19, TS6F: 14, H51V: 24, C6SJ: 18, WJS5: 11 },
    judgment: '品类共性',
    praiseScold: '夸 52%',
    quotes: ['Fabric started fraying after 3 weeks.'],
  },
  {
    dimension: '耐用性',
    deathType: '品控寿命',
    improveType: '需供应链配合',
    journey: '长期使用',
    me: 11,
    competitors: { '2MLJ': 9, VRZF: 12, TS6F: 10, H51V: 15, C6SJ: 38, WJS5: 14 },
    judgment: '品类共性',
    praiseScold: '夸 60%',
    quotes: ['Snapped while playing basketball.'],
  },
  {
    dimension: '调节难度',
    deathType: '基础体验',
    improveType: '低成本结构件',
    journey: '安装',
    me: 8,
    competitors: { '2MLJ': 11, VRZF: 7, TS6F: 9, H51V: 6, C6SJ: 5, WJS5: 10 },
    judgment: '品类共性',
    praiseScold: '夸 55%',
    quotes: ['Hard to adjust with one hand.'],
  },
  {
    dimension: '佩戴舒适度',
    deathType: '基础体验',
    improveType: '低成本结构件',
    journey: '日常使用',
    me: 10,
    competitors: { '2MLJ': 8, VRZF: 13, TS6F: 9, H51V: 7, C6SJ: 12, WJS5: 6 },
    judgment: '品类共性',
    praiseScold: '夸 68%',
    quotes: ['Comfortable for daily wear, but digs in during workouts.'],
  },
  {
    dimension: '弹性恢复',
    deathType: '卖点没兑现',
    improveType: '需供应链配合',
    journey: '长期使用',
    me: 13,
    competitors: { '2MLJ': 3, VRZF: 4, TS6F: 2, H51V: 5, C6SJ: 3, WJS5: 2 },
    judgment: '本品独有',
    praiseScold: '体验两极',
    quotes: [
      'Lost elasticity after a month — no longer stays tight.',
      'Stretched out and became floppy.',
    ],
  },
  {
    dimension: '松紧保持',
    deathType: '卖点没兑现',
    improveType: '低成本结构件',
    journey: '日常使用',
    me: 13,
    competitors: { '2MLJ': 10, VRZF: 12, TS6F: 11, H51V: 9, C6SJ: 14, WJS5: 8 },
    judgment: '品类共性',
    praiseScold: '夸 49%',
    quotes: ['Keeps loosening during the day.'],
  },
  {
    dimension: '皮肤刺激',
    deathType: '基础体验',
    improveType: '需供应链配合',
    journey: '长期使用',
    me: 6,
    competitors: { '2MLJ': 5, VRZF: 8, TS6F: 4, H51V: 7, C6SJ: 9, WJS5: 3 },
    judgment: '品类共性',
    praiseScold: '夸 70%',
    quotes: ['Caused mild rash in hot weather.'],
  },
  {
    dimension: '扣具牢固度',
    deathType: '品控寿命',
    improveType: '低成本结构件',
    journey: '日常使用',
    me: 7,
    competitors: { '2MLJ': 6, VRZF: 9, TS6F: 8, H51V: 5, C6SJ: 11, WJS5: 7 },
    judgment: '品类共性',
    praiseScold: '夸 58%',
    quotes: ['Buckle came loose twice.'],
  },
  {
    dimension: '磁扣功能',
    deathType: '卖点没兑现',
    improveType: '低成本结构件',
    journey: '日常使用',
    me: 2,
    competitors: { '2MLJ': 4, VRZF: 5, TS6F: 3, H51V: 6, C6SJ: 8, WJS5: 39 },
    judgment: '品类共性',
    praiseScold: '体验两极',
    quotes: ['Magnetic clasp fails randomly.'],
  },
  {
    dimension: '颜色准确性',
    deathType: '卖点没兑现',
    improveType: '服务兜底',
    journey: '购买前',
    me: 5,
    competitors: { '2MLJ': 7, VRZF: 6, TS6F: 9, H51V: 4, C6SJ: 5, WJS5: 8 },
    judgment: '品类共性',
    praiseScold: '夸 45%',
    quotes: ['Color much darker than the main image.'],
  },
  {
    dimension: '包装完整性',
    deathType: '服务不兜底',
    improveType: '服务兜底',
    journey: '售后',
    me: 4,
    competitors: { '2MLJ': 3, VRZF: 5, TS6F: 2, H51V: 6, C6SJ: 4, WJS5: 3 },
    judgment: '品类共性',
    praiseScold: '夸 72%',
    quotes: ['Arrived with one band missing.'],
  },
  {
    dimension: '安装难度',
    deathType: '基础体验',
    improveType: '低成本结构件',
    journey: '安装',
    me: 9,
    competitors: { '2MLJ': 8, VRZF: 10, TS6F: 7, H51V: 11, C6SJ: 6, WJS5: 9 },
    judgment: '品类共性',
    praiseScold: '夸 50%',
    quotes: ['Took forever to install on the watch lugs.'],
  },
]

export type GapItem = {
  quadrant: '他有我无' | '他有我弱' | '他无我有' | '双方都无'
  attribute: string
  evidence: string
  action: string
}

export const gapItems: GapItem[] = [
  {
    quadrant: '他有我弱',
    attribute: '防滑/运动稳固',
    evidence: '同价对手主图强调防滑纹，本品仅有弹力卖点',
    action: '主图/五点补齐防滑证据，结构小改',
  },
  {
    quadrant: '双方都无',
    attribute: '儿童/青少年尺码',
    evidence: 'Top6 均未系统覆盖小尺寸',
    action: '开独立尺码线，广告打父母人群',
  },
  {
    quadrant: '双方都无',
    attribute: '单条自选购买',
    evidence: '市场以 3/4/10 包装为主，个性化弱',
    action: '增加单条变体，测试转化',
  },
  {
    quadrant: '双方都无',
    attribute: 'Fitbit/多品牌兼容',
    evidence: '细分样本几乎全是 Apple Watch',
    action: '跨品牌迁移测试',
  },
  {
    quadrant: '双方都无',
    attribute: '高强度防汗长效弹力',
    evidence: '评论高频抱怨弹力衰减，竞品也未标准化',
    action: '材料升级 + 卖点重定义',
  },
  {
    quadrant: '双方都无',
    attribute: '多宽度组合',
    evidence: '腕围适配差评共性高，宽度方案稀缺',
    action: '推出宽窄组合装',
  },
  {
    quadrant: '双方都无',
    attribute: '专业运动定位标准件',
    evidence: '品类仍偏通用日常，专业运动心智空白',
    action: '重定义专业运动弹力表带',
  },
]

export const defaultWeights = {
  demandEvidence: 25,
  competitionPosition: 15,
  perceivedValue: 15,
  totalCostImpact: 15,
  copyBarrier: 15,
  implRisk: 10,
  resourceMatch: 5,
}

export type UpgradeScheme = {
  id: string
  label: string
  title: string
  onlyVariable: string
  keep: string[]
  slogan: string
  evidence: string
  validation: string
  risk: string
  dims: Omit<ScoreDims, 'resourceMatch'> & { resourceMatchDefault: number }
}

export const upgradeSchemes: UpgradeScheme[] = [
  {
    id: 'u1',
    label: '反推重定义',
    title: '定位为专业运动弹力表带，突出轻量与防滑优势',
    onlyVariable: '定位与主图叙事改为专业运动',
    keep: ['尼龙材质', '弹力结构', '多色', 'Apple Watch 兼容'],
    slogan: '「练得再狠，表带也不打滑」',
    evidence: 'g1/g3/g7 均缺标准化弹力运动带心智',
    validation: '优化主图文案 → 测 CTR/CVR',
    risk: '复制门槛低，竞品 7–15 天可跟进',
    dims: {
      demandEvidence: 78,
      competitionPosition: 72,
      perceivedValue: 70,
      totalCostImpact: 65,
      copyBarrier: 35,
      implRisk: 55,
      resourceMatchDefault: 60,
    },
  },
  {
    id: 'u2',
    label: '真差异化',
    title: '高强度运动：防汗 + 长效弹力材料方案',
    onlyVariable: '材料配方与防汗涂层',
    keep: ['基础版型', '尺码逻辑', '包装形态'],
    slogan: '「出汗也不松、拉扯也回弹」',
    evidence: '差评「弹性恢复」本品偏高，品类未解',
    validation: '小批量打样 → 耐磨/回弹测试 → 评论验证',
    risk: '需供应链配合，库存试错成本上升',
    dims: {
      demandEvidence: 80,
      competitionPosition: 68,
      perceivedValue: 75,
      totalCostImpact: 48,
      copyBarrier: 58,
      implRisk: 42,
      resourceMatchDefault: 55,
    },
  },
  {
    id: 'u3',
    label: '改变购买方式',
    title: '从套装改为单条售卖，支持颜色自选',
    onlyVariable: '销售单位：套装 → 单条',
    keep: ['材质', '结构', '视觉风格'],
    slogan: '「只买你想戴的那一条」',
    evidence: '套装差评含「用不到的颜色」',
    validation: '新增单条 SKU，广告分组测转化',
    risk: '客单价下降，需靠复购/附件补',
    dims: {
      demandEvidence: 70,
      competitionPosition: 66,
      perceivedValue: 68,
      totalCostImpact: 72,
      copyBarrier: 40,
      implRisk: 60,
      resourceMatchDefault: 70,
    },
  },
  {
    id: 'u4',
    label: '被忽视人群',
    title: '推出儿童与青少年尺码线',
    onlyVariable: '尺码段下探',
    keep: ['材质', '颜色矩阵', '品牌调性'],
    slogan: '「给孩子一条真正合适的表带」',
    evidence: 'Top 竞品几乎无系统儿童尺码',
    validation: '定向父母人群广告，看搜索词与转化',
    risk: '合规与安全表述需额外审核',
    dims: {
      demandEvidence: 66,
      competitionPosition: 74,
      perceivedValue: 64,
      totalCostImpact: 60,
      copyBarrier: 50,
      implRisk: 48,
      resourceMatchDefault: 50,
    },
  },
  {
    id: 'u5',
    label: '跨场景迁移',
    title: '适配 Fitbit 等非 Apple 智能手表',
    onlyVariable: '接口兼容品牌扩展',
    keep: ['弹力带体验', '价格带'],
    slogan: '「不止 Apple，运动表都能换」',
    evidence: '细分样本过度集中 Apple 生态',
    validation: '先上 1–2 个接口 SKU 测搜索覆盖',
    risk: 'SKU 爆炸，运营复杂度上升',
    dims: {
      demandEvidence: 58,
      competitionPosition: 62,
      perceivedValue: 60,
      totalCostImpact: 55,
      copyBarrier: 45,
      implRisk: 50,
      resourceMatchDefault: 45,
    },
  },
]

export const costDefaults = {
  purchaseCny: 0,
  packagingCny: 0,
  firstLegPerKgCny: 12,
  fx: 7.1,
  commissionPct: 15,
  adPct: 15,
  returnLossPct: 5,
  sellPriceUsd: 6.99,
  fbaFeeUsd: 3.06,
  billableWeightLb: 0.07,
  dimensions: '7.32 × 6.02 × 0.47 in',
  weightOz: 1.13,
  sizeTier: 'Small Standard',
}

export type HypothesisCard = {
  id: number
  tag: string
  score: number
  title: string
  audience: string
  scenario: string
  onlyVariable: string
  keep: string
  reason: string
  diffSource: string
  priceLogic: string
  validation: string
  stopLoss: string
}

export const hypothesisCards: HypothesisCard[] = [
  {
    id: 1,
    tag: '重定义',
    score: 64,
    title: '定位专业运动弹力表带，突出轻量与防滑',
    audience: '专业健身用户',
    scenario: '高强度训练',
    onlyVariable: '定位与防滑卖点标准化',
    keep: '材质、颜色、Apple 兼容',
    reason: '运动中稳固不移位',
    diffSource: '竞品缺专业运动心智',
    priceLogic: '+8% 溢价 / 低增本',
    validation: '优化主图文案，测 CTR/CVR',
    stopLoss: '2 周无 CTR/CVR 提升则停止，不进入打样',
  },
  {
    id: 2,
    tag: '真差异化',
    score: 63,
    title: '高强度防汗 + 长效弹力材料',
    audience: '高频运动用户',
    scenario: '出汗量大的训练',
    onlyVariable: '材料与涂层',
    keep: '版型与包装',
    reason: '出汗不松、回弹持久',
    diffSource: '差评弹性恢复未解',
    priceLogic: '+10% / 中增本',
    validation: '打样回弹测试 + 小流量验证',
    stopLoss: '材料成本导致广告前毛利不足则停',
  },
  {
    id: 3,
    tag: '购买方式',
    score: 62,
    title: '单条售卖，支持个性化自选',
    audience: '已有多色需求的老客',
    scenario: '日常搭配',
    onlyVariable: '3 包装 → 单条',
    keep: '材质与颜色体系',
    reason: '只买需要的颜色',
    diffSource: '套装浪费感',
    priceLogic: '客单下降，靠复购',
    validation: '新 SKU A/B 转化',
    stopLoss: '单条转化不足以弥补客单则回退套装',
  },
  {
    id: 4,
    tag: '被忽视人群',
    score: 61,
    title: '儿童与青少年尺码线',
    audience: '父母 / 青少年',
    scenario: '校园与运动课',
    onlyVariable: '尺码下探',
    keep: '材质与配色',
    reason: '真正合腕的小尺寸',
    diffSource: '竞品无系统儿童尺码',
    priceLogic: '同价或微溢价',
    validation: '定向父母广告 + 关键词覆盖',
    stopLoss: '4 周无稳定订单则停',
  },
  {
    id: 5,
    tag: '跨场景',
    score: 58,
    title: 'Fitbit / 多品牌兼容扩展',
    audience: '非 Apple 智能手表用户',
    scenario: '日常与轻运动',
    onlyVariable: '接口品牌',
    keep: '弹力体验与价格带',
    reason: '同体验跨设备',
    diffSource: '生态过于 Apple 中心',
    priceLogic: '同价带扩池',
    validation: '搜索词覆盖与小批量上架',
    stopLoss: '接口退货率异常则收缩品牌',
  },
  {
    id: 6,
    tag: '结构组合',
    score: 53,
    title: '多宽度组合，适配不同腕围',
    audience: '腕围两端用户',
    scenario: '日常佩戴',
    onlyVariable: '宽度组合 SKU',
    keep: '材质与扣具逻辑',
    reason: '尺寸适配痛点下降',
    diffSource: '尺寸适配差评共性高',
    priceLogic: '组合装微溢价',
    validation: '尺寸相关差评率跟踪',
    stopLoss: '宽度 SKU 库存周转差则合并',
  },
]
