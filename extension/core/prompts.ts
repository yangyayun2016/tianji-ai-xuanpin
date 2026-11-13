import { ATTR_DIMS, ATTR_DIM_NAMES, DEATHS, FIXES, LEVERS, NEED_LEVELS, STAGES, type Aspect, type ElementCard, type FormDef, type GapItem, type Product, type ProductDetail, type Review } from './types';

/** 所有 AI 任务的名字：AI 只打标签、归类、写文案，计数和分数都由程序算 */
export type AiTask = 'forms' | 'classify' | 'attrs' | 'attrMerge' | 'element' | 'taxonomy' | 'tag' | 'hypotheses';

export interface Prompt {
  task: AiTask;
  system: string;
  user: string;
  images?: string[];
}

const RULE = '只输出 JSON，不要任何说明文字。所有标签用简体中文短语（≤12 字）。不确定就少写，不要编造。';

export function formsPrompt(me: ProductDetail, titles: Product[]): Prompt {
  return {
    task: 'forms',
    system: `你是亚马逊产品开发。任务：把一个类目节点里的商品切成“买家不会跨组比价”的产品形态组。
判断标准：动力源（电动/手动/插电）、主体形态、用途对象等会改变买家比较池的差异才算不同形态；颜色、尺寸、卖点形容词（heavy duty、premium、mini 这类描述“多好”的词）不算。
配件（替换件、耗材、for XX 的附件、XX 支架等）单独归为“配件”，不算形态。with / includes 之后的词是随附件，不改变主体形态。
给出 3–8 个形态组，每组一句定义和标题里能识别它的英文线索词。${RULE}
输出：{"forms":[{"name":"形态名","desc":"一句定义 + 线索词"}]}`,
    user: `我的产品：${me.title}\n\n该节点商品标题（按销量排序）：\n${titles.map((p) => `- ${p.title.slice(0, 140)}`).join('\n')}`,
  };
}

export function classifyPrompt(forms: FormDef[], batch: Product[]): Prompt {
  return {
    task: 'classify',
    system: `把每个商品归入给定的形态组之一；配件（替换件、耗材、附件、支架等）标 accessory=true。
注意词序无关：“XX holder”和“holder for XX”都是配件；with/includes 后面的随附件不影响主体判断。
形态组：
${forms.map((f) => `- ${f.name}：${f.desc}`).join('\n')}
都不合适就写“其他”。${RULE}
输出：{"items":[{"asin":"","accessory":false,"form":"形态名"}]}`,
    user: batch.map((p) => `${p.asin}\t$${p.price}\t${p.title.slice(0, 160)}`).join('\n'),
  };
}

export function attrsPrompt(batch: { asin: string; title: string; features?: string[] }[]): Prompt {
  return {
    task: 'attrs',
    system: `逐个商品抽取属性，六个维度：${ATTR_DIMS.map((d) => `${d}=${ATTR_DIM_NAMES[d]}`).join('，')}。
只抽标题/五点里明确写到的，每维最多 4 个，用通用的中文短语（如“可折叠”“304不锈钢”“大容量”“露营”“老人”），同一含义用同一个说法。
不要抽品牌、颜色、营销形容词（premium、best 等）。${RULE}
输出：{"items":[{"asin":"",${ATTR_DIMS.map((d) => `"${d}":[]`).join(',')}}]}`,
    user: batch.map((p) => `【${p.asin}】${p.title.slice(0, 200)}${p.features?.length ? `\n五点：${p.features.join(' | ').slice(0, 600)}` : ''}`).join('\n\n'),
  };
}

export function attrMergePrompt(values: Partial<Record<string, string[]>>): Prompt {
  return {
    task: 'attrMerge',
    system: `下面是从同一细分市场商品里抽出的属性值，按维度列出。把同义或几乎同义的说法合并到一个标准说法（例：“可折叠/折叠式/能折叠”→“可折叠”）。
含义不同的不要合并。只输出需要改名的项。${RULE}
输出：{"mapping":{"维度英文名":{"原词":"标准词"}}}`,
    user: Object.entries(values)
      .map(([d, vs]) => `${d}：${(vs ?? []).join('、')}`)
      .join('\n'),
  };
}

export function elementPrompt(d: ProductDetail, price: number, units: number, isMine: boolean): Prompt {
  return {
    task: 'element',
    system: `你是亚马逊产品开发，正在把${isMine ? '我自己的产品' : '一个已被市场验证的爆款'}拆成可复用的“爆款元素”。看标题、五点和主图。
- realPitch：一句话说它真正在卖什么（购买理由，不是品类名。例：不是“木鸟屋”，而是“能装饰花园、适合送观鸟爱好者的鸟屋”）
- demand 需求 / scene 场景 / persona 人群 / structure 结构（可伸缩、可折叠、可拆卸、模块化、套装等）/ visual 视觉（颜色、材质观感、造型、图案、主图表达方式）/ priceSpec 价格规格组合（单件/多件装/混合规格/套装）
- transferable：哪些元素离开这个产品也成立、可以迁移到别的产品或类目
- playbook：打法类型，从“装饰礼品型/问题解决型/技术生态型/性价比型/品质溢价型/季节节日型/配件补全型”选一个
每项 1–4 条。${RULE}
输出：{"realPitch":"","demand":[],"scene":[],"persona":[],"structure":[],"visual":[],"priceSpec":[],"transferable":[],"playbook":""}`,
    user: `ASIN ${d.asin}｜$${price}｜月销 ${units}\n标题：${d.title}\n五点：\n${d.features.map((f) => `- ${f}`).join('\n')}`,
    images: d.imageUrl ? [d.imageUrl] : [],
  };
}

