import { useMemo, useState } from 'react'
import { ProgressBar } from '../components/ProgressBar'
import { Tag } from '../components/Tag'
import { defaultWeights, upgradeSchemes } from '../data/demo-watch-band'
import { weightedScore, type ScoreWeights } from '../lib/calc'

const WEIGHT_FIELDS: { key: keyof ScoreWeights; label: string }[] = [
  { key: 'demandEvidence', label: '需求证据' },
  { key: 'competitionPosition', label: '竞争与位置' },
  { key: 'perceivedValue', label: '感知价值/增本' },
  { key: 'totalCostImpact', label: '总成本影响' },
  { key: 'copyBarrier', label: '复制门槛' },
  { key: 'implRisk', label: '实施风险' },
  { key: 'resourceMatch', label: '资源匹配' },
]

const DIM_LABELS: Record<keyof ScoreWeights, string> = {
  demandEvidence: '需求证据',
  competitionPosition: '竞争与位置',
  perceivedValue: '感知价值/增本',
  totalCostImpact: '总成本影响',
  copyBarrier: '复制门槛',
  implRisk: '实施风险',
  resourceMatch: '资源匹配',
}

export function UpgradesTab() {
  const [weights, setWeights] = useState<ScoreWeights>({ ...defaultWeights })
  const [resources, setResources] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      upgradeSchemes.map((s) => [s.id, s.dims.resourceMatchDefault]),
    ),
  )

  const ranked = useMemo(() => {
    return upgradeSchemes
      .map((s) => {
        const dims = {
          demandEvidence: s.dims.demandEvidence,
          competitionPosition: s.dims.competitionPosition,
          perceivedValue: s.dims.perceivedValue,
          totalCostImpact: s.dims.totalCostImpact,
          copyBarrier: s.dims.copyBarrier,
          implRisk: s.dims.implRisk,
          resourceMatch: resources[s.id] ?? s.dims.resourceMatchDefault,
        }
        return { ...s, dims, score: weightedScore(dims, weights) }
      })
      .sort((a, b) => b.score - a.score)
  }, [weights, resources])

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold">评分权重（修改后即时重算）</h2>
        <p className="mt-1 text-xs text-gray-500">
          「资源匹配」在每张方案卡上用滑杆单独调整，默认 60。覆盖供应链、摄影、资金、团队长板。
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {WEIGHT_FIELDS.map((f) => (
            <label key={f.key} className="block text-xs text-gray-600">
              {f.label}
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                value={weights[f.key]}
                onChange={(e) =>
                  setWeights((w) => ({
                    ...w,
                    [f.key]: Number(e.target.value) || 0,
                  }))
                }
              />
            </label>
          ))}
        </div>
      </section>

      <div className="space-y-3">
        {ranked.map((s) => (
          <article
            key={s.id}
            className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 lg:grid-cols-[1fr_240px]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-900 text-sm font-semibold text-white">
                  {s.score}
                </div>
                <Tag tone="dark">{s.label}</Tag>
              </div>
              <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm">
                <span className="text-gray-500">唯一变量：</span>
                {s.onlyVariable}
              </p>
              <p className="mt-1 text-sm">
                <span className="text-gray-500">保留不动：</span>
                {s.keep.join('、')}
              </p>
              <p className="mt-2 text-sm italic text-gray-700">{s.slogan}</p>
              <p className="mt-2 text-xs text-gray-600">
                <strong>证据：</strong>
                {s.evidence}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                <strong>验证：</strong>
                {s.validation}
              </p>
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                风险：{s.risk}
              </div>
            </div>

            <div className="space-y-2 rounded-lg bg-gray-50 p-3">
              {(Object.keys(DIM_LABELS) as (keyof ScoreWeights)[]).map((k) => {
                const v = s.dims[k]
                const color =
                  v >= 65 ? 'bg-emerald-500' : v < 45 ? 'bg-rose-500' : 'bg-amber-400'
                return (
                  <ProgressBar
                    key={k}
                    label={DIM_LABELS[k]}
                    right={String(v)}
                    value={v}
                    color={color}
                  />
                )
              })}
              <label className="mt-2 block text-xs text-gray-600">
                资源匹配（滑杆）
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={resources[s.id]}
                  onChange={(e) =>
                    setResources((r) => ({
                      ...r,
                      [s.id]: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full accent-blue-600"
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
