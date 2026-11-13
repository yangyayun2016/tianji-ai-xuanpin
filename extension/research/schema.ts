/** 固定模板契约。中文 key 同时是 UI 列名；动态列只允许在约定位置展开。 */
export const MODULE_NAMES = [
  '市场背景调查', '谷歌趋势', '站内竞争情况-关键词', '广告难易程度&类目平均转化率预估',
  '市场大盘分析', '竞品分析', 'QA&RV分析', '流量位竞品数量', '站点广告盈亏',
  '流量位竞争格局', '词库联动', '合规门槛', '垄断性', '新品表现', '知识产权', '利润表',
] as const;
export type ModuleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
export const BACKGROUND_SCOPE_ROWS = [
  '范围（站点；类目）', '目标排名节点', '期间', '逐月保留目标细分类目 BSR 1—100 全部记录',
  '同父体不同 ASIN 全部保留，月销量及月销售额逐行相加', '排名并列或多变体可超过 100 行，不截取表格前 100 行',
  '销量标题口径：BSR 1—100 入选记录月销量合计', '源月销量可能是父体字段，每条原值均保留',
  '结构份额统一按入选记录销售额汇总计算', '字段完整率 = 有效字段记录数 ÷ 入选记录数（完整率不是销售额金额占比）',
  '所有金额份额分母：当月入选记录已知销售额合计；缺失不补零', '未知规则：卖家归属 / 所在地 / 配送 / 日期 / 品牌',
  '缺失身份不参与前 10 排序', '卖家所在地不等于生产地', 'SC/VC 账户身份缺失时不据配送方式推断',
  '新品定义（见总规则）', '不查询父体最早上架日', '产业链标注事实/推断；用户画像无数据则留空',
] as const;
export const NEW_PRODUCT_RULES = ['新品定义（见总规则）', '不查询父体最早上架日'] as const;
export const TREND_STATS = ['完整周数量', '完整周均值', '最高完整周', '最低完整周', '最新完整周', '最近 4 周均值', '此前 4 周均值', '近 4 周变化'] as const;
export const KEYWORD_COLUMNS = ['关键词', '关键词翻译', 'AC推荐词', '相关度', 'ABA排名', '月搜索量', '月购买量', '购买率', 'SPR', '标题密度', '商品数', '供需比', '广告竞品数', '点击集中度', '前三ASIN转化总占比', 'PPC竞价', '建议竞价范围', '均价', '评分数', '评分值', '所属类目', '#1 前三ASIN', '#1 点击共享', '#1转化共享', '#2 前三ASIN', '#2 点击共享', '#2 转化共享', '#3 前三ASIN', '#3 点击共享', '#3 转化共享', '前十ASIN', '每日竞争程度'] as const;
export const AD_DIFFICULTY_COLUMNS = ['关键词', '翻译', '月搜索量', '商品数', '每日竞争程度', '竞争程度分级', '广告竞品数', '点击集中度', '前三ASIN转化总占比', '购买率', 'PPC竞价', '建议竞价范围', '广告轮播页数', '广告标识类型'] as const;
export const ATTRIBUTE_COLUMNS = ['分类', 'SIF月销量下限', '卖家精灵销售额', 'Listing数', '销量占比', '销售额占比', 'Listing占比', '合计行', '【Insight｜产品切入】'] as const;
export const CONCENTRATION_COLUMNS = ['对象', 'Top3销量占比', 'Top3销售额占比', 'Top3 Listing占比', 'Top10销量占比', 'Top10销售额占比', 'Top10 Listing占比', '垄断率', '切入判断'] as const;
export const MARKET_ASIN_COLUMNS = ['ASIN', '品牌', '卖家名称', '卖家类型', '配送方式', '卖家国家', '评分', '评分数', '套装数', '价格', '1个装价格', '{期末月} SIF购买量下限', 'SIF缺失原因', '{期末月} 卖家精灵销量(核对)', '{期末月} 销量差异率(核对)', '{期末月} 卖家精灵销售额', '销售额缺失原因', '所属类目（点击榜单）'] as const;
export const MONTH_ASIN_COLUMNS = ['YYYY-MM SIF购买量下限', 'SIF缺失原因', '卖家精灵销售额', '销售额缺失原因'] as const;
export const COMPETITOR_GROUPS = [
  { name: '分组行', rows: ['竞品分组', '商品序号'] },
  { name: '基础参数与市场身份', rows: ['ASIN', '亚马逊商品链接', '产品图片', '中文产品定位', '品牌', '父ASIN', '履约方式', '卖家名称', '卖家所在国（快照）', '所属叶子类目 / 节点', '当前大类BSR', '当前小类BSR', '上架记录日', '上架天数', '上架日期与父子关系核验'] },
  { name: '价格、销量与市场表现', rows: ['套装售价（SIF 最新可得）', '卖家精灵对照价', '差值', '套装数', '折算单只售价', '单只价格带', '当前Coupon / 活动记录', '历史父体月销量估算（套）', '近30天销量档位', '星级', '评分人数（非文字评论数）', '变体数量 / 清单核验', '产品尺寸', '包装尺寸 / 包装重量', 'FBA配送费'] },
  { name: '性能参数与适用场景', rows: ['供电方式', '发光方向 / 光型', '发光颜色', '色温', '光通量', '功率 / 功耗', '亮度调节方式', '感应方式 / 光感', '运动感应距离', '感应角度', '感应延时', '工作模式', '记忆功能', '安装方式', '电池容量', '充电时长', '续航及说明条件', '材质 / 部件归属', '防水等级', '保修', '定时 / 遥控控制', '主要使用场景', '主要卖点与配件线索', '规格冲突 / 待核事项'] },
  { name: '历史变化与竞争结论', rows: ['历史实际覆盖 / 最后更新', '近90天LD活动记录', '近90天最划算活动记录', '近90天Coupon变化', '近30天最低报价', '近30天最高报价', '近30天价格振幅', '近90天价格区间 / 调价', '近90天价格走势', '断货情况', '近90天评分人数净变化', '评分人数异常波动（>20且日变>10%）', 'Keepa原生图①价格与排名', 'Keepa原生图②类目排名', 'Keepa原生图③评分与报价数量', '未来30天观察情景', '历史判断与限制（点击Keepa）'] },
  { name: '站内销量、关键词与流量', rows: ['变体购买量贡献 / 范围', '自然 / 广告得分结构（近30天）', '广告内部渠道分布（近30天）', '推荐专栏来源（近30天）', '前10流量词：贡献、自然/SP位置与趋势', '核心关键词表现（排名与份额）', '首页位置持续性', '重点词选取依据'] },
  { name: '站外推广与品牌渠道', rows: ['Facebook官方线索 / 公开规模', 'YouTube测评 / 商品匹配', '视频上传 / 发布日期', '视频观看 / 点赞', '站外促销证据', '品牌官网流量排名', '品牌官网 / 商品页面', '建议切入点'] },
] as const;
export const QA_ROWS = ['分析范围', '规格与说明', '商品图片', 'ASIN', '品牌 / 父ASIN', '评分数 / 星级', '大类BSR', '细分类目与BSR', '首次上架 / 变体数', '整套价格 / 折合单只', '功能与模式', '光色与亮度', '供电 / 容量', '充电与续航', '定时 / 光感', '质保', '评论概况 / QA及买家评价分析', '星级构成', '评分 × 情绪强度矩阵', '用户认可点', '差评痛点', '评价主题表现', '常见差评问题与可能原因', '使用情境洞察', '运营决策与执行建议（竞品反馈、我方需核对项、具体运营动作、优先级、验证指标）', '用户体验归纳', '有效正文统计分母', '图表统计范围', '用户槽点及使用限制', '用户爽点', '统计说明', '用户关注点 / 开发FAQ建议', '产品方向与开发重点', '产品开发要求与建议验证', '差评图片汇总', '来源', '覆盖与父体评论入口'] as const;
export const TRAFFIC_COUNT_COLUMNS = ['#', '关键词', '翻译', 'ABA排名', '搜索量', '在售商品数', '自然流量产品数', '广告流量产品数', 'SP(常规)广告产品数', 'SP(推荐)广告产品数', 'SB(常规)广告产品数', 'SBV视频广告产品数', 'ABA Top3集中度-点击', 'ABA Top3集中度-转化'] as const;
// 契约要求三个 ASIN 分列，使用稳定序号；实际 ASIN 在对应关键词记录中保留。
export const AD_PROFIT_COLUMNS = ['#', '关键词', '翻译', '搜索量', '点击量', '购买量', '搜索转化率', '点击转化率', '建议竞价-最低', '建议竞价-推荐', '建议竞价-最高', 'CPA-最低', 'CPA-推荐', 'CPA-最高', 'ACOS-最低', 'ACOS-均价', 'ACOS-最高', '产品均价-最低', '产品均价-均价', '产品均价-最高', '广告盈亏预估-最低', '广告盈亏预估-推荐', '广告盈亏预估-最高', 'top3产品转化率（ASIN 1）', 'top3产品转化率（ASIN 2）', 'top3产品转化率（ASIN 3）', 'ABATop3集中度-点击', 'ABATop3集中度-转化'] as const;
export const TRAFFIC_LANDSCAPE_COLUMNS = ['#', 'ASIN', '图片', '标题', '价格', '评论', '评分', '子体月订单量', '自然流量', 'SP(常规)流量', 'SP(推荐)流量', 'SB(常规)流量', 'SBV流量', 'AC推荐流量'] as const;
export const LEXICON_COLUMNS = ['#', '关键词', '翻译', '周搜索量', '周搜索排名', '周ABA 排名', '周搜索趋势', '点击', '转化', '类目节点', '类目节点id', '该类目下关键词收录的产品数', '提升与降低-精准_推荐/最低/最高竞价', '提升与降低-词组_推荐/最低/最高竞价', '提升与降低-广泛_推荐/最低/最高竞价', '仅降低/固定-精准_推荐/最低/最高竞价', '仅降低/固定-词组_推荐/最低/最高竞价', '仅降低/固定-广泛_推荐/最低/最高竞价'] as const;
export const COMPLIANCE_ROWS = ['产品标识与回收标识', '说明书语言', '警告语', '电器安全认证（如 CE/UKCA 等按站点）', '儿童用品额外要求', '包装与材质声明', '其他类目强制项'] as const;
export const IP_ROWS = ['商标冲突', '外观专利 / 外观设计', '实用新型 / 发明', '品牌词/核心词占用', '图片或文案相似性（仅在有输入证据时填写，否则 unavailable）'] as const;
export const PROFIT_COLUMNS = ['ASIN', '套装售价（SIF）', '卖家精灵对照价', 'Coupon后价格', '套装数', '折算单只售价', '采购成本', '头程', 'FBA配送费', '平台佣金', '其他费用', '广告CPA（可引用模块 9 推荐档）', '自定义毛利率', '毛利额', '广告后利润', '广告后利润率', '备注'] as const;

