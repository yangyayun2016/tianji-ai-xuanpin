import { Tag } from '../components/Tag'
import { benchmarkProducts } from '../data/demo-watch-band'

export function BenchmarkTab() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">对标与元素</h2>
        <p className="mt-1 text-xs text-gray-500">
          拆解本品、同价对手与头部常青的需求 / 场景 / 人群 / 结构 / 视觉；绿色为可迁移元素。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {benchmarkProducts.map((p) => (
          <article
            key={p.asin}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-500">
                图
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1">
                  <a
                    className="text-sm font-medium text-blue-600 hover:underline"
                    href={`https://www.amazon.com/dp/${p.asin}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {p.asin}
                  </a>
                  <Tag tone={p.role === '我的产品' ? 'dark' : 'neutral'}>
                    {p.role}
                  </Tag>
                  <Tag>{p.rankLabel}</Tag>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-gray-600">{p.title}</p>
                <p className="mt-1 text-sm font-medium">
                  ${p.price.toFixed(2)} · 月销 {p.monthlySales.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
              {p.slogan}
            </div>

            <div className="mt-3 space-y-2">
              {Object.entries(p.tags).map(([k, vals]) => (
                <div key={k} className="flex gap-2 text-xs">
                  <div className="w-14 shrink-0 text-gray-400">{k}</div>
                  <div className="flex flex-wrap gap-1">
                    {vals.map((v) => (
                      <Tag key={v}>{v}</Tag>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 text-xs">
                <div className="w-14 shrink-0 text-gray-400">可迁移</div>
                <div className="flex flex-wrap gap-1">
                  {p.transferable.map((v) => (
                    <Tag key={v} tone="transfer">
                      {v}
                    </Tag>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <div className="w-14 shrink-0 text-gray-400">打法</div>
                <Tag tone="dark">{p.play}</Tag>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
