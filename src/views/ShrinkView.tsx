import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAllStockMovements, useProductCostData } from '../db/useTransactions'
import { EmptyState } from '../components/ui/EmptyState'
import { formatCurrency } from '../utils/format'
import { chart } from '../lib/chartTheme'
import { stockMovementLabel, lookupUnitCost } from '../types/models'
import type { StockMovement, ProductCostData } from '../types/models'
import { classifyProduct } from '../engine/categoryClassifier'
import { format } from 'date-fns'

const LOSS_LABELS = new Set(['Waste', 'Removed'])

interface LossEvent {
  changeId: string
  productName: string
  category: string
  reason: string
  units: number
  cost: number | null
  occurredAt: Date
}

function buildLosses(movements: StockMovement[], costData: ProductCostData[]): LossEvent[] {
  const events: LossEvent[] = []
  for (const m of movements) {
    const { label, delta } = stockMovementLabel(m)
    if (!LOSS_LABELS.has(label) || delta >= 0) continue
    const units = Math.abs(delta)
    const unitCost = lookupUnitCost(m.productName, costData)
    events.push({
      changeId: m.changeId,
      productName: m.productName,
      category: classifyProduct(m.productName),
      reason: label,
      units,
      cost: unitCost != null ? unitCost * units : null,
      occurredAt: m.occurredAt,
    })
  }
  return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}

export default function ShrinkView() {
  const movements = useAllStockMovements()
  const costData = useProductCostData()

  const losses = useMemo(() => buildLosses(movements, costData), [movements, costData])

  const totalUnits = useMemo(() => losses.reduce((s, l) => s + l.units, 0), [losses])
  const totalCost = useMemo(() => losses.reduce((s, l) => s + (l.cost ?? 0), 0), [losses])
  const hasCost = useMemo(() => losses.some(l => l.cost !== null), [losses])

  const byProduct = useMemo(() => {
    const map = new Map<string, { units: number; cost: number; category: string }>()
    for (const l of losses) {
      const e = map.get(l.productName) ?? { units: 0, cost: 0, category: l.category }
      e.units += l.units
      e.cost += l.cost ?? 0
      map.set(l.productName, e)
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => (b.cost || b.units) - (a.cost || a.units))
  }, [losses])

  const byCategory = useMemo(() => {
    const map = new Map<string, { units: number; cost: number }>()
    for (const l of losses) {
      const e = map.get(l.category) ?? { units: 0, cost: 0 }
      e.units += l.units
      e.cost += l.cost ?? 0
      map.set(l.category, e)
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => (b.cost || b.units) - (a.cost || a.units))
  }, [losses])

  const chartData = useMemo(() => byProduct.slice(0, 15), [byProduct])

  if (movements.length === 0) {
    return (
      <EmptyState
        title="No stock movement data"
        subtitle="Sync with Square to pull inventory adjustments, waste, and recounts. Shrink is tracked from those movements."
      />
    )
  }

  if (losses.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-700 text-stone-100 tracking-tight">Shrink & Loss</h1>
          <p className="text-sm text-stone-400 mt-1">Waste, damage, and downward inventory adjustments</p>
        </div>
        <div className="bg-stone-800/30 border border-stone-700/40 p-8 text-center text-sm text-stone-400">
          No waste or loss adjustments recorded in your synced stock history. That's good news.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-700 text-stone-100 tracking-tight">Shrink & Loss</h1>
        <p className="text-sm text-stone-400 mt-1">Waste, damage, and downward inventory adjustments from Square stock movements</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-stone-800/30 border border-stone-700/40 p-4">
          <p className="text-xs text-stone-400">Loss Events</p>
          <p className="text-2xl font-bold text-stone-100 mt-1">{losses.length}</p>
        </div>
        <div className="bg-stone-800/30 border border-stone-700/40 p-4">
          <p className="text-xs text-stone-400">Units Lost</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{totalUnits.toLocaleString()}</p>
        </div>
        <div className="bg-stone-800/30 border border-stone-700/40 p-4">
          <p className="text-xs text-stone-400">Cost of Shrink</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{hasCost ? formatCurrency(totalCost) : 'Add costs →'}</p>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="bg-stone-800/30 border border-stone-700/40 p-5">
          <h2 className="text-sm font-semibold text-stone-100 mb-4">Loss by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {byCategory.map(c => (
              <div key={c.category} className="flex items-center justify-between p-3 bg-stone-900">
                <div>
                  <p className="font-semibold text-sm text-stone-100">{c.category}</p>
                  <p className="text-xs text-stone-400">{c.units} units</p>
                </div>
                <p className="font-mono text-sm text-red-400">{c.cost > 0 ? formatCurrency(c.cost) : '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="bg-stone-800/30 border border-stone-700/40 p-5">
          <h2 className="text-base font-semibold text-stone-100 mb-4">Top Shrink by Product</h2>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 24)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chart.grid} />
              <XAxis type="number" tick={{ fontSize: 11, fill: chart.axis }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: chart.axis }} width={130} />
              <Tooltip
                formatter={(v: number, n: string) => n === 'cost' ? [formatCurrency(v), 'Cost'] : [v, 'Units']}
                contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: chart.tooltipText }}
                itemStyle={{ color: chart.tooltipText }}
              />
              <Bar dataKey={hasCost ? 'cost' : 'units'} radius={[0, 3, 3, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={chart.negative} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-stone-800/30 border border-stone-700/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-700/50">
          <h2 className="text-base font-semibold text-stone-100">Loss Events</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-stone-900 border-b border-stone-700/50 text-left">
                <th className="px-4 py-2.5 font-semibold text-stone-400">Product</th>
                <th className="px-4 py-2.5 font-semibold text-stone-400">Category</th>
                <th className="px-4 py-2.5 font-semibold text-stone-400">Reason</th>
                <th className="px-4 py-2.5 font-semibold text-stone-400 text-right">Units</th>
                <th className="px-4 py-2.5 font-semibold text-stone-400 text-right">Cost</th>
                <th className="px-4 py-2.5 font-semibold text-stone-400 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {losses.slice(0, 200).map(l => (
                <tr key={l.changeId} className="border-b border-stone-800 hover:bg-stone-700/50">
                  <td className="px-4 py-2 font-medium text-stone-100">{l.productName}</td>
                  <td className="px-4 py-2 text-stone-400">{l.category}</td>
                  <td className="px-4 py-2 text-stone-300">{l.reason}</td>
                  <td className="px-4 py-2 text-right font-mono text-stone-100">{l.units}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-400">{l.cost != null ? formatCurrency(l.cost) : '—'}</td>
                  <td className="px-4 py-2 text-right font-mono text-stone-400">{format(l.occurredAt, 'MMM d, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
