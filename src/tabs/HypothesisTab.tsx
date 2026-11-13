import { Tag } from '../components/Tag'
import { hypothesisCards } from '../data/demo-watch-band'

export function HypothesisTab() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">⑨ 假设卡</h2>
        <p className="mt-1 text-xs text-gray-500">
          老品先测卖点（主图/五点/广告按需求分组），有响应再打样或改款。同步飞书后，团队在「升级假设」表改状态、填测试指标与结论。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hypothesisCards.map((c) => (
          <article
            key={c.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">假设卡 #{c.id}</span>
                <Tag>{c.tag}</Tag>
              </div>
              <div className="text-sm font-semibold">总分 {c.score}</div>
            </div>
            <h3 className="mt-2 text-sm font-semibold leading-snug">{c.title}</h3>
            <dl className="mt-3 space-y-1.5 text-xs">
              {(
                [
                  ['目标人群', c.audience],
                  ['场景', c.scenario],
                  ['唯一变量', c.onlyVariable],
                  ['保留不动', c.keep],
                  ['购买理由', c.reason],
                  ['差异来源', c.diffSource],
                  ['价格逻辑', c.priceLogic],
                  ['验证动作', c.validation],
                  ['止损边界', c.stopLoss],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[72px_1fr] gap-2">
                  <dt className="text-gray-400">{k}</dt>
                  <dd className="text-gray-800">{v}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
