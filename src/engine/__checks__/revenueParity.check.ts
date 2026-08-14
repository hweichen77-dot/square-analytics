import assert from 'node:assert/strict'
import { computeProductStats, computeCategoryRevenue } from '../analyticsEngine'
import type { SalesTransaction } from '../../types/models'

let seq = 0
function tx(over: Partial<SalesTransaction>): SalesTransaction {
  const date = over.date ?? new Date('2026-08-01T12:00:00')
  return {
    transactionID: `t${seq++}`,
    date,
    netSales: over.netSales ?? 0,
    staffName: 'Ann',
    paymentMethod: 'CARD',
    itemDescription: over.itemDescription ?? '',
    dayOfWeek: date.getDay() + 1,
    hour: date.getHours(),
    lineItems: over.lineItems,
  }
}

const dashboard = (t: SalesTransaction[]) => t.reduce((s, x) => s + x.netSales, 0)
const transactionsScreen = (t: SalesTransaction[]) =>
  computeProductStats(t, {}).reduce((s, p) => s + p.totalRevenue, 0)
const categoryChart = (t: SalesTransaction[]) =>
  computeCategoryRevenue(t, {}).reduce((s, c) => s + c.revenue, 0)

function reconciles(label: string, t: SalesTransaction[]) {
  const d = dashboard(t)
  const i = transactionsScreen(t)
  const c = categoryChart(t)
  console.log(`${label}\n  dashboard ${d.toFixed(2)}  transactions ${i.toFixed(2)}  categories ${c.toFixed(2)}`)
  assert.ok(Math.abs(d - i) < 0.005, `${label}: transactions screen off by ${(i - d).toFixed(2)}`)
  assert.ok(Math.abs(d - c) < 0.005, `${label}: category chart off by ${(c - d).toFixed(2)}`)
}

reconciles('plain sales', [
  tx({ netSales: 10, itemDescription: '1 x Coke' }),
  tx({ netSales: 20, itemDescription: '2 x Chips' }),
])

reconciles('refunded order', [
  tx({ netSales: 10, itemDescription: '1 x Coke' }),
  tx({ netSales: -15, itemDescription: '1 x Coke' }),
])

reconciles('same item on two line items', [
  tx({
    netSales: 8,
    itemDescription: '1 x Coke, 3 x Coke',
    lineItems: [
      { name: 'Coke', qty: 1, unitPrice: 2 },
      { name: 'Coke', qty: 3, unitPrice: 2 },
    ],
  }),
])

reconciles('same item twice, CSV import without line items', [
  tx({ netSales: 8, itemDescription: '1 x Coke, 3 x Coke' }),
])

reconciles('non-itemized sale', [tx({ netSales: 12, itemDescription: '' })])

reconciles('tip-only line the product table skips', [
  tx({ netSales: 5, itemDescription: '1 x Tip' }),
])

reconciles('tax and tips inflating net above line-item gross', [
  tx({
    netSales: 11.5,
    itemDescription: '1 x Coke, 1 x Chips',
    lineItems: [
      { name: 'Coke', qty: 1, unitPrice: 4 },
      { name: 'Chips', qty: 1, unitPrice: 6 },
    ],
  }),
])

{
  const t = [
    tx({ netSales: 8, itemDescription: '1 x Coke, 3 x Coke' }),
    tx({ netSales: -8, itemDescription: '1 x Coke' }),
  ]
  const coke = computeProductStats(t, {}).find(p => p.name === 'Coke')
  assert.equal(coke?.totalUnitsSold, 4, 'duplicate names must merge into one product row')
}

console.log('\nall three screens reconcile to the same total')
