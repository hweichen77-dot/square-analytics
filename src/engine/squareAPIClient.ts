const BASE = 'https://connect.squareup.com/v2'
const SQUARE_TIMEOUT_MS = 10_000
const MAX_RETRIES = 3

function isTauri(): boolean {
  return (window as any).__TAURI_INTERNALS__ !== undefined
}

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

async function squareFetch(
  url: string,
  options: RequestInit,
  attempt = 0,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SQUARE_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
  } catch (err) {
    clearTimeout(timer)
    if ((err as Error).name === 'AbortError') {
      throw new Error('Square API timed out after 10s')
    }
    throw err
  }

  if (res.status === 429 && attempt < MAX_RETRIES) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10)
    await sleep(retryAfter * 1000)
    return squareFetch(url, options, attempt + 1)
  }

  return res
}

async function squareRequest(
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<unknown> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    const text = await invoke<string>('proxy_square_api', {
      accessToken: token,
      method,
      url,
      body: body ? JSON.stringify(body) : null,
    })
    return JSON.parse(text)
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Square-Version': '2023-10-18',
  }
  const res = await squareFetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Square API error ${res.status}: ${text}`)
  }
  return res.json()
}

export interface SquareLocation {
  id: string
  name: string
  address?: { address_line_1?: string; locality?: string }
}

export interface SquareOrderLineItem {
  name: string
  quantity: string
  variation_name?: string
  base_price_money?: { amount: number; currency: string }
  gross_sales_money?: { amount: number; currency: string }
  total_discount_money?: { amount: number; currency: string }
  total_tax_money?: { amount: number; currency: string }
  item_type?: string
}

export interface SquareOrder {
  id: string
  created_at: string
  closed_at?: string
  tenders?: { type: string; amount_money?: { amount: number } }[]
  line_items?: SquareOrderLineItem[]
  net_amounts?: { total_money: { amount: number }; tax_money?: { amount: number }; tip_money?: { amount: number }; service_charge_money?: { amount: number } }
  returns?: { return_line_items?: { name?: string; item_type?: string; gross_return_money?: { amount: number }; total_discount_money?: { amount: number } }[] }[]
  total_money?: { amount: number }
  return_amounts?: { total_money: { amount: number } }
  total_tax_money?: { amount: number }
  total_tip_money?: { amount: number }
  employee_id?: string
  customer_id?: string
}

export interface SquareCatalogItem {
  id: string
  type: string
  item_data?: {
    name: string
    description?: string
    description_plaintext?: string
    product_type?: string
    variations?: {
      id: string
      item_variation_data?: {
        name: string
        price_money?: { amount: number; currency: string }
        default_unit_cost?: { amount: number; currency: string }
        sku?: string
        upc?: string
        item_id?: string
        track_inventory?: boolean
        sellable?: boolean
        stockable?: boolean
        inventory_alert_type?: string
        inventory_alert_threshold?: number
        measurement_unit_id?: string
        item_variation_vendor_infos?: {
          item_variation_vendor_info_data?: {
            vendor_id?: string
            sku?: string
            price_money?: { amount: number; currency: string }
          }
        }[]
      }
    }[]
    category_id?: string
    is_taxable?: boolean
    tax_ids?: string[]
    is_archived?: boolean
  }
  category_data?: {
    name: string
  }
  measurement_unit_data?: {
    measurement_unit?: {
      custom_unit?: { name?: string; abbreviation?: string }
      area_unit?: string
      length_unit?: string
      volume_unit?: string
      weight_unit?: string
      generic_unit?: string
      time_unit?: string
      type?: string
    }
  }
}

export interface SquareVendor {
  id: string
  name?: string
  account_number?: string
  status?: string
}

export async function fetchVendors(token: string): Promise<SquareVendor[]> {
  const vendors: SquareVendor[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = { limit: 100 }
    if (cursor) body.cursor = cursor

    const data = await squareRequest(token, 'POST', `${BASE}/vendors/search`, body) as {
      vendors?: SquareVendor[]
      cursor?: string
    }
    vendors.push(...(data.vendors ?? []))
    cursor = data.cursor
  } while (cursor)

  return vendors
}

export interface SquareInventoryCount {
  catalog_object_id: string
  quantity: string
  state?: string
}

export async function fetchLocations(token: string): Promise<SquareLocation[]> {
  const data = await squareRequest(token, 'GET', `${BASE}/locations`) as { locations?: SquareLocation[] }
  return data.locations ?? []
}

export async function fetchOrders(
  token: string,
  locationID: string,
  startDate: Date,
  endDate: Date,
): Promise<SquareOrder[]> {
  const orders: SquareOrder[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {
      location_ids: [locationID],
      query: {
        filter: {
          date_time_filter: {
            closed_at: {
              start_at: startDate.toISOString(),
              end_at: endDate.toISOString(),
            },
          },
          state_filter: { states: ['COMPLETED'] },
        },
        sort: { sort_field: 'CLOSED_AT', sort_order: 'ASC' },
      },
      limit: 500,
    }
    if (cursor) body.cursor = cursor

    const data = await squareRequest(token, 'POST', `${BASE}/orders/search`, body) as {
      orders?: SquareOrder[]
      cursor?: string
    }
    orders.push(...(data.orders ?? []))
    cursor = data.cursor
  } while (cursor)

  return orders
}

export async function fetchCatalogue(token: string): Promise<SquareCatalogItem[]> {
  const items: SquareCatalogItem[] = []
  let cursor: string | undefined

  do {
    const url = new URL(`${BASE}/catalog/list`)
    url.searchParams.set('types', 'ITEM,CATEGORY,MEASUREMENT_UNIT')
    if (cursor) url.searchParams.set('cursor', cursor)

    const data = await squareRequest(token, 'GET', url.toString()) as {
      objects?: SquareCatalogItem[]
      cursor?: string
    }
    items.push(...(data.objects ?? []))
    cursor = data.cursor
  } while (cursor)

  return items
}

export interface SquareTeamMember {
  id: string
  given_name?: string
  family_name?: string
  display_name?: string
}

export async function fetchTeamMembers(token: string): Promise<SquareTeamMember[]> {
  const byId = new Map<string, SquareTeamMember>()

  for (const status of ['ACTIVE', 'INACTIVE'] as const) {
    let cursor: string | undefined
    do {
      const body: Record<string, unknown> = {
        limit: 200,
        query: { filter: { status } },
      }
      if (cursor) body.cursor = cursor

      const data = await squareRequest(token, 'POST', `${BASE}/team-members/search`, body) as {
        team_members?: SquareTeamMember[]
        cursor?: string
      }
      for (const m of data.team_members ?? []) byId.set(m.id, m)
      cursor = data.cursor
    } while (cursor)
  }

  return [...byId.values()]
}

export interface SquareCustomer {
  id: string
  given_name?: string
  family_name?: string
  email_address?: string
  phone_number?: string
  group_ids?: string[]
  reference_id?: string
  version?: number
}

export async function fetchCustomersByIds(token: string, ids: string[]): Promise<SquareCustomer[]> {
  if (ids.length === 0) return []
  const customers: SquareCustomer[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const data = await squareRequest(token, 'POST', `${BASE}/customers/batch-retrieve`, { customer_ids: chunk }) as {
      responses?: { customer?: SquareCustomer; errors?: unknown[] }[]
    }
    for (const r of data.responses ?? []) {
      if (r.customer) customers.push(r.customer)
    }
  }
  return customers
}

export interface SquarePayment {
  id: string
  orderId?: string
  customerId?: string
  teamMemberId?: string
  amountMoney: { amount: number; currency: string }
  processingFee?: Array<{ amountMoney: { amount: number } }>
  status: string
  sourceType: string
  cardDetails?: { card?: { cardBrand?: string; last4?: string; fingerprint?: string } }
  createdAt: string
}

interface RawSquarePayment {
  id: string
  order_id?: string
  customer_id?: string
  team_member_id?: string
  amount_money?: { amount: number; currency: string }
  processing_fee?: Array<{ amount_money?: { amount: number } }>
  status?: string
  source_type?: string
  card_details?: { card?: { card_brand?: string; last_4?: string; fingerprint?: string } }
  created_at?: string
}

function mapPayment(p: RawSquarePayment): SquarePayment {
  return {
    id: p.id,
    orderId: p.order_id,
    customerId: p.customer_id,
    teamMemberId: p.team_member_id,
    amountMoney: p.amount_money ?? { amount: 0, currency: 'USD' },
    processingFee: (p.processing_fee ?? []).map(f => ({ amountMoney: { amount: f.amount_money?.amount ?? 0 } })),
    status: p.status ?? '',
    sourceType: p.source_type ?? '',
    cardDetails: p.card_details
      ? { card: { cardBrand: p.card_details.card?.card_brand, last4: p.card_details.card?.last_4, fingerprint: p.card_details.card?.fingerprint } }
      : undefined,
    createdAt: p.created_at ?? '',
  }
}

export async function fetchPayments(
  accessToken: string,
  locationId: string,
  beginTime: string,
  endTime: string,
): Promise<SquarePayment[]> {
  const payments: SquarePayment[] = []
  let cursor: string | undefined

  do {
    const url = new URL(`${BASE}/payments`)
    url.searchParams.set('location_id', locationId)
    url.searchParams.set('begin_time', beginTime)
    url.searchParams.set('end_time', endTime)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)

    const data = await squareRequest(accessToken, 'GET', url.toString()) as {
      payments?: RawSquarePayment[]
      cursor?: string
    }
    for (const p of data.payments ?? []) payments.push(mapPayment(p))
    cursor = data.cursor
  } while (cursor)

  return payments
}

export interface SquareRefund {
  id: string
  paymentId?: string
  amountMoney: { amount: number; currency: string }
  status: string
  createdAt: string
  reason?: string
}

export async function fetchRefunds(
  accessToken: string,
  locationId: string,
  beginTime: string,
  endTime: string,
): Promise<SquareRefund[]> {
  const refunds: SquareRefund[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {
      query: {
        filter: {
          location_ids: [locationId],
          created_at: { start_at: beginTime, end_at: endTime },
        },
      },
      limit: 100,
    }
    if (cursor) body.cursor = cursor

    const data = await squareRequest(accessToken, 'POST', `${BASE}/refunds/search`, body) as {
      refunds?: Array<{
        id: string
        payment_id?: string
        amount_money?: { amount: number; currency: string }
        status?: string
        created_at?: string
        reason?: string
      }>
      cursor?: string
    }
    for (const r of data.refunds ?? []) {
      refunds.push({
        id: r.id,
        paymentId: r.payment_id,
        amountMoney: r.amount_money ?? { amount: 0, currency: 'USD' },
        status: r.status ?? '',
        createdAt: r.created_at ?? '',
        reason: r.reason,
      })
    }
    cursor = data.cursor
  } while (cursor)

  return refunds
}

export interface SquareShift {
  id: string
  teamMemberId?: string
  startAt: string
  endAt?: string
  locationId?: string
  wage?: { hourlyRate?: { amount: number; currency: string }; title?: string }
}

export async function fetchShifts(
  accessToken: string,
  locationId: string,
  beginTime: string,
  endTime: string,
): Promise<SquareShift[]> {
  const shifts: SquareShift[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {
      query: {
        filter: {
          location_ids: [locationId],
          start: { start_at: beginTime, end_at: endTime },
        },
      },
      limit: 200,
    }
    if (cursor) body.cursor = cursor

    const data = await squareRequest(accessToken, 'POST', `${BASE}/labor/shifts/search`, body) as {
      shifts?: Array<{
        id: string
        team_member_id?: string
        employee_id?: string
        start_at?: string
        end_at?: string
        location_id?: string
        wage?: { hourly_rate?: { amount: number; currency: string }; title?: string }
      }>
      cursor?: string
    }
    for (const s of data.shifts ?? []) {
      shifts.push({
        id: s.id,
        teamMemberId: s.team_member_id ?? s.employee_id,
        startAt: s.start_at ?? '',
        endAt: s.end_at,
        locationId: s.location_id,
        wage: s.wage
          ? { hourlyRate: s.wage.hourly_rate, title: s.wage.title }
          : undefined,
      })
    }
    cursor = data.cursor
  } while (cursor)

  return shifts
}

export interface SquareInventoryChange {
  id: string
  type: 'ADJUSTMENT' | 'PHYSICAL_COUNT'
  catalogObjectId: string
  quantity: number
  fromState?: string
  toState?: string
  occurredAt: string
  source?: string
  teamMemberId?: string
}

interface RawInventoryDetail {
  id?: string
  catalog_object_id?: string
  from_state?: string
  to_state?: string
  state?: string
  quantity?: string
  occurred_at?: string
  created_at?: string
  source?: { name?: string; application_id?: string }
  team_member_id?: string
  employee_id?: string
}

export async function fetchInventoryChanges(
  token: string,
  locationID: string,
  beginTime: string,
  endTime: string,
): Promise<SquareInventoryChange[]> {
  const changes: SquareInventoryChange[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {
      location_ids: [locationID],
      types: ['ADJUSTMENT', 'PHYSICAL_COUNT'],
      updated_after: beginTime,
      updated_before: endTime,
      limit: 100,
    }
    if (cursor) body.cursor = cursor

    const data = await squareRequest(token, 'POST', `${BASE}/inventory/changes/batch-retrieve`, body) as {
      changes?: Array<{
        type?: string
        adjustment?: RawInventoryDetail
        physical_count?: RawInventoryDetail
      }>
      cursor?: string
    }

    for (const c of data.changes ?? []) {
      const type = c.type as SquareInventoryChange['type'] | undefined
      const detail = c.adjustment ?? c.physical_count
      if (!type || !detail?.catalog_object_id) continue
      const occurredAt = detail.occurred_at ?? detail.created_at ?? ''
      if (!occurredAt) continue
      changes.push({
        id: detail.id ?? `${detail.catalog_object_id}|${occurredAt}|${detail.quantity ?? '0'}`,
        type,
        catalogObjectId: detail.catalog_object_id,
        quantity: parseFloat(detail.quantity ?? '0') || 0,
        fromState: detail.from_state,
        toState: detail.to_state ?? detail.state,
        occurredAt,
        source: detail.source?.name,
        teamMemberId: detail.team_member_id ?? detail.employee_id,
      })
    }
    cursor = data.cursor
  } while (cursor)

  return changes
}

export async function fetchInventory(token: string, locationID: string): Promise<SquareInventoryCount[]> {
  const counts: SquareInventoryCount[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {
      location_ids: [locationID],
      states: ['IN_STOCK'],
      limit: 1000,
    }
    if (cursor) body.cursor = cursor

    const data = await squareRequest(token, 'POST', `${BASE}/inventory/counts/batch-retrieve`, body) as {
      counts?: SquareInventoryCount[]
      cursor?: string
    }
    counts.push(...(data.counts ?? []))
    cursor = data.cursor
  } while (cursor)

  return counts
}

export interface SquareTax {
  id: string
  name: string
  enabled: boolean
  percentage?: string
}

export async function fetchTaxes(token: string): Promise<SquareTax[]> {
  const seenIds = new Set<string>()
  const byContent = new Map<string, SquareTax>()
  let cursor: string | undefined
  do {
    const qs = new URLSearchParams({ types: 'TAX' })
    if (cursor) qs.set('cursor', cursor)
    const data = await squareRequest(token, 'GET', `${BASE}/catalog/list?${qs.toString()}`) as {
      objects?: { id: string; is_deleted?: boolean; tax_data?: { name?: string; enabled?: boolean; percentage?: string } }[]
      cursor?: string
    }
    for (const o of data.objects ?? []) {
      if (o.is_deleted) continue
      if (seenIds.has(o.id)) continue
      seenIds.add(o.id)
      const tax: SquareTax = {
        id: o.id,
        name: o.tax_data?.name ?? 'Tax',
        enabled: o.tax_data?.enabled ?? true,
        percentage: o.tax_data?.percentage,
      }
      const contentKey = `${tax.name}::${tax.percentage ?? ''}`
      const existing = byContent.get(contentKey)
      if (!existing || (!existing.enabled && tax.enabled)) byContent.set(contentKey, tax)
    }
    cursor = data.cursor
  } while (cursor)
  return [...byContent.values()]
}

export async function updateItemTaxes(
  token: string,
  itemIds: string[],
  taxesToEnable: string[],
  taxesToDisable: string[],
): Promise<void> {
  if (itemIds.length === 0) return
  await squareRequest(token, 'POST', `${BASE}/catalog/update-item-taxes`, {
    item_ids: itemIds,
    taxes_to_enable: taxesToEnable,
    taxes_to_disable: taxesToDisable,
  })
}

async function searchCustomers(token: string, filter: Record<string, unknown>): Promise<SquareCustomer[]> {
  const customers: SquareCustomer[] = []
  let cursor: string | undefined
  do {
    const data = await squareRequest(token, 'POST', `${BASE}/customers/search`, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
      query: { filter },
    }) as { customers?: SquareCustomer[]; cursor?: string }
    customers.push(...(data.customers ?? []))
    cursor = data.cursor
  } while (cursor)
  return customers
}

export function searchCustomersByEmail(token: string, fuzzyEmail: string): Promise<SquareCustomer[]> {
  return searchCustomers(token, { email_address: { fuzzy: fuzzyEmail } })
}

export interface SquareCustomerGroup {
  id: string
  name: string
}

export async function listCustomerGroups(token: string): Promise<SquareCustomerGroup[]> {
  const groups: SquareCustomerGroup[] = []
  let cursor: string | undefined
  do {
    const url = `${BASE}/customers/groups${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
    const data = await squareRequest(token, 'GET', url) as { groups?: SquareCustomerGroup[]; cursor?: string }
    groups.push(...(data.groups ?? []))
    cursor = data.cursor
  } while (cursor)
  return groups
}

