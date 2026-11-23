import type { SalesTransaction } from '../types/models'
import type { SquareCustomer, SquareOrder } from './squareAPIClient'

export type Tier = 'Bronze' | 'Silver' | 'Gold'

export const LOYALTY_RULES = {
  bronze: { weekly: 12, weeks: 4 },
  silver: { weekly: 15, weeks: 8 },
  gold: { weekly: 15, weeks: 13 },
  steps: {
    Bronze: { base: 2, max: 5 },
    Silver: { base: 6, max: 8 },
    Gold: { base: 10, max: 10 },
  } as Record<Tier, { base: number; max: number }>,
  stepEveryWeeks: 2,
  memberEmailDomain: '@warriorlife.net',
}

export type LoyaltyRules = typeof LOYALTY_RULES

export interface LoyaltyMember {
  email: string
  name: string
  customerIds: string[]
}

export interface LoyaltyTx {
  date: Date
  amount: number
  customerID?: string
  cardFingerprint?: string
}

export interface Promotion {
  tier: Tier
  weekStart: string
  number: number
}

export interface TierProgress {
  nextTier: Tier
  weeksLeft: number
  averageNeeded: number
  averageNow: number
}

export interface MemberStanding {
  email: string
  name: string
  customerIds: string[]
  cards: string[]
  tier: Tier | null
  weeksInTier: number
  discountPct: number
  level: string | null
  weeksToNextStep: number | null
  promotions: Promotion[]
  totalSpend: number
  averageLast4: number
  progress: TierProgress | null
}

export interface LoyaltyResult {
  standings: MemberStanding[]
  countedWeeks: string[]
  sharedCards: { fingerprint: string; owner: string; alsoUsedBy: string[] }[]
  cardNumbers: Record<string, number>
}

export function weekStartOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return d
}

