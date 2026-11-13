type Props = {
  value: number
  max?: number
  color?: string
  label?: string
  right?: string
}

export function ProgressBar({
  value,
  max = 100,
  color = 'bg-orange-400',
  label,
  right,
}: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="w-full">
      {(label || right) && (
        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
          <span>{label}</span>
          <span>{right}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
