import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './database'
import type { SalesTransaction } from '../types/models'

export interface DateRange {
  start: Date | null
  end: Date | null
}

export function useAllTransactions(): SalesTransaction[] {
  return useLiveQuery(() => db.salesTransactions.toArray(), []) ?? []
}

export function useFilteredTransactions(range: DateRange): SalesTransaction[] {
  return useLiveQuery(async () => {
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
}

export function useCategoryOverrides() {
  return useLiveQuery(() => db.categoryOverrides.toArray(), []) ?? []
}

export function useOverridesMap(): Record<string, string> {
  const overrides = useCategoryOverrides()
  const map: Record<string, string> = {}
  for (const o of overrides) map[o.productName] = o.category
  return map
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

export function useStaffWages() {
  return useLiveQuery(() => db.staffWages.toArray(), []) ?? []
}
