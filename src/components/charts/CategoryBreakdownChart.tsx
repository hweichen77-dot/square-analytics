import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { CategoryRevenue } from '../../engine/analyticsEngine'
import { formatCurrency, formatPercent } from '../../utils/format'

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']

interface CategoryBreakdownChartProps {
  data: CategoryRevenue[]
}

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h2 className="font-semibold text-gray-800 mb-4">Revenue by Category</h2>
      <div className="flex gap-6 items-center">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={data} dataKey="revenue" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2 text-sm min-w-0">
          {data.map((cat, i) => (
            <div key={cat.category} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="flex-1 truncate text-gray-700">{cat.category}</span>
              <span className="text-gray-500">{formatPercent(cat.percentage)}</span>
              <span className="text-gray-700 font-medium">{formatCurrency(cat.revenue)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
