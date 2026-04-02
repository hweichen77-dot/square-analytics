import * as XLSX from 'xlsx'
import type { CatalogueProduct } from '../types/models'

interface ParsedRow {
  name: string
  sku: string
  price: number | null
  category: string
  taxable: boolean
  enabled: boolean
  quantity: number | null
  unitCost: number | null
}

function colIndex(header: string[]): (keywords: string[]) => number | null {
  return (keywords) => {
    // Exact match first
    for (const kw of keywords) {
      const idx = header.findIndex(h => h.toLowerCase().trim() === kw)
      if (idx !== -1) return idx
    }
    // Contains match
    for (const kw of keywords) {
      const idx = header.findIndex(h => h.toLowerCase().trim().includes(kw))
      if (idx !== -1) return idx
    }
    return null
  }
}

function parsePrice(value: unknown): number | null {
  if (value == null || value === '') return null
  const s = String(value).replace(/[$,]/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parseBool(value: unknown): boolean {
  const v = String(value ?? '').toLowerCase().trim()
  return v === 'y' || v === 'yes' || v === 'true' || v === '1'
}

function parseEnabledBool(value: unknown): boolean {
  const v = String(value ?? 'true').toLowerCase().trim()
  return v !== 'false' && v !== 'no' && v !== '0' && v !== 'disabled'
}

function parseQuantity(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = parseInt(String(value), 10)
  return isNaN(n) ? null : n
}

export function parseXLSXCatalogue(buffer: ArrayBuffer): Omit<CatalogueProduct, 'id'>[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][]
  if (rows.length < 2) return []

  // Find the header row (first non-empty row)
  const headerRowIdx = rows.findIndex(r => Array.isArray(r) && r.some(c => String(c).trim()))
  if (headerRowIdx === -1) return []

  const header = (rows[headerRowIdx] as unknown[]).map(c => String(c))
  const col = colIndex(header)

  const nameIdx    = col(['item name', 'name', 'product'])
  if (nameIdx === null) return []

  const skuIdx      = col(['sku', 'barcode', 'token'])
  const priceIdx    = col(['price', 'selling price'])
  const categoryIdx = col(['categories', 'category'])
  const taxIdx      = col(['tax'])
  const archivedIdx = col(['archived'])
  const enabledIdx  = archivedIdx === null ? col(['enabled', 'active', 'sellable']) : null
  const quantityIdx = col(['current quantity', 'quantity', 'stock', 'on hand'])
  const unitCostIdx = col(['default unit cost', 'unit cost', 'cost'])

  const results: Omit<CatalogueProduct, 'id'>[] = []

  for (const row of rows.slice(headerRowIdx + 1) as unknown[][]) {
    let name = String(row[nameIdx] ?? '').trim()
    if (name.startsWith('*')) name = name.slice(1).trim()
    if (!name) continue

    const enabled: boolean = archivedIdx !== null
      ? !parseBool(row[archivedIdx])
      : enabledIdx !== null
        ? parseEnabledBool(row[enabledIdx])
        : true

    const parsed: ParsedRow = {
      name,
      sku: skuIdx !== null ? String(row[skuIdx] ?? '').trim() : '',
      price: priceIdx !== null ? parsePrice(row[priceIdx]) : null,
      category: categoryIdx !== null ? String(row[categoryIdx] ?? '').trim() : '',
      taxable: taxIdx !== null ? parseBool(row[taxIdx]) : false,
      enabled,
      quantity: quantityIdx !== null ? parseQuantity(row[quantityIdx]) : null,
      unitCost: unitCostIdx !== null ? parsePrice(row[unitCostIdx]) : null,
    }

    results.push({
      name: parsed.name,
      sku: parsed.sku,
      price: parsed.price,
      category: parsed.category,
      taxable: parsed.taxable,
      enabled: parsed.enabled,
      quantity: parsed.quantity,
      importedAt: new Date(),
      squareItemID: '',
    })
  }

  return results
}
