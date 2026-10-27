import { useState } from 'react'
import { subDays, subMonths, startOfMonth, startOfDay, endOfMonth } from 'date-fns'
import { useDateRangeStore } from '../../store/dateRangeStore'
import type { DateRange } from '../../db/useTransactions'

interface Preset {
  label: string
  range: DateRange
}

function makePresets(): Preset[] {
  const now = new Date()
  return [
    { label: 'Today',          range: { start: startOfDay(now), end: now } },
    { label: 'Last 7 days',    range: { start: subDays(now, 7), end: now } },
    { label: 'Last 30 days',   range: { start: subDays(now, 30), end: now } },
    { label: 'Last 90 days',   range: { start: subDays(now, 90), end: now } },
    { label: 'This month',     range: { start: startOfMonth(now), end: endOfMonth(now) } },
    { label: 'Last month',     range: { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) } },
    { label: 'Last 6 months',  range: { start: subMonths(now, 6), end: now } },
    { label: 'Last 12 months', range: { start: subMonths(now, 12), end: now } },
    { label: 'All time',       range: { start: null, end: null } },
  ]
}

function sameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return a === b
  return a.toDateString() === b.toDateString()
}

export function DateRangePicker() {
  const { range, setRange } = useDateRangeStore()
  const [open, setOpen] = useState(false)

  const presets = makePresets()
  const activePreset = presets.find(p => sameDay(p.range.start, range.start) && sameDay(p.range.end, range.end)) ?? { label: 'Custom range' }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2 h-8 px-3 rounded-md border border-[var(--control)] bg-white text-[13px] text-stone-100 hover:border-[#b9b6b1] transition-colors cursor-pointer"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-stone-500">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className="flex-1 text-left font-medium">{activePreset.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-stone-500">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="listbox" className="absolute left-0 right-0 top-9 z-50 bg-white border border-[var(--border)] rounded-lg shadow-[0_8px_24px_rgb(0_0_0/0.10)] py-1" style={{ animation: 'dropIn 0.14s ease-out' }}>
            {presets.map(p => (
              <button
                key={p.label}
                role="option"
                aria-selected={activePreset.label === p.label}
                onClick={() => { setRange(p.range); setOpen(false) }}
                className={`w-full text-left px-3 h-8 text-[13px] transition-colors cursor-pointer ${
                  activePreset.label === p.label ? 'bg-[var(--active)] text-stone-100 font-medium' : 'text-stone-300 hover:bg-[var(--raised)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