export function taxonomyPrompt(sample: Review[]): Prompt {
  return {
    task: 'taxonomy',
    system: `你在为一个细分市场建立固定的评论标签体系，之后这个市场的所有评论都用它打标，保证前后可比。
给出 8–15 个“体验维度”（如 耐用性、佩戴稳定、清洁难度、安装难度、尺寸适配、客服售后、包装破损、卖点兑现），每个维度：
- id：英文小写短 id（如 durability）
- name：中文名，desc：一句话界定
- death：当它是差评时属于哪种死法：${DEATHS.join('/')}（品控寿命=用几周就坏/一致性差；服务不兜底=客服保修；卖点没兑现=主打卖点实际做不到；基础体验=戴不住、难装、难清洁等基本体验）
- fix：改进类型：${FIXES.join('/')}（低成本结构件=换料、加配件、改小结构；需供应链配合=模具、元件、品控标准；服务兜底=原理上改不动，用保修和说明兜住）
- stage：问题发生在用户旅程哪一段：${STAGES.join('/')}
维度要互斥、颗粒度适中：“音质差”这类笼统说法如果评论里能拆成不同原因（如噪音、发闷、低音弱），就拆开。${RULE}
输出：{"aspects":[{"id":"","name":"","desc":"","death":"","fix":"","stage":""}]}`,
    user: sample.map((r) => `[${r.star}星] ${`${r.title} ${r.content}`.replace(/\s+/g, ' ').slice(0, 300)}`).join('\n'),
  };
}

export function tagPrompt(aspects: Aspect[], batch: Review[]): Prompt {
  return {
    task: 'tag',
    system: `用给定的标签体系给每条评论打标。一条评论可以有多个维度；p=1 表示夸、p=-1 表示骂。没提到的维度不要写。
空泛、与产品无关或明显恶意（只骂不说具体问题、描述与产品对不上）的标 spam=true。
标签体系：
${aspects.map((a) => `- ${a.id}：${a.name}（${a.desc}）`).join('\n')}
${RULE}
输出：{"items":[{"id":"","aspects":[{"a":"维度id","p":-1}],"spam":false}]}`,
    user: batch.map((r) => `${r.id}\t[${r.star}星] ${`${r.title} ${r.content}`.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n'),
  };
}

export function hypothesesPrompt(input: { me: ProductDetail; mine: ElementCard | undefined; gaps: GapItem[]; keep: string[]; benchPitches: string[]; transferable: string[] }): Prompt {
  return {
    task: 'hypotheses',
    system: `你是亚马逊产品开发，为一个在售老品提出升级方案。原则：“用爆款做爆款”——复制已成立的需求和购买理由，只改变消费者仍不满意的那一个关键变量。
硬规则：
1. 每个方案只改一个变量（change 写清楚唯一改动），不要把加灯、折叠、磁吸堆在一起。
2. lever 只能从这里选：${LEVERS.join('、')}。
3. evidence 必须引用下面差距矩阵里的 id（如 g3），说明这个方案在回应哪条证据。
4. keep：必须保留不动的东西（来自好评/爆款已验证的元素）。
5. level：只是修复差评、把产品补到及格的写“补及格线”；能改变选择理由（新人群、新场景、重新定义）的写“真差异化”。
6. need：需求层次，从 ${NEED_LEVELS.join('/')} 选。
7. pitch：一句买家三秒能懂的购买理由（英文 listing 视角的中文表述）。
8. verify：最低成本的验证动作，老品优先“先测卖点”（主图/五点/广告按需求分组测试），有响应再打样改模。
9. judge：perceivable 主图能否一眼看出差异；costDelta 单件增本 低/中/高；priceUpliftPct 预计可提价百分比（保守）；mold 是否需要开模；cert 是否涉及新认证；moatLayers 别人复制要跨过几层门槛（钱/时间/复杂度/资源/专利合规，0–5）；sizeChange 包装体积 变小/不变/变大。
给出 8–14 个方案，覆盖不同杠杆，优先回应强度高的证据。${RULE}
输出：{"items":[{"lever":"","title":"","change":"","keep":[],"persona":"","scene":"","pitch":"","evidence":["g1"],"level":"","need":"","verify":"","judge":{"perceivable":true,"costDelta":"低","priceUpliftPct":5,"mold":false,"cert":false,"moatLayers":1,"sizeChange":"不变"}}]}`,
    user: [
      `我的产品：${input.me.title}（$${input.me.price}）`,
      input.mine ? `我的产品在卖什么：${input.mine.realPitch}；结构：${input.mine.structure.join('、')}；人群：${input.mine.persona.join('、')}；场景：${input.mine.scene.join('、')}` : '',
      `对标爆款的购买理由：\n${input.benchPitches.map((p) => `- ${p}`).join('\n')}`,
      `可迁移元素：${input.transferable.join('、') || '无'}`,
      `好评里必须保留的：${input.keep.join('、') || '无'}`,
      `差距矩阵（id｜象限｜维度｜项｜证据｜强度）：\n${input.gaps.map((g) => `${g.id}｜${g.quadrant}｜${g.dim}｜${g.item}｜${g.evidence}｜${g.strength}`).join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}
