import { subDays } from 'date-fns'
import { useAuthStore } from '../store/authStore'
import { refreshAccessToken } from './squareAuth'
import { fetchOrders, fetchCatalogue, fetchInventory, fetchInventoryChanges, fetchTeamMembers, fetchCustomersByIds, fetchPayments, fetchRefunds, fetchShifts, fetchVendors } from './squareAPIClient'
import type { SquareOrder, SquareCatalogItem } from './squareAPIClient'
import { upsertTransactions, upsertCatalogueProducts, upsertRefunds, upsertShifts, mergeSquareProductCosts, upsertRestockLogs, upsertStockMovements } from '../db/dbUtils'
import { db } from '../db/database'
import type { SalesTransaction, CatalogueProduct, TransactionLineItem, StockMovement } from '../types/models'
import { parseProductItems, splitItemVariation } from '../types/models'

export interface SyncStatus {
  phase: 'idle' | 'orders' | 'catalogue' | 'inventory' | 'done' | 'error'
  message: string
  ordersAdded: number
  productsAdded: number
}

let _syncInFlight: Promise<void> | null = null

export function isSyncInFlight(): boolean {
  return _syncInFlight !== null
}

function orderToTransaction(order: SquareOrder, employeeMap: Record<string, string> = {}): Omit<SalesTransaction, 'id'> | null {
  const rawDate = order.closed_at ?? order.created_at
  const date = new Date(rawDate)
  if (isNaN(date.getTime())) return null

  let amountCents: number
  if (order.net_amounts?.total_money?.amount != null) {
    amountCents = order.net_amounts.total_money.amount
  } else if (order.total_money?.amount != null) {
    const gross = order.total_money.amount
    const returned = order.return_amounts?.total_money?.amount ?? 0
    amountCents = gross - returned
  } else {
    amountCents = 0
  }
  const netSales = amountCents / 100

  const rawLineItems = order.line_items ?? []
  const lineItemPrices: TransactionLineItem[] = []
  const descParts: string[] = []

  for (const li of rawLineItems) {
    const qty = parseFloat(li.quantity) || 1
    const varName = (li.variation_name ?? '').trim()
    const isDefault = !varName || varName.toLowerCase() === 'regular'
    const fullName = isDefault ? li.name : `${li.name} (${varName})`
    descParts.push(`${qty} x ${fullName}`)

    const grossCents = li.gross_sales_money?.amount ?? li.base_price_money?.amount ?? null
    if (grossCents != null) {
      lineItemPrices.push({ name: fullName, qty, unitPrice: grossCents / qty / 100 })
    }
  }

  const description = descParts.join(', ')
  const payment = order.tenders?.[0]?.type ?? 'UNKNOWN'

  const tx: Omit<SalesTransaction, 'id'> = {
    transactionID: order.id,
    date,
    netSales,
    staffName: order.employee_id ? (employeeMap[order.employee_id] ?? order.employee_id) : '',
    paymentMethod: payment,
    customerID: order.customer_id ?? undefined,
    itemDescription: description,
    dayOfWeek: date.getDay() + 1,
    hour: date.getHours(),
    source: 'api',
  }
  if (lineItemPrices.length > 0) tx.lineItems = lineItemPrices
  return tx
}

