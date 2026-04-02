import Papa from 'papaparse'
import type { SalesTransaction } from '../types/models'

function parseDateTime(value: string): Date | null {
  if (!value) return null
  // Try ISO format first
  const iso = new Date(value)
  if (!isNaN(iso.getTime())) return iso
  // Try "MM/DD/YYYY HH:MM:SS" style
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (match) {
    const [, m, d, y, h, min, sec] = match
    return new Date(+y, +m - 1, +d, +h, +min, +(sec ?? 0))
  }
  return null
}

function parseCurrency(value: string): number {
  if (!value) return 0
  const cleaned = value.replace(/[$,]/g, '').trim()
  return parseFloat(cleaned) || 0
}

function generateFallbackID(row: Record<string, string>, index: number): string {
  return `import-${index}-${Object.values(row).join('-').slice(0, 40)}`
}

export function parseCSVContent(content: string): Omit<SalesTransaction, 'id'>[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim(),
  })

  const rows = result.data
  const transactions: Omit<SalesTransaction, 'id'>[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Find columns by common Square export header names
    const dateStr = row['Date'] ?? row['Transaction Date'] ?? row['Created At'] ?? ''
    const netSalesStr = row['Net Sales'] ?? row['Net Amount'] ?? row['Total'] ?? row['Amount'] ?? ''
    const staff = row['Employee'] ?? row['Staff'] ?? row['Cashier'] ?? row['Team Member'] ?? ''
    const payment = row['Payment Method'] ?? row['Tender Type'] ?? row['Payment Type'] ?? ''
    const description = row['Item Name'] ?? row['Description'] ?? row['Items'] ?? row['Line Items'] ?? ''
    const txID = row['Transaction ID'] ?? row['Payment ID'] ?? row['Order ID'] ?? ''

    const date = parseDateTime(dateStr)
    if (!date) continue

    const netSales = parseCurrency(netSalesStr)

    transactions.push({
      transactionID: txID || generateFallbackID(row, i),
      date,
      netSales,
      staffName: staff.trim(),
      paymentMethod: payment.trim(),
      itemDescription: description.trim(),
      dayOfWeek: date.getDay() + 1,  // JS getDay() 0=Sun, +1 → 1=Sun…7=Sat
      hour: date.getHours(),
    })
  }

  return transactions
}
