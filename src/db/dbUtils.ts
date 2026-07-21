import { db } from './database'
import type { SalesTransaction, CatalogueProduct, ProductCostData, CategoryOverride, OpexEntry, RestockLog, StoreEvent, ProductBundle, StaffWage, StoredRefund, StoredShift, StockMovement } from '../types/models'

export async function upsertStaffWage(staffName: string, hourlyWage: number): Promise<void> {
  const existing = await db.staffWages.where('staffName').equals(staffName).first()
  if (existing) {
    await db.staffWages.update(existing.id!, { hourlyWage })
  } else {
    await db.staffWages.add({ staffName, hourlyWage })
  }
}

export async function upsertRefunds(refunds: Omit<StoredRefund, 'id'>[]): Promise<number> {
  if (refunds.length === 0) return 0
  const ids = refunds.map(r => r.refundId)
  const existing = new Set(
    (await db.refunds.where('refundId').anyOf(ids).toArray()).map(r => r.refundId)
  )
  const toAdd = refunds.filter(r => !existing.has(r.refundId))
  if (toAdd.length === 0) return 0
  let added = 0
  for (const r of toAdd) {
    try { await db.refunds.add(r); added++ } catch {  }
  }
  return added
}

export async function upsertShifts(shifts: Omit<StoredShift, 'id'>[]): Promise<number> {
  if (shifts.length === 0) return 0
  let added = 0
  await db.transaction('rw', db.shifts, async () => {
    for (const s of shifts) {
      const existing = await db.shifts.where('shiftId').equals(s.shiftId).first()
      if (existing) {
        await db.shifts.update(existing.id!, s)
      } else {
        await db.shifts.add(s)
        added++
      }
    }
  })
  return added
}

export async function upsertTransactions(transactions: Omit<SalesTransaction, 'id'>[]): Promise<number> {
  if (transactions.length === 0) return 0
  const ids = transactions.map(t => t.transactionID)
  const existingById = new Map(
    (await db.salesTransactions.where('transactionID').anyOf(ids).toArray()).map(t => [t.transactionID, t])
  )
  const toAdd: Omit<SalesTransaction, 'id'>[] = []
  let added = 0
  await db.transaction('rw', db.salesTransactions, async () => {
    for (const t of transactions) {
      const ex = existingById.get(t.transactionID)
      if (ex) {
        await db.salesTransactions.update(ex.id!, t)
      } else {
        toAdd.push(t)
      }
    }
    if (toAdd.length > 0) {
      try {
        await db.salesTransactions.bulkAdd(toAdd)
        added = toAdd.length
      } catch {
        for (const tx of toAdd) {
          try { await db.salesTransactions.add(tx); added++ } catch {  }
        }
      }
    }
  })
  return added
}

function definedOnly<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v
  }
  return out
}

export async function upsertCatalogueProducts(products: Omit<CatalogueProduct, 'id'>[]): Promise<void> {
  await db.transaction('rw', db.catalogueProducts, async () => {
    for (const p of products) {
      const existing = await db.catalogueProducts.where('name').equals(p.name).first()
      if (existing) {
        await db.catalogueProducts.update(existing.id!, definedOnly(p))
      } else {
        await db.catalogueProducts.add(p)
      }
    }
  })
}

export async function upsertStockMovements(movements: Omit<StockMovement, 'id'>[]): Promise<number> {
  if (movements.length === 0) return 0
  const ids = movements.map(m => m.changeId)
  const existing = new Set(
    (await db.stockMovements.where('changeId').anyOf(ids).toArray()).map(m => m.changeId)
  )
  const seen = new Set<string>()
  const toAdd = movements.filter(m => {
    if (existing.has(m.changeId) || seen.has(m.changeId)) return false
    seen.add(m.changeId)
    return true
  })
  if (toAdd.length === 0) return 0
  try {
    await db.stockMovements.bulkAdd(toAdd as StockMovement[])
    return toAdd.length
  } catch {
    let added = 0
    for (const m of toAdd) {
      try { await db.stockMovements.add(m as StockMovement); added++ } catch {  }
    }
    return added
  }
}

