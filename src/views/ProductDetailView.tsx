import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useFilteredTransactions, useOverridesMap } from '../db/useTransactions'
import { useDateRangeStore } from '../store/dateRangeStore'
import {
  computeProductStats,
  computeProductTimeSeries,
  computeProductTransactions,
  computeProductDayOfWeek,
  productTrend,
} from '../engine/analyticsEngine'
import { StatCard } from '../components/ui/StatCard'
import { formatCurrency, formatNumber, dayName } from '../utils/format'

export default function ProductDetailView() {
  const { name } = useParams<{ name: string }>()
  const productName = decodeURIComponent(name ?? '')
  const { range } = useDateRangeStore()
  const transactions = useFilteredTransactions(range)
  const overrides = useOverridesMap()
  const navigate = useNavigate()
  const [showAllTx, setShowAllTx] = useState(false)
  const [granularity, setGranularity] = useState<'Daily' | 'Weekly' | 'Monthly'>('Monthly')

  const stats = useMemo(() => {
    const all = computeProductStats(transactions, overrides)
    return all.find(p => p.name === productName) ?? null
  }, [transactions, overrides, productName])

  const timeSeries = useMemo(() =>
    computeProductTimeSeries(productName, transactions, granularity),
    [productName, transactions, granularity]
  )

  const txRows = useMemo(() =>
    computeProductTransactions(productName, transactions),
    [productName, transactions]
  )

  const dowData = useMemo(() =>
    computeProductDayOfWeek(productName, transactions).map(d => ({
      day: dayName(d.dayOfWeek),
      count: d.count,
    })),
    [productName, transactions]
  )

  if (!stats) {
    return (
      <div className="py-20 text-center text-slate-500">
        <p className="text-4xl mb-3">🔍</p>
        <p>Product not found in current date range.</p>
        <button onClick={() => navigate('/inventory')} className="mt-3 text-teal-400 text-sm underline">← Back</button>
      </div>
    )
  }

  const bestMonthEntry = Object.entries(stats.monthlySales).sort(([,a],[,b]) => b - a)[0]
  const trend = productTrend(stats)
  const displayedTx = showAllTx ? txRows : txRows.slice(0, 10)

  const chartData = timeSeries.map(p => ({
    date: format(p.date, granularity === 'Monthly' ? 'MMM yyyy' : 'MMM d'),
    revenue: Math.round(p.revenue * 100) / 100,
    units: p.units,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/inventory')} className="text-teal-400 text-sm hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-slate-100">{productName}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Units Sold" value={formatNumber(stats.totalUnitsSold)} />
        <StatCard label="Revenue" value={formatCurrency(stats.totalRevenue)} />
        <StatCard label="Avg Price" value={formatCurrency(stats.avgPrice)} />
        <StatCard label="Best Month" value={bestMonthEntry?.[0] ?? '—'} sub={bestMonthEntry ? `${bestMonthEntry[1]} units` : ''} />
        <StatCard label="Trend" value={trend}
          trendUp={trend === 'Growing'}
          trend={trend === 'Growing' ? 'Month over month ↑' : trend === 'Declining' ? 'Month over month ↓' : undefined} />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-200">Sales Over Time</h2>
          <div className="flex gap-1">
            {(['Daily', 'Weekly', 'Monthly'] as const).map(g => (
              <button key={g} onClick={() => setGranularity(g)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium ${granularity === g ? 'bg-teal-500 text-slate-950' : 'text-slate-500 hover:bg-slate-700'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <Tooltip formatter={(v: number, n) => [n === 'revenue' ? formatCurrency(v) : v, n]} />
            <Area type="monotone" dataKey="revenue" stroke="#14B8A6" fill="url(#prodGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h2 className="font-semibold text-slate-200 mb-4">Sales by Day of Week</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={dowData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={32} />
            <Tooltip />
            <Bar dataKey="count" fill="#14B8A6" maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h2 className="font-semibold text-slate-200">Transaction History ({txRows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Unit Price</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-left">Staff</th>
                <th className="px-4 py-2 text-left">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {displayedTx.map((tx, i) => (
                <tr key={i} className="hover:bg-slate-700/50">
                  <td className="px-4 py-2 text-slate-400">{format(tx.date, 'MMM d, yyyy h:mm a')}</td>
                  <td className="px-4 py-2 text-right">{tx.qty}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(tx.unitPrice)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(tx.total)}</td>
                  <td className="px-4 py-2 text-slate-400">{tx.staffName}</td>
                  <td className="px-4 py-2 text-slate-500">{tx.paymentMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {txRows.length > 10 && (
          <div className="px-4 py-3 border-t border-slate-700/50 text-center">
            <button onClick={() => setShowAllTx(s => !s)} className="text-sm text-teal-400 hover:underline">
              {showAllTx ? 'Show less' : `Show all ${txRows.length} transactions`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
