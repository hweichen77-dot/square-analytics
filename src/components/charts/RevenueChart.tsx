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
  const fmt = granularity === 'Monthly' ? 'MMM yyyy' : granularity === 'Weekly' ? 'MMM d' : 'MMM d'

  const chartData = data.map(d => ({
    date: format(d.date, fmt),
    revenue: Math.round(d.revenue * 100) / 100,
    transactions: d.transactionCount,
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Revenue</h2>
        <div className="flex gap-1">
          {GRANULARITIES.map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                granularity === g ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
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
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tickFormatter={shortCurrency} tick={{ fontSize: 11 }} width={48} />
          <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} />
          <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGradient)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
