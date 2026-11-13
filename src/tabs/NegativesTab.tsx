import { Fragment, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { Tag } from '../components/Tag'
import { negativeCompetitors, negativeRows } from '../data/demo-watch-band'

function heatClass(v: number): string {
  if (v >= 30) return 'bg-rose-200/80'
  if (v >= 20) return 'bg-rose-100'
  if (v >= 12) return 'bg-rose-50'
  return ''
}

export function NegativesTab() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">
          差评维度（我 vs 对标，差评提及率）
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          四种死法：品控寿命 / 服务不兜底 / 卖点没兑现 / 基础体验。改进三类：低成本结构件（性价比最高）·
          需供应链配合（先算库存价值）· 服务兜底（修不好就用质保）。点一行看买家原话。
        </p>
      </div>

      <DataTable
        headers={[
          '维度',
          '死法',
          '改进类型',
          '旅程',
          '我',
          ...negativeCompetitors,
          '判断',
          '夸/骂',
        ]}
      >
        {negativeRows.map((r) => {
          const isOpen = open === r.dimension
          return (
            <Fragment key={r.dimension}>
              <tr
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => setOpen(isOpen ? null : r.dimension)}
              >
                <td className="px-3 py-2.5 font-medium">{r.dimension}</td>
                <td className="px-3 py-2.5 text-xs">{r.deathType}</td>
                <td className="px-3 py-2.5 text-xs">{r.improveType}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{r.journey}</td>
                <td className={`px-3 py-2.5 font-medium ${heatClass(r.me)}`}>
                  {r.me}%
                </td>
                {negativeCompetitors.map((c) => (
                  <td
                    key={c}
                    className={`px-3 py-2.5 ${heatClass(r.competitors[c] ?? 0)}`}
                  >
                    {r.competitors[c] ?? 0}%
                  </td>
                ))}
                <td className="px-3 py-2.5">
                  <Tag tone={r.judgment === '本品独有' ? 'danger' : 'neutral'}>
                    {r.judgment}
                  </Tag>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600">
                  {r.praiseScold}
                </td>
              </tr>
              {isOpen ? (
                <tr className="bg-gray-50">
                  <td
                    colSpan={9 + negativeCompetitors.length}
                    className="px-4 py-3 text-sm text-gray-700"
                  >
                    <div className="font-medium">买家原话</div>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
                      {r.quotes.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          )
        })}
      </DataTable>
    </div>
  )
}
