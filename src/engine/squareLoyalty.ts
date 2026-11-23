import { db } from '../db/database'
import { useAuthStore } from '../store/authStore'
import {
  addCustomerToGroup, batchUpsertCatalog, createCustomerGroup, listCustomerGroups, removeCustomerFromGroup, searchCatalogByTypes,
  searchCustomersByEmail, searchCustomersInGroups, setCustomerReferenceId,
} from './squareAPIClient'
import type { SquareCustomerGroup } from './squareAPIClient'
import {
  LOYALTY_LEVEL_NAMES, LOYALTY_RULES, allLevels, computeStandings, isGiftCardLine, membersFromCustomers, planGroupChanges, resolveMemberCodes,
  toLoyaltyTx,
} from './loyaltyEngine'
import type { CodeWrite, GroupChange, LoyaltyResult } from './loyaltyEngine'

export type { GroupChange, GroupRef } from './loyaltyEngine'

export interface LoyaltySnapshot {
  result: LoyaltyResult
  groupNames: Record<string, string>
  changes: GroupChange[]
  codes: Record<string, string>
  codeWrites: CodeWrite[]
  codeProblems: string[]
}

export interface ApplyOutcome {
  applied: number
  failed: string[]
}

const DOMAIN_QUERY = LOYALTY_RULES.memberEmailDomain.replace('@', '')
const PRODUCT_SET_NAME = 'Loyalty all products'
const EXCLUDED_SET_NAME = 'Loyalty excluded gift cards'

let inFlight: Promise<unknown> | null = null

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  if (inFlight) return Promise.reject(new Error('A loyalty update is already running'))
  const run = task().finally(() => { inFlight = null })
  inFlight = run
  return run
}

