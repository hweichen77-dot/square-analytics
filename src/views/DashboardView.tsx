import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, getDaysInMonth, getDay } from 'date-fns'
import { useFilteredTransactions, useProductCostData, useAllTransactions, useRefunds } from '../db/useTransactions'
import { useDateRangeStore } from '../store/dateRangeStore'
import { useGoalStore } from '../store/goalStore'
import {
  computeProductStats,
  computeDailyRevenue,
  computeWeeklyRevenue,
  computeMonthlyRevenue,
  isSlowMover,
} from '../engine/analyticsEngine'
import { computeGrossProfit } from '../engine/reportEngine'
import { useAnalytics } from '../context/AnalyticsContext'
import { StatCard } from '../components/ui/StatCard'
import { RevenueChart } from '../components/charts/RevenueChart'
import { CategoryBreakdownChart } from '../components/charts/CategoryBreakdownChart'
import { TopProductsChart } from '../components/charts/TopProductsChart'
import { formatCurrency, formatNumber } from '../utils/format'
import type { DateRange } from '../db/useTransactions'

function previousPeriod(range: DateRange): DateRange {
  const { start, end } = range
  if (!start || !end) return { start: null, end: null }
  const durationMs = end.getTime() - start.getTime()
  return {
    start: new Date(start.getTime() - durationMs - 86_400_000),
    end: new Date(start.getTime() - 86_400_000),
  }
}

function pctChange(current: number, previous: number): { label: string; up: boolean } | null {
  if (previous <= 0) return null
  const pct = ((current - previous) / previous) * 100
  const abs = Math.abs(pct)
  const label = `${abs.toFixed(1)}% vs prev period`
  return { label, up: pct >= 0 }
}

