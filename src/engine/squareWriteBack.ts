import { updateItemTaxes } from './squareAPIClient'
import { db } from '../db/database'
import type { CatalogueProduct } from '../types/models'

const MAX_ITEMS_PER_CALL = 1000

export interface TaxabilityPushPlan {
  enable: { itemId: string; itemName: string }[]
  disable: { itemId: string; itemName: string }[]
  skipped: { itemName: string; reason: string }[]
}

export interface TaxabilityPushResult {
  itemsEnabled: number
  itemsDisabled: number
  productsUpdated: number
  skipped: { itemName: string; reason: string }[]
}

export class SquareWriteScopeError extends Error {
  constructor() {
    super('Square has not granted this app permission to edit your catalogue. Reconnect to Square from the Square Sync tab, then push again.')
    this.name = 'SquareWriteScopeError'
  }
}

function isInsufficientScope(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /Square API error 40[13]/.test(msg) && /INSUFFICIENT_SCOPES|FORBIDDEN|UNAUTHORIZED/i.test(msg)
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function buildTaxabilityPushPlan(products: CatalogueProduct[]): Promise<TaxabilityPushPlan> {
  const plan: TaxabilityPushPlan = { enable: [], disable: [], skipped: [] }

  const targets = new Map<string, CatalogueProduct[]>()
  for (const p of products) {
    const itemId = p.squareParentItemID
    if (!itemId) {
      plan.skipped.push({ itemName: p.name, reason: 'Not linked to a Square item. Sync from Square first.' })
      continue
    }
    const group = targets.get(itemId)
    if (group) group.push(p)
    else targets.set(itemId, [p])
  }
  if (targets.size === 0) return plan

  const all = await db.catalogueProducts.toArray()
  const families = new Map<string, CatalogueProduct[]>()
  for (const p of all) {
    if (!p.enabled || !p.squareParentItemID || !targets.has(p.squareParentItemID)) continue
    const family = families.get(p.squareParentItemID)
    if (family) family.push(p)
    else families.set(p.squareParentItemID, [p])
  }

  for (const [itemId, group] of targets) {
    const desired = group[0].taxable
    const override = new Map(group.map(p => [p.id, p.taxable]))
    const family = families.get(itemId) ?? group
    const resolved = family.map(p => (override.has(p.id) ? override.get(p.id)! : p.taxable))
    const itemName = group[0].itemName || group[0].name

    if (resolved.some(t => t !== desired)) {
      plan.skipped.push({
        itemName,
        reason: 'Variations of this item disagree on taxability. Square applies tax per item, so make them match first.',
      })
      continue
    }

    if (desired) plan.enable.push({ itemId, itemName })
    else plan.disable.push({ itemId, itemName })
  }

  return plan
}

export async function pushTaxabilityToSquare(
  token: string,
  products: CatalogueProduct[],
  taxIds: string[],
): Promise<TaxabilityPushResult> {
  if (taxIds.length === 0) {
    throw new Error('No sales tax selected. Choose which tax applies to taxable items on the Square Sync tab first.')
  }

  const plan = await buildTaxabilityPushPlan(products)
  const enableIds = plan.enable.map(e => e.itemId)
  const disableIds = plan.disable.map(d => d.itemId)

  try {
    for (const batch of chunk(enableIds, MAX_ITEMS_PER_CALL)) {
      await updateItemTaxes(token, batch, taxIds, [])
    }
    for (const batch of chunk(disableIds, MAX_ITEMS_PER_CALL)) {
      await updateItemTaxes(token, batch, [], taxIds)
    }
  } catch (e) {
    if (isInsufficientScope(e)) throw new SquareWriteScopeError()
    throw e
  }

  const pushed = new Map<string, boolean>()
  for (const id of enableIds) pushed.set(id, true)
  for (const id of disableIds) pushed.set(id, false)

  let productsUpdated = 0
  await db.transaction('rw', db.catalogueProducts, async () => {
    const all = await db.catalogueProducts.toArray()
    for (const p of all) {
      const taxable = p.squareParentItemID ? pushed.get(p.squareParentItemID) : undefined
      if (taxable === undefined || p.taxable === taxable) continue
      await db.catalogueProducts.update(p.id!, { taxable })
      productsUpdated++
    }
  })

  return {
    itemsEnabled: enableIds.length,
    itemsDisabled: disableIds.length,
    productsUpdated,
    skipped: plan.skipped,
  }
}
