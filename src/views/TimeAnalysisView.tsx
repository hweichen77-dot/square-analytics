import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useFilteredTransactions } from '../db/useTransactions'
import { useDateRangeStore } from '../store/dateRangeStore'
import { computeHeatmap, computeMonthlyComparison } from '../engine/analyticsEngine'
import { EmptyState } from '../components/ui/EmptyState'
import { formatCurrency } from '../utils/format'

const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function hourLabel(h: number) {
  if (h === 0) return '12a'
  if (h < 12) return `${h}a`
  if (h === 12) return '12p'
  return `${h - 12}p`
}

export default function TimeAnalysisView() {
  const { range } = useDateRangeStore()
  const transactions = useFilteredTransactions(range)

  const heatmap = useMemo(() => computeHeatmap(transactions), [transactions])
  const monthly = useMemo(() => computeMonthlyComparison(transactions), [transactions])

  const maxCount = useMemo(
    () => Math.max(1, ...heatmap.filter(h => HOURS.includes(h.hour)).map(h => h.count)),
    [heatmap],
  )

  if (transactions.length === 0) {
    return <EmptyState title="No data" subtitle="Import sales data to see time analysis." />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Time Analysis</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900">Sales Heatmap</h2>
        <p className="text-xs text-gray-500 mt-0.5 mb-4">Sales volume by day and hour</p>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="flex gap-1 mb-1 ml-10">
              {HOURS.map(h => (
                <div key={h} className="text-center text-xs text-gray-400 font-medium" style={{ width: 36 }}>
                  {hourLabel(h)}
                </div>
              ))}
            </div>

            {Array.from({ length: 7 }, (_, i) => i + 1).map(dow => (
              <div key={dow} className="flex gap-1 mb-1 items-center">
                <div className="text-xs text-gray-500 w-9 text-right pr-1 shrink-0">
                  {DAY_NAMES[dow - 1]}
                </div>
                {HOURS.map(hour => {
                  const cell = heatmap.find(h => h.dayOfWeek === dow && h.hour === hour)
                  const count = cell?.count ?? 0
                  const intensity = count / maxCount
                  return (
                    <div
                      key={hour}
                      title={`${DAY_NAMES[dow - 1]} ${hourLabel(hour)}: ${count} sales`}
                      className="rounded flex items-center justify-center text-xs font-medium"
                      style={{
                        width: 36,
                        height: 28,
                        backgroundColor:
                          count === 0
                            ? 'rgb(243 244 246)'
                            : `rgba(99, 102, 241, ${0.15 + intensity * 0.8})`,
                        color: intensity > 0.5 ? 'white' : '#374151',
                      }}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  )
                })}
              </div>
            ))}

            <div className="flex items-center gap-1 mt-3 ml-10">
              <span className="text-xs text-gray-400">Less</span>
              {[0, 0.25, 0.5, 0.75, 1].map(v => (
                <div
                  key={v}
                  className="rounded"
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor:
                      v === 0 ? 'rgb(243 244 246)' : `rgba(99, 102, 241, ${0.15 + v * 0.8})`,
                  }}
                />
              ))}
              <span className="text-xs text-gray-400">More</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly Comparison</h2>
        {monthly.length === 0 ? (
          <p className="text-sm text-gray-400">No monthly data available.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="pb-2 font-semibold text-gray-600 text-xs">Month</th>
                    <th className="pb-2 font-semibold text-gray-600 text-xs text-right">Revenue</th>
                    <th className="pb-2 font-semibold text-gray-600 text-xs text-right">Transactions</th>
                    <th className="pb-2 font-semibold text-gray-600 text-xs text-right">Avg Value</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map(m => (
                    <tr key={m.month} className="border-b border-gray-50">
                      <td className="py-1.5 text-gray-700 font-mono text-xs">{m.month}</td>
                      <td className="py-1.5 text-gray-900 font-mono text-xs text-right">{formatCurrency(m.revenue)}</td>
                      <td className="py-1.5 text-gray-700 font-mono text-xs text-right">{m.transactions}</td>
                      <td className="py-1.5 text-gray-700 font-mono text-xs text-right">{formatCurrency(m.avgTransaction)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
/tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
