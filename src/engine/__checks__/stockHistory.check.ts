import assert from 'node:assert/strict'
import { changesToStockRecords, stockHistoryStart, stockHistoryWindows } from '../stockHistory'
import { fetchInventoryChanges } from '../squareAPIClient'

const earliest = new Date('2026-01-01T00:00:00Z')
assert.equal(stockHistoryStart(null, earliest), earliest)
assert.equal(stockHistoryStart('2026-06-01T00:05:00Z', earliest).toISOString(), '2026-06-01T00:00:00.000Z')
assert.equal(stockHistoryStart('garbage', earliest), earliest)

const windows = stockHistoryWindows(new Date('2026-01-01T00:00:00Z'), new Date('2026-03-15T00:00:00Z'))
assert.equal(windows.length, 3)
assert.equal(windows[0].end.getTime(), windows[1].begin.getTime())
assert.equal(windows[2].end.toISOString(), '2026-03-15T00:00:00.000Z')
assert.equal(stockHistoryWindows(earliest, earliest).length, 0)

const names = new Map([['v1', 'Ramen']])
const base = { catalogObjectId: 'v1', quantity: 5, occurredAt: '2026-02-01T10:00:00Z' }
const { restocks, movements } = changesToStockRecords([
  { ...base, id: 'received', type: 'ADJUSTMENT', fromState: 'NONE', toState: 'IN_STOCK', teamMemberId: 't1' },
  { ...base, id: 'sold', type: 'ADJUSTMENT', fromState: 'IN_STOCK', toState: 'SOLD' },
  { ...base, id: 'count', type: 'PHYSICAL_COUNT', toState: 'IN_STOCK' },
  { ...base, id: 'deleted', type: 'ADJUSTMENT', catalogObjectId: 'gone', fromState: 'NONE', toState: 'IN_STOCK' },
  { ...base, id: 'bad-date', type: 'ADJUSTMENT', occurredAt: 'nope', fromState: 'NONE', toState: 'IN_STOCK' },
], names, { t1: 'Sam' })
assert.deepEqual(movements.map(m => m.changeId), ['received', 'sold', 'count'])
assert.equal(movements[0].staffName, 'Sam')
assert.equal(restocks.length, 1)

Object.assign(globalThis, { window: {} })
const bodies: Record<string, unknown>[] = []
globalThis.fetch = (async (_url: string, init: RequestInit) => {
  bodies.push(JSON.parse(init.body as string))
  const page = bodies.length === 1
    ? { changes: [{ type: 'ADJUSTMENT', adjustment: { id: 'a', catalog_object_id: 'v1', quantity: '2', occurred_at: '2026-02-01T10:00:00Z', from_state: 'IN_STOCK', to_state: 'SOLD' } }], cursor: 'next' }
    : { changes: [{ type: 'PHYSICAL_COUNT', physical_count: { id: 'b', catalog_object_id: 'v1', quantity: '9', occurred_at: '2026-02-02T10:00:00Z', state: 'IN_STOCK' } }] }
  return new Response(JSON.stringify(page), { status: 200 })
}) as typeof fetch

const fetched = await fetchInventoryChanges('token', 'loc', '2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z')
assert.deepEqual(fetched.map(c => c.id), ['a', 'b'])
assert.equal(bodies[1].cursor, 'next')
assert.deepEqual(bodies[0].types, ['ADJUSTMENT', 'PHYSICAL_COUNT'])

console.log('stock history checks pass')
