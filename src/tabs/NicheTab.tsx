import { DataTable } from '../components/DataTable'
import { ProgressBar } from '../components/ProgressBar'
import { Tag } from '../components/Tag'
import { morphGroups, priceBands, PRODUCT_CONTEXT } from '../data/demo-watch-band'

export function NicheTab() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">形态分组与质检</h2>
          <p className="mt-1 text-xs text-gray-500">{PRODUCT_CONTEXT.category}</p>
          <p className="mt-1 text-xs text-gray-500">
            质检三条：价格收敛、占比正常、样本≥30。样本不足仅作定性参考。
          </p>
        </div>
        <DataTable
          headers={[
            '形态',
            '产品数',
            '月销占比',
            '均价',
            '价格范围',
            '质检',
            '定义',
          ]}
        >
          {morphGroups.map((g) => (
            <tr key={g.name} className="hover:bg-gray-50">
              <td className="px-3 py-2.5 font-medium">{g.name}</td>
              <td className="px-3 py-2.5">{g.count}</td>
              <td className="px-3 py-2.5">{g.salesShare}%</td>
              <td className="px-3 py-2.5">${g.avgPrice}</td>
              <td className="px-3 py-2.5">{g.priceRange}</td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {g.qc.map((q) => (
                    <Tag
                      key={q}
                      tone={q.includes('<') ? 'warn' : 'good'}
                    >
                      {q}
                    </Tag>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2.5 text-xs text-gray-500">{g.definition}</td>
            </tr>
          ))}
        </DataTable>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">价格区间（2 美元一档）</h2>
          <p className="mt-1 text-xs text-gray-500">
            你在 $6-8：单均市占 4.07%（基准 4%），区间垄断度 69.5%。
          </p>
        </div>
        <DataTable
          headers={[
            '区间',
            '产品数',
            '销量占比',
            '单均市占',
            '区间垄断度',
            '评论占比',
            '信号',
          ]}
        >
          {priceBands.map((b) => (
            <tr
              key={b.range}
              className={b.isMine ? 'bg-amber-50/70' : 'hover:bg-gray-50'}
            >
              <td className="px-3 py-2.5 font-medium">
                {b.range}{' '}
                {b.isMine ? <Tag tone="warn">我在这</Tag> : null}
              </td>
              <td className="px-3 py-2.5">{b.count}</td>
              <td className="min-w-[140px] px-3 py-2.5">
                <ProgressBar value={b.salesShare} right={`${b.salesShare}%`} />
              </td>
              <td className="px-3 py-2.5">{b.avgShare}%</td>
              <td className="px-3 py-2.5">{b.concentration}%</td>
              <td className="px-3 py-2.5">{b.reviewShare}%</td>
              <td className="px-3 py-2.5">
                <Tag tone={b.signal === '近期热销' ? 'good' : 'warn'}>
                  {b.signal}
                </Tag>
              </td>
            </tr>
          ))}
        </DataTable>
      </section>
    </div>
  )
}
