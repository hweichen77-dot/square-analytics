import { useMemo, useState } from 'react'
import { useRestockLogs, useCatalogueProducts, useAllTransactions } from '../db/useTransactions'
import { useDeferredCompute } from '../hooks/useDeferredCompute'
import { computeProductStats } from '../engine/analyticsEngine'
import { EmptyState } from '../components/ui/EmptyState'
import { StatCard } from '../components/ui/StatCard'
import { db } from '../db/database'
import type { SalesTransaction, RestockLog, CatalogueProduct } from '../types/models'
import { startOfDay } from 'date-fns'
import { format } from 'date-fns'

type UrgencyTier = 'outOfStock' | 'critical' | 'low' | 'safe' | 'noData'

interface RestockAlert {
  productName: string
  category: string
  weeklyVelocity: number
  stockRemaining: number | null
  daysUntilStockout: number | null
  projectedStockoutDate: Date | null
  lastRestockedDate: Date | null
  lastRestockedQuantity: number | null
  urgency: UrgencyTier
  recommendedRestockQty: number
}

const URGENCY_ORDER: Record<UrgencyTier, number> = {
  outOfStock: 0, critical: 1, low: 2, safe: 3, noData: 4,
}

function urgencyColor(tier: UrgencyTier) {
  if (tier === 'outOfStock' || tier === 'critical') return '#ef4444'
  if (tier === 'low') return '#f59e0b'
  if (tier === 'safe') return '#16a34a'
  return '#a8a29e'
}

function urgencyLabel(tier: UrgencyTier) {
  if (tier === 'outOfStock') return 'OUT OF STOCK'
  if (tier === 'critical') return 'Critical'
  if (tier === 'low') return 'Low'
  if (tier === 'safe') return 'Safe'
  return 'No data'
}

function computeAlerts(
  transactions: SalesTransaction[],
  restockLogs: RestockLog[],
  catalogueProducts: CatalogueProduct[],
): RestockAlert[] {
  if (!transactions.length) return []

  const stats = computeProductStats(transactions)

  const latestLog: Record<string, RestockLog> = {}
  for (const log of restockLogs) {
    const existing = latestLog[log.productName]
    if (!existing || log.date > existing.date) latestLog[log.productName] = log
  }

  const catalogueQtyLower: Record<string, number> = {}
  for (const p of catalogueProducts) {
    if (p.quantity !== null) catalogueQtyLower[p.name.toLowerCase().trim()] = p.quantity
  }

  function lookupCatalogueQty(name: string): number | undefined {
    const lower = name.toLowerCase().trim()
    if (catalogueQtyLower[lower] !== undefined) return catalogueQtyLower[lower]
    const base = lower.replace(/\s*\([^)]*\)\s*$/, '').trim()
    return catalogueQtyLower[base]
  }

  const today = new Date()
  const alerts: RestockAlert[] = []

  for (const product of stats) {
    const spanDays = (today.getTime() - product.firstSoldDate.getTime()) / 86_400_000
    const weeksSpan = Math.max(1, spanDays / 7)
    const weeklyVelocity = product.totalUnitsSold / weeksSpan
    const dailyVelocity = weeklyVelocity / 7

    let stockRemaining: number | null = null
    let daysUntilStockout: number | null = null
    let projectedStockoutDate: Date | null = null
    let lastRestockedDate: Date | null = null
    let lastRestockedQuantity: number | null = null

    const log = latestLog[product.name]
    if (log) {
      lastRestockedDate = log.date
      lastRestockedQuantity = log.quantity
      const restockDay = startOfDay(log.date).getTime()
      const soldAfter = Object.entries(product.dailySales)
        .filter(([key]) => startOfDay(new Date(key + 'T00:00:00')).getTime() > restockDay)
        .reduce((s, [, v]) => s + v, 0)
      const remaining = log.quantity - soldAfter
      stockRemaining = remaining
      if (remaining > 0 && dailyVelocity > 0) {
        daysUntilStockout = remaining / dailyVelocity
        projectedStockoutDate = new Date(today.getTime() + daysUntilStockout * 86_400_000)
      }
    } else {
      const qty = lookupCatalogueQty(product.name)
      if (qty !== undefined) {
        stockRemaining = qty
        if (qty > 0 && dailyVelocity > 0) {
          daysUntilStockout = qty / dailyVelocity
          projectedStockoutDate = new Date(today.getTime() + daysUntilStockout * 86_400_000)
        }
      }
    }

    let urgency: UrgencyTier
    if (stockRemaining !== null) {
      if (stockRemaining <= 0) urgency = 'outOfStock'
      else if (daysUntilStockout !== null) {
        urgency = daysUntilStockout <= 5 ? 'critical' : daysUntilStockout <= 10 ? 'low' : 'safe'
      } else urgency = 'safe'
    } else urgency = 'noData'

    alerts.push({
      productName: product.name,
      category: product.category,
      weeklyVelocity,
      stockRemaining,
      daysUntilStockout,
      projectedStockoutDate,
      lastRestockedDate,
      lastRestockedQuantity,
      urgency,
      recommendedRestockQty: Math.ceil(weeklyVelocity * 3),
    })
  }

  return alerts.sort((a, b) => {
    const uo = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
    if (uo !== 0) return uo
    const da = a.daysUntilStockout ?? Infinity
    const db_ = b.daysUntilStockout ?? Infinity
    return da - db_
  })
}