function weekKey(date: Date): string {
  const d = weekStartOf(date)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function levelName(tier: Tier, pct: number): string {
  return `Loyalty ${tier} ${pct}%`
}

export function allLevels(rules: LoyaltyRules = LOYALTY_RULES): { tier: Tier; pct: number; name: string }[] {
  const out: { tier: Tier; pct: number; name: string }[] = []
  for (const tier of ['Bronze', 'Silver', 'Gold'] as Tier[]) {
    const { base, max } = rules.steps[tier]
    for (let pct = base; pct <= max; pct++) out.push({ tier, pct, name: levelName(tier, pct) })
  }
  return out
}

export function qualifyingAmount(tx: SalesTransaction): number {
  if (tx.loyaltySpend !== undefined) return tx.loyaltySpend
  const giftCards = (tx.lineItems ?? [])
    .filter(li => isGiftCardLine(li.name, undefined))
    .reduce((sum, li) => sum + li.unitPrice * li.qty, 0)
  return tx.netSales - giftCards
}

export function toLoyaltyTx(tx: SalesTransaction): LoyaltyTx {
  return { date: new Date(tx.date), amount: qualifyingAmount(tx), customerID: tx.customerID, cardFingerprint: tx.cardFingerprint }
}

export function membersFromCustomers(customers: { id: string; email_address?: string; given_name?: string; family_name?: string }[],
  rules: LoyaltyRules = LOYALTY_RULES): LoyaltyMember[] {
  const byEmail = new Map<string, LoyaltyMember>()
  for (const c of customers) {
    const email = (c.email_address ?? '').trim().toLowerCase()
    if (!email.endsWith(rules.memberEmailDomain)) continue
    const name = customerDisplayName(c)
    const m = byEmail.get(email) ?? { email, name, customerIds: [] }
    if (!m.name && name) m.name = name
    if (!m.customerIds.includes(c.id)) m.customerIds.push(c.id)
    byEmail.set(email, m)
  }
  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email))
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function computeStandings(txs: LoyaltyTx[], members: LoyaltyMember[], now: Date,
  rules: LoyaltyRules = LOYALTY_RULES, fixedNumbers: Record<string, number> = {}): LoyaltyResult {
  const sorted = [...txs].sort((a, b) => a.date.getTime() - b.date.getTime())
  const currentWeek = weekKey(now)
  const countedWeeks = [...new Set(sorted.map(t => weekKey(t.date)))].filter(w => w < currentWeek).sort()

  const ownerOfProfile = new Map<string, string>()
  for (const m of members) for (const id of m.customerIds) ownerOfProfile.set(id, m.email)

  const cardOwner = new Map<string, string>()
  const cardOthers = new Map<string, Set<string>>()
  for (const tx of sorted) {
    if (!tx.cardFingerprint || !tx.customerID) continue
    const email = ownerOfProfile.get(tx.customerID)
    if (!email) continue
    const owner = cardOwner.get(tx.cardFingerprint)
    if (!owner) cardOwner.set(tx.cardFingerprint, email)
    else if (owner !== email) {
      const others = cardOthers.get(tx.cardFingerprint) ?? new Set<string>()
      others.add(email)
      cardOthers.set(tx.cardFingerprint, others)
    }
  }

  const weekly = new Map<string, Map<string, number>>()
  const totals = new Map<string, number>()
  for (const tx of sorted) {
    const email = (tx.customerID && ownerOfProfile.get(tx.customerID)) || (tx.cardFingerprint && cardOwner.get(tx.cardFingerprint))
    if (!email) continue
    const wk = weekKey(tx.date)
    const byWeek = weekly.get(email) ?? new Map<string, number>()
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + tx.amount)
    weekly.set(email, byWeek)
    totals.set(email, (totals.get(email) ?? 0) + tx.amount)
  }

  const raw = members.map(m => {
    const byWeek = weekly.get(m.email) ?? new Map<string, number>()
    const history: number[] = []
    let tier: Tier | null = null
    let inTier = 0
    const promotions: { tier: Tier; weekStart: string }[] = []
    const window = (n: number) => sum(history.slice(-n))
    for (const wk of countedWeeks) {
      history.push(byWeek.get(wk) ?? 0)
      if (tier) inTier += 1
      if (!tier && history.length >= rules.bronze.weeks && window(rules.bronze.weeks) >= rules.bronze.weekly * rules.bronze.weeks) {
        tier = 'Bronze'; inTier = 0; promotions.push({ tier, weekStart: wk })
      } else if (tier === 'Bronze' && inTier >= rules.silver.weeks && window(rules.silver.weeks) >= rules.silver.weekly * rules.silver.weeks) {
        tier = 'Silver'; inTier = 0; promotions.push({ tier, weekStart: wk })
      } else if (tier === 'Silver' && inTier >= rules.gold.weeks && window(rules.gold.weeks) >= rules.gold.weekly * rules.gold.weeks) {
        tier = 'Gold'; inTier = 0; promotions.push({ tier, weekStart: wk })
      }
    }
    const steps = tier ? rules.steps[tier] : null
    const pct = steps ? Math.min(steps.base + Math.floor(inTier / rules.stepEveryWeeks), steps.max) : 0
    const weeksToNextStep = steps && pct < steps.max ? rules.stepEveryWeeks - (inTier % rules.stepEveryWeeks) : null
    const avg = (n: number) => (history.length ? window(n) / n : 0)
    let progress: TierProgress | null = null
    if (!tier) progress = { nextTier: 'Bronze', weeksLeft: 0, averageNeeded: rules.bronze.weekly, averageNow: avg(rules.bronze.weeks) }
    else if (tier === 'Bronze') progress = { nextTier: 'Silver', weeksLeft: Math.max(0, rules.silver.weeks - inTier), averageNeeded: rules.silver.weekly, averageNow: avg(rules.silver.weeks) }
    else if (tier === 'Silver') progress = { nextTier: 'Gold', weeksLeft: Math.max(0, rules.gold.weeks - inTier), averageNeeded: rules.gold.weekly, averageNow: avg(rules.gold.weeks) }
    return {
      member: m, tier, inTier, pct, weeksToNextStep, promotions, progress,
      cards: [...cardOwner.entries()].filter(([, e]) => e === m.email).map(([f]) => f),
      total: totals.get(m.email) ?? 0, avg4: avg(4),
    }
  })

  const numbers = new Map<string, number>(Object.entries(fixedNumbers))
  for (const tier of ['Bronze', 'Silver', 'Gold'] as Tier[]) {
    let next = Math.max(0, ...[...numbers.entries()].filter(([k]) => k.startsWith(`${tier}|`)).map(([, n]) => n)) + 1
    const reached = raw
      .flatMap(r => r.promotions.filter(p => p.tier === tier).map(p => ({ email: r.member.email, weekStart: p.weekStart })))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.email.localeCompare(b.email))
    for (const r of reached) {
      const key = cardNumberKey(tier, r.email)
      if (!numbers.has(key)) numbers.set(key, next++)
    }
  }

  const standings: MemberStanding[] = raw.map(r => ({
    email: r.member.email,
    name: r.member.name,
    customerIds: r.member.customerIds,
    cards: r.cards,
    tier: r.tier,
    weeksInTier: r.inTier,
    discountPct: r.pct,
    level: r.tier ? levelName(r.tier, r.pct) : null,
    weeksToNextStep: r.weeksToNextStep,
    promotions: r.promotions.map(p => ({ ...p, number: numbers.get(cardNumberKey(p.tier, r.member.email))! })),
    totalSpend: r.total,
    averageLast4: r.avg4,
    progress: r.progress,
  }))

  const sharedCards = [...cardOthers.entries()].map(([fingerprint, others]) => ({
    fingerprint, owner: cardOwner.get(fingerprint)!, alsoUsedBy: [...others],
  }))
  return { standings, countedWeeks, sharedCards, cardNumbers: Object.fromEntries(numbers) }
}

