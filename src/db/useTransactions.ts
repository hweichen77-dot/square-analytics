import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './database'
import type { SalesTransaction } from '../types/models'

export interface DateRange {
  start: Date | null
  end: Date | null
}

function sanitizeTransactions(txns: SalesTransaction[]): SalesTransaction[] {
  const out: SalesTransaction[] = []
  for (const t of txns) {
    const d = t.date instanceof Date ? t.date : new Date(t.date as unknown as string)
    if (Number.isNaN(d.getTime())) continue
    const netSales = Number.isFinite(t.netSales) ? t.netSales : 0
    out.push(d === t.date && netSales === t.netSales ? t : { ...t, date: d, netSales })
  }
  return out
}

export function useAllTransactions(): SalesTransaction[] {
  const raw = useLiveQuery(() => db.salesTransactions.toArray(), []) ?? []
  return useMemo(() => sanitizeTransactions(raw), [raw])
}

export function useFilteredTransactions(range: DateRange): SalesTransaction[] {
  const raw = useLiveQuery(async () => {
    if (!range.start && !range.end) return db.salesTransactions.toArray()
    let coll = db.salesTransactions.orderBy('date')
    if (range.start && range.end) {
      coll = db.salesTransactions.where('date').between(range.start, range.end, true, true)
    } else if (range.start) {
      coll = db.salesTransactions.where('date').aboveOrEqual(range.start)
    } else if (range.end) {
      coll = db.salesTransactions.where('date').belowOrEqual(range.end)
    }
    return coll.toArray()
  }, [range.start?.getTime(), range.end?.getTime()]) ?? []
  return useMemo(() => sanitizeTransactions(raw), [raw])
}

export function useCategoryOverrides() {
  return useLiveQuery(() => db.categoryOverrides.toArray(), []) ?? []
}

export function useOverridesMap(): Record<string, string> {
  const overrides = useCategoryOverrides()
  return useMemo(() => {
    const map: Record<string, string> = {}
    for (const o of overrides) map[o.productName] = o.category
    return map
  }, [overrides])
}

export function useTransactionCount(): number {
  return useLiveQuery(() => db.salesTransactions.count(), []) ?? 0
}

export function useRestockLogs() {
  return useLiveQuery(() => db.restockLogs.toArray(), []) ?? []
}

export function useProductCostData() {
  return useLiveQuery(() => db.productCostData.toArray(), []) ?? []
}

export function useStoreEvents() {
  return useLiveQuery(() => db.storeEvents.orderBy('startDate').toArray(), []) ?? []
}

export function useProductBundles() {
  return useLiveQuery(() => db.productBundles.toArray(), []) ?? []
}

export function useCatalogueProducts() {
  return useLiveQuery(() => db.catalogueProducts.toArray(), []) ?? []
}

export function useCatalogueProduct(name: string) {
  return useLiveQuery(
    () => db.catalogueProducts.where('name').equals(name).first(),
    [name],
  )
}

export function useStockMovements(productName: string) {
  const raw = useLiveQuery(
    () => db.stockMovements.where('productName').equals(productName).toArray(),
    [productName],
  ) ?? []
  return useMemo(
    () => [...raw]
      .map(m => ({ ...m, occurredAt: m.occurredAt instanceof Date ? m.occurredAt : new Date(m.occurredAt as unknown as string) }))
      .filter(m => !isNaN(m.occurredAt.getTime()))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()),
    [raw],
  )
}

export function useAllStockMovements() {
  const raw = useLiveQuery(() => db.stockMovements.toArray(), []) ?? []
  return useMemo(
    () => raw
      .map(m => ({ ...m, occurredAt: m.occurredAt instanceof Date ? m.occurredAt : new Date(m.occurredAt as unknown as string) }))
      .filter(m => !isNaN(m.occurredAt.getTime())),
    [raw],
  )
}

export function useRefunds() {
  return useLiveQuery(() => db.refunds.toArray(), []) ?? []
}

export function useShifts() {
  return useLiveQuery(() => db.shifts.toArray(), []) ?? []
}

export function useStaffWages() {
  return useLiveQuery(() => db.staffWages.toArray(), []) ?? []
}
