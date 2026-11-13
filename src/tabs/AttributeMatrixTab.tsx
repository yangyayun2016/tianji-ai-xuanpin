import { useMemo, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { ProgressBar } from '../components/ProgressBar'
import { Tag } from '../components/Tag'
import {
  attrDimensions,
  attributeRows,
} from '../data/demo-watch-band'
import { isWhiteSpace, salesDrive } from '../lib/calc'

export function AttributeMatrixTab() {
  const [dim, setDim] = useState<(typeof attrDimensions)[number]>('全部')

  const rows = useMemo(() => {
    return attributeRows
      .filter((r) => dim === '全部' || r.dimension === dim)
      .map((r) => {
        const drive = salesDrive(r.salesShare, r.productShare)
        return {
          ...r,
          drive,
          white: isWhiteSpace(drive, r.productShare),
        }
      })
      .sort((a, b) => b.drive - a.drive)
  }, [dim])

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">
          属性矩阵：属性 × 频次 × 销量（做市场填空）
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          销量拉动 = 销量占比 ÷ 产品占比；&gt;1 表示带该属性的产品卖得更好。空白格：拉动
          ≥ 1.3 且产品占比 ≤ 25%。
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {attrDimensions.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDim(d)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              dim === d
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <DataTable
        headers={[
          '维度',
          '属性',
          '产品数',
          '产品占比',
          '销量占比',
          '销量拉动',
          '对标具备',
          '我有',
          '状态',
        ]}
      >
        {rows.map((r) => (
          <tr key={`${r.dimension}-${r.attribute}`} className="hover:bg-gray-50">
            <td className="px-3 py-2.5 text-gray-500">{r.dimension}</td>
            <td className="px-3 py-2.5 font-medium">{r.attribute}</td>
            <td className="px-3 py-2.5">{r.productCount}</td>
            <td className="px-3 py-2.5">{r.productShare}%</td>
            <td className="min-w-[130px] px-3 py-2.5">
              <ProgressBar
                value={Math.min(r.salesShare, 100)}
                right={`${r.salesShare}%`}
              />
            </td>
            <td
              className={`px-3 py-2.5 font-semibold ${
                r.drive >= 1.3
                  ? 'text-emerald-600'
                  : r.drive < 1
                    ? 'text-rose-600'
                    : 'text-gray-800'
              }`}
            >
              {r.drive}
            </td>
            <td className="px-3 py-2.5">{r.competitorHave}</td>
            <td className="px-3 py-2.5">{r.iHave ? '✓' : '—'}</td>
            <td className="px-3 py-2.5">
              {r.white ? <Tag tone="good">空白格</Tag> : null}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  )
}