function newKey(label: string): string {
  return `loyalty-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function loyaltyGroupIds(groups: SquareCustomerGroup[]): string[] {
  return groups.filter(g => LOYALTY_LEVEL_NAMES.has(g.name)).map(g => g.id)
}

function configuredGroupIds(ids: Record<string, string>): Record<string, string> {
  return Object.fromEntries(allLevels().filter(l => ids[`group:${l.name}`]).map(l => [l.name, ids[`group:${l.name}`]]))
}

function saveIds(ids: Record<string, string>): void {
  useAuthStore.getState().setCredentials({ loyaltySquareIds: Object.fromEntries(Object.entries(ids).filter(([, v]) => !!v)) })
}

function persistMemberCodes(before: Record<string, string>, codes: Record<string, string>): void {
  const state = useAuthStore.getState()
  if (state.loyaltyMemberCodes !== before) return
  if (Object.entries(codes).every(([email, code]) => before[email] === code)) return
  state.setCredentials({ loyaltyMemberCodes: { ...before, ...codes } })
}

function persistCardNumbers(before: Record<string, number>, computed: Record<string, number>): void {
  const state = useAuthStore.getState()
  if (!state.loyaltyBackfillDone) return
  if (state.loyaltyCardNumbers !== before) return
  if (Object.keys(computed).length === Object.keys(before).length) return
  state.setCredentials({ loyaltyCardNumbers: { ...before, ...computed } })
}

export async function loadLoyaltySnapshot(now = new Date()): Promise<LoyaltySnapshot> {
  const { accessToken, loyaltyCardNumbers, loyaltySquareIds, loyaltyMemberCodes } = useAuthStore.getState()
  const [customers, groups, rows] = await Promise.all([
    searchCustomersByEmail(accessToken, DOMAIN_QUERY),
    listCustomerGroups(accessToken),
    db.salesTransactions.toArray(),
  ])
  const inLoyaltyGroups = await searchCustomersInGroups(accessToken, loyaltyGroupIds(groups))
  const members = membersFromCustomers(customers)
  const result = computeStandings(rows.map(toLoyaltyTx), members, now, LOYALTY_RULES, loyaltyCardNumbers)
  persistCardNumbers(loyaltyCardNumbers, result.cardNumbers)
  const memberCodes = resolveMemberCodes(members, customers, loyaltyMemberCodes)
  persistMemberCodes(loyaltyMemberCodes, memberCodes.codes)
  const groupNames: Record<string, string> = Object.fromEntries(groups.map(g => [g.id, g.name]))
  const changes = planGroupChanges(result, [...customers, ...inLoyaltyGroups], groupNames, configuredGroupIds(loyaltySquareIds))
  return { result, groupNames, changes, codes: memberCodes.codes, codeWrites: memberCodes.writes, codeProblems: memberCodes.problems }
}

export async function ensureLoyaltySetup(): Promise<Record<string, string>> {
  const { accessToken, loyaltySquareIds } = useAuthStore.getState()
  const levels = allLevels()
  const ids: Record<string, string> = { ...loyaltySquareIds }
  if (ids['productSet'] && levels.every(l => ids[`group:${l.name}`] && ids[`rule:${l.name}`])) return ids

  const [groups, catalog, products] = await Promise.all([
    listCustomerGroups(accessToken),
    searchCatalogByTypes(accessToken, ['DISCOUNT', 'PRICING_RULE', 'PRODUCT_SET']),
    db.catalogueProducts.toArray(),
  ])
  const findCatalog = (type: string, name: string) => catalog.find(o => o.type === type && o.name === name)?.id ?? ''
  const giftCardItemIds = [...new Set(products
    .filter(p => p.squareParentItemID && isGiftCardLine(p.itemName || p.name, undefined))
    .map(p => p.squareParentItemID!))]

  ids['productSet'] = ids['productSet'] || findCatalog('PRODUCT_SET', PRODUCT_SET_NAME)
  ids['excludedSet'] = ids['excludedSet'] || findCatalog('PRODUCT_SET', EXCLUDED_SET_NAME)
  for (const l of levels) {
    ids[`group:${l.name}`] = ids[`group:${l.name}`] || groups.find(g => g.name === l.name)?.id || ''
    ids[`discount:${l.name}`] = ids[`discount:${l.name}`] || findCatalog('DISCOUNT', l.name)
    ids[`rule:${l.name}`] = ids[`rule:${l.name}`] || findCatalog('PRICING_RULE', l.name)
  }
  for (const l of levels) {
    if (!ids[`group:${l.name}`]) {
      ids[`group:${l.name}`] = (await createCustomerGroup(accessToken, l.name, newKey('group'))).id
      saveIds(ids)
    }
  }
  saveIds(ids)

  const objects: unknown[] = []
  if (!ids['productSet']) {
    objects.push({ type: 'PRODUCT_SET', id: '#loyalty-all-products', product_set_data: { name: PRODUCT_SET_NAME, all_products: true } })
  }
  if (!ids['excludedSet'] && giftCardItemIds.length) {
    objects.push({ type: 'PRODUCT_SET', id: '#loyalty-excluded', product_set_data: { name: EXCLUDED_SET_NAME, product_ids_any: giftCardItemIds } })
  }
  const excludedRef = ids['excludedSet'] || (giftCardItemIds.length ? '#loyalty-excluded' : '')
  const slugs: Record<string, string> = {}
  for (const l of levels) {
    if (ids[`rule:${l.name}`]) continue
    const slug = l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    slugs[l.name] = slug
    if (!ids[`discount:${l.name}`]) {
      objects.push({
        type: 'DISCOUNT', id: `#d-${slug}`,
        discount_data: { name: l.name, discount_type: 'FIXED_PERCENTAGE', percentage: `${l.pct}.0`, modify_tax_basis: 'MODIFY_TAX_BASIS' },
      })
    }
    objects.push({
      type: 'PRICING_RULE', id: `#r-${slug}`,
      pricing_rule_data: {
        name: l.name,
        discount_id: ids[`discount:${l.name}`] || `#d-${slug}`,
        match_products_id: ids['productSet'] || '#loyalty-all-products',
        customer_group_ids_any: [ids[`group:${l.name}`]],
        ...(excludedRef ? { exclude_products_id: excludedRef } : {}),
      },
    })
  }
  if (objects.length) {
    const { idMappings } = await batchUpsertCatalog(accessToken, objects, newKey('catalog'))
    const mapped = new Map(idMappings.map(m => [m.clientObjectId, m.objectId]))
    ids['productSet'] = ids['productSet'] || mapped.get('#loyalty-all-products') || ''
    ids['excludedSet'] = ids['excludedSet'] || mapped.get('#loyalty-excluded') || ''
    for (const [name, slug] of Object.entries(slugs)) {
      ids[`discount:${name}`] = ids[`discount:${name}`] || mapped.get(`#d-${slug}`) || ''
      ids[`rule:${name}`] = ids[`rule:${name}`] || mapped.get(`#r-${slug}`) || ''
    }
    saveIds(ids)
  }
  const missing = levels.filter(l => !ids[`group:${l.name}`] || !ids[`rule:${l.name}`]).map(l => l.name)
  if (!ids['productSet'] || missing.length) throw new Error(`Square setup incomplete: ${missing.join(', ') || 'product set'}`)
  return ids
}

