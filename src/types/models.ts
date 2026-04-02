// Mirrors SwiftData @Model classes from Models.swift and FeatureModels.swift

export interface SalesTransaction {
  id?: number
  transactionID: string
  date: Date
  netSales: number
  staffName: string
  paymentMethod: string
  itemDescription: string   // "2 x Takis, 1 x Coke"
  dayOfWeek: number         // 1=Sun … 7=Sat  (matches Calendar.component(.weekday))
  hour: number              // 0–23
  customerID?: string
  customerName?: string
}

export interface CategoryOverride {
  id?: number
  productName: string
  category: string
}

export interface RestockLog {
  id?: number
  productName: string
  date: Date
  quantity: number
  notes: string
}

export interface ProductCostData {
  id?: number
  productName: string       // unique
  unitCost: number
  casePrice: number
  unitsPerCase: number
  lastUpdated: Date
}

export interface StoreEvent {
  id?: number
  name: string
  startDate: Date
  endDate: Date
  eventType: string
  notes: string
}

export interface ProductBundle {
  id?: number
  name: string
  productNames: string[]
  bundlePrice: number
  createdDate: Date
  notes: string
}

export interface CatalogueProduct {
  id?: number
  name: string
  sku: string
  price: number | null
  category: string
  taxable: boolean
  enabled: boolean
  quantity: number | null
  importedAt: Date
  squareItemID: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export interface ProductItem {
  name: string
  qty: number
}

/** Parse "2 x Takis, 1 x Coke" → [{name:"Takis",qty:2}, {name:"Coke",qty:1}] */
export function parseProductItems(description: string): ProductItem[] {
  if (!description.trim()) return []
  return description.split(',').flatMap(part => {
    const trimmed = part.trim()
    const match = trimmed.match(/^(\d+)\s*x\s+(.+)$/i)
    if (match) return [{ qty: parseInt(match[1], 10), name: match[2].trim() }]
    if (trimmed) return [{ qty: 1, name: trimmed }]
    return []
  })
}

/** Unique product names from itemDescription */
export function splitProducts(description: string): string[] {
  return parseProductItems(description).map(i => i.name)
}

export function effectiveUnitCost(cost: ProductCostData): number {
  if (cost.casePrice > 0 && cost.unitsPerCase > 0) {
    return cost.casePrice / cost.unitsPerCase
  }
  return cost.unitCost
}

export const EVENT_TYPES = [
  'Spirit Week', 'Homecoming', 'Finals', 'Back to School',
  'Holiday', 'Sports Game', 'Custom',
] as const

export function eventColor(type: string): string {
  const map: Record<string, string> = {
    'Spirit Week': 'purple',
    'Homecoming': 'orange',
    'Finals': 'red',
    'Back to School': 'blue',
    'Holiday': 'green',
    'Sports Game': 'teal',
  }
  return map[type] ?? 'gray'
}
