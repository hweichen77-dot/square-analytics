import { useMemo, useState } from 'react'
import { useAllTransactions } from '../db/useTransactions'
import { computeAnomalies } from '../engine/forecastEngine'
import type { AnomalyDay } from '../engine/forecastEngine'
import { EmptyState } from '../components/ui/EmptyState'
import { StatCard } from '../components/ui/StatCard'
import { formatCurrency, formatPercent } from '../utils/format'
import { useNavigate } from 'react-router-dom'

type Filter = 'all' | 'above' | 'below'

function SeverityBadge({ severity }: { severity: 'mild' | 'strong' }) {
  return severity === 'strong'
    ? <span className="px-1.5 py-0.5 text-xs font-medium bg-red-500/15 text-red-400 rounded">Strong</span>
    : <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-400 rounded">Mild</span>
}

function AnomalyRow({ anomaly }: { anomaly: AnomalyDay }) {
  const { dayLabel, actualRevenue, expectedRevenue, percentDiff, direction, severity } = anomaly
  const isAbove = direction === 'above'
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-stone-700/50 last:border-0 hover:bg-stone-700/50">
      <div className={`w-2 h-2 rounded-full shrink-0 ${isAbove ? 'bg-emerald-500' : 'bg-red-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-200">{dayLabel}</p>
        <p className="text-xs text-stone-400 mt-0.5">
          Expected ~{formatCurrency(expectedRevenue)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-stone-100">{formatCurrency(actualRevenue)}</p>
        <p className={`text-xs font-medium ${isAbove ? 'text-emerald-400' : 'text-red-400'}`}>
          {isAbove ? '+' : ''}{formatPercent(percentDiff, 1)}
        </p>
      </div>
      <SeverityBadge severity={severity} />
    </div>
  )
}

export default function AnomalyView() {
  const transactions = useAllTransactions()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')

  const anomalies = useMemo(() => computeAnomalies(transactions), [transactions])

  const filtered = useMemo(
    () => filter === 'all' ? anomalies : anomalies.filter(a => a.direction === filter),
    [anomalies, filter],
  )

  const aboveCount = anomalies.filter(a => a.direction === 'above').length
  const belowCount = anomalies.filter(a => a.direction === 'below').length

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No data yet"
        subtitle="Import transactions to detect anomalous days."
        action={{ label: 'Go to Import', onClick: () => navigate('/import') }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-700 text-stone-100 tracking-tight">Anomaly Alerts</h1>
        <p className="text-sm text-stone-400 mt-1">
          Days that were unusually above or below your typical revenue for that day of the week.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 cf-stagger">
        <StatCard
          label="Total anomalies"
          value={String(anomalies.length)}
          countTo={anomalies.length}
          format={(n) => Math.round(n).toLocaleString()}
        />
        <StatCard
          label="Above normal"
          value={String(aboveCount)}
          countTo={aboveCount}
          format={(n) => Math.round(n).toLocaleString()}
        />
        <StatCard
          label="Below normal"
          value={String(belowCount)}
          countTo={belowCount}
          format={(n) => Math.round(n).toLocaleString()}
        />
      </div>

      {anomalies.length === 0 ? (
        <div className="bg-stone-800/30 border border-stone-700/40 p-8 text-center text-stone-400 text-sm">
          No anomalous days detected. Your revenue is remarkably consistent!
        </div>
      ) : (
        <div className="bg-stone-800/30 border border-stone-700/40 overflow-hidden">
          <div className="flex border-b border-stone-700/50">
            {(['all', 'above', 'below'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  filter === f
                    ? 'border-b-2 border-amber-500 text-amber-400'
                    : 'text-stone-400 hover:text-stone-100'
                }`}
              >
                {f === 'all' ? `All (${anomalies.length})` : f === 'above' ? `Above (${aboveCount})` : `Below (${belowCount})`}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-400">No {filter} anomalies.</div>
          ) : (
            <div>
              {filtered.map((a, i) => <AnomalyRow key={i} anomaly={a} />)}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-stone-500">
        A day is flagged as anomalous when its revenue is more than 2.0 standard deviations from the mean for that day of the week.
        Strong anomalies are more than 2.5 standard deviations away.
      </p>
    </div>
  )
}