export async function createCustomerGroup(token: string, name: string, idempotencyKey: string): Promise<SquareCustomerGroup> {
  const data = await squareRequest(token, 'POST', `${BASE}/customers/groups`, {
    idempotency_key: idempotencyKey,
    group: { name },
  }) as { group: SquareCustomerGroup }
  return data.group
}

export async function addCustomerToGroup(token: string, customerId: string, groupId: string): Promise<void> {
  await squareRequest(token, 'PUT', `${BASE}/customers/${encodeURIComponent(customerId)}/groups/${encodeURIComponent(groupId)}`)
}

export async function removeCustomerFromGroup(token: string, customerId: string, groupId: string): Promise<void> {
  await squareRequest(token, 'DELETE', `${BASE}/customers/${encodeURIComponent(customerId)}/groups/${encodeURIComponent(groupId)}`)
}

export async function setCustomerReferenceId(token: string, customerId: string, referenceId: string, version?: number): Promise<void> {
  await squareRequest(token, 'PUT', `${BASE}/customers/${encodeURIComponent(customerId)}`, {
    reference_id: referenceId,
    ...(version !== undefined ? { version } : {}),
  })
}

export interface CatalogUpsertResult {
  idMappings: { clientObjectId: string; objectId: string }[]
}

export async function batchUpsertCatalog(token: string, objects: unknown[], idempotencyKey: string): Promise<CatalogUpsertResult> {
  const data = await squareRequest(token, 'POST', `${BASE}/catalog/batch-upsert`, {
    idempotency_key: idempotencyKey,
    batches: [{ objects }],
  }) as { id_mappings?: { client_object_id: string; object_id: string }[] }
  return { idMappings: (data.id_mappings ?? []).map(m => ({ clientObjectId: m.client_object_id, objectId: m.object_id })) }
}

export interface SquareCatalogObjectSummary {
  id: string
  type: string
  name: string
}

export async function searchCatalogByTypes(token: string, objectTypes: string[]): Promise<SquareCatalogObjectSummary[]> {
  const out: SquareCatalogObjectSummary[] = []
  let cursor: string | undefined
  do {
    const data = await squareRequest(token, 'POST', `${BASE}/catalog/search`, {
      object_types: objectTypes,
      include_deleted_objects: false,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    }) as { objects?: { id: string; type: string; is_deleted?: boolean; discount_data?: { name?: string }; pricing_rule_data?: { name?: string }; product_set_data?: { name?: string }; item_data?: { name?: string } }[]; cursor?: string }
    for (const o of data.objects ?? []) {
      if (o.is_deleted) continue
      const name = o.discount_data?.name ?? o.pricing_rule_data?.name ?? o.product_set_data?.name ?? o.item_data?.name ?? ''
      out.push({ id: o.id, type: o.type, name })
    }
    cursor = data.cursor
  } while (cursor)
  return out
}

export async function searchCustomersInGroups(token: string, groupIds: string[]): Promise<SquareCustomer[]> {
  if (groupIds.length === 0) return []
  return searchCustomers(token, { group_ids: { any: groupIds } })
}
