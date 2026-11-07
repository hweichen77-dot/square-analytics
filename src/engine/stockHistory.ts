import type { SquareInventoryChange } from './squareAPIClient'
import type { RestockLog, StockMovement } from '../types/models'

const WINDOW_DAYS = 30
const OVERLAP_MS = 5 * 60 * 1000
const DAY_MS = 86_400_000

export function stockHistoryStart(syncedThrough: string | null, earliest: Date): Date {
  if (!syncedThrough) return earliest
  const resumed = new Date(new Date(syncedThrough).getTime() - OVERLAP_MS)
  return isNaN(resumed.getTime()) ? earliest : resumed
}

export function stockHistoryWindows(start: Date, end: Date): { begin: Date; end: Date }[] {
  const windows: { begin: Date; end: Date }[] = []
  for (let begin = start.getTime(); begin < end.getTime(); begin += WINDOW_DAYS * DAY_MS) {
    windows.push({ begin: new Date(begin), end: new Date(Math.min(begin + WINDOW_DAYS * DAY_MS, end.getTime())) })
  }
  return windows
}

export function changesToStockRecords(
  changes: SquareInventoryChange[],
  nameByVarId: Map<string, string>,
  employeeMap: Record<string, string>,
): { restocks: Omit<RestockLog, 'id'>[]; movements: Omit<StockMovement, 'id'>[] } {
  const restocks: Omit<RestockLog, 'id'>[] = []
  const movements: Omit<StockMovement, 'id'>[] = []
  for (const c of changes) {
    const productName = nameByVarId.get(c.catalogObjectId)
    const occurredAt = new Date(c.occurredAt)
    if (!productName || isNaN(occurredAt.getTime())) continue
    movements.push({
      changeId: c.id,
      productName,
      catalogObjectId: c.catalogObjectId,
      type: c.type,
      fromState: c.fromState,
      toState: c.toState,
      quantity: c.quantity,
      occurredAt,
      source: c.source,
      staffName: c.teamMemberId ? (employeeMap[c.teamMemberId] ?? '') : '',
    })
    const isReceiving = c.fromState == null || c.fromState === 'NONE'
    if (c.type === 'ADJUSTMENT' && c.quantity > 0 && c.toState === 'IN_STOCK' && isReceiving) {
      restocks.push({ productName, date: occurredAt, quantity: c.quantity, notes: 'Square inventory' })
    }
  }
  return { restocks, movements }
}