export function cardNumberKey(tier: Tier, email: string): string {
  return `${tier}|${email}`
}

export function weekDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isGiftCardLine(name: string | undefined, itemType: string | undefined): boolean {
  return itemType === 'GIFT_CARD' || /gift\s*card/i.test(name ?? '')
}

export function customerDisplayName(c: { given_name?: string; family_name?: string }): string {
  return [c.given_name, c.family_name].filter(Boolean).join(' ')
}

export const LOYALTY_LEVEL_NAMES: ReadonlySet<string> = new Set(allLevels().map(l => l.name))

export function orderLoyaltySpend(order: SquareOrder): number {
  const net = order.net_amounts
  const total = net ? net.total_money.amount : (order.total_money?.amount ?? 0) - (order.return_amounts?.total_money?.amount ?? 0)
  const tax = net ? (net.tax_money?.amount ?? 0) : (order.total_tax_money?.amount ?? 0)
  const tip = net ? (net.tip_money?.amount ?? 0) : (order.total_tip_money?.amount ?? 0)
  const service = net?.service_charge_money?.amount ?? 0
  const soldGiftCards = (order.line_items ?? [])
    .filter(li => isGiftCardLine(li.name, li.item_type))
    .reduce((sum, li) => sum + (li.gross_sales_money?.amount ?? 0) - (li.total_discount_money?.amount ?? 0), 0)
  const returnedGiftCards = (order.returns ?? [])
    .flatMap(r => r.return_line_items ?? [])
    .filter(li => isGiftCardLine(li.name, li.item_type))
    .reduce((sum, li) => sum + (li.gross_return_money?.amount ?? 0) - (li.total_discount_money?.amount ?? 0), 0)
  return (total - tax - tip - service - (soldGiftCards - returnedGiftCards)) / 100
}

export interface GroupRef {
  id: string
  name: string
}

export interface GroupChange {
  customerId: string
  email: string
  name: string
  add: string | null
  remove: GroupRef[]
}

export function planGroupChanges(result: LoyaltyResult, customers: SquareCustomer[], groupNames: Record<string, string>,
  configuredGroupIds: Record<string, string> = {}): GroupChange[] {
  const byId = new Map(customers.map(c => [c.id, c]))
  const loyaltyGroupsOf = (id: string): GroupRef[] =>
    (byId.get(id)?.group_ids ?? []).filter(g => LOYALTY_LEVEL_NAMES.has(groupNames[g] ?? '')).map(g => ({ id: g, name: groupNames[g] }))
  const changes: GroupChange[] = []
  const memberIds = new Set<string>()
  for (const s of result.standings) {
    for (const id of s.customerIds) {
      memberIds.add(id)
      const current = loyaltyGroupsOf(id)
      const target = s.level ? configuredGroupIds[s.level] : undefined
      const keep = s.level ? current.find(g => (target ? g.id === target : g.name === s.level)) : undefined
      const add = s.level && !keep ? s.level : null
      const remove = current.filter(g => g !== keep)
      if (add || remove.length) changes.push({ customerId: id, email: s.email, name: s.name, add, remove })
    }
  }
  for (const c of byId.values()) {
    if (memberIds.has(c.id)) continue
    const current = loyaltyGroupsOf(c.id)
    if (current.length) changes.push({ customerId: c.id, email: c.email_address ?? '', name: customerDisplayName(c), add: null, remove: current })
  }
  return changes
}

