import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { ProductStats } from '../../engine/analyticsEngine'
import { formatCurrency } from '../../utils/format'

const CAT_COLORS: Record<string, string> = {
  'Food': '#f59e0b',
  'Drinks': '#6366f1',
  'Ice Cream': '#10b981',
  'Ramen/Hot Food': '#ef4444',
  'Merch': '#8b5cf6',
  'Other': '#94a3b8',
}

interface TopProductsChartProps {
  products: ProductStats[]
}

export function TopProductsChart({ products }: TopProductsChartProps) {
  const [mode, setMode] = useState<'revenue' | 'units'>('revenue')
  const top10 = products.slice(0, 10)
  const chartData = top10.map(p => ({
    name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
    fullName: p.name,
    value: mode === 'revenue' ? p.totalRevenue : p.totalUnitsSold,
    category: p.category,
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Top Products</h2>
        <div className="flex gap-1">
          {(['revenue', 'units'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium capitalize ${
                mode === m ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {m === 'revenue' ? 'By Revenue' : 'By Qty'}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11 }}
            tickFormatter={v => mode === 'revenue' ? `$${v}` : String(v)} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
          <Tooltip
            formatter={(v: number, _n, props) => [
              mode === 'revenue' ? formatCurrency(v) : `${v} units`,
              props.payload?.fullName ?? '',
            ]}
          />
          <Bar dataKey="value" maxBarSize={20}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={CAT_COLORS[d.category] ?? '#94a3b8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