export interface SectionSchema {
  readonly id: string;
  readonly title: string;
  readonly columns: readonly string[];
  readonly rowLabels: readonly string[];
  readonly kind: 'table' | 'items' | 'cards' | 'dimensions';
  readonly summaryHeading?: '总结';
}
const table = (id: string, title: string, columns: readonly string[], rowLabels: readonly string[] = [], kind: SectionSchema['kind'] = 'table'): SectionSchema => ({ id, title, columns, rowLabels, kind });
const items = (id: string, title: string, rows: readonly string[]) => table(id, title, ['项目', '内容'], rows, 'items');
const SECTIONS: Record<ModuleId, readonly SectionSchema[]> = {
  1: [items('title', '市场背景调查', ['市场名']), items('macro', '1.宏观分析', ['市场体量走势', '增长速度', '同期比较']), table('yoy', '可比年对照', ['月份', '本年销量', '上年销量', '同比']), table('sampling', '逐月取样（BSR 1—100，保留全部记录）', ['月份', '入选记录数', '月销量合计', '月销售额合计（已知）', '金额字段完整率', '销量缺失条数', '销售额缺失条数', '无目标类目排名而未纳入的候选数', '缺失说明']), items('scope', '口径说明', BACKGROUND_SCOPE_ROWS), items('industry', '2.行业分析&市场大盘分析', ['市场规模', '产业链', '（可选）结构观察']), items('persona', '2.卖家画像', ['用户需求', '正面反馈主题', '主要投诉主题'])],
  2: [items('title', '{国家} {查询词} 谷歌趋势分析', ['标题']), items('seasonality', '1.产品季节性分析（近五年）', ['产品趋势及季节性']), table('regions', '3.产品流行区域（近五年）', ['地区排名', '地区名称', '区域热度（0—100 相对指数）']), items('metadata', '查询元数据', ['查询词', '国家', '类型（Google 网页搜索）', '类别', '时间范围（过去 5 年）', '采集日期']), items('summary', '4.总结', ['产品趋势及季节性', '近期及长期变化', '地区分布']), items('method', '原始数据与计算口径', ['来源 URL', '计算口径']), table('weeks', '周序列表', ['五年周起始日', '热度指数', '数据状态（完整周 / 未完整周 / 缺值）', '曲线标签', '完整周指数']), items('stats', '统计摘要', TREND_STATS)],
  3: [table('keywords', '站内竞争情况-关键词', KEYWORD_COLUMNS)],
  4: [table('words', '词表', AD_DIFFICULTY_COLUMNS), items('summary', '汇总', ['词池规模', '筛选说明', '需求与供给要点', '点击与竞价要点', '类目平均转化率预估', '判定口径全文'])],
  5: [table('monthly', '月度大盘', ['月份', '月销量下限', '月销售额', 'SIF有值ASIN', '销售额有值ASIN', '缺失说明']), table('brandsUnits', '销量占比｜每月前10品牌（SIF购买量下限）', ['月份', '品牌', 'SIF购买量下限', '销量占比']), table('brandsRevenue', '销售额占比｜每月前10品牌（卖家精灵）', ['月份', '品牌', '卖家精灵销售额', '销售额占比']), table('brandsListings', 'Listing占比｜当月SIF可观测ASIN中的前10品牌（非历史Top100）', ['月份', '品牌', 'Listing数', 'Listing占比']), table('accounts', '头部品牌与账号反查', ['序号', '品牌', '账号名称', '账号类型', '配送方式', '品牌简介', '资料来源']), table('concentration', '品牌与Buybox卖家｜Top3、Top10集中度及切入判断', CONCENTRATION_COLUMNS, ['品牌', 'Buybox卖家']), table('attributes', '属性维度拆解', ATTRIBUTE_COLUMNS, [], 'dimensions'), items('method', '数据口径、竞争阈值与来源', ['样本', '销量', '销售额', '缺失原因', '图表口径', '历史', 'Top100 Listing占比', '竞争阈值', '来源', '更新']), table('asins', 'ASIN 底表', MARKET_ASIN_COLUMNS)],
  6: COMPETITOR_GROUPS.map((g, i) => table(`group${i}`, g.name, ['项目', '{ASIN}'], g.rows, 'cards')),
  7: [table('analysis', 'QA&RV分析', ['项目', '{ASIN}'], QA_ROWS, 'cards'), table('complaints', '用户槽点及使用限制', ['主题', '提及次数', '占比', '说明']), table('delights', '用户爽点', ['主题', '提及次数', '占比', '说明'])],
  8: [table('counts', '流量位竞品数量', TRAFFIC_COUNT_COLUMNS)],
  9: [table('profit', '站点广告盈亏', AD_PROFIT_COLUMNS)],
  10: [table('landscape', '流量位竞争格局', TRAFFIC_LANDSCAPE_COLUMNS)],
  11: [table('lexicon', '词库联动', LEXICON_COLUMNS)],
  12: [table('checks', '合规门槛', ['检查项', '适用站点/类目', '要求摘要', '证据', '状态（已核验 / 需人工核实 / 无法确认）', '风险说明'], COMPLIANCE_ROWS)],
  13: [table('concentration', '品牌与Buybox卖家｜Top3、Top10集中度及切入判断', CONCENTRATION_COLUMNS, ['品牌', 'Buybox卖家']), items('insight', 'Insight', ['Insight', '亚马逊自营份额'])],
  14: [items('summary', '汇总', ['新品 Listing 数', '成熟 Listing 数', '新品 SIF购买量下限及占比', '新品销售额及占比', '覆盖说明']), table('monthly', '月度表', ['月份', '新品Listing数', '新品销量下限', '新品销售额', '成熟销量下限', '成熟销售额', '新品销量占比']), table('asins', 'ASIN 明细', ['ASIN', '品牌', '上架记录日', '上架月', '是否新品', 'SIF购买量下限', '销售额', '评分', '评分数']), items('method', '口径说明', NEW_PRODUCT_RULES)],
  15: [table('checks', '知识产权', ['检查项', '对象（品牌/ASIN/关键词）', '检索范围', '命中摘要', '证据链接', '状态（已核验 / 需人工核实 / 无法确认）', '风险说明'], IP_ROWS)],
  16: [table('profit', '利润表', PROFIT_COLUMNS)],
};
SECTIONS[1] = SECTIONS[1].map((s) => ['macro', 'industry', 'persona'].includes(s.id) ? { ...s, summaryHeading: '总结' } : s);
function freeze<T>(v: T): T {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
}
export const MODULE_CATALOG = freeze(MODULE_NAMES.map((name, i) => ({ moduleId: (i + 1) as ModuleId, moduleName: name, sections: SECTIONS[(i + 1) as ModuleId] })));
export const RESEARCH_SCHEMA = freeze(Object.fromEntries(MODULE_CATALOG.map((m) => [m.moduleId, m])) as Record<ModuleId, (typeof MODULE_CATALOG)[number]>);
freeze(MONTH_ASIN_COLUMNS);
