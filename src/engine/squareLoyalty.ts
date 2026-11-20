import { db } from '../db/database'
import { useAuthStore } from '../store/authStore'
import {
  addCustomerToGroup, batchUpsertCatalog, createCustomerGroup, listCustomerGroups, removeCustomerFromGroup, searchCustomersByEmail,
} from './squareAPIClient'
import type { SquareCustomer } from './squareAPIClient'
import { LOYALTY_RULES, allLevels, computeStandings, membersFromCustomers, toLoyaltyTx } from './loyaltyEngine'
import type { LoyaltyResult } from './loyaltyEngine'

export interface GroupChange {
  customerId: string
  email: string
  name: string
  add: string | null
  remove: string[]
}

export interface LoyaltySnapshot {
  result: LoyaltyResult
  customers: SquareCustomer[]
  groupNames: Record<string, string>
  changes: GroupChange[]
}

const DOMAIN_QUERY = LOYALTY_RULES.memberEmailDomain.replace('@', '')

function newKey(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function loadLoyaltySnapshot(now = new Date()): Promise<LoyaltySnapshot> {
  const { accessToken } = useAuthStore.getState()
  const [customers, groups, rows] = await Promise.all([
    searchCustomersByEmail(accessToken, DOMAIN_QUERY),
    listCustomerGroups(accessToken),
    db.salesTransactions.toArray(),
  ])
  const members = membersFromCustomers(customers)
  const result = computeStandings(rows.map(toLoyaltyTx), members, now)
  const groupNames: Record<string, string> = Object.fromEntries(groups.map(g => [g.id, g.name]))
  return { result, customers, groupNames, changes: planGroupChanges(result, customers, groupNames) }
}

export function planGroupChanges(result: LoyaltyResult, customers: SquareCustomer[], groupNames: Record<string, string>): GroupChange[] {
  const levelNames = new Set(allLevels().map(l => l.name))
  const byId = new Map(customers.map(c => [c.id, c]))
  const changes: GroupChange[] = []
  for (const s of result.standings) {
    for (const id of s.customerIds) {
      const current = (byId.get(id)?.group_ids ?? []).map(g => groupNames[g]).filter((n): n is string => !!n && levelNames.has(n))
      const add = s.level && !current.includes(s.level) ? s.level : null
      const remove = current.filter(n => n !== s.level)
      if (add || remove.length) changes.push({ customerId: id, email: s.email, name: s.name, add, remove })
    }
  }
  return changes
}

export async function ensureLoyaltySetup(): Promise<Record<string, string>> {
  const { accessToken, loyaltySquareIds, setCredentials } = useAuthStore.getState()
  const levels = allLevels()
  const ids: Record<string, string> = { ...loyaltySquareIds }
  if (levels.every(l => ids[`group:${l.name}`] && ids[`rule:${l.name}`])) return ids

  const existing = await listCustomerGroups(accessToken)
  for (const l of levels) {
    const key = `group:${l.name}`
    if (ids[key]) continue
    const found = existing.find(g => g.name === l.name)
    ids[key] = found ? found.id : (await createCustomerGroup(accessToken, l.name, newKey('loyalty-group'))).id
  }

  const objects: unknown[] = []
  if (!ids['productSet']) {
    objects.push({ type: 'PRODUCT_SET', id: '#loyalty-all-products', product_set_data: { name: 'Loyalty all products', all_products: true } })
  }
  for (const l of levels) {
    if (ids[`rule:${l.name}`]) continue
    const slug = l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    objects.push({
      type: 'DISCOUNT', id: `#d-${slug}`,
      discount_data: { name: l.name, discount_type: 'FIXED_PERCENTAGE', percentage: `${l.pct}.0`, modify_tax_basis: 'MODIFY_TAX_BASIS' },
    })
    objects.push({
      type: 'PRICING_RULE', id: `#r-${slug}`,
      pricing_rule_data: {
        name: l.name,
        discount_id: `#d-${slug}`,
        match_products_id: ids['productSet'] ?? '#loyalty-all-products',
        customer_group_ids_any: [ids[`group:${l.name}`]],
      },
    })
  }
  if (objects.length) {
    const { idMappings } = await batchUpsertCatalog(accessToken, objects, newKey('loyalty-catalog'))
    const mapped = new Map(idMappings.map(m => [m.clientObjectId, m.objectId]))
    if (mapped.get('#loyalty-all-products')) ids['productSet'] = mapped.get('#loyalty-all-products')!
    for (const l of levels) {
      const slug = l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      if (mapped.get(`#d-${slug}`)) ids[`discount:${l.name}`] = mapped.get(`#d-${slug}`)!
      if (mapped.get(`#r-${slug}`)) ids[`rule:${l.name}`] = mapped.get(`#r-${slug}`)!
    }
  }
  setCredentials({ loyaltySquareIds: ids })
  return ids
}

export async function applyGroupChanges(changes: GroupChange[], ids: Record<string, string>): Promise<{ applied: number; failed: string[] }> {
  const { accessToken } = useAuthStore.getState()
  let applied = 0
  const failed: string[] = []
  for (const c of changes) {
    try {
      for (const name of c.remove) {
        const groupId = ids[`group:${name}`]
        if (groupId) await removeCustomerFromGroup(accessToken, c.customerId, groupId)
      }
      if (c.add) await addCustomerToGroup(accessToken, c.customerId, ids[`group:${c.add}`])
      applied += 1
    } catch (err) {
      failed.push(`${c.email}: ${(err as Error).message}`)
    }
  }
  return { applied, failed }
}

export async function runLoyaltyStep(): Promise<void> {
  if (!useAuthStore.getState().loyaltyLive) return
  const ids = await ensureLoyaltySetup()
  const snapshot = await loadLoyaltySnapshot()
  await applyGroupChanges(snapshot.changes, ids)
  useAuthStore.getState().setCredentials({ loyaltyLastApplied: new Date().toISOString() })
}