export default function DashboardView() {
  const { range } = useDateRangeStore()
  const { transactions, overrides, productStats: stats, daily, weekly, monthly, categories, staffStats, totalRevenue, totalTransactions } = useAnalytics()
  const { weeklyGoal, monthlyGoal, setWeeklyGoal, setMonthlyGoal } = useGoalStore()
  const [editingGoal, setEditingGoal] = useState<'weekly' | 'monthly' | null>(null)
  const [goalInput, setGoalInput] = useState('')
  const prevRange = useMemo(() => previousPeriod(range), [range])
  const prevTransactions = useFilteredTransactions(prevRange)
  const navigate = useNavigate()

  const prevDaily = useMemo(() => computeDailyRevenue(prevTransactions), [prevTransactions])
  const prevWeekly = useMemo(() => computeWeeklyRevenue(prevTransactions), [prevTransactions])
  const prevMonthly = useMemo(() => computeMonthlyRevenue(prevTransactions), [prevTransactions])

  const insights = useMemo(() => {
    if (!daily.length) return null
    const bestDay = daily.reduce((a, b) => b.revenue > a.revenue ? b : a, daily[0])
    const topProduct = stats[0] ?? null
    const slowProduct = stats.find(s => isSlowMover(s)) ?? null
    const topStaff = staffStats[0] ?? null
    return { bestDay, topProduct, slowProduct, topStaff }
  }, [daily, stats, staffStats])

  const allTransactions = useAllTransactions()
  const costData = useProductCostData() ?? []
  const refunds = useRefunds()

  const totalRefunds = useMemo(() => {
    const inRange = refunds.filter(r => {
      const ms = r.createdAt.getTime()
      if (range.start && ms < range.start.getTime()) return false
      if (range.end && ms > range.end.getTime()) return false
      return true
    })
    return inRange.reduce((s, r) => s + r.amount, 0) / 100
  }, [refunds, range])
  const hasRefunds = totalRefunds > 0
  const netRevenue = totalRevenue - totalRefunds

  const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
  const uniqueProducts = stats.length

  const { grossProfit, marginPct } = useMemo(
    () => computeGrossProfit(stats, costData, totalRevenue),
    [stats, costData, totalRevenue],
  )

  const goalProgress = useMemo(() => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    const weekRevenue = allTransactions
      .filter(t => t.date >= weekStart && t.date <= weekEnd)
      .reduce((s, t) => s + t.netSales, 0)
    const monthRevenue = allTransactions
      .filter(t => t.date >= monthStart && t.date <= monthEnd)
      .reduce((s, t) => s + t.netSales, 0)

    const dayOfWeek = ((getDay(now) + 6) % 7) + 1
    const dayOfMonth = now.getDate()
    const daysInMonth = getDaysInMonth(now)

    const weekPace = weeklyGoal != null ? (weekRevenue / dayOfWeek) * 7 : null
    const monthPace = monthlyGoal != null ? (monthRevenue / dayOfMonth) * daysInMonth : null

    return { weekRevenue, monthRevenue, weekPace, monthPace }
  }, [allTransactions, weeklyGoal, monthlyGoal])

  const hasPrevPeriod = prevRange.start !== null
  const prevRevenue = hasPrevPeriod ? prevTransactions.reduce((s, t) => s + t.netSales, 0) : 0
  const prevTxCount = hasPrevPeriod ? prevTransactions.length : 0
  const prevAvg = prevTxCount > 0 ? prevRevenue / prevTxCount : 0
  const prevProducts = useMemo(
    () => hasPrevPeriod ? computeProductStats(prevTransactions, overrides).length : 0,
    [hasPrevPeriod, prevTransactions, overrides],
  )

  const revTrend      = hasPrevPeriod ? pctChange(totalRevenue, prevRevenue) : null
  const txTrend       = hasPrevPeriod ? pctChange(totalTransactions, prevTxCount) : null
  const avgTrend      = hasPrevPeriod ? pctChange(avgTransaction, prevAvg) : null
  const productsTrend = hasPrevPeriod ? pctChange(uniqueProducts, prevProducts) : null

  if (transactions.length === 0) {
    const paths = [
      {
        n: '01',
        title: 'Connect Square directly',
        desc: 'Paste your Square access token on the Sync page. Orders import on their own after every shift.',
        cta: 'Set up Square Sync',
        to: '/square-sync',
      },
      {
        n: '02',
        title: 'Or drop in a CSV',
        desc: 'Export a Sales Summary from Square (Reports → Sales Summary → Export) and drop the file on the Import page.',
        cta: 'Import a CSV file',
        to: '/import',
      },
    ]
    return (
      <div className="max-w-2xl pt-10">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-500/80">Walley&apos;s · Store Ledger</p>
        <h1 className="font-display text-4xl font-700 text-stone-100 tracking-tight mt-3 leading-[1.06]">
          No numbers yet.<br />Let&apos;s bring your sales in.
        </h1>
        <p className="text-stone-400 mt-4 text-[15px] leading-relaxed max-w-md">
          Walley&apos;s turns your Square sales into plain answers — what&apos;s selling, what to restock,
          where the money goes. Two ways to begin:
        </p>
        <div className="mt-10 space-y-8">
          {paths.map(({ n, title, desc, cta, to }) => (
            <div key={n} className="flex gap-5">
              <span className="font-display text-3xl text-amber-500/90 tabular-nums leading-none w-10 shrink-0">{n}</span>
              <div className="pt-0.5">
                <h2 className="text-stone-100 font-semibold">{title}</h2>
                <p className="text-stone-400 text-sm mt-1 leading-relaxed max-w-md">{desc}</p>
                <button
                  onClick={() => navigate(to)}
                  className="text-amber-400 hover:text-amber-300 text-sm font-medium mt-2.5 underline underline-offset-4 decoration-amber-500/30 hover:decoration-amber-400"
                >
                  {cta} →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-700 text-stone-100 tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          trend={revTrend?.label}
          trendUp={revTrend?.up}
          sub={hasRefunds ? `${formatCurrency(netRevenue)} net of refunds` : undefined}
        />
        <StatCard
          label="Transactions"
          value={formatNumber(totalTransactions)}
          trend={txTrend?.label}
          trendUp={txTrend?.up}
        />
        <StatCard
          label="Avg Transaction"
          value={formatCurrency(avgTransaction)}
          trend={avgTrend?.label}
          trendUp={avgTrend?.up}
        />
        <StatCard
          label="Products Sold"
          value={formatNumber(uniqueProducts)}
          trend={productsTrend?.label}
          trendUp={productsTrend?.up}
        />
        {grossProfit !== null && (
          <StatCard
            label="Gross Profit"
            value={formatCurrency(grossProfit)}
            sub={marginPct !== null ? `${marginPct.toFixed(1)}% margin` : undefined}
          />
        )}
        {grossProfit === null && (
          <div onClick={() => navigate('/profit')} className="cursor-pointer">
            <StatCard
              label="Gross Profit"
              value="—"
              sub="Click to add COGS →"
            />
          </div>
        )}
      </div>

      {(
        <div className="border border-stone-700/50 bg-stone-800/25 px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400">Revenue Goals</p>
            {editingGoal ? null : (
              <button
                onClick={() => { setEditingGoal('weekly'); setGoalInput(weeklyGoal?.toString() ?? '') }}
                className="text-[10px] text-stone-200 hover:text-stone-300 uppercase tracking-wide"
              >
                Edit
              </button>
            )}
          </div>
          {editingGoal ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs text-stone-200 mb-1">Weekly Target ($)</label>
                <input
                  type="number"
                  value={editingGoal === 'weekly' ? goalInput : (weeklyGoal?.toString() ?? '')}
                  onChange={e => { setEditingGoal('weekly'); setGoalInput(e.target.value) }}
                  onFocus={() => setEditingGoal('weekly')}
                  placeholder="e.g. 5000"
                  className="w-full bg-stone-900 border border-stone-600 px-3 py-1.5 text-sm text-stone-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-stone-200 mb-1">Monthly Target ($)</label>
                <input
                  type="number"
                  value={editingGoal === 'monthly' ? goalInput : (monthlyGoal?.toString() ?? '')}
                  onChange={e => { setEditingGoal('monthly'); setGoalInput(e.target.value) }}
                  onFocus={() => setEditingGoal('monthly')}
                  placeholder="e.g. 20000"
                  className="w-full bg-stone-900 border border-stone-600 px-3 py-1.5 text-sm text-stone-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => {
                    const v = parseFloat(goalInput)
                    if (editingGoal === 'weekly') setWeeklyGoal(isNaN(v) || v <= 0 ? null : v)
                    else setMonthlyGoal(isNaN(v) || v <= 0 ? null : v)
                    setEditingGoal(null)
                  }}
                  className="px-3 py-1.5 bg-amber-500 text-stone-900 text-xs font-semibold hover:bg-amber-400"
                >
                  Save
                </button>
                <button onClick={() => setEditingGoal(null)} className="px-3 py-1.5 text-xs text-stone-200 hover:text-stone-200">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['weekly', 'monthly'] as const).map(period => {
                const goal = period === 'weekly' ? weeklyGoal : monthlyGoal
                const revenue = period === 'weekly' ? goalProgress.weekRevenue : goalProgress.monthRevenue
                const pace = period === 'weekly' ? goalProgress.weekPace : goalProgress.monthPace
                const pct = goal ? Math.min(100, (revenue / goal) * 100) : 0
                const hit = goal != null && revenue >= goal
                const barColor = hit ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-400' : 'bg-amber-500'
                return (
                  <div key={period}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-stone-200 capitalize">{period}</span>
                      {goal != null ? (
                        <span className={`text-xs font-mono font-semibold ${hit ? 'text-emerald-400' : 'text-stone-100'}`}>
                          {formatCurrency(revenue)} / {formatCurrency(goal)}
                          {hit && ' ✓'}
                        </span>
                      ) : (
                        <button
                          onClick={() => { setEditingGoal(period); setGoalInput('') }}
                          className="text-xs text-stone-200 hover:text-amber-400"
                        >
                          + Set goal
                        </button>
                      )}
                    </div>
                    {goal != null && (
                      <>
                        <div
                          role="progressbar"
                          aria-valuenow={Math.round(pct)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${period === 'weekly' ? 'Weekly' : 'Monthly'} goal: ${Math.round(pct)}% complete`}
                          className="h-1.5 bg-stone-700/60 rounded-full overflow-hidden"
                        >
                          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        {pace != null && !hit && (
                          <p className="text-[10px] text-stone-200 mt-1">
                            On pace for {formatCurrency(pace)} this {period === 'weekly' ? 'week' : 'month'}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <RevenueChart
        daily={daily} weekly={weekly} monthly={monthly}
        prevDaily={prevDaily} prevWeekly={prevWeekly} prevMonthly={prevMonthly}
      />

      {insights && (
        <div className="border border-stone-700/50 bg-stone-800/25 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400 mb-3">Quick Insights</p>
          <ul className="space-y-1.5 text-sm">
            <li className="text-stone-100">
              Best day:{' '}
              <span className="text-stone-200">
                {format(insights.bestDay.date, 'EEE, MMM d')} — {formatCurrency(insights.bestDay.revenue)}
              </span>
            </li>
            {insights.topProduct && (
              <li className="text-stone-100">
                Top seller:{' '}
                <span className="text-stone-200">
                  {insights.topProduct.name} ({formatNumber(insights.topProduct.totalUnitsSold)} units,{' '}
                  {formatCurrency(insights.topProduct.totalRevenue)})
                </span>
              </li>
            )}
            {insights.slowProduct && (
              <li className="text-stone-100">
                Slow mover:{' '}
                <span className="text-amber-400">{insights.slowProduct.name}</span>
                {' '}— no sales in {Math.floor((Date.now() - insights.slowProduct.lastSoldDate.getTime()) / 86_400_000)} days
              </li>
            )}
            {insights.topStaff && insights.topStaff.name !== 'Unknown' && (
              <li className="text-stone-100">
                Top staff:{' '}
                <span className="text-stone-200">
                  {insights.topStaff.name} — {formatCurrency(insights.topStaff.totalSales)} across{' '}
                  {formatNumber(insights.topStaff.transactionCount)} transactions
                </span>
              </li>
            )}
            {hasRefunds && (
              <li className="text-stone-100">
                Refunds:{' '}
                <span className="text-amber-400">- {formatCurrency(totalRefunds)}</span>
                {' '}— net revenue {formatCurrency(netRevenue)}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdownChart data={categories} />
        <TopProductsChart products={stats} />
      </div>
    </div>
  )
}
