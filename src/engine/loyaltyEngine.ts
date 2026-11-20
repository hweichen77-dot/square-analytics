import type { SalesTransaction } from '../types/models'

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
}

const DAY_MS = 86_400_000

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
  const giftCards = (tx.lineItems ?? [])
    .filter(li => /gift\s*card/i.test(li.name))
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
    const name = [c.given_name, c.family_name].filter(Boolean).join(' ')
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
  rules: LoyaltyRules = LOYALTY_RULES): LoyaltyResult {
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

  const numbers = new Map<string, number>()
  for (const tier of ['Bronze', 'Silver', 'Gold'] as Tier[]) {
    const reached = raw
      .flatMap(r => r.promotions.filter(p => p.tier === tier).map(p => ({ email: r.member.email, weekStart: p.weekStart })))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.email.localeCompare(b.email))
    reached.forEach((r, i) => numbers.set(`${tier}|${r.email}`, i + 1))
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
    promotions: r.promotions.map(p => ({ ...p, number: numbers.get(`${p.tier}|${r.member.email}`)! })),
    totalSpend: r.total,
    averageLast4: r.avg4,
    progress: r.progress,
  }))

  const sharedCards = [...cardOthers.entries()].map(([fingerprint, others]) => ({
    fingerprint, owner: cardOwner.get(fingerprint)!, alsoUsedBy: [...others],
  }))
  return { standings, countedWeeks, sharedCards }
}

export function weekDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isClosedWeek(key: string, now: Date): boolean {
  return weekDate(key).getTime() + 7 * DAY_MS <= weekStartOf(now).getTime()
}
