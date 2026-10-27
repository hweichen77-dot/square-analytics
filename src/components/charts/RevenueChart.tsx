import { useState } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { format } from 'date-fns'
import type { DailyRevenue, TimeGranularity } from '../../engine/analyticsEngine'
import { formatCurrency } from '../../utils/format'
import { chart } from '../../lib/chartTheme'

interface RevenueChartProps {
  daily: DailyRevenue[]
  weekly: DailyRevenue[]
  monthly: DailyRevenue[]
  usualDay: number
  bigDayThreshold: number
}

function shortCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
  return `$${value.toFixed(0)}`
}

const GRANULARITIES: TimeGranularity[] = ['Daily', 'Weekly', 'Monthly']

export function RevenueChart({ daily, weekly, monthly, usualDay, bigDayThreshold }: RevenueChartProps) {
  const [granularity, setGranularity] = useState<TimeGranularity>('Daily')

  const data = granularity === 'Daily' ? daily : granularity === 'Weekly' ? weekly : monthly
  const isDaily = granularity === 'Daily'
  const labelFmt = granularity === 'Monthly' ? 'MMM yyyy' : granularity === 'Weekly' ? "'Week of' MMM d" : 'EEE, MMM d, yyyy'
  const tickFmt = granularity === 'Monthly' ? 'MMM' : 'MMM d'

  const chartData = data.map(d => ({
    label: format(d.date, labelFmt),
    tick: format(d.date, tickFmt),
    revenue: Math.round(d.revenue * 100) / 100,
    orders: d.transactionCount,
    big: isDaily && d.revenue >= bigDayThreshold,
  }))

  return (
    <section className="bg-white border border-[var(--border)] rounded-lg p-5" aria-labelledby="sales-chart-title">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4 min-w-0">
          <h2 id="sales-chart-title" className="text-base font-semibold text-stone-100">Sales</h2>
          {isDaily && (
            <div className="flex items-center gap-4 text-xs text-stone-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: chart.bar }} />Big day, 3× usual or more</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: chart.grey }} />School day</span>
              {usualDay > 0 && (
                <span className="flex items-center gap-1.5 tabular-nums">
                  <svg width="14" height="2" aria-hidden="true"><line x1="0" y1="1" x2="14" y2="1" stroke={chart.ink} strokeDasharray="3 2" /></svg>
                  Usual day {formatCurrency(usualDay)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex h-8 p-0.5 rounded-md bg-[var(--active)]" role="tablist" aria-label="Group sales by">
          {GRANULARITIES.map(g => (
            <button
              key={g}
              role="tab"
              aria-selected={granularity === g}
              onClick={() => setGranularity(g)}
              className={`px-3 rounded text-[13px] transition-colors ${
                granularity === g ? 'bg-white text-stone-100 font-medium shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={isDaily ? 1 : '20%'}>
          <CartesianGrid vertical={false} stroke={chart.grid} />
          <XAxis dataKey="tick" tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={40} axisLine={{ stroke: '#d4d2ce' }} tickLine={false} />
          <YAxis tickFormatter={shortCurrency} tick={{ fontSize: 12 }} width={48} axisLine={false} tickLine={false} domain={[0, 'auto']} allowDataOverflow allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgb(0 0 0 / 0.04)' }}
            labelFormatter={(_l: string, p: { payload?: { label?: string } }[]) => p?.[0]?.payload?.label ?? ''}
            formatter={(v, _n, p) => [`${formatCurrency(Number(v))} · ${p.payload?.orders} orders`, p.payload?.big ? "Big day" : "Sales"] as [string, string]}
          />
          {isDaily && usualDay > 0 && (
            <ReferenceLine
              y={usualDay}
              stroke={chart.ink}
              strokeDasharray="3 2"
            />
          )}
          <Bar dataKey="revenue" isAnimationActive={false}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={!isDaily || d.big ? chart.bar : chart.grey} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  )
}
