import { format } from 'date-fns'
import type { SalesTransaction } from '../types/models'

// Quotes a CSV field, escaping embedded quotes. Always quoting keeps the output
// safe regardless of commas, quotes, or newlines in product names / descriptions.
function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

// Total item quantity for a transaction. Uses Square line-item data when present
// (exact), otherwise falls back to summing parsed "Nx Item" prefixes, defaulting to 1.
function totalQty(tx: SalesTransaction): number {
  if (tx.lineItems && tx.lineItems.length > 0) {
    return tx.lineItems.reduce((s, li) => s + (li.qty || 0), 0)
  }
  const matches = tx.itemDescription.match(/(\d+)\s*[xX]\s+/g)
  if (matches && matches.length > 0) {
    return matches.reduce((s, m) => s + (parseInt(m, 10) || 0), 0)
  }
  return 1
}

/**
 * Builds a CSV string from the given transactions, one row per transaction.
 * Columns: Date, Staff, Item, Qty, Net Sales, Payment Type, Processing Fee.
 * Processing Fee is converted from cents to dollars; blank when unknown.
 */
export function buildTransactionCSV(transactions: SalesTransaction[]): string {
  const header = ['Date', 'Staff', 'Item', 'Qty', 'Net Sales', 'Payment Type', 'Processing Fee']
  const rows = transactions.map(tx => {
    const paymentType = tx.paymentSourceType || tx.paymentMethod || ''
    const fee = tx.processingFee != null ? (tx.processingFee / 100).toFixed(2) : ''
    return [
      format(tx.date, 'yyyy-MM-dd HH:mm'),
      tx.staffName || 'Unknown',
      tx.itemDescription || '',
      totalQty(tx),
      tx.netSales.toFixed(2),
      paymentType,
      fee,
    ]
  })
  return [header, ...rows]
    .map(r => r.map(csvCell).join(','))
    .join('\n')
}

/**
 * Builds the transaction CSV and triggers a browser download via an object URL.
 */
export function exportTransactionsToCSV(transactions: SalesTransaction[]): void {
  const csv = buildTransactionCSV(transactions)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `walleys-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
