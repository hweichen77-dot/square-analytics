import { computeStandings, levelName, allLevels, membersFromCustomers, qualifyingAmount, weekStartOf, orderLoyaltySpend, planGroupChanges, cardNumberKey, newMemberCode, normalizeMemberCode, codeCheckChar, resolveMemberCodes } from '../loyaltyEngine'
import { qrModules } from '../loyaltyCards'
import type { LoyaltyTx } from '../loyaltyEngine'
import type { SalesTransaction } from '../../types/models'
import type { SquareOrder } from '../squareAPIClient'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`)
}

const monday = new Date(2026, 7, 3)
function day(week: number, dayOffset = 1): Date {
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + week * 7 + dayOffset, 12)
}

function storeWeeks(n: number): LoyaltyTx[] {
  return Array.from({ length: n }, (_, w) => ({ date: day(w, 2), amount: 1, customerID: 'walkin' }))
}

const members = membersFromCustomers([
  { id: 'A1', email_address: 'ann@warriorlife.net', given_name: 'Ann' },
  { id: 'A2', email_address: 'ANN@warriorlife.net' },
  { id: 'B1', email_address: 'ben@warriorlife.net', given_name: 'Ben' },
  { id: 'C1', email_address: 'cat@warriorlife.net', given_name: 'Cat' },
  { id: 'S1', email_address: 'staff@vcs.net' },
])
check('members grouped by email, staff excluded', members.length === 3 && members[0].customerIds.join() === 'A1,A2')

check('eight Square levels', allLevels().length === 8 && allLevels()[0].name === 'Loyalty Bronze 2%' && allLevels()[7].name === 'Loyalty Gold 10%')

const gift: SalesTransaction = {
  transactionID: 'g', date: day(0), netSales: 30, staffName: '', paymentMethod: 'CARD', itemDescription: '', dayOfWeek: 1, hour: 12,
  lineItems: [{ name: 'Gift Card', qty: 1, unitPrice: 25 }, { name: 'Hoodie', qty: 1, unitPrice: 5 }],
}
check('gift card lines excluded from spend', qualifyingAmount(gift) === 5)

const now = day(40)
const txs: LoyaltyTx[] = [...storeWeeks(40)]
for (let w = 0; w < 4; w++) txs.push({ date: day(w), amount: 11.99, customerID: 'B1' })
for (let w = 0; w < 4; w++) txs.push({ date: day(w), amount: 12, customerID: 'A2' })
for (let w = 4; w < 30; w++) txs.push({ date: day(w), amount: 15, customerID: 'A1' })
let r = computeStandings(txs, members, now)
const ann = r.standings.find(s => s.email === 'ann@warriorlife.net')!
const ben = r.standings.find(s => s.email === 'ben@warriorlife.net')!
check('just under $12 a week stays unranked', ben.tier === null, `avg ${ben.progress?.averageNow.toFixed(2)}`)
check('Bronze at $12 a week over 4 weeks', ann.promotions[0]?.tier === 'Bronze' && ann.promotions[0].weekStart === '2026-08-24')
check('Silver after 8 weeks as Bronze at $15 pace', ann.promotions[1]?.tier === 'Silver' && ann.promotions[1].weekStart === '2026-10-19')
check('Gold after 13 weeks as Silver at $15 pace', ann.promotions[2]?.tier === 'Gold' && ann.promotions[2].weekStart === '2027-01-18')
check('Gold is 10% and numbered 001', ann.discountPct === 10 && ann.level === levelName('Gold', 10) && ann.promotions[2].number === 1)

const stepTxs: LoyaltyTx[] = [...storeWeeks(12)]
for (let w = 0; w < 4; w++) stepTxs.push({ date: day(w), amount: 20, customerID: 'C1' })
const atWeeks = (n: number) => computeStandings(stepTxs, members, day(n, 0)).standings.find(s => s.email === 'cat@warriorlife.net')!
check('Bronze starts at 2%', atWeeks(4).discountPct === 2 && atWeeks(4).weeksInTier === 0)
check('Bronze +1% after 2 counted weeks', atWeeks(6).discountPct === 3)
check('Bronze capped at 5%', atWeeks(12).discountPct === 5 && atWeeks(12).weeksToNextStep === null)
check('rank never drops after spending stops', atWeeks(12).tier === 'Bronze')

const breakTxs: LoyaltyTx[] = []
for (const w of [0, 1, 4, 5]) breakTxs.push({ date: day(w, 2), amount: 1, customerID: 'walkin' }, { date: day(w), amount: 12, customerID: 'C1' })
const brk = computeStandings(breakTxs, members, day(8))
check('closed weeks are skipped, not counted as zero', brk.countedWeeks.length === 4 && brk.standings.find(s => s.email === 'cat@warriorlife.net')!.tier === 'Bronze')

const cardTxs: LoyaltyTx[] = [...storeWeeks(6)]
for (let w = 0; w < 4; w++) cardTxs.push({ date: day(w), amount: 13, customerID: `instant${w}`, cardFingerprint: 'fpBen' })
cardTxs.push({ date: day(4), amount: 1, customerID: 'B1', cardFingerprint: 'fpBen' })
cardTxs.push({ date: day(5), amount: 1, customerID: 'C1', cardFingerprint: 'fpBen' })
r = computeStandings(cardTxs, members, day(6))
const benCard = r.standings.find(s => s.email === 'ben@warriorlife.net')!
check('linking a card makes its past spend count', benCard.tier === 'Bronze' && benCard.cards.join() === 'fpBen')
check('a card used by two members stays with the first and is flagged', r.sharedCards.length === 1 && r.sharedCards[0].owner === 'ben@warriorlife.net')

check('weeks start on Monday', weekStartOf(new Date(2026, 7, 9)).getDate() === 3)

const order: SquareOrder = {
  id: 'o1', created_at: '2026-09-01T18:00:00Z',
  net_amounts: { total_money: { amount: 3500 }, tax_money: { amount: 250 }, tip_money: { amount: 150 } },
  line_items: [
    { name: 'Gift Card', quantity: '1', item_type: 'GIFT_CARD', gross_sales_money: { amount: 2000, currency: 'USD' } },
    { name: 'Hoodie', quantity: '1', item_type: 'ITEM', gross_sales_money: { amount: 1200, currency: 'USD' }, total_discount_money: { amount: 100, currency: 'USD' } },
  ],
}
check('spend excludes tax, tip and gift cards', Math.abs(orderLoyaltySpend(order) - 11) < 1e-9, `got ${orderLoyaltySpend(order)}`)
const returned: SquareOrder = {
  ...order,
  net_amounts: { total_money: { amount: 1500 }, tax_money: { amount: 250 }, tip_money: { amount: 150 }, service_charge_money: { amount: 100 } },
  returns: [{ return_line_items: [{ name: 'Gift Card', item_type: 'GIFT_CARD', gross_return_money: { amount: 2000 } }] }],
}
check('returned gift cards and service charges handled', Math.abs(orderLoyaltySpend(returned) - 10) < 1e-9, `got ${orderLoyaltySpend(returned)}`)
const namedGift: SquareOrder = { id: 'o3', created_at: order.created_at, net_amounts: { total_money: { amount: 2500 } },
  line_items: [{ name: 'Gift Card', quantity: '1', item_type: 'ITEM', gross_sales_money: { amount: 2000, currency: 'USD' } }] }
check('a catalog item named Gift Card does not count as spend', Math.abs(orderLoyaltySpend(namedGift) - 5) < 1e-9)
const refundOrder: SquareOrder = { id: 'o4', created_at: order.created_at, net_amounts: { total_money: { amount: -6480 }, tax_money: { amount: -480 } } }
check('a refund order lowers spend', Math.abs(orderLoyaltySpend(refundOrder) + 60) < 1e-9, `got ${orderLoyaltySpend(refundOrder)}`)
const legacyOrder: SquareOrder = { id: 'o5', created_at: order.created_at, total_money: { amount: 1080 }, return_amounts: { total_money: { amount: 500 } }, total_tax_money: { amount: 80 } }
check('orders without net amounts drop tax and returns', Math.abs(orderLoyaltySpend(legacyOrder) - 5) < 1e-9, `got ${orderLoyaltySpend(legacyOrder)}`)
check('stored loyalty spend wins over net sales', qualifyingAmount({ ...gift, netSales: 40, loyaltySpend: 7 }) === 7)

const numTxs: LoyaltyTx[] = [...storeWeeks(12)]
for (let w = 4; w < 8; w++) numTxs.push({ date: day(w), amount: 13, customerID: 'A1' })
const first = computeStandings(numTxs, members, day(9))
check('first Bronze gets No. 001', first.cardNumbers[cardNumberKey('Bronze', 'ann@warriorlife.net')] === 1)
for (let w = 0; w < 4; w++) numTxs.push({ date: day(w), amount: 13, customerID: 'C1' })
const later = computeStandings(numTxs, members, day(9), undefined, first.cardNumbers)
check('printed numbers never shift when earlier history appears',
  later.cardNumbers[cardNumberKey('Bronze', 'ann@warriorlife.net')] === 1 && later.cardNumbers[cardNumberKey('Bronze', 'cat@warriorlife.net')] === 2)

const groupNames = { g2: 'Loyalty Bronze 2%', g3: 'Loyalty Bronze 3%', g3dup: 'Loyalty Bronze 3%', other: 'Square Online' }
const res = computeStandings(stepTxs, members, day(6, 0))
const customersInSquare = [
  { id: 'C1', email_address: 'cat@warriorlife.net', group_ids: ['g2', 'g3dup', 'other'] },
  { id: 'X9', email_address: 'old@gmail.com', group_ids: ['g3', 'other'] },
]
const preview = planGroupChanges(res, customersInSquare, groupNames).find(c => c.customerId === 'C1')
check('before setup, a same-named group counts as the level', !!preview && preview.add === null && preview.remove.map(g => g.id).join() === 'g2')
const plan = planGroupChanges(res, customersInSquare, groupNames, { 'Loyalty Bronze 3%': 'g3' })
const cat = plan.find(c => c.customerId === 'C1')
const stale = plan.find(c => c.customerId === 'X9')
check('member in a duplicate group moves to the group the discount targets',
  !!cat && cat.add === 'Loyalty Bronze 3%' && cat.remove.map(g => g.id).sort().join() === 'g2,g3dup', JSON.stringify(cat))
check('non-loyalty groups are never touched', plan.every(c => c.remove.every(g => g.id !== 'other')))
check('a non-member left in a loyalty group is removed by its real group id', !!stale && stale.remove.map(g => g.id).join() === 'g3')

const codes = Array.from({ length: 2000 }, () => newMemberCode())
check('new codes are valid and canonical', codes.every(c => normalizeMemberCode(c) === c && /^WL-[2-9A-HJKMNP-Z]{9}$/.test(c)))
check('new codes do not repeat in 2000 draws', new Set(codes).size === codes.length)
check('a code avoids taken codes', newMemberCode(new Set(codes)) !== codes[0])
const sample = codes[0]
check('scanner input is normalized', normalizeMemberCode(` ${sample.toLowerCase().replace('-', '')}\n`) === sample)
const body = sample.slice(3, 11)
const swapped = body[1] + body[0] + body.slice(2)
const wrongChar = (body[0] === '2' ? '3' : '2') + body.slice(1)
check('one wrong character is rejected', normalizeMemberCode(`WL-${wrongChar}${sample[11]}`) === null)
check('two swapped neighbours are rejected', body[0] === body[1] || codeCheckChar(swapped) !== codeCheckChar(body))
check('non-codes are rejected', ['', 'WL-', 'hello', 'WL-0O1IL2345', `XX-${body}${sample[11]}`].every(x => normalizeMemberCode(x) === null))

const codeMembers = membersFromCustomers([
  { id: 'P1', email_address: 'pat@warriorlife.net' },
  { id: 'P2', email_address: 'pat@warriorlife.net' },
  { id: 'Q1', email_address: 'quin@warriorlife.net' },
  { id: 'R1', email_address: 'ray@warriorlife.net' },
  { id: 'T1', email_address: 'tay@warriorlife.net' },
])
const squareProfiles = [
  { id: 'P1', reference_id: '', version: 3 },
  { id: 'P2', reference_id: codes[1].toLowerCase(), version: 1 },
  { id: 'Q1', reference_id: 'STUDENT-123', version: 2 },
  { id: 'R1', version: 5 },
  { id: 'T1', reference_id: codes[1] },
]
const resolved = resolveMemberCodes(codeMembers, squareProfiles, { 'ray@warriorlife.net': codes[2], 'tay@warriorlife.net': codes[1] })
check('a code already on any profile wins', resolved.codes['pat@warriorlife.net'] === codes[1])
check('a saved code is reused when Square has none', resolved.codes['ray@warriorlife.net'] === codes[2])
check('every member gets a distinct code', new Set(Object.values(resolved.codes)).size === codeMembers.length)
check('a code on two members is reported and the second gets a new one',
  resolved.codes['tay@warriorlife.net'] !== codes[1] && resolved.problems.some(p => p.includes('both')))
check('no write when the code is already in Square', !resolved.writes.some(w => w.email === 'pat@warriorlife.net'))
check('an empty profile gets the code, with its version', resolved.writes.some(w => w.customerId === 'R1' && w.code === codes[2] && w.version === 5))
check('a foreign reference ID is never overwritten',
  !resolved.writes.some(w => w.customerId === 'Q1') && resolved.problems.some(p => p.startsWith('quin@')))
check('codes are stable across refreshes', JSON.stringify(resolveMemberCodes(codeMembers, squareProfiles, resolved.codes).codes) === JSON.stringify(resolved.codes))

const modules = qrModules(sample)
const finder = (r: number, c: number) => [0, 6].every(i => modules[r + i][c] && modules[r][c + i] && modules[r + 6][c + i] && modules[r + i][c + 6])
check('QR for a code is version 1 with three finder patterns', modules.length === 21 && finder(0, 0) && finder(0, 14) && finder(14, 0))

console.log(failures === 0 ? 'all loyalty checks passed' : `${failures} loyalty checks failed`)
if (failures) process.exit(1)
