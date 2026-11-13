type Props = {
  label: string
  children: React.ReactNode
  hint?: string
}

export function StatCard({ label, children, hint }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{children}</div>
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </div>
  )
}
