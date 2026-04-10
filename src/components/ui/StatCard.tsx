interface StatCardProps {
  label: string
  value: string
  trend?: string
  trendUp?: boolean
  sub?: string
}

export function StatCard({ label, value, trend, trendUp, sub }: StatCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold text-slate-100 mt-1.5 font-mono tabular-nums">{value}</p>
      {trend && (
        <p className={`text-xs mt-1.5 font-medium flex items-center gap-1 ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
          <span>{trendUp ? '↑' : '↓'}</span>
          <span>{trend}</span>
        </p>
      )}
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}
