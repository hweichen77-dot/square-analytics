import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilteredTransactions, useOverridesMap, useCategoryOverrides } from '../db/useTransactions'
import { useDateRangeStore } from '../store/dateRangeStore'
import { db } from '../db/database'
import { computeProductStats, productTrend, isSlowMover } from '../engine/analyticsEngine'
import { ALL_CATEGORY_NAMES } from '../engine/categoryClassifier'
import { EmptyState } from '../components/ui/EmptyState'
import { CategoryBadge } from '../components/ui/Badge'
import { formatCurrency, formatNumber } from '../utils/format'
import { useToastStore } from '../store/toastStore'

export default function InventoryView() {
  const { range } = useDateRangeStore()
  const transactions = useFilteredTransactions(range)
  const overridesMap = useOverridesMap()
  const overrides = useCategoryOverrides()
  const navigate = useNavigate()
  const { show } = useToastStore()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; name: string } | null>(null)

  const stats = useMemo(() => computeProductStats(transactions, overridesMap), [transactions, overridesMap])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return stats.filter(p => {
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [stats, search, categoryFilter])

  async function setOverride(productName: string, category: string) {
    const existing = overrides.find(o => o.productName === productName)
    if (existing) await db.categoryOverrides.update(existing.id!, { category })
    else await db.categoryOverrides.add({ productName, category })
    show(`Set "${productName}" → ${category}`, 'success')
    setCtxMenu(null)
  }

  if (transactions.length === 0) {
    return <EmptyState title="No transaction data" subtitle="Import sales data to see your inventory analytics." />
  }

  return (
    <div className="space-y-4" onClick={() => setCtxMenu(null)}>
      <h1 className="text-2xl font-bold text-gray-900">Transaction Intelligence</h1>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search product…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="All">All categories</option>
          {ALL_CATEGORY_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-sm text-gray-400 self-center">{filtered.length} products</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Units</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Avg Price</th>
                <th className="px-4 py-3 text-center">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => {
                const trend = productTrend(p)
                const slow = isSlowMover(p)
                return (
                  <tr
                    key={p.name}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/inventory/${encodeURIComponent(p.name)}`)}
                    onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, name: p.name }) }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.name}
                      {slow && <span className="ml-2 text-xs text-orange-500">slow</span>}
                    </td>
                    <td className="px-4 py-3"><CategoryBadge category={p.category} /></td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatNumber(p.totalUnitsSold)}</td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium">{formatCurrency(p.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(p.avgPrice)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={trend === 'Growing' ? 'text-green-600' : trend === 'Declining' ? 'text-red-500' : 'text-gray-400'}>
                        {trend === 'Growing' ? '↑' : trend === 'Declining' ? '↓' : '→'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context menu for category override */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-44"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={e => e.stopPropagation()}
          >
            <p className="px-3 py-1 text-xs text-gray-500 font-medium uppercase">Set category</p>
            {ALL_CATEGORY_NAMES.map(cat => (
              <button
                key={cat}
                onClick={() => setOverride(ctxMenu.name, cat)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                {cat}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