function LogRestockModal({ productName, onClose }: { productName: string; onClose: () => void }) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(false)

  async function save() {
    const n = parseInt(qty, 10)
    if (!n || n <= 0) { setError(true); return }
    await db.restockLogs.add({ productName, date: new Date(date + 'T00:00:00'), quantity: n, notes })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-stone-800 rounded-2xl shadow-2xl border border-stone-700 w-96 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-100">Log Restock</h2>
            <p className="text-sm text-stone-400">{productName}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-100 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-100 mb-1">Restock Date</label>
            <input type="date" className="w-full border border-stone-600 rounded-lg px-3 py-2 bg-stone-700/50 text-sm"
              value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-100 mb-1">Quantity Restocked</label>
            <input type="number" placeholder="e.g. 48"
              className={`w-full border rounded-lg px-3 py-2 text-sm ${error ? 'border-red-400' : 'border-stone-700'}`}
              value={qty} onChange={e => { setQty(e.target.value); setError(false) }} />
            {error && <p className="text-xs text-red-400 mt-1">Enter a valid whole number</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-100 mb-1">Notes (optional)</label>
            <input type="text" placeholder="e.g. Received from supplier"
              className="w-full border border-stone-600 rounded-lg px-3 py-2 bg-stone-700/50 text-sm"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-400 hover:text-stone-100">Cancel</button>
          <button onClick={save} className="px-4 py-2 text-sm bg-amber-500 text-stone-950 rounded-lg hover:bg-amber-600">
            Save Restock
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RestockView() {
  const transactions = useAllTransactions()
  const restockLogs = useRestockLogs()
  const catalogueProducts = useCatalogueProducts()
  const [productToRestock, setProductToRestock] = useState<string | null>(null)

  const { value: alertsRaw, loading: computing } = useDeferredCompute(
    () => computeAlerts(transactions, restockLogs, catalogueProducts),
    [transactions, restockLogs, catalogueProducts],
  )
  const alerts = alertsRaw ?? []

  const outOfStockCount = useMemo(() => alerts.filter(a => a.urgency === 'outOfStock').length, [alerts])
  const criticalCount = useMemo(() => alerts.filter(a => a.urgency === 'critical').length, [alerts])
  const lowCount = useMemo(() => alerts.filter(a => a.urgency === 'low').length, [alerts])
  const suggestedList = useMemo(
    () => alerts.filter(a => a.urgency === 'outOfStock' || a.urgency === 'critical' || a.urgency === 'low'),
    [alerts],
  )

  if (transactions.length === 0) {
    return <EmptyState title="No data" subtitle="Import CSV sales data to see restock alerts." />
  }

  if (computing && !alertsRaw) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-700 text-stone-100 tracking-tight">Restock Alerts & Forecasting</h1>
        <div className="flex items-center justify-center gap-3 text-stone-400 text-sm py-24">
          <div className="w-4 h-4 border-2 border-stone-700 border-t-amber-400 rounded-full animate-spin" />
          Analyzing…
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-700 text-stone-100 tracking-tight">Restock Alerts & Forecasting</h1>

      <div className="grid grid-cols-4 gap-4 cf-stagger">
        <StatCard
          label="Total Products"
          value={String(alerts.length)}
          countTo={alerts.length}
          format={(n) => Math.round(n).toLocaleString()}
        />
        <StatCard
          label="Out of Stock"
          value={String(outOfStockCount)}
          countTo={outOfStockCount}
          format={(n) => Math.round(n).toLocaleString()}
        />
        <StatCard
          label="Critical (≤5 days)"
          value={String(criticalCount)}
          countTo={criticalCount}
          format={(n) => Math.round(n).toLocaleString()}
        />
        <StatCard
          label="Low (6–10 days)"
          value={String(lowCount)}
          countTo={lowCount}
          format={(n) => Math.round(n).toLocaleString()}
        />
      </div>

      {suggestedList.length > 0 && (
        <div className="bg-stone-800/30 border border-stone-700/40 p-5">
          <h2 className="text-sm font-semibold text-amber-400 mb-3">Suggested Restock List</h2>
          <div className="space-y-2">
            {suggestedList.map(alert => (
              <div key={alert.productName} className="flex items-center gap-3 p-3 rounded-lg"
                style={{ backgroundColor: urgencyColor(alert.urgency) + '0d' }}>
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: urgencyColor(alert.urgency) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-100 text-sm">{alert.productName}</p>
                  <p className="text-xs text-stone-400">{alert.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm text-stone-100">
                    Restock {alert.recommendedRestockQty} units
                  </p>
                  {alert.stockRemaining !== null ? (
                    <p className="text-xs" style={{ color: urgencyColor(alert.urgency) }}>
                      {alert.stockRemaining <= 0 ? 'OUT OF STOCK' : `${alert.stockRemaining} remaining`}
                    </p>
                  ) : (
                    <p className="text-xs text-stone-400">No stock data</p>
                  )}
                </div>
                <button
                  onClick={() => setProductToRestock(alert.productName)}
                  className="shrink-0 text-xs px-3 py-1.5 border border-stone-700 rounded-lg hover:bg-stone-700/50"
                >
                  Log Restock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-stone-800/30 border border-stone-700/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-700/50">
          <h2 className="text-base font-semibold text-stone-100">All Products — Stock Status</h2>
        </div>
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-400">Import CSV sales data to see restock alerts.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-900 border-b border-stone-700/50 text-left">
                  {['Product', 'Category', 'Weekly Vel.', 'Est. Stock', 'Days Left', 'Proj. Stockout', 'Last Restocked', 'Status', 'Action'].map(h => (
                    <th key={h} className="px-4 py-2.5 font-semibold text-stone-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert.productName} className="border-b border-stone-800 hover:bg-stone-700/50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-stone-100">{alert.productName}</div>
                    </td>
                    <td className="px-4 py-2.5 text-stone-400">{alert.category}</td>
                    <td className="px-4 py-2.5 font-mono text-stone-100">{alert.weeklyVelocity.toFixed(1)}/wk</td>
                    <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: urgencyColor(alert.urgency) }}>
                      {alert.stockRemaining !== null
                        ? alert.stockRemaining <= 0 ? 'OUT' : alert.stockRemaining
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: urgencyColor(alert.urgency) }}>
                      {alert.urgency === 'outOfStock' ? '0'
                        : alert.daysUntilStockout !== null ? Math.round(alert.daysUntilStockout)
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-stone-400">
                      {alert.projectedStockoutDate ? format(alert.projectedStockoutDate, 'MMM d') : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-stone-400">
                      {alert.lastRestockedDate ? format(alert.lastRestockedDate, 'M/d/yy') : 'Never'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: urgencyColor(alert.urgency) + '20',
                          color: urgencyColor(alert.urgency),
                        }}
                      >
                        {urgencyLabel(alert.urgency)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setProductToRestock(alert.productName)}
                        className="text-xs px-2 py-1 border border-stone-700 rounded hover:bg-stone-700/50"
                      >
                        Log Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {productToRestock && (
        <LogRestockModal productName={productToRestock} onClose={() => setProductToRestock(null)} />
      )}
    </div>
  )
}
