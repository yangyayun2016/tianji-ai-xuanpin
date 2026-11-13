type Props = {
  children: React.ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'dark' | 'transfer'
}

const tones: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  dark: 'bg-gray-900 text-white',
  transfer: 'bg-emerald-100 text-emerald-800',
}

export function Tag({ children, tone = 'neutral' }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