export async function upsertProductCosts(costs: Omit<ProductCostData, 'id'>[]): Promise<void> {
  await db.transaction('rw', db.productCostData, async () => {
    for (const c of costs) {
      const existing = await db.productCostData.where('productName').equals(c.productName).first()
      if (existing) {
        // A catalogue re-import only carries a flat unit cost, so casePrice/unitsPerCase
        // arrive as 0. effectiveUnitCost prefers case pricing when set, so blindly writing
        // the incoming record would wipe hand-entered case costs and silently change COGS.
        // Only overwrite case fields when the incoming values are real (> 0).
        const patch: Partial<ProductCostData> = { unitCost: c.unitCost, lastUpdated: c.lastUpdated }
        if ((c.casePrice ?? 0) > 0) patch.casePrice = c.casePrice
        if ((c.unitsPerCase ?? 0) > 0) patch.unitsPerCase = c.unitsPerCase
        await db.productCostData.update(existing.id!, patch)
      } else {
        await db.productCostData.add(c)
      }
    }
  })
}

export async function mergeSquareProductCosts(costs: Array<{ productName: string; unitCost: number; lastUpdated: Date }>): Promise<number> {
  if (costs.length === 0) return 0
  let written = 0
  await db.transaction('rw', db.productCostData, async () => {
    for (const c of costs) {
      if (!(c.unitCost > 0)) continue
      const existing = await db.productCostData.where('productName').equals(c.productName).first()
      if (existing) {
        await db.productCostData.update(existing.id!, { unitCost: c.unitCost, lastUpdated: c.lastUpdated })
      } else {
        await db.productCostData.add({ productName: c.productName, unitCost: c.unitCost, casePrice: 0, unitsPerCase: 0, lastUpdated: c.lastUpdated })
      }
      written++
    }
  })
  return written
}

export async function upsertRestockLogs(logs: Omit<RestockLog, 'id'>[]): Promise<number> {
  if (logs.length === 0) return 0
  const existing = await db.restockLogs.toArray()
  const seen = new Set(existing.map(l => `${l.productName}|${l.date.getTime()}|${l.quantity}`))
  let added = 0
  await db.transaction('rw', db.restockLogs, async () => {
    for (const l of logs) {
      const key = `${l.productName}|${l.date.getTime()}|${l.quantity}`
      if (seen.has(key)) continue
      seen.add(key)
      await db.restockLogs.add(l)
      added++
    }
  })
  return added
}

export async function removeCsvDuplicates(): Promise<number> {
  const apiTxs = await db.salesTransactions.filter(t => t.source === 'api').toArray()
  if (apiTxs.length === 0) return 0
  const key = (t: SalesTransaction) => `${t.date.toDateString()}|${t.netSales.toFixed(2)}`
  const counts = new Map<string, number>()
  for (const t of apiTxs) counts.set(key(t), (counts.get(key(t)) ?? 0) + 1)

  const csvTxs = await db.salesTransactions.filter(t => t.source === 'csv').toArray()
  const toDelete: number[] = []
  for (const t of csvTxs) {
    const k = key(t)
    const remaining = counts.get(k) ?? 0
    if (remaining > 0) {
      counts.set(k, remaining - 1)
      if (t.id != null) toDelete.push(t.id)
    }
  }
  if (toDelete.length === 0) return 0
  await db.salesTransactions.bulkDelete(toDelete)
  return toDelete.length
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw',
    [db.salesTransactions, db.categoryOverrides, db.restockLogs,
    db.productCostData, db.storeEvents, db.productBundles, db.catalogueProducts,
    db.opexEntries, db.staffWages, db.refunds, db.shifts, db.stockMovements],
    async () => {
      await Promise.all([
        db.salesTransactions.clear(),
        db.categoryOverrides.clear(),
        db.restockLogs.clear(),
        db.productCostData.clear(),
        db.storeEvents.clear(),
        db.productBundles.clear(),
        db.catalogueProducts.clear(),
        db.opexEntries.clear(),
        db.staffWages.clear(),
        db.refunds.clear(),
        db.shifts.clear(),
        db.stockMovements.clear(),
      ])
    }
  )
}

