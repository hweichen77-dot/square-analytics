import { computeStandings, levelName, allLevels, membersFromCustomers, qualifyingAmount, weekStartOf } from '../loyaltyEngine'
import type { LoyaltyTx } from '../loyaltyEngine'
import type { SalesTransaction } from '../../types/models'

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

console.log(failures === 0 ? 'all loyalty checks passed' : `${failures} loyalty checks failed`)
if (failures) process.exit(1)
