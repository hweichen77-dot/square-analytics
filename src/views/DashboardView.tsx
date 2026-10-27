import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { startOfWeek, startOfMonth, endOfWeek, endOfMonth, getDaysInMonth, getDay, differenceInCalendarDays } from 'date-fns'
import { useFilteredTransactions, useProductCostData, useAllTransactions, useRefunds } from '../db/useTransactions'
import { useDateRangeStore } from '../store/dateRangeStore'
import { useGoalStore } from '../store/goalStore'
import { isRealProduct } from '../engine/analyticsEngine'
import { computeGrossProfit } from '../engine/reportEngine'
import { useAnalytics } from '../context/AnalyticsContext'
import { useRestockQueue } from '../hooks/useRestockAlertCount'
import { StatCard } from '../components/ui/StatCard'
import { RevenueChart } from '../components/charts/RevenueChart'
import { formatCurrency, formatNumber } from '../utils/format'
import type { DateRange } from '../db/useTransactions'

const BIG_DAY_MULTIPLE = 3

function previousPeriod(range: DateRange): DateRange {
  const { start, end } = range
  if (!start || !end) return { start: null, end: null }
  const durationMs = end.getTime() - start.getTime()
  return {
    start: new Date(start.getTime() - durationMs - 86_400_000),
    end: new Date(start.getTime() - 86_400_000),
  }
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function periodWords(range: DateRange): string {
  if (!range.start || !range.end) return ''
  const days = differenceInCalendarDays(range.end, range.start) + 1
  return `vs the previous ${days} days`
}

function change(current: number, previous: number, window: string) {
  if (previous <= 0) return null
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.05) return null
  return { label: `${Math.abs(pct).toFixed(1)}% ${window}`, up: pct > 0 }
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[var(--border)] rounded-lg">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h2 className="text-base font-semibold text-stone-100">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function RankedList({ rows, empty }: { rows: { name: string; value: number; sub: string }[]; empty: string }) {
  if (!rows.length) return <p className="px-5 pb-5 text-sm text-stone-500">{empty}</p>
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <ol className="px-5 pb-3">
      {rows.map((r, i) => (
        <li key={r.name} className="py-2.5 border-t border-[var(--rule)] first:border-t-0">
          <div className="flex items-baseline gap-3">
            <span className="flex-1 min-w-0 truncate text-sm text-stone-100" title={r.name}>{r.name}</span>
            <span className="text-xs text-stone-500 tabular-nums shrink-0">{r.sub}</span>
            <span className="w-24 text-right text-sm font-medium text-stone-100 tabular-nums shrink-0">{formatCurrency(r.value)}</span>
          </div>
          <div className="mt-1.5 h-[2px] rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: i === 0 ? '#121110' : '#cfccc8' }} />
        </li>
      ))}
    </ol>
  )
}

