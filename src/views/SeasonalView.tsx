import { useMemo, useState } from 'react'
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { useStoreEvents, useAllTransactions } from '../db/useTransactions'
import { useDeferredCompute } from '../hooks/useDeferredCompute'
import { useAnalytics } from '../context/AnalyticsContext'
import { EmptyState } from '../components/ui/EmptyState'
import { db } from '../db/database'
import { formatCurrency } from '../utils/format'
import { chart } from '../lib/chartTheme'
import type { StoreEvent, SalesTransaction } from '../types/models'
import { EVENT_TYPES, eventColor } from '../types/models'
import { format, startOfDay } from 'date-fns'
import { parseProductItems } from '../types/models'

interface EventImpact {
  event: StoreEvent
  totalRevenueDuring: number
  avgDailyRevenueDuring: number
  avgDailyRevenueBefore: number
  upliftPct: number
  topProducts: { name: string; qty: number }[]
}

const EVENT_TAILWIND_COLOR: Record<string, string> = {
  purple: 'bg-amber-500/15 text-amber-400',
  orange: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
  blue: 'bg-amber-500/15 text-amber-400',
  green: 'bg-emerald-500/15 text-emerald-400',
  teal: 'bg-amber-100 text-amber-700',
  gray: 'bg-stone-800 text-stone-200',
}

function eventHex(type: string) {
  const map: Record<string, string> = {
    'Big Game': '#14b8a6', 'Holiday': '#16a34a', 'Long Weekend': '#3b82f6',
    'Payday': '#f59e0b', 'Local Event': '#a855f7', 'Promotion': '#ef4444',
  }
  return map[type] ?? '#a8a29e'
}

function computeImpact(event: StoreEvent, transactions: SalesTransaction[]): EventImpact {
  const eventStart = startOfDay(event.startDate)
  const eventEnd = startOfDay(event.endDate)

  const duringTx = transactions.filter(tx => {
    const d = startOfDay(tx.date)
    return d >= eventStart && d <= eventEnd
  })
  const totalRevenueDuring = duringTx.reduce((s, t) => s + t.netSales, 0)
  const distinctDaysDuring = new Set(duringTx.map(tx => startOfDay(tx.date).getTime())).size
  const avgDailyRevenueDuring = totalRevenueDuring / Math.max(1, distinctDaysDuring)

  const baselineEnd = new Date(eventStart.getTime() - 86_400_000)
  const baselineStart = new Date(eventStart.getTime() - 14 * 86_400_000)
  const baselineTx = transactions.filter(tx => {
    const d = startOfDay(tx.date)
    return d >= startOfDay(baselineStart) && d <= startOfDay(baselineEnd)
  })
  const baselineRevenue = baselineTx.reduce((s, t) => s + t.netSales, 0)
  const distinctDaysBase = new Set(baselineTx.map(tx => startOfDay(tx.date).getTime())).size
  const avgDailyRevenueBefore = baselineRevenue / Math.max(1, distinctDaysBase)

  const upliftPct = avgDailyRevenueBefore > 0
    ? ((avgDailyRevenueDuring - avgDailyRevenueBefore) / avgDailyRevenueBefore) * 100
    : 0

  const productQty: Record<string, number> = {}
  for (const tx of duringTx) {
    for (const item of parseProductItems(tx.itemDescription)) {
      productQty[item.name] = (productQty[item.name] ?? 0) + item.qty
    }
  }
  const topProducts = Object.entries(productQty)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, qty]) => ({ name, qty }))

  return { event, totalRevenueDuring, avgDailyRevenueDuring, avgDailyRevenueBefore, upliftPct, topProducts }
}

function EventTypeBadge({ type }: { type: string }) {
  const color = eventColor(type)
  const cls = EVENT_TAILWIND_COLOR[color] ?? 'bg-stone-800 text-stone-200'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{type}</span>
}

