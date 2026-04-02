import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useFilteredTransactions } from '../db/useTransactions'
import { useDateRangeStore } from '../store/dateRangeStore'
import { computeStaffStats } from '../engine/analyticsEngine'
import { EmptyState } from '../components/ui/EmptyState'
import { formatCurrency, formatNumber } from '../utils/format'

export default function StaffView() {
  const { range } = useDateRangeStore()
  const transactions = useFilteredTransactions(range)

  const staffStats = useMemo(() => computeStaffStats(transactions), [transactions])
  const totalRevenue = useMemo(() => staffStats.reduce((s, x) => s + x.totalSales, 0), [staffStats])

  if (transactions.length === 0) {
    return <EmptyState title="No data" subtitle="Import CSV data to see staff performance." />
  }

  if (staffStats.length === 0) {
    return <EmptyState title="No staff data" subtitle="No staff names found in the imported transactions." />
  }

  const chartData = [...staffStats].reverse()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Staff Performance</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue by Staff Member</h2>
        <ResponsiveContainer width="100%" height={Math.max(200, staffStats.length * 40)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 60, left: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11 }}
            />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="totalSales" radius={[0, 3, 3, 0]} label={{ position: 'right', formatter: (v: number) => `$${Math.round(v)}`, fontSize: 10, fill: '#6b7280' }}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="#6366f1" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Staff Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-3 font-semibold text-gray-600 text-xs">Staff Member</th>
                <th className="pb-3 font-semibold text-gray-600 text-xs text-right">Transactions</th>
                <th className="pb-3 font-semibold text-gray-600 text-xs text-right">Total Sales</th>
                <th className="pb-3 font-semibold text-gray-600 text-xs text-right">Avg Sale</th>
                <th className="pb-3 font-semibold text-gray-600 text-xs text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {staffStats.map(staff => {
                const avg = staff.transactionCount > 0 ? staff.totalSales / staff.transactionCount : 0
                const share = totalRevenue > 0 ? (staff.totalSales / totalRevenue) * 100 : 0
                return (
                  <tr key={staff.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-900">{staff.name}</td>
                    <td className="py-2.5 text-right text-gray-700 font-mono">{formatNumber(staff.transactionCount)}</td>
                    <td className="py-2.5 text-right text-gray-900 font-mono">{formatCurrency(staff.totalSales)}</td>
                    <td className="py-2.5 text-right text-gray-700 font-mono">{formatCurrency(avg)}</td>
                    <td className="py-2.5 text-right text-gray-400 font-mono">{share.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