function catalogueToProduct(
  item: SquareCatalogItem,
  categoryMap: Record<string, string>,
  vendorMap: Record<string, string>,
  unitMap: Record<string, string>,
): Omit<CatalogueProduct, 'id'>[] {
  const data = item.item_data
  if (!data?.name) return []
  const name = data.name.trim()
  if (!name) return []

  const variations = data.variations ?? []
  const category = data.category_id ? (categoryMap[data.category_id] ?? '') : ''
  const now = new Date()
  const common = {
    category,
    taxable: data.is_taxable ?? false,
    enabled: !(data.is_archived ?? false),
    quantity: null as number | null,
    importedAt: now,
    lastSyncedAt: now,
    description: data.description_plaintext ?? data.description ?? undefined,
    itemType: data.product_type ?? undefined,
    squareParentItemID: item.id,
  }

  if (variations.length === 0) {
    return [{ ...common, name, itemName: name, variationName: 'Regular', sku: '', price: null, squareItemID: '' }]
  }

  return variations.map(variation => {
    const varData = variation.item_variation_data
    const priceCents = varData?.price_money?.amount
    const costCents = varData?.default_unit_cost?.amount
    const variantLabel = varData?.name ?? 'Regular'
    const variationName = variantLabel.toLowerCase() === 'regular' || variations.length === 1
      ? 'Regular'
      : variantLabel
    const displayName = variationName !== 'Regular' ? `${name} (${variationName})` : name
    const { itemName } = splitItemVariation(displayName)
    const vendorInfo = varData?.item_variation_vendor_infos?.[0]?.item_variation_vendor_info_data
    const alertType = varData?.inventory_alert_type ?? 'NONE'
    return {
      ...common,
      name: displayName,
      itemName,
      variationName,
      sku: varData?.sku ?? '',
      gtin: varData?.upc ?? undefined,
      price: priceCents != null ? priceCents / 100 : null,
      unitCost: costCents != null ? costCents / 100 : undefined,
      vendorName: vendorInfo?.vendor_id ? vendorMap[vendorInfo.vendor_id] : undefined,
      vendorCode: vendorInfo?.sku ?? undefined,
      trackInventory: varData?.track_inventory ?? true,
      sellable: varData?.sellable ?? true,
      stockable: varData?.stockable ?? true,
      stockAlertEnabled: alertType === 'LOW_QUANTITY',
      stockAlertCount: varData?.inventory_alert_threshold ?? null,
      unitType: varData?.measurement_unit_id ? unitMap[varData.measurement_unit_id] : undefined,
      squareItemID: variation.id,
    }
  })
}

function measurementUnitLabel(item: SquareCatalogItem): string {
  const u = item.measurement_unit_data?.measurement_unit
  if (!u) return ''
  return u.custom_unit?.abbreviation
    ?? u.custom_unit?.name
    ?? u.weight_unit
    ?? u.volume_unit
    ?? u.length_unit
    ?? u.area_unit
    ?? u.generic_unit
    ?? u.time_unit
    ?? ''
}

function catalogueToCosts(item: SquareCatalogItem): Array<{ productName: string; unitCost: number; lastUpdated: Date }> {
  const data = item.item_data
  if (!data?.name) return []
  const name = data.name.trim()
  if (!name) return []
  const variations = data.variations ?? []
  const now = new Date()
  return variations.flatMap(variation => {
    const varData = variation.item_variation_data
    const costCents = varData?.default_unit_cost?.amount
    if (costCents == null) return []
    const variantLabel = varData?.name ?? 'Regular'
    const variationName = variantLabel.toLowerCase() === 'regular' || variations.length === 1 ? 'Regular' : variantLabel
    const displayName = variationName !== 'Regular' ? `${name} (${variationName})` : name
    return [{ productName: displayName, unitCost: costCents / 100, lastUpdated: now }]
  })
}

async function fetchCustomerNames(accessToken: string, ids: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  if (ids.length === 0) return map
  try {
    const customers = await fetchCustomersByIds(accessToken, ids)
    for (const c of customers) {
      const name = [c.given_name, c.family_name].filter(Boolean).join(' ')
      if (name) map[c.id] = name
    }
  } catch {
  }
  return map
}

