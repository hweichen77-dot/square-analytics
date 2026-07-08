import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { chart } from '../lib/chartTheme'
import { useFilteredTransactions } from '../db/useTransactions'
import { useDateRangeStore } from '../store/dateRangeStore'
import { EmptyState } from '../components/ui/EmptyState'
import { formatCurrency } from '../utils/format'
import { StatCard } from '../components/ui/StatCard'
import type { SalesTransaction } from '../types/models'
import { parseProductItems } from '../types/models'
import { startOfDay } from 'date-fns'

interface StaffProfile {
  name: string
  totalTransactions: number
  totalRevenue: number
  avgTransactionValue: number
  activeDays: number
  topProducts: { name: string; count: number }[]
  hourlyRevenue: Record<number, number>
  dailyRevenue: Record<number, number>
  revenueByHour: { hour: number; revenue: number }[]
}

type StaffMetric = 'revenue' | 'transactions' | 'avgValue'

function buildProfiles(transactions: SalesTransaction[]): StaffProfile[] {
  const byStaff: Record<string, SalesTransaction[]> = {}
  for (const tx of transactions) {
    if (!tx.staffName.trim()) continue
    const name = tx.staffName.trim()
    if (!byStaff[name]) byStaff[name] = []
    byStaff[name].push(tx)
  }

  return Object.entries(byStaff).map(([name, txs]) => {
    const totalRev = txs.reduce((s, t) => s + t.netSales, 0)
    const avgTx = totalRev / Math.max(1, txs.length)
    const days = new Set(txs.map(tx => startOfDay(tx.date).getTime())).size

    const productCount: Record<string, number> = {}
    for (const tx of txs) {
      for (const item of parseProductItems(tx.itemDescription)) {
        productCount[item.name] = (productCount[item.name] ?? 0) + item.qty
      }
    }
    const topProducts = Object.entries(productCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([n, count]) => ({ name: n, count }))

    const hourlyRev: Record<number, number> = {}
    const dailyRev: Record<number, number> = {}
    for (const tx of txs) {
      hourlyRev[tx.hour] = (hourlyRev[tx.hour] ?? 0) + tx.netSales
      dailyRev[tx.dayOfWeek] = (dailyRev[tx.dayOfWeek] ?? 0) + tx.netSales
    }
    const revenueByHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: hourlyRev[h] ?? 0 }))

    return {
      name,
      totalTransactions: txs.length,
      totalRevenue: totalRev,
      avgTransactionValue: avgTx,
      activeDays: days,
      topProducts,
      hourlyRevenue: hourlyRev,
      dailyRevenue: dailyRev,
      revenueByHour,
    }
  }).sort((a, b) => b.totalRevenue - a.totalRevenue)
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function StaffShiftView() {
  const { range } = useDateRangeStore()
  const transactions = useFilteredTransactions(range)
  const [metric, setMetric] = useState<StaffMetric>('revenue')
  const [selectedStaff, setSelectedStaff] = useState('')

  const profiles = useMemo(() => buildProfiles(transactions), [transactions])
  const namedTxCount = useMemo(
    () => transactions.filter(tx => tx.staffName.trim()).length,
    [transactions],
  )
  const selectedProfile = useMemo(
    () => profiles.find(p => p.name === selectedStaff) ?? null,
    [profiles, selectedStaff],
  )

  function metricValue(p: StaffProfile) {
    if (metric === 'revenue') return p.totalRevenue
    if (metric === 'transactions') return p.totalTransactions
    return p.avgTransactionValue
  }
  function metricLabel(v: number) {
    if (metric === 'revenue') return formatCurrency(v)
    if (metric === 'transactions') return String(Math.round(v))
    return formatCurrency(v)
  }

  if (transactions.length === 0) {
    return <EmptyState title="No data" subtitle="Import transaction data to analyze staff performance." />
  }
  if (namedTxCount === 0) {
    return <EmptyState title="No staff data" subtitle="No staff names found in the imported transactions." />
  }

  const sorted = [...profiles].sort((a, b) => metricValue(b) - metricValue(a))
  const chartData = [...sorted].reverse()
  const topStaff = profiles[0]
  const avgRevenue = profiles.length ? profiles.reduce((s, p) => s + p.totalRevenue, 0) / profiles.length : 0
  const coveragePct = Math.round((namedTxCount / Math.max(1, transactions.length)) * 100)

  const heatmapMax = Math.max(1, ...profiles.flatMap(p => Object.values(p.dailyRevenue)))

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-700 text-stone-100 tracking-tight">Staff Shift Analysis</h1>

      <div className="grid grid-cols-4 gap-4 cf-stagger">
        <StatCard label="Top Earner" value={topStaff?.name ?? '—'} />
        <StatCard label="Total Staff" value={String(profiles.length)} countTo={profiles.length} format={(n) => Math.round(n).toLocaleString()} />
        <StatCard label="Avg Revenue/Staff" value={formatCurrency(avgRevenue)} countTo={avgRevenue} format={(n) => formatCurrency(n)} />
        <StatCard label="Coverage" value={`${coveragePct}%`} countTo={coveragePct} format={(n) => `${Math.round(n)}%`} />
      </div>

      <div className="bg-stone-800/30 border border-stone-700/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-stone-100">Staff Leaderboard</h2>
          <div className="flex gap-1">
            {([['revenue', 'Total Revenue'], ['transactions', 'Transactions'], ['avgValue', 'Avg Value']] as [StaffMetric, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMetric(key)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${metric === key ? 'bg-amber-500/15 text-amber-400 font-semibold' : 'text-stone-400 hover:bg-stone-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={Math.max(150, profiles.length * 32)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 80, left: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chart.grid} />
            <XAxis type="number" tick={{ fontSize: 11, fill: chart.axis }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: chart.axis }} width={90} />
            <Tooltip formatter={(v: number) => metricLabel(v)} contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: chart.tooltipText }} itemStyle={{ color: chart.tooltipText }} />
            <Bar dataKey={d => metricValue(d)} radius={[0, 3, 3, 0]}
              label={{ position: 'right', formatter: (v: number) => metricLabel(v), fontSize: 10, fill: chart.axis }}>
              {chartData.map((p, i) => (
                <Cell key={i} fill={p.name === selectedStaff ? chart.bar : '#F59E0B60'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-700 text-left">
                {['Staff Member', 'Transactions', 'Total Revenue', 'Avg Transaction', 'Days Worked', 'Top Product'].map(h => (
                  <th key={h} className="pb-2 font-semibold text-stone-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr
                  key={p.name}
                  className="border-b border-stone-800 hover:bg-stone-700/50 cursor-pointer"
                  onClick={() => setSelectedStaff(selectedStaff === p.name ? '' : p.name)}
                >
                  <td className="py-2 flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: p.name === selectedStaff ? chart.bar : '#78716c' }}
                    />
                    <span className="font-medium text-stone-100">{p.name}</span>
                  </td>
                  <td className="py-2 font-mono text-stone-100">{p.totalTransactions}</td>
                  <td className="py-2 font-mono text-stone-100">{formatCurrency(p.totalRevenue)}</td>
                  <td className="py-2 font-mono text-stone-100">{formatCurrency(p.avgTransactionValue)}</td>
                  <td className="py-2 font-mono text-stone-100">{p.activeDays}</td>
                  <td className="py-2 text-stone-200 truncate max-w-32">{p.topProducts[0]?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-stone-800/30 border border-stone-700/40 p-5">
        <h2 className="text-base font-semibold text-stone-100 mb-1">Staff × Day of Week Revenue Heatmap</h2>
        <p className="text-xs text-stone-400 mb-4">Color intensity = revenue generated in that slot</p>
        <div className="overflow-x-auto">
          <div className="inline-block">
            <div className="flex gap-1 mb-1 ml-28">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-xs text-stone-400 font-medium text-center" style={{ width: 44 }}>{d}</div>
              ))}
            </div>
            {sorted.slice(0, 10).map(p => (
              <div key={p.name} className="flex gap-1 mb-1 items-center">
                <div className="text-xs text-stone-400 w-28 text-right pr-2 truncate">{p.name}</div>
                {Array.from({ length: 7 }, (_, i) => i + 1).map(dow => {
                  const rev = p.dailyRevenue[dow] ?? 0
                  const intensity = rev / heatmapMax
                  return (
                    <div
                      key={dow}
                      title={`${p.name} ${DAY_NAMES[dow - 1]}: ${formatCurrency(rev)}`}
                      className="rounded flex items-center justify-center"
                      style={{
                        width: 44,
                        height: 24,
                        backgroundColor: rev > 0
                          ? `rgba(245,158,11,${0.1 + intensity * 0.85})`
                          : 'rgb(41 37 36)',
                      }}
                    >
                      {rev > 0 && intensity > 0.4 && (
                        <span className="text-white text-xs leading-none">${Math.round(rev)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedProfile && (
        <div className="bg-stone-800/30 border border-stone-700/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-stone-100">{selectedProfile.name} — Detail View</h2>
            <button onClick={() => setSelectedStaff('')} className="text-stone-400 hover:text-stone-100 text-lg">×</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-stone-900 p-4">
              <h3 className="text-sm font-medium text-stone-100 mb-3">Revenue by Hour of Day</h3>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={selectedProfile.revenueByHour} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: chart.axis }}
                    tickFormatter={h => h > 0 && h % 2 === 0 ? `${h > 12 ? h - 12 : h}${h < 12 ? 'a' : 'p'}` : ''}
                  />
                  <YAxis tick={{ fontSize: 10, fill: chart.axis }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: chart.tooltipText }} itemStyle={{ color: chart.tooltipText }} />
                  <Bar dataKey="revenue" fill={chart.bar} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-stone-900 p-4">
              <h3 className="text-sm font-medium text-stone-100 mb-3">Top 5 Products Sold</h3>
              <div className="space-y-2">
                {selectedProfile.topProducts.slice(0, 5).map(item => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span className="text-xs text-stone-100 truncate flex-1 mr-2">{item.name}</span>
                    <span className="text-xs font-semibold font-mono text-stone-100">{item.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
