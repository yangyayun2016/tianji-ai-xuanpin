type Props = {
  headers: React.ReactNode[]
  children: React.ReactNode
}

export function DataTable({ headers, children }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-gray-50 text-xs font-medium text-gray-500">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  )
}
