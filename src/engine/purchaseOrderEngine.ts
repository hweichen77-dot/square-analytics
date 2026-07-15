import { differenceInDays } from 'date-fns'
import type { SalesTransaction, StoreEvent, RestockLog, CatalogueProduct } from '../types/models'
import { computeProductStats, trailingWeeklyVelocity } from './analyticsEngine'

const HIGH_DEMAND_EVENTS = ['Big Game', 'Holiday', 'Long Weekend', 'Payday', 'Local Event']

const LEAD_TIME_DAYS = 3

export interface PurchaseOrderItem {
  productName: string
  category: string
  avgDailyVelocity: number
  onHand: number | null
  recommendedQty: number
  estimatedRevenue: number
  avgPrice: number
  lastSoldDate: Date
  reasoning: string
}

function buildOnHandLookup(catalogue: CatalogueProduct[]): (name: string) => number | undefined {
  const byName: Record<string, number> = {}
  for (const p of catalogue) {
    if (p.quantity !== null) byName[p.name.toLowerCase().trim()] = p.quantity
  }
  return (name: string) => {
    const lower = name.toLowerCase().trim()
    if (byName[lower] !== undefined) return byName[lower]
    const base = lower.replace(/\s*\([^)]*\)\s*$/, '').trim()
    return byName[base]
  }
}

export function generatePurchaseOrder(
  transactions: SalesTransaction[],
  events: StoreEvent[],
  _restockLogs: RestockLog[],
  overrides: Record<string, string> = {},
  weeksAhead = 2,
  catalogueProducts: CatalogueProduct[] = [],
): PurchaseOrderItem[] {
  const reorderDays = weeksAhead * 7
  const stats = computeProductStats(transactions, overrides)
  const today = new Date()
  const lookupOnHand = buildOnHandLookup(catalogueProducts)

  const upcomingEvents = events.filter(e => {
    const daysUntil = differenceInDays(e.startDate, today)
    return daysUntil >= 0 && daysUntil <= 30
  })

  const items: PurchaseOrderItem[] = []

  for (const product of stats) {
    const weeklyVelocity = trailingWeeklyVelocity(product)
    const dailyVelocity = weeklyVelocity / 7
    if (dailyVelocity <= 0) continue

    let multiplier = 1.0

    if (upcomingEvents.length > 0) {
      const isHighDemandEvent = upcomingEvents.some(e => HIGH_DEMAND_EVENTS.includes(e.eventType))
      multiplier = isHighDemandEvent ? 1.5 : 1.2
    }

    const onHandQty = lookupOnHand(product.name)
    const onHand = onHandQty ?? null
    const targetStock = dailyVelocity * (reorderDays + LEAD_TIME_DAYS) * multiplier
    const recommendedQty = Math.max(0, Math.ceil(targetStock - (onHandQty ?? 0)))
    if (recommendedQty <= 0) continue
    const estimatedRevenue = recommendedQty * product.avgPrice

    let reasoning = `${weeklyVelocity.toFixed(1)} units/wk (last 8w)`
    if (onHand !== null) reasoning += ` · ${onHand} on hand`
    if (multiplier > 1) {
      reasoning += ` · ${Math.round((multiplier - 1) * 100)}% event boost`
    }

    items.push({
      productName: product.name,
      category: product.category,
      avgDailyVelocity: dailyVelocity,
      onHand,
      recommendedQty,
      estimatedRevenue,
      avgPrice: product.avgPrice,
      lastSoldDate: product.lastSoldDate,
      reasoning,
    })
  }

  return items.sort((a, b) => b.estimatedRevenue - a.estimatedRevenue)
}
