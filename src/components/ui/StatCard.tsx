interface StatCardProps {
  label: string
  value: string
  trend?: string
  trendUp?: boolean
  trendGood?: boolean
  sub?: string
  countTo?: number
  format?: (n: number) => string
}

export function StatCard({ label, value, trend, trendUp, trendGood, sub, countTo, format }: StatCardProps) {
  const display = countTo != null && format ? format(countTo) : value
  const good = trendGood ?? trendUp
  return (
    <div className="px-5 py-4 bg-white min-w-0">
      <p className="text-[13px] text-stone-500 truncate">{label}</p>
      <p className="mt-1.5 text-[24px] leading-8 font-medium text-stone-100 tabular-nums truncate">{display}</p>
      {trend && (
        <p className="text-xs mt-1 flex items-center gap-1 text-stone-500">
          <span aria-hidden="true" className={good ? 'text-emerald-500' : 'text-red-500'}>{trendUp ? '▲' : '▼'}</span>
          <span className="tabular-nums">{trend}</span>
        </p>
      )}
      {sub && <p className="text-xs text-stone-500 mt-1 truncate">{sub}</p>}
    </div>
  )
}
