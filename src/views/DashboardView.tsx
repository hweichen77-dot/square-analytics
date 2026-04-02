import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilteredTransactions, useOverridesMap } from '../db/useTransactions'
import { useDateRangeStore } from '../store/dateRangeStore'
import {
  computeProductStats,
  computeDailyRevenue,
  computeWeeklyRevenue,
  computeMonthlyRevenue,
  computeCategoryRevenue,
} from '../engine/analyticsEngine'
import { StatCard } from '../components/ui/StatCard'
import { EmptyState } from '../components/ui/EmptyState'
import { RevenueChart } from '../components/charts/RevenueChart'
import { CategoryBreakdownChart } from '../components/charts/CategoryBreakdownChart'
import { TopProductsChart } from '../components/charts/TopProductsChart'
import { formatCurrency, formatNumber } from '../utils/format'

export default function DashboardView() {
  const { range } = useDateRangeStore()
  const transactions = useFilteredTransactions(range)
  const overrides = useOverridesMap()
  const navigate = useNavigate()

  const stats = useMemo(() => computeProductStats(transactions, overrides), [transactions, overrides])
  const daily = useMemo(() => computeDailyRevenue(transactions), [transactions])
  const weekly = useMemo(() => computeWeeklyRevenue(transactions), [transactions])
  const monthly = useMemo(() => computeMonthlyRevenue(transactions), [transactions])
  const categories = useMemo(() => computeCategoryRevenue(transactions, overrides), [transactions, overrides])

  const totalRevenue = transactions.reduce((s, t) => s + t.netSales, 0)
  const totalTransactions = transactions.length
  const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
  const uniqueProducts = stats.length

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No data yet"
        subtitle="Import a Square CSV export or sync directly via Square to see your analytics."
        action={{ label: 'Go to Import', onClick: () => navigate('/import') }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} />
        <StatCard label="Transactions" value={formatNumber(totalTransactions)} />
        <StatCard label="Avg Transaction" value={formatCurrency(avgTransaction)} />
        <StatCard label="Products Sold" value={formatNumber(uniqueProducts)} />
      </div>

      <RevenueChart daily={daily} weekly={weekly} monthly={monthly} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdownChart data={categories} />
        <TopProductsChart products={stats} />
      </div>
    </div>
  )
}
