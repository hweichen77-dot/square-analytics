import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format } from 'date-fns'
import type { DailyRevenue, TimeGranularity } from '../../engine/analyticsEngine'

interface RevenueChartProps {
  daily: DailyRevenue[]
  weekly: DailyRevenue[]
  monthly: DailyRevenue[]
}

function shortCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

const GRANULARITIES: TimeGranularity[] = ['Daily', 'Weekly', 'Monthly']

export function RevenueChart({ daily, weekly, monthly }: RevenueChartProps) {
  const [granularity, setGranularity] = useState<TimeGranularity>('Daily')

  const data = granularity === 'Daily' ? daily : granularity === 'Weekly' ? weekly : monthly
  const fmt = granularity === 'Monthly' ? 'MMM yyyy' : 'MMM d'

  const chartData = data.map(d => ({
    date: format(d.date, fmt),
    revenue: Math.round(d.revenue * 100) / 100,
    transactions: d.transactionCount,
  }))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-200 text-sm">Revenue</h2>
        <div className="flex gap-1">
          {GRANULARITIES.map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                granularity === g
                  ? 'bg-teal-500 text-slate-950'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#14B8A6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} interval="preserveStartEnd" axisLine={{ stroke: '#1E293B' }} tickLine={false} />
          <YAxis tickFormatter={shortCurrency} tick={{ fontSize: 11, fill: '#64748B' }} width={48} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
            labelStyle={{ color: '#94A3B8' }}
            itemStyle={{ color: '#2DD4BF' }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']}
          />
          <Area type="monotone" dataKey="revenue" stroke="#14B8A6" fill="url(#revGradient)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
