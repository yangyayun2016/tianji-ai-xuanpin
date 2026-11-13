import { PRODUCT_CONTEXT } from '../data/demo-watch-band'

export type TabKey =
  | 'overview'
  | 'niche'
  | 'benchmark'
  | 'attrs'
  | 'negatives'
  | 'gaps'
  | 'upgrades'
  | 'cost'
  | 'hypo'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'niche', label: '① 细分市场' },
  { key: 'benchmark', label: '④ 对标与元素' },
  { key: 'attrs', label: '④ 属性矩阵' },
  { key: 'negatives', label: '⑤ 差评死法' },
  { key: 'gaps', label: '⑥ 差距矩阵' },
  { key: 'upgrades', label: '⑦⑧ 升级方案' },
  { key: 'cost', label: '成本与包装' },
  { key: 'hypo', label: '⑨ 假设卡' },
]

type Props = {
  active: TabKey
  onChange: (key: TabKey) => void
  children: React.ReactNode
}

export function AppShell({ active, onChange, children }: Props) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {PRODUCT_CONTEXT.title}
            </div>
            <div className="text-xs text-gray-500">
              {PRODUCT_CONTEXT.subtitle} · {PRODUCT_CONTEXT.caseName}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              同步到飞书知识库
            </button>
            <button
              type="button"
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-800"
            >
              重新确认市场
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((tab) => {
            const isActive = tab.key === active
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChange(tab.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-gray-900 font-medium text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-4">{children}</main>
    </div>
  )
}

export { TABS }