async function backfillCustomerLinks(
  accessToken: string,
  locationID: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<void> {
  const payments = await fetchPayments(
    accessToken,
    locationID,
    windowStart.toISOString(),
    windowEnd.toISOString(),
  )
  const customerByOrderId = new Map(
    payments
      .filter(p => p.orderId && p.customerId)
      .map(p => [p.orderId!, p.customerId!]),
  )
  if (customerByOrderId.size === 0) return

  const stored = await db.salesTransactions
    .filter(t => !t.customerID && customerByOrderId.has(t.transactionID))
    .toArray()
  if (stored.length === 0) return

  const ids = [...new Set(stored.map(t => customerByOrderId.get(t.transactionID)!))]
  const names = await fetchCustomerNames(accessToken, ids)

  await db.transaction('rw', db.salesTransactions, async () => {
    for (const tx of stored) {
      const customerID = customerByOrderId.get(tx.transactionID)!
      await db.salesTransactions.update(tx.id!, {
        customerID,
        customerName: names[customerID] ?? tx.customerName,
      })
    }
  })
}

export async function runSquareSync(
  onStatus: (status: SyncStatus) => void,
): Promise<void> {
  if (_syncInFlight) {
    return _syncInFlight
  }
  _syncInFlight = _runSyncImpl(onStatus).finally(() => { _syncInFlight = null })
  return _syncInFlight
}

async function _runSyncImpl(
  onStatus: (status: SyncStatus) => void,
): Promise<void> {
  const { tokenExpiresAt } = useAuthStore.getState()
  if (tokenExpiresAt != null && tokenExpiresAt > 0 && tokenExpiresAt - Date.now() < 5 * 60 * 1000) {
    await refreshAccessToken()
  }

  const { accessToken, locationID, daysBack, lastSyncDate } = useAuthStore.getState()

  const employeeMap: Record<string, string> = {}
  try {
    const members = await fetchTeamMembers(accessToken)
    for (const m of members) {
      const name = m.display_name ?? [m.given_name, m.family_name].filter(Boolean).join(' ')
      if (name) employeeMap[m.id] = name
    }
  } catch {
  }

  onStatus({ phase: 'orders', message: 'Fetching orders...', ordersAdded: 0, productsAdded: 0 })

  const endDate = new Date()
  const daysBackStart = subDays(endDate, daysBack)
  const lastSyncMs = lastSyncDate ? new Date(new Date(lastSyncDate).getTime() - 5 * 60 * 1000) : null
  const startDate = lastSyncMs && lastSyncMs > daysBackStart ? lastSyncMs : daysBackStart
  const orders = await fetchOrders(accessToken, locationID, startDate, endDate)
  const txRows = orders.flatMap(o => {
    const tx = orderToTransaction(o, employeeMap)
    return tx ? [tx] : []
  })

  try {
    const payments = await fetchPayments(
      accessToken,
      locationID,
      startDate.toISOString(),
      endDate.toISOString(),
    )
    const paymentByOrderId = new Map(
      payments.filter(p => p.orderId).map(p => [p.orderId!, p]),
    )
    for (const tx of txRows) {
      const payment = paymentByOrderId.get(tx.transactionID)
      if (!payment) continue
      tx.paymentSourceType = payment.sourceType
      tx.processingFee = payment.processingFee?.[0]?.amountMoney?.amount ?? 0
      tx.cardBrand = payment.cardDetails?.card?.cardBrand
      tx.cardLastFour = payment.cardDetails?.card?.last4
      if (!tx.customerID && payment.customerId) {
        tx.customerID = payment.customerId
      }
      if (payment.teamMemberId) {
        tx.staffName = employeeMap[payment.teamMemberId] ?? payment.teamMemberId
      }
    }
  } catch {
  }

  const customerIDsToFetch = [...new Set(txRows.map(t => t.customerID).filter((id): id is string => !!id))]
  const customerMap = await fetchCustomerNames(accessToken, customerIDsToFetch)
  for (const tx of txRows) {
    if (tx.customerID && customerMap[tx.customerID]) {
      tx.customerName = customerMap[tx.customerID]
    }
  }

  try {
    const refunds = await fetchRefunds(
      accessToken,
      locationID,
      startDate.toISOString(),
      endDate.toISOString(),
    )
    await upsertRefunds(refunds.map(r => ({
      refundId: r.id,
      paymentId: r.paymentId,
      amount: r.amountMoney.amount,
      currency: r.amountMoney.currency,
      status: r.status,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      reason: r.reason,
    })))
  } catch {
  }

  try {
    const shifts = await fetchShifts(
      accessToken,
      locationID,
      startDate.toISOString(),
      endDate.toISOString(),
    )
    await upsertShifts(shifts.map(s => ({
      shiftId: s.id,
      teamMemberId: s.teamMemberId,
      staffName: s.teamMemberId ? (employeeMap[s.teamMemberId] ?? '') : '',
      startAt: new Date(s.startAt),
      endAt: s.endAt ? new Date(s.endAt) : undefined,
      locationId: s.locationId,
      hourlyWage: s.wage?.hourlyRate?.amount != null ? s.wage.hourlyRate.amount / 100 : undefined,
    })))
  } catch {
  }

  const ordersAdded = await upsertTransactions(txRows)

  if (!useAuthStore.getState().customerBackfillDone) {
    try {
      await backfillCustomerLinks(accessToken, locationID, daysBackStart, endDate)
      useAuthStore.getState().setCredentials({ customerBackfillDone: true })
    } catch {
    }
  }

  onStatus({ phase: 'catalogue', message: 'Fetching catalogue...', ordersAdded, productsAdded: 0 })
  const catObjects = await fetchCatalogue(accessToken)

  const categoryMap: Record<string, string> = {}
  const unitMap: Record<string, string> = {}
  for (const obj of catObjects) {
    if (obj.type === 'CATEGORY' && obj.category_data?.name) {
      categoryMap[obj.id] = obj.category_data.name
    }
    if (obj.type === 'MEASUREMENT_UNIT') {
      const label = measurementUnitLabel(obj)
      if (label) unitMap[obj.id] = label
    }
  }

  const vendorMap: Record<string, string> = {}
  try {
    for (const v of await fetchVendors(accessToken)) {
      if (v.name) vendorMap[v.id] = v.name
    }
  } catch {
  }

  const productItems = catObjects.filter(obj => obj.type === 'ITEM')
  const products = productItems.flatMap(item => catalogueToProduct(item, categoryMap, vendorMap, unitMap))
  await upsertCatalogueProducts(products)

  try {
    const costRows = productItems.flatMap(catalogueToCosts)
    await mergeSquareProductCosts(costRows)
  } catch {
  }

  onStatus({ phase: 'inventory', message: 'Fetching inventory...', ordersAdded, productsAdded: products.length })
  const invCounts = await fetchInventory(accessToken, locationID)
  const invMap = new Map(invCounts.map(c => [c.catalog_object_id, parseFloat(c.quantity)]))

  for (const product of products) {
    const qty = invMap.get(product.squareItemID)
    if (qty != null) product.quantity = qty
  }
  await upsertCatalogueProducts(products)

  try {
    const changes = await fetchInventoryChanges(accessToken, locationID, startDate.toISOString(), endDate.toISOString())
    const nameByVarId = new Map(products.map(p => [p.squareItemID, p.name]))

    const restocks = changes.flatMap(c => {
      if (c.type !== 'ADJUSTMENT') return []
      const isReceiving = c.fromState == null || c.fromState === 'NONE'
      if (!(c.quantity > 0) || c.toState !== 'IN_STOCK' || !isReceiving) return []
      const productName = nameByVarId.get(c.catalogObjectId)
      if (!productName) return []
      const date = new Date(c.occurredAt)
      if (isNaN(date.getTime())) return []
      return [{ productName, date, quantity: c.quantity, notes: 'Square inventory' }]
    })
    await upsertRestockLogs(restocks)

    const movements = changes.flatMap((c): Omit<StockMovement, 'id'>[] => {
      const productName = nameByVarId.get(c.catalogObjectId)
      if (!productName) return []
      const occurredAt = new Date(c.occurredAt)
      if (isNaN(occurredAt.getTime())) return []
      return [{
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
      }]
    })
    await upsertStockMovements(movements)
  } catch {
  }

  useAuthStore.getState().setCredentials({
    lastSyncDate: endDate.toISOString(),
    lastSyncCount: ordersAdded,
  })

  onStatus({ phase: 'done', message: 'Sync complete', ordersAdded, productsAdded: products.length })
}

export { parseProductItems }
