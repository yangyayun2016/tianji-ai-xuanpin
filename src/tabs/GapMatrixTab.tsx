import { DataTable } from '../components/DataTable'
import { Tag } from '../components/Tag'
import { gapItems, overview } from '../data/demo-watch-band'

const ORDER = ['他有我无', '他有我弱', '他无我有', '双方都无'] as const

export function GapMatrixTab() {
  const counts = {
    他有我无: overview.stats.gapItems.heHasIDont,
    他有我弱: overview.stats.gapItems.heHasImWeak,
    他无我有: overview.stats.gapItems.heDoesntIHave,
    双方都无: overview.stats.gapItems.neither,
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">⑥ 差距矩阵</h2>
        <p className="mt-1 text-xs text-gray-500">
          共 {overview.stats.gapItems.total}{' '}
          项差距。优先打「他有我弱」补齐短板，再用「双方都无」做真差异化。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ORDER.map((q) => (
          <div
            key={q}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="text-xs text-gray-500">{q}</div>
            <div className="mt-1 text-2xl font-semibold">{counts[q]}</div>
          </div>
        ))}
      </div>

      <DataTable headers={['象限', '属性/机会', '证据', '建议动作']}>
        {gapItems.map((g) => (
          <tr key={`${g.quadrant}-${g.attribute}`} className="hover:bg-gray-50">
            <td className="px-3 py-2.5">
              <Tag
                tone={
                  g.quadrant === '他有我弱'
                    ? 'warn'
                    : g.quadrant === '双方都无'
                      ? 'good'
                      : 'neutral'
                }
              >
                {g.quadrant}
              </Tag>
            </td>
            <td className="px-3 py-2.5 font-medium">{g.attribute}</td>
            <td className="px-3 py-2.5 text-xs text-gray-600">{g.evidence}</td>
            <td className="px-3 py-2.5 text-xs">{g.action}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  )
}