export async function applyGroupChanges(changes: GroupChange[], ids: Record<string, string>, requireLive: boolean): Promise<ApplyOutcome> {
  const { accessToken } = useAuthStore.getState()
  let applied = 0
  const failed: string[] = []
  for (const c of changes) {
    if (requireLive && !useAuthStore.getState().loyaltyLive) {
      failed.push('stopped: switched to preview during the update')
      break
    }
    try {
      for (const g of c.remove) await removeCustomerFromGroup(accessToken, c.customerId, g.id)
      if (c.add) {
        const addId = ids[`group:${c.add}`]
        if (!addId) throw new Error(`no Square group for ${c.add}`)
        await addCustomerToGroup(accessToken, c.customerId, addId)
      }
      applied += 1
    } catch (err) {
      failed.push(`${c.email || c.customerId}: ${(err as Error).message}`)
    }
  }
  return { applied, failed }
}

export async function applyCodeWrites(writes: CodeWrite[]): Promise<ApplyOutcome> {
  const { accessToken } = useAuthStore.getState()
  let applied = 0
  const failed: string[] = []
  for (const w of writes) {
    if (!useAuthStore.getState().loyaltyLive) {
      failed.push('stopped: switched to preview during the update')
      break
    }
    try {
      await setCustomerReferenceId(accessToken, w.customerId, w.code, w.version)
      applied += 1
    } catch (err) {
      failed.push(`${w.email}: card code ${w.code}: ${(err as Error).message}`)
    }
  }
  return { applied, failed }
}

function recordOutcome(outcome: ApplyOutcome): ApplyOutcome {
  useAuthStore.getState().setCredentials(outcome.failed.length
    ? { loyaltyLastError: `${outcome.failed.length} Square update${outcome.failed.length > 1 ? 's' : ''} failed. First: ${outcome.failed[0]}` }
    : { loyaltyLastError: null, loyaltyLastApplied: new Date().toISOString() })
  return outcome
}

export function applyLoyaltyNow(): Promise<ApplyOutcome> {
  return exclusive(async () => {
    if (!useAuthStore.getState().loyaltyLive) throw new Error('Loyalty is in preview mode')
    const ids = await ensureLoyaltySetup()
    const snapshot = await loadLoyaltySnapshot()
    const groups = await applyGroupChanges(snapshot.changes, ids, true)
    const codes = await applyCodeWrites(snapshot.codeWrites)
    return recordOutcome({ applied: groups.applied + codes.applied, failed: [...groups.failed, ...codes.failed] })
  })
}

export async function runLoyaltyStep(): Promise<void> {
  const { loyaltyLive, loyaltyPausePending } = useAuthStore.getState()
  if ((!loyaltyLive && !loyaltyPausePending) || inFlight) return
  try {
    await (loyaltyPausePending ? pauseLoyalty() : applyLoyaltyNow())
  } catch (err) {
    useAuthStore.getState().setCredentials({ loyaltyLastError: `Loyalty update failed: ${(err as Error).message}` })
  }
}

export async function pauseLoyalty(): Promise<ApplyOutcome> {
  useAuthStore.getState().setCredentials({ loyaltyLive: false, loyaltyPausePending: true })
  if (inFlight) await inFlight.catch(() => undefined)
  return exclusive(async () => {
    const { accessToken, loyaltySquareIds, setCredentials } = useAuthStore.getState()
    const groups = await listCustomerGroups(accessToken)
    const inGroups = await searchCustomersInGroups(accessToken, loyaltyGroupIds(groups))
    const groupNames: Record<string, string> = Object.fromEntries(groups.map(g => [g.id, g.name]))
    const nobody: LoyaltyResult = { standings: [], countedWeeks: [], sharedCards: [], cardNumbers: {} }
    const changes = planGroupChanges(nobody, inGroups, groupNames)
    const outcome = recordOutcome(await applyGroupChanges(changes, loyaltySquareIds, false))
    if (outcome.failed.length === 0) setCredentials({ loyaltyPausePending: false })
    return outcome
  })
}
