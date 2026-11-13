import { useMemo, useState } from 'react'
import { Tag } from '../components/Tag'
import { costDefaults } from '../data/demo-watch-band'
import { calcUnitEconomics } from '../lib/calc'

export function CostPackagingTab() {
  const [form, setForm] = useState({ ...costDefaults })
  const econ = useMemo(() => calcUnitEconomics(form), [form])

  function setNum<K extends keyof typeof form>(key: K, raw: string) {
    const n = Number(raw)
    setForm((f) => ({ ...f, [key]: Number.isFinite(n) ? n : 0 }))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold">成本输入</h2>
        <p className="mt-1 text-xs text-gray-500">
          采购、包装、头程需手工填写；其余为估算。总成本 = 采购 + 包装 + 头程 + FBA +
          佣金 + 广告 + 退货。降采购 0.5 元不如把包装体积压 15%。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['purchaseCny', '采购价（元/件）'],
              ['packagingCny', '包装（元/件）'],
              ['firstLegPerKgCny', '头程（元/kg）'],
              ['fx', '汇率'],
              ['commissionPct', '佣金 %'],
              ['adPct', '广告占比 %'],
              ['returnLossPct', '退货损失 %'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-xs text-gray-600">
              {label}
              <input
                type="number"
                step="any"
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                value={form[key]}
                onChange={(e) => setNum(key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold">单件经济账</h2>
        {econ.missingPurchase ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            缺失：采购价，结果不完整。
          </div>
        ) : null}

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">售价</dt>
            <dd className="font-medium">${form.sellPriceUsd.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">尺寸 / 重量</dt>
            <dd>
              {form.dimensions} / {form.weightOz} oz
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">尺寸分段</dt>
            <dd>
              {form.sizeTier}（计费重 {form.billableWeightLb} lb）
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">FBA 配送费（参考）</dt>
            <dd>${form.fbaFeeUsd.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">到岸成本</dt>
            <dd>${econ.landedCostUsd.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2">
            <dt className="text-gray-500">单件利润</dt>
            <dd
              className={`font-semibold ${
                econ.unitProfitUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              ${econ.unitProfitUsd.toFixed(2)}（{econ.marginPct}%）
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <Tag tone="good">包装分段：已是最小分段</Tag>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          FBA 费用为美站非旺季参考价，请以当前官方费率核对。压缩、嵌套、压平或真空可减体积，但不要牺牲防护。
        </p>
      </section>
    </div>
  )
}