function EventEditModal({
  event,
  onSave,
  onClose,
}: {
  event: StoreEvent | null
  onSave: (name: string, type: string, start: Date, end: Date, notes: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(event?.name ?? '')
  const [type, setType] = useState(event?.eventType ?? EVENT_TYPES[0])
  const [start, setStart] = useState(format(event?.startDate ?? new Date(), 'yyyy-MM-dd'))
  const [end, setEnd] = useState(format(event?.endDate ?? new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState(event?.notes ?? '')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-stone-800 rounded-2xl shadow-2xl border border-stone-700 w-96 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{event ? 'Edit Event' : 'Add Event'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-100 text-xl">×</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Event Name</label>
            <input className="w-full border border-stone-600 rounded-lg px-3 py-2 bg-stone-700/50 text-sm"
              value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Super Bowl Weekend" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Type</label>
            <select className="w-full border border-stone-600 rounded-lg px-3 py-2 bg-stone-700/50 text-sm"
              value={type} onChange={e => setType(e.target.value)}>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-400 mb-1">Start Date</label>
              <input type="date" className="w-full border border-stone-600 rounded-lg px-3 py-2 bg-stone-700/50 text-sm"
                value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-400 mb-1">End Date</label>
              <input type="date" className="w-full border border-stone-600 rounded-lg px-3 py-2 bg-stone-700/50 text-sm"
                value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Notes (optional)</label>
            <input className="w-full border border-stone-600 rounded-lg px-3 py-2 bg-stone-700/50 text-sm"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="text-sm text-stone-400 hover:text-stone-100">Cancel</button>
          <button
            disabled={!name.trim()}
            onClick={() => { onSave(name, type, new Date(start + 'T00:00:00'), new Date(end + 'T00:00:00'), notes); onClose() }}
            className="px-4 py-2 text-sm bg-amber-500 text-stone-950 rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            Save Event
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SeasonalView() {
  const { daily: dailyRevenue } = useAnalytics()
  const allTransactions = useAllTransactions()
  const events = useStoreEvents()
  const [showAdd, setShowAdd] = useState(false)
  const [editingEvent, setEditingEvent] = useState<StoreEvent | null>(null)
  const { value: impactsRaw, loading: computing } = useDeferredCompute(
    () => events.map(e => computeImpact(e, allTransactions)),
    [events, allTransactions],
  )
  const impacts = impactsRaw ?? []

  const chartData = useMemo(
    () => dailyRevenue.map(d => ({ date: format(d.date, 'MMM d'), revenue: d.revenue, ts: d.date.getTime() })),
    [dailyRevenue],
  )

  async function addEvent(name: string, type: string, start: Date, end: Date, notes: string) {
    await db.storeEvents.add({ name, startDate: start, endDate: end, eventType: type, notes })
  }

  async function updateEvent(event: StoreEvent, name: string, type: string, start: Date, end: Date, notes: string) {
    await db.storeEvents.update(event.id!, { name, eventType: type, startDate: start, endDate: end, notes })
  }

  async function deleteEvent(event: StoreEvent) {
    if (event.id) await db.storeEvents.delete(event.id)
  }

  if (allTransactions.length === 0) {
    return <EmptyState title="No data" subtitle="Import sales data to see seasonal analysis." />
  }

  if (computing && !impactsRaw) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-700 text-stone-100 tracking-tight">Seasonal & Events</h1>
        <div className="flex items-center justify-center gap-3 text-stone-400 text-sm py-24">
          <div className="w-4 h-4 border-2 border-stone-700 border-t-amber-400 rounded-full animate-spin" />
          Analyzing…
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-700 text-stone-100 tracking-tight">Seasonal & Events</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 text-sm bg-amber-500 text-stone-950 rounded-lg hover:bg-amber-600"
        >
          + Add Event
        </button>
      </div>

      <div className="bg-stone-800/30 border border-stone-700/40 p-5">
        <h2 className="text-base font-semibold text-stone-100 mb-3">Store Events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-stone-400">No events added yet. Click "Add Event" to get started.</p>
        ) : (
          <div className="divide-y divide-stone-700/40">
            {events.map(event => (
              <div key={event.id} className="flex items-center gap-3 py-3">
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: eventHex(event.eventType) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-stone-100">{event.name}</span>
                    <EventTypeBadge type={event.eventType} />
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {format(event.startDate, 'MMM d')} – {format(event.endDate, 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingEvent(event)} className="text-xs text-stone-400 hover:text-stone-100">Edit</button>
                  <button onClick={() => deleteEvent(event)} className="text-xs text-red-400 hover:text-red-400">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="bg-stone-800/30 border border-stone-700/40 p-5">
          <h2 className="text-base font-semibold text-stone-100 mb-4">Revenue Timeline</h2>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: chart.axis }} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: chart.axis }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: chart.tooltipText }} itemStyle={{ color: chart.tooltipText }} />
              <Area type="monotone" dataKey="revenue" fill="#F59E0B20" stroke={chart.line} strokeWidth={1.5} dot={false} />
              {events.map(event => (
                <ReferenceLine
                  key={`${event.id}-start`}
                  x={format(event.startDate, 'MMM d')}
                  stroke={eventHex(event.eventType)}
                  strokeDasharray="4 2"
                  label={{ value: event.name, position: 'insideTopLeft', fontSize: 9, fill: eventHex(event.eventType) }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {events.length > 0 && impacts.length > 0 && (
        <div className="bg-stone-800/30 border border-stone-700/40 p-5">
          <h2 className="text-base font-semibold text-stone-100 mb-4">Event Impact Analysis</h2>
          <div className="space-y-3">
            {impacts.map(impact => {
              const upliftColor = impact.upliftPct >= 0 ? '#16a34a' : '#dc2626'
              const upliftSign = impact.upliftPct >= 0 ? '+' : ''
              return (
                <div key={impact.event.id} className="flex items-start gap-3 p-4 border border-stone-700/50">
                  <div
                    className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: eventHex(impact.event.eventType) }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-sm text-stone-100">{impact.event.name}</span>
                      <EventTypeBadge type={impact.event.eventType} />
                      <span className="text-xs text-stone-400 ml-auto">
                        {format(impact.event.startDate, 'MMM d')} – {format(impact.event.endDate, 'MMM d')}
                      </span>
                    </div>
                    <div className="flex gap-6 flex-wrap">
                      <div>
                        <p className="text-xs text-stone-400">Total Revenue</p>
                        <p className="font-bold text-sm text-stone-100">{formatCurrency(impact.totalRevenueDuring)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-400">vs Baseline</p>
                        <p className="font-bold text-sm" style={{ color: upliftColor }}>
                          {upliftSign}{impact.upliftPct.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-400">Avg Daily During</p>
                        <p className="font-mono text-sm text-stone-100">{formatCurrency(impact.avgDailyRevenueDuring)}/day</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-400">Avg Daily Baseline</p>
                        <p className="font-mono text-sm text-stone-100">{formatCurrency(impact.avgDailyRevenueBefore)}/day</p>
                      </div>
                      {impact.topProducts.length > 0 && (
                        <div>
                          <p className="text-xs text-stone-400">Top Products</p>
                          <p className="text-sm text-stone-100">{impact.topProducts.map(p => `${p.name} (${p.qty})`).join(', ')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showAdd && (
        <EventEditModal
          event={null}
          onSave={addEvent}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editingEvent && (
        <EventEditModal
          event={editingEvent}
          onSave={(name, type, start, end, notes) => updateEvent(editingEvent, name, type, start, end, notes)}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  )
}