export const MEMBER_CODE_PREFIX = 'WL'
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const CODE_BODY_LENGTH = 8

export function codeCheckChar(body: string): string {
  let total = 0
  for (let i = 0; i < body.length; i++) total += (i + 1) * CODE_ALPHABET.indexOf(body[i])
  return CODE_ALPHABET[total % CODE_ALPHABET.length]
}

function randomCodeChar(): string {
  const limit = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length
  const byte = new Uint8Array(1)
  do crypto.getRandomValues(byte)
  while (byte[0] >= limit)
  return CODE_ALPHABET[byte[0] % CODE_ALPHABET.length]
}

export function newMemberCode(taken: ReadonlySet<string> = new Set()): string {
  for (;;) {
    let body = ''
    for (let i = 0; i < CODE_BODY_LENGTH; i++) body += randomCodeChar()
    const code = `${MEMBER_CODE_PREFIX}-${body}${codeCheckChar(body)}`
    if (!taken.has(code)) return code
  }
}

export function normalizeMemberCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, '')
  if (!raw.startsWith(MEMBER_CODE_PREFIX)) return null
  const rest = raw.slice(MEMBER_CODE_PREFIX.length)
  if (rest.length !== CODE_BODY_LENGTH + 1 || [...rest].some(ch => !CODE_ALPHABET.includes(ch))) return null
  const body = rest.slice(0, CODE_BODY_LENGTH)
  if (codeCheckChar(body) !== rest[CODE_BODY_LENGTH]) return null
  return `${MEMBER_CODE_PREFIX}-${rest}`
}

export interface CodeWrite {
  customerId: string
  email: string
  code: string
  version?: number
}

export interface MemberCodes {
  codes: Record<string, string>
  writes: CodeWrite[]
  problems: string[]
}

export function resolveMemberCodes(members: LoyaltyMember[], customers: { id: string; reference_id?: string; version?: number }[],
  stored: Record<string, string>, makeCode: (taken: ReadonlySet<string>) => string = newMemberCode): MemberCodes {
  const byId = new Map(customers.map(c => [c.id, c]))
  const codes: Record<string, string> = {}
  const owner = new Map<string, string>()
  const problems: string[] = []
  const claim = (email: string, code: string): boolean => {
    const holder = owner.get(code)
    if (holder && holder !== email) {
      problems.push(`${code} is on profiles of both ${holder} and ${email}; fix one in Square`)
      return false
    }
    owner.set(code, email)
    codes[email] = code
    return true
  }
  const pending: LoyaltyMember[] = []
  for (const m of members) {
    const onProfile = m.customerIds.map(id => normalizeMemberCode(byId.get(id)?.reference_id ?? '')).find((c): c is string => !!c)
    if (onProfile && claim(m.email, onProfile)) continue
    pending.push(m)
  }
  for (const m of pending) {
    const saved = normalizeMemberCode(stored[m.email] ?? '')
    if (saved && !owner.has(saved) && claim(m.email, saved)) continue
    claim(m.email, makeCode(new Set(owner.keys())))
  }
  const writes: CodeWrite[] = []
  for (const m of members) {
    const code = codes[m.email]
    if (!code) continue
    const profiles = m.customerIds.map(id => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c)
    if (profiles.some(c => normalizeMemberCode(c.reference_id ?? '') === code)) continue
    const target = profiles.find(c => !(c.reference_id ?? '').trim())
    if (target) writes.push({ customerId: target.id, email: m.email, code, version: target.version })
    else if (profiles.length) problems.push(`${m.email} already has a different reference ID on every profile; add ${code} by hand`)
  }
  return { codes, writes, problems }
}
