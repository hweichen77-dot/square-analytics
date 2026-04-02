import { create } from 'zustand'
import type { DateRange } from '../db/useTransactions'

interface DateRangeStore {
  range: DateRange
  setRange: (range: DateRange) => void
}

export const useDateRangeStore = create<DateRangeStore>(set => ({
  range: { start: null, end: null },
  setRange: range => set({ range }),
}))