function GoalRow({ label, revenue, goal, pace, onSet }: { label: string; revenue: number; goal: number | null; pace: number | null; onSet: () => void }) {
  if (goal == null) {
    return (
      <div className="flex items-center justify-between py-3 border-t border-[var(--rule)] first:border-t-0">
        <span className="text-sm text-stone-100">{label}</span>
        <button onClick={onSet} className="text-sm font-medium text-stone-100 underline underline-offset-4 decoration-[var(--control)] hover:decoration-stone-100">Set a goal</button>
      </div>
    )
  }
  const pct = Math.min(100, (revenue / goal) * 100)
  const hit = revenue >= goal
  return (
    <div className="py-3 border-t border-[var(--rule)] first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-stone-100">{label}</span>
        <span className="text-sm tabular-nums text-stone-100">
          {formatCurrency(revenue)} <span className="text-stone-500">of {formatCurrency(goal)}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} goal ${Math.round(pct)}% reached`}
        className="mt-2 h-2 rounded-full bg-[var(--active)] overflow-hidden"
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: hit ? 'var(--positive)' : 'var(--data)' }} />
      </div>
      <p className="mt-1.5 text-xs text-stone-500">
        {hit ? 'Goal reached' : pace != null ? `On pace for ${formatCurrency(pace)}` : ''}
      </p>
    </div>
  )
}

export default function DashboardView() {
  const { range } = useDateRangeStore()
  const { productStats: stats, daily, weekly, monthly, categories, totalRevenue, totalTransactions } = useAnalytics()
  const { weeklyGoal, monthlyGoal, setWeeklyGoal, setMonthlyGoal } = useGoalStore()
  const [editingGoal, setEditingGoal] = useState<'weekly' | 'monthly' | null>(null)
  const [goalInput, setGoalInput] = useState('')
  const [productMode, setProductMode] = useState<'revenue' | 'units'>('revenue')
  const prevRange = useMemo(() => previousPeriod(range), [range])
  const prevTransactions = useFilteredTransactions(prevRange)
  const navigate = useNavigate()
  const restockQueue = useRestockQueue()
  const storedCount = useLiveQuery(() => db.salesTransactions.count(), [])

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

  const avgOrder = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

  const { grossProfit, marginPct } = useMemo(
    () => computeGrossProfit(stats, costData, totalRevenue),
    [stats, costData, totalRevenue],
  )

  const days = useMemo(() => {
    const usual = median(daily.filter(d => d.revenue > 0).map(d => d.revenue))
    const threshold = usual * BIG_DAY_MULTIPLE
    const big = usual > 0 ? daily.filter(d => d.revenue >= threshold) : []
    const bigSales = big.reduce((s, d) => s + d.revenue, 0)
    const best = daily.reduce<typeof daily[number] | null>((a, d) => (!a || d.revenue > a.revenue ? d : a), null)
    return { usual, threshold, bigCount: big.length, bigShare: totalRevenue > 0 ? bigSales / totalRevenue : 0, best }
  }, [daily, totalRevenue])

  const goalProgress = useMemo(() => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const weekRevenue = allTransactions.filter(t => t.date >= weekStart && t.date <= weekEnd).reduce((s, t) => s + t.netSales, 0)
    const monthRevenue = allTransactions.filter(t => t.date >= monthStart && t.date <= monthEnd).reduce((s, t) => s + t.netSales, 0)
    const dayOfWeek = ((getDay(now) + 6) % 7) + 1
    const weekPace = weeklyGoal != null ? (weekRevenue / dayOfWeek) * 7 : null
    const monthPace = monthlyGoal != null ? (monthRevenue / now.getDate()) * getDaysInMonth(now) : null
    return { weekRevenue, monthRevenue, weekPace, monthPace }
  }, [allTransactions, weeklyGoal, monthlyGoal])

  const hasPrev = prevRange.start !== null
  const window = periodWords(range)
  const prevRevenue = hasPrev ? prevTransactions.reduce((s, t) => s + t.netSales, 0) : 0
  const prevOrders = hasPrev ? prevTransactions.length : 0
  const revTrend = hasPrev ? change(totalRevenue, prevRevenue, window) : null
  const orderTrend = hasPrev ? change(totalTransactions, prevOrders, window) : null
  const avgTrend = hasPrev && prevOrders > 0 ? change(avgOrder, prevRevenue / prevOrders, window) : null

  const topProducts = useMemo(() => {
    const real = stats.filter(s => isRealProduct(s.name))
    const sorted = productMode === 'revenue'
      ? [...real].sort((a, b) => b.totalRevenue - a.totalRevenue)
      : [...real].sort((a, b) => b.totalUnitsSold - a.totalUnitsSold)
    return sorted.slice(0, 5).map(p => ({
      name: p.name,
      value: productMode === 'revenue' ? p.totalRevenue : p.totalUnitsSold,
      sub: productMode === 'revenue' ? `${formatNumber(p.totalUnitsSold)} sold` : formatCurrency(p.totalRevenue),
    }))
  }, [stats, productMode])

  const categoryRows = categories.slice(0, 5).map(c => ({ name: c.category, value: c.revenue, sub: `${c.percentage.toFixed(1)}%` }))

  if (storedCount === undefined) {
    return (
      <div role="status" aria-label="Loading sales">
        <h1 className="text-2xl font-semibold text-stone-100">Overview</h1>
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-[var(--active)]" />
      </div>
    )
  }

  if (storedCount === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold text-stone-100">Overview</h1>
        <p className="mt-1.5 text-sm text-stone-400">No sales yet. Bring in Square sales to see takings, top sellers and what to restock.</p>
        <div className="mt-6 rounded-lg border border-dashed border-[var(--control)] bg-white divide-y divide-[var(--rule)]">
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-stone-100">Connect Square</h2>
              <p className="text-sm text-stone-400 mt-0.5">Orders import on their own after every shift.</p>
            </div>
            <button onClick={() => navigate('/square-sync')} className="h-9 px-4 rounded-md bg-stone-100 text-white text-sm font-medium hover:bg-stone-300 shrink-0">Set up sync</button>
          </div>
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-stone-100">Import a file</h2>
              <p className="text-sm text-stone-400 mt-0.5">A Sales Summary export from Square works.</p>
            </div>
            <button onClick={() => navigate('/import')} className="h-9 px-4 rounded-md border border-[var(--control)] bg-white text-stone-100 text-sm font-medium hover:bg-[var(--raised)] shrink-0">Import</button>
          </div>
        </div>
      </div>
    )
  }

  const finding = days.bigCount > 0
    ? `${days.bigCount} big ${days.bigCount === 1 ? 'day' : 'days'} brought in ${(days.bigShare * 100).toFixed(0)}% of sales. A usual school day takes ${formatCurrency(days.usual)}.`
    : days.usual > 0 ? `A usual school day in this period takes ${formatCurrency(days.usual)}.` : 'No sales in this period.'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-stone-100">Overview</h1>
          <p className="mt-1 text-sm text-stone-400">{finding}</p>
        </div>
        {restockQueue.length > 0 && (
          <button onClick={() => navigate('/restock')} className="h-9 px-4 rounded-md bg-stone-100 text-white text-sm font-medium hover:bg-stone-300 transition-colors">
            Restock {restockQueue.length} {restockQueue.length === 1 ? 'item' : 'items'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div className="kpi-strip grid grid-cols-2 md:grid-cols-4">
            <StatCard
              label="Sales"
              value={formatCurrency(totalRevenue)}
              trend={revTrend?.label}
              trendUp={revTrend?.up}
              sub={totalRefunds > 0 ? `${formatCurrency(totalRevenue - totalRefunds)} after ${formatCurrency(totalRefunds)} refunds` : undefined}
            />
            <StatCard label="Orders" value={formatNumber(totalTransactions)} trend={orderTrend?.label} trendUp={orderTrend?.up} />
            <StatCard label="Average order" value={formatCurrency(avgOrder)} trend={avgTrend?.label} trendUp={avgTrend?.up} />
            {grossProfit !== null ? (
              <StatCard label="Gross profit" value={formatCurrency(grossProfit)} sub={marginPct !== null ? `${marginPct.toFixed(1)}% margin` : undefined} />
            ) : (
              <div className="px-5 py-4 bg-white">
                <p className="text-[13px] text-stone-500">Gross profit</p>
                <p className="mt-1.5 text-[24px] leading-8 text-stone-500">–</p>
                <Link to="/profit" className="text-xs font-medium text-stone-100 underline underline-offset-4 decoration-[var(--control)]">Add item costs</Link>
              </div>
            )}
          </div>

          <RevenueChart daily={daily} weekly={weekly} monthly={monthly} usualDay={days.usual} bigDayThreshold={days.threshold} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Panel
              title="Top sellers"
              action={
                <div className="flex h-8 p-0.5 rounded-md bg-[var(--active)]" role="tablist" aria-label="Rank top sellers by">
                  {(['revenue', 'units'] as const).map(m => (
                    <button
                      key={m}
                      role="tab"
                      aria-selected={productMode === m}
                      onClick={() => setProductMode(m)}
                      className={`px-3 rounded text-[13px] transition-colors ${productMode === m ? 'bg-white text-stone-100 font-medium shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-stone-400 hover:text-stone-100'}`}
                    >
                      {m === 'revenue' ? 'Sales' : 'Units'}
                    </button>
                  ))}
                </div>
              }
            >
              {productMode === 'revenue' ? (
                <RankedList rows={topProducts} empty="Nothing sold in this period." />
              ) : (
                <ol className="px-5 pb-3">
                  {topProducts.map((r, i) => (
                    <li key={r.name} className="py-2.5 border-t border-[var(--rule)] first:border-t-0">
                      <div className="flex items-baseline gap-3">
                        <span className="flex-1 min-w-0 truncate text-sm text-stone-100" title={r.name}>{r.name}</span>
                        <span className="text-xs text-stone-500 tabular-nums shrink-0">{r.sub}</span>
                        <span className="w-24 text-right text-sm font-medium text-stone-100 tabular-nums shrink-0">{formatNumber(r.value)}</span>
                      </div>
                      <div className="mt-1.5 h-[2px] rounded-full" style={{ width: `${(r.value / Math.max(topProducts[0]?.value ?? 1, 1)) * 100}%`, background: i === 0 ? '#121110' : '#cfccc8' }} />
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Sales by category" action={<Link to="/profit" className="text-[13px] text-stone-400 hover:text-stone-100">Margins</Link>}>
              <RankedList rows={categoryRows} empty="No categories in this period." />
            </Panel>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <Panel
            title="Restock next"
            action={restockQueue.length > 0 ? <span className="text-[13px] text-stone-500 tabular-nums">{restockQueue.length} items</span> : undefined}
          >
            {restockQueue.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-stone-400">Nothing is running low. Stock counts come from Square and your restock log.</p>
            ) : (
              <>
                <ul className="px-5">
                  {restockQueue.slice(0, 8).map(item => (
                    <li key={item.name} className="flex items-center gap-3 h-11 border-t border-[var(--rule)] first:border-t-0">
                      <Link to={`/inventory/${encodeURIComponent(item.name)}`} className="flex-1 min-w-0 truncate text-sm text-stone-100 hover:underline underline-offset-4" title={item.name}>{item.name}</Link>
                      <span className={`text-[13px] tabular-nums shrink-0 ${item.stockRemaining <= 0 ? 'text-red-500 font-medium' : 'text-stone-400'}`}>
                        {item.stockRemaining <= 0 ? 'Sold out' : `${formatNumber(Math.round(item.stockRemaining))} left${item.daysUntilStockout != null ? ` · ${Math.max(1, Math.round(item.daysUntilStockout))}d` : ''}`}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="px-5 pt-1 pb-4">
                  <Link to="/restock" className="flex items-center justify-center h-8 rounded-md border border-[var(--control)] text-[13px] font-medium text-stone-100 hover:bg-[var(--raised)]">
                    View all {restockQueue.length}
                  </Link>
                </div>
              </>
            )}
          </Panel>

          <Panel
            title="Goals"
            action={!editingGoal && (weeklyGoal != null || monthlyGoal != null) ? (
              <button onClick={() => { setEditingGoal('weekly'); setGoalInput(weeklyGoal?.toString() ?? '') }} className="text-[13px] text-stone-400 hover:text-stone-100">Edit</button>
            ) : undefined}
          >
            <div className="px-5 pb-4">
              {editingGoal ? (
                <form
                  className="space-y-3 pt-1"
                  onSubmit={e => {
                    e.preventDefault()
                    const v = parseFloat(goalInput)
                    if (editingGoal === 'weekly') setWeeklyGoal(isNaN(v) || v <= 0 ? null : v)
                    else setMonthlyGoal(isNaN(v) || v <= 0 ? null : v)
                    setEditingGoal(null)
                  }}
                >
                  <div className="flex h-8 p-0.5 rounded-md bg-[var(--active)] w-fit" role="tablist" aria-label="Goal period">
                    {(['weekly', 'monthly'] as const).map(p => (
                      <button
                        type="button"
                        key={p}
                        role="tab"
                        aria-selected={editingGoal === p}
                        onClick={() => { setEditingGoal(p); setGoalInput((p === 'weekly' ? weeklyGoal : monthlyGoal)?.toString() ?? '') }}
                        className={`px-3 rounded text-[13px] ${editingGoal === p ? 'bg-white text-stone-100 font-medium' : 'text-stone-400'}`}
                      >
                        {p === 'weekly' ? 'This week' : 'This month'}
                      </button>
                    ))}
                  </div>
                  <label className="block">
                    <span className="block text-sm font-medium text-stone-100 mb-1.5">Sales target in dollars</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      autoFocus
                      value={goalInput}
                      onChange={e => setGoalInput(e.target.value)}
                      placeholder={editingGoal === 'weekly' ? '1500' : '6000'}
                      className="w-full h-9 px-3 rounded-md border border-[var(--control)] bg-white text-sm text-stone-100 tabular-nums focus:outline-none focus:border-stone-100"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" className="h-8 px-3 rounded-md bg-stone-100 text-white text-[13px] font-medium hover:bg-stone-300">Save</button>
                    <button type="button" onClick={() => setEditingGoal(null)} className="h-8 px-3 rounded-md text-[13px] text-stone-400 hover:text-stone-100">Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <GoalRow label="This week" revenue={goalProgress.weekRevenue} goal={weeklyGoal} pace={goalProgress.weekPace} onSet={() => { setEditingGoal('weekly'); setGoalInput('') }} />
                  <GoalRow label="This month" revenue={goalProgress.monthRevenue} goal={monthlyGoal} pace={goalProgress.monthPace} onSet={() => { setEditingGoal('monthly'); setGoalInput('') }} />
                </>
              )}
            </div>
          </Panel>

          {days.best && (
            <Panel title="Best day">
              <div className="px-5 pb-4">
                <p className="text-sm text-stone-100">{days.best.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <p className="mt-0.5 text-sm text-stone-400 tabular-nums">
                  {formatCurrency(days.best.revenue)} from {formatNumber(days.best.transactionCount)} orders
                  {days.usual > 0 && `, ${(days.best.revenue / days.usual).toFixed(0)}× a usual day`}
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
