import { StatCard } from '../components/StatCard'
import { Tag } from '../components/Tag'
import { overview } from '../data/demo-watch-band'
import type { TabKey } from '../components/AppShell'

type Props = { onNavigate: (key: TabKey) => void }

export function OverviewTab({ onNavigate }: Props) {
  const { stats } = overview
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <ul className="list-disc space-y-1 pl-4">
          {overview.alerts.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="细分市场样本"
          hint={`从池 ${stats.nicheSample.pool} 中分析`}
        >
          {stats.nicheSample.analyzed} 个产品
        </StatCard>
        <StatCard
          label="我的价格带"
          hint={`市占 ${stats.myPriceBand.share}% · 基准 ${stats.myPriceBand.benchmark}%`}
        >
          {stats.myPriceBand.range}
        </StatCard>
        <StatCard
          label="差距项"
          hint={`他有我无 ${stats.gapItems.heHasIDont} · 他有我弱 ${stats.gapItems.heHasImWeak} · 他无我有 ${stats.gapItems.heDoesntIHave} · 双方都无 ${stats.gapItems.neither}`}
        >
          {stats.gapItems.total} 项
        </StatCard>
        <StatCard label="升级方案" hint={`最高分 ${stats.upgrades.topScore}`}>
          {stats.upgrades.count} 个
        </StatCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-base font-semibold">本品问题与品类共性</h2>
          <p className="mt-1 text-xs text-gray-500">差评提及率：我 vs 基准</p>

          <div className="mt-4">
            <div className="text-xs font-medium text-gray-500">本品独有问题</div>
            {overview.myProblems.map((p) => (
              <div
                key={p.name}
                className="mt-2 flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <Tag tone="danger">{p.kind}</Tag>
                </div>
                <span className="text-sm">
                  {p.me}% <span className="text-gray-400">vs</span> {p.bench}%
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="text-xs font-medium text-gray-500">品类共性未解问题</div>
            <div className="mt-2 space-y-2">
              {overview.categoryCommons.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <span>{p.name}</span>
                  <span className="text-sm">
                    {p.me}% <span className="text-gray-400">vs</span> {p.bench}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('negatives')}
            className="mt-4 text-sm font-medium text-gray-900 underline"
          >
            查看差评死法 →
          </button>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-base font-semibold">最高分升级方案</h2>
          <div className="mt-3 space-y-2">
            {overview.topUpgrades.map((u) => (
              <div
                key={u.title}
                className="flex gap-3 rounded-lg border border-gray-100 px-3 py-2"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-sm font-semibold text-white">
                  {u.score}
                </div>
                <div>
                  <div className="font-medium">{u.title}</div>
                  <div className="text-xs text-gray-500">{u.note}</div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('upgrades')}
            className="mt-4 text-sm font-medium text-gray-900 underline"
          >
            查看全部方案 →
          </button>
        </section>
      </div>
    </div>
  )
}