export async function exportAllData(): Promise<string> {
  const [transactions, catalogue, costData, overrides, opexEntries, restockLogs, storeEvents, productBundles, staffWages, refunds, shifts, stockMovements] = await Promise.all([
    db.salesTransactions.toArray(),
    db.catalogueProducts.toArray(),
    db.productCostData.toArray(),
    db.categoryOverrides.toArray(),
    db.opexEntries.toArray(),
    db.restockLogs.toArray(),
    db.storeEvents.toArray(),
    db.productBundles.toArray(),
    db.staffWages.toArray(),
    db.refunds.toArray(),
    db.shifts.toArray(),
    db.stockMovements.toArray(),
  ])
  return JSON.stringify({
    version: 3,
    exportedAt: new Date().toISOString(),
    data: { transactions, catalogue, costData, overrides, opexEntries, restockLogs, storeEvents, productBundles, staffWages, refunds, shifts, stockMovements },
  })
}

export async function restoreAllData(json: string): Promise<{ transactions: number; catalogue: number }> {
  let backup: {
    version: number
    data: {
      transactions?: Record<string, unknown>[]
      catalogue?: Record<string, unknown>[]
      costData?: Record<string, unknown>[]
      overrides?: Record<string, unknown>[]
      opexEntries?: Record<string, unknown>[]
      restockLogs?: Record<string, unknown>[]
      storeEvents?: Record<string, unknown>[]
      productBundles?: Record<string, unknown>[]
      staffWages?: Record<string, unknown>[]
      refunds?: Record<string, unknown>[]
      shifts?: Record<string, unknown>[]
      stockMovements?: Record<string, unknown>[]
      salesTransactions?: Record<string, unknown>[]
      catalogueProducts?: Record<string, unknown>[]
      productCostData?: Record<string, unknown>[]
      categoryOverrides?: Record<string, unknown>[]
    }
  }

  try {
    backup = JSON.parse(json)
  } catch {
    throw new Error('Invalid backup file — file is not valid JSON.')
  }

  if (!backup?.data || typeof backup.data !== 'object') {
    throw new Error('Invalid backup file — missing data field. Is this a Walley\'s Analytics backup?')
  }

  const d = backup.data
  const txRaw = d.transactions ?? d.salesTransactions ?? []
  const catRaw = d.catalogue ?? d.catalogueProducts ?? []
  const costRaw = d.costData ?? d.productCostData ?? []
  const overridesRaw = d.overrides ?? d.categoryOverrides ?? []

  function stripId<T extends Record<string, unknown>>(rec: T): Omit<T, 'id'> {
    const { id: _id, ...rest } = rec
    return rest as Omit<T, 'id'>
  }

  function safeDate(val: unknown, field: string): Date {
    const d = new Date(val as string)
    if (isNaN(d.getTime())) throw new Error(`Invalid date in backup field "${field}": ${val}`)
    return d
  }

  const txToAdd = txRaw.map((r, i) => {
    try { return { ...stripId(r), date: safeDate(r.date, `transactions[${i}].date`) }
    } catch (e) { throw new Error(`Backup validation failed: ${(e as Error).message}`) }
  })
  const catToAdd = catRaw.map((r, i) => {
    try { return { ...stripId(r), importedAt: safeDate(r.importedAt, `catalogue[${i}].importedAt`) }
    } catch { return { ...stripId(r), importedAt: new Date() } }
  })
  const costToAdd = costRaw.map((r, i) => {
    try { return { ...stripId(r), lastUpdated: safeDate(r.lastUpdated, `costData[${i}].lastUpdated`) }
    } catch { return { ...stripId(r), lastUpdated: new Date() } }
  })
  const restockToAdd = (d.restockLogs ?? []).map((r, i) => {
    try { return { ...stripId(r), date: safeDate(r.date, `restockLogs[${i}].date`) }
    } catch { return { ...stripId(r), date: new Date() } }
  })
  const eventsToAdd = (d.storeEvents ?? []).map((r, i) => {
    const start = new Date(r.startDate as string)
    const end = new Date(r.endDate as string)
    if (isNaN(start.getTime())) throw new Error(`Invalid startDate in storeEvents[${i}]: ${r.startDate}`)
    if (isNaN(end.getTime())) throw new Error(`Invalid endDate in storeEvents[${i}]: ${r.endDate}`)
    return { ...stripId(r), startDate: start, endDate: end }
  })
  const bundlesToAdd = (d.productBundles ?? []).map(r => ({
    ...stripId(r),
    createdDate: r.createdDate ? new Date(r.createdDate as string) : new Date(),
  }))
  const movementsToAdd = (d.stockMovements ?? []).map(r => ({
    ...stripId(r),
    occurredAt: r.occurredAt ? new Date(r.occurredAt as string) : new Date(),
  }))
  const refundsToAdd = (d.refunds ?? []).map((r, i) => {
    try { return { ...stripId(r), createdAt: safeDate(r.createdAt, `refunds[${i}].createdAt`) }
    } catch { return { ...stripId(r), createdAt: new Date() } }
  })
  const shiftsToAdd = (d.shifts ?? []).map(r => ({
    ...stripId(r),
    startAt: r.startAt ? new Date(r.startAt as string) : new Date(),
    endAt: r.endAt ? new Date(r.endAt as string) : undefined,
  }))

  await db.transaction('rw', [
    db.salesTransactions, db.catalogueProducts, db.productCostData, db.categoryOverrides,
    db.opexEntries, db.restockLogs, db.storeEvents, db.productBundles, db.staffWages,
    db.refunds, db.shifts, db.stockMovements,
  ], async () => {
    await Promise.all([
      db.salesTransactions.clear(),
      db.catalogueProducts.clear(),
      db.productCostData.clear(),
      db.categoryOverrides.clear(),
      db.opexEntries.clear(),
      db.restockLogs.clear(),
      db.storeEvents.clear(),
      db.productBundles.clear(),
      db.staffWages.clear(),
      db.refunds.clear(),
      db.shifts.clear(),
      db.stockMovements.clear(),
    ])
    if (txToAdd.length) await db.salesTransactions.bulkPut(txToAdd as unknown as SalesTransaction[])
    if (catToAdd.length) await db.catalogueProducts.bulkPut(catToAdd as unknown as CatalogueProduct[])
    if (costToAdd.length) await db.productCostData.bulkAdd(costToAdd as unknown as ProductCostData[])
    if (overridesRaw.length) await db.categoryOverrides.bulkAdd(overridesRaw.map(stripId) as unknown as CategoryOverride[])
    if (d.opexEntries?.length) await db.opexEntries.bulkAdd(d.opexEntries.map(stripId) as unknown as OpexEntry[])
    if (restockToAdd.length) await db.restockLogs.bulkAdd(restockToAdd as unknown as RestockLog[])
    if (eventsToAdd.length) await db.storeEvents.bulkAdd(eventsToAdd as unknown as StoreEvent[])
    if (bundlesToAdd.length) await db.productBundles.bulkAdd(bundlesToAdd as unknown as ProductBundle[])
    if (d.staffWages?.length) await db.staffWages.bulkAdd(d.staffWages.map(stripId) as unknown as StaffWage[])
    if (refundsToAdd.length) await db.refunds.bulkAdd(refundsToAdd as unknown as StoredRefund[])
    if (shiftsToAdd.length) await db.shifts.bulkAdd(shiftsToAdd as unknown as StoredShift[])
    if (movementsToAdd.length) await db.stockMovements.bulkAdd(movementsToAdd as unknown as StockMovement[])
  })

  return { transactions: txRaw.length, catalogue: catRaw.length }
}

export async function getTransactionCount(): Promise<number> {
  return db.salesTransactions.count()
}
