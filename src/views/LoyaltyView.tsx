import { useCallback, useEffect, useMemo, useState } from 'react'
import { StatCard } from '../components/ui/StatCard'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { formatCurrency } from '../utils/format'
import { LOYALTY_RULES, cardNumberKey, normalizeMemberCode, weekDate } from '../engine/loyaltyEngine'
import { cardBackPdf } from '../engine/loyaltyCards'
import type { CardBack } from '../engine/loyaltyCards'
import type { MemberStanding, Tier } from '../engine/loyaltyEngine'
import { applyLoyaltyNow, loadLoyaltySnapshot, pauseLoyalty } from '../engine/squareLoyalty'
import type { LoyaltySnapshot } from '../engine/squareLoyalty'

const TIER_ORDER: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2, none: 3 }
const TIER_COLOR: Record<Tier, string> = { Bronze: '#a0623a', Silver: '#7d848b', Gold: '#b08a2e' }


function memberNumber(n: number): string {
  return `No. ${String(n).padStart(3, '0')}`
}

function TierBadge({ s }: { s: MemberStanding }) {
  if (!s.tier) return <span className="text-sm text-stone-100">Not yet</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-100">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLOR[s.tier] }} />
      {s.tier} {s.discountPct}%
    </span>
  )
}

function progressText(s: MemberStanding): string {
  const p = s.progress
  if (!p) return 'Top tier'
  const pace = `${formatCurrency(p.averageNow)} of ${formatCurrency(p.averageNeeded)} a week`
  return p.weeksLeft > 0 ? `${p.nextTier} in ${p.weeksLeft}+ weeks, ${pace}` : `${p.nextTier}: ${pace}`
}

export function LoyaltyView() {
  const { accessToken, loyaltyLive, loyaltyPausePending, loyaltyCardsIssued, loyaltyLastApplied, loyaltyLastError, loyaltyBackfillError, setCredentials } = useAuthStore()
  const toast = useToastStore(s => s.show)
  const [snapshot, setSnapshot] = useState<LoyaltySnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lookup, setLookup] = useState('')
  const [lookupResult, setLookupResult] = useState<{ standing: MemberStanding | null; code: string | null; input: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSnapshot(await loadLoyaltySnapshot())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (accessToken) void refresh()
  }, [accessToken, refresh])

  const standings = useMemo(() => {
    const rows = snapshot?.result.standings ?? []
    return [...rows].sort((a, b) =>
      TIER_ORDER[a.tier ?? 'none'] - TIER_ORDER[b.tier ?? 'none'] || b.discountPct - a.discountPct || b.averageLast4 - a.averageLast4)
  }, [snapshot])

  const counts = useMemo(() => ({
    Bronze: standings.filter(s => s.tier === 'Bronze').length,
    Silver: standings.filter(s => s.tier === 'Silver').length,
    Gold: standings.filter(s => s.tier === 'Gold').length,
    linked: standings.filter(s => s.cards.length > 0).length,
  }), [standings])

  const cardsToPrint = useMemo(() => standings
    .flatMap(s => s.promotions.map(p => ({ s, p, key: cardNumberKey(p.tier, s.email) })))
    .sort((a, b) => a.p.weekStart.localeCompare(b.p.weekStart)), [standings])

  const codes = snapshot?.codes ?? {}

  function checkCard(input: string) {
    const code = normalizeMemberCode(input)
    const email = code ? Object.keys(codes).find(e => codes[e] === code) : undefined
    setLookupResult({ standing: email ? standings.find(s => s.email === email) ?? null : null, code, input })
    setLookup('')
  }

  function downloadCardBacks(rows: typeof cardsToPrint, name: string) {
    const backs: CardBack[] = rows.filter(r => codes[r.s.email]).map(r => ({ code: codes[r.s.email], tier: r.p.tier, number: r.p.number }))
    if (!backs.length) {
      toast('No member codes yet. Refresh first.', 'error')
      return
    }
    cardBackPdf(backs).save(name)
  }

  async function runWrite(task: () => Promise<{ applied: number; failed: string[] }>, done: string) {
    setApplying(true)
    try {
      const { applied, failed } = await task()
      toast(failed.length ? `${applied} done, ${failed.length} failed` : `${done} (${applied})`, failed.length ? 'error' : 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setApplying(false)
      await refresh()
    }
  }

  function toggleLive() {
    if (loyaltyPausePending) {
      void runWrite(pauseLoyalty, 'Loyalty paused, members removed from groups')
      return
    }
    if (!loyaltyLive) {
      if (!window.confirm('Go live? The app will create the 8 loyalty groups, discounts and pricing rules in Square and keep members in the right group after every sync.')) return
      setCredentials({ loyaltyLive: true })
      void runWrite(applyLoyaltyNow, 'Members updated in Square')
      return
    }
    if (!window.confirm('Pause loyalty? Every member is taken out of the loyalty groups in Square, so no loyalty discount applies at the register until you go live again.')) return
    void runWrite(pauseLoyalty, 'Loyalty paused, members removed from groups')
  }

  function toggleIssued(key: string) {
    const next = { ...loyaltyCardsIssued }
    if (next[key]) delete next[key]
    else next[key] = new Date().toISOString()
    setCredentials({ loyaltyCardsIssued: next })
  }

  if (!accessToken) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-stone-100">Loyalty</h1>
        <p className="text-sm text-stone-100">Connect Square on the Square sync page to compute ranks.</p>
      </div>
    )
  }

  const rules = LOYALTY_RULES
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-100">Loyalty</h1>
          <p className="text-sm text-stone-100 mt-1">
            Bronze at {formatCurrency(rules.bronze.weekly)} a week over {rules.bronze.weeks} weeks, Silver after {rules.silver.weeks} weeks
            as Bronze at {formatCurrency(rules.silver.weekly)} a week, Gold after {rules.gold.weeks} weeks as Silver at the same pace.
            Discounts rise 1% every {rules.stepEveryWeeks} weeks.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => void refresh()} disabled={loading}
            className="h-9 px-4 border border-[var(--border)] rounded-md text-sm text-stone-100 hover:bg-stone-800/10 disabled:opacity-60">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button onClick={toggleLive} disabled={applying}
            className={`h-9 px-4 rounded-md text-sm font-medium ${loyaltyLive ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-white hover:bg-stone-300'}`}>
            {loyaltyPausePending ? 'Finish pausing' : loyaltyLive ? 'Live in Square' : 'Preview only'}
          </button>
        </div>
      </div>

      {error && <div className="border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-stone-100">Could not load members: {error}</div>}
      {loyaltyPausePending && <div className="border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-stone-100">Pausing is not finished. Some members may still get a loyalty discount. Click Finish pausing, or it will retry after the next sync.</div>}
      {loyaltyBackfillError && <div className="border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-stone-100">{loyaltyBackfillError}</div>}
      {loyaltyLastError && <div className="border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-stone-100">{loyaltyLastError}</div>}

      <div className="grid grid-cols-5 gap-4 kpi-strip">
        <StatCard label="Members (WarriorLife email)" value={String(standings.length)} />
        <StatCard label="Bronze" value={String(counts.Bronze)} />
        <StatCard label="Silver" value={String(counts.Silver)} />
        <StatCard label="Gold" value={String(counts.Gold)} />
        <StatCard label="Members with a linked card" value={String(counts.linked)} />
      </div>

      <div className="bg-white border border-[var(--border)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-stone-100">Square changes</h2>
          {loyaltyLive && (
            <button onClick={() => void runWrite(applyLoyaltyNow, 'Members updated in Square')} disabled={applying || !(snapshot?.changes.length || snapshot?.codeWrites.length)}
              className="h-8 px-3 bg-stone-100 text-white rounded-md text-sm disabled:opacity-60">
              {applying ? 'Applying...' : 'Apply now'}
            </button>
          )}
        </div>
        <p className="text-sm text-stone-100 mb-3">
          {loyaltyLive
            ? `Live. Changes are written after every sync${loyaltyLastApplied ? `, last on ${new Date(loyaltyLastApplied).toLocaleString()}` : ''}.`
            : 'Preview only. Nothing is written to Square until you switch to live.'}
        </p>
        {snapshot && snapshot.codeWrites.length > 0 && (
          <p className="text-sm text-stone-100 mb-2">
            {snapshot.codeWrites.length} member card code{snapshot.codeWrites.length > 1 ? 's' : ''} {loyaltyLive ? 'will be' : 'would be'} saved as the Square reference ID, so scanning the card at checkout adds the member and their discount.
          </p>
        )}
        {snapshot && snapshot.codeProblems.length > 0 && (
          <ul className="text-sm text-stone-100 mb-2 list-disc pl-5">{snapshot.codeProblems.map(p => <li key={p}>{p}</li>)}</ul>
        )}
        {snapshot && snapshot.changes.length === 0 && <p className="text-sm text-stone-100">Every member is already in the right group.</p>}
        {snapshot && snapshot.changes.length > 0 && (
          <ul className="text-sm text-stone-100 space-y-1 max-h-56 overflow-auto">
            {snapshot.changes.map(c => (
              <li key={c.customerId}>
                <span className="font-medium">{c.name || c.email}</span>
                {c.add && <> → {c.add}</>}
                {c.remove.length > 0 && <span className="opacity-80"> (remove {c.remove.map(g => g.name).join(', ')})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-[var(--border)] rounded-lg p-5">
        <h2 className="text-base font-semibold text-stone-100 mb-1">Check a card</h2>
        <p className="text-sm text-stone-100 mb-3">Scan the code on the back of a card, or type it, and press Enter.</p>
        <form onSubmit={e => { e.preventDefault(); if (lookup.trim()) checkCard(lookup) }} className="flex gap-2">
          <input value={lookup} onChange={e => setLookup(e.target.value)} placeholder="WL-..." autoComplete="off" spellCheck={false}
            className="h-9 w-64 px-3 border border-[var(--border)] rounded-md text-sm font-mono text-stone-100 bg-transparent" />
          <button type="submit" className="h-9 px-4 border border-[var(--border)] rounded-md text-sm text-stone-100 hover:bg-stone-800/10">Check</button>
        </form>
        {lookupResult && (
          <div className="mt-3 text-sm text-stone-100">
            {!lookupResult.code && <p>{lookupResult.input.trim()} is not a Walley's card code. Check for a typo.</p>}
            {lookupResult.code && !lookupResult.standing && <p>{lookupResult.code} is a valid code but belongs to no current member.</p>}
            {lookupResult.standing && (() => {
              const s = lookupResult.standing
              const issued = s.promotions.filter(p => loyaltyCardsIssued[cardNumberKey(p.tier, s.email)])
              const current = s.tier ? s.promotions.find(p => p.tier === s.tier) : undefined
              const needsCard = current && !loyaltyCardsIssued[cardNumberKey(current.tier, s.email)]
              return (
                <div className="space-y-1">
                  <div className="font-medium">{s.name || s.email} <span className="opacity-80 font-normal">{s.email}</span></div>
                  <div className="flex items-center gap-3"><TierBadge s={s} /><span>{progressText(s)}</span></div>
                  <div>Cards handed out: {issued.length ? issued.map(p => `${p.tier} ${memberNumber(p.number)}`).join(', ') : 'none'}</div>
                  {needsCard && <div className="font-medium">Hand out the {current.tier} card ({memberNumber(current.number)}).</div>}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      <div className="bg-white border border-[var(--border)] rounded-lg p-5">
        <h2 className="text-base font-semibold text-stone-100 mb-3">Members</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm text-stone-100">
            <thead>
              <tr className="text-left border-b border-[var(--border)]">
                <th className="py-2 pr-4 font-medium">Member</th>
                <th className="py-2 pr-4 font-medium">Rank</th>
                <th className="py-2 pr-4 font-medium">Card code</th>
                <th className="py-2 pr-4 font-medium">Next +1%</th>
                <th className="py-2 pr-4 font-medium">Last 4 weeks</th>
                <th className="py-2 pr-4 font-medium">Next tier</th>
                <th className="py-2 pr-4 font-medium">Cards</th>
                <th className="py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {standings.map(s => (
                <tr key={s.email} className="border-b border-[var(--border)]/60">
                  <td className="py-2 pr-4">
                    <div className="font-medium">{s.name || s.email.split('@')[0]}</div>
                    <div className="text-xs opacity-80">{s.email}</div>
                  </td>
                  <td className="py-2 pr-4"><TierBadge s={s} /></td>
                  <td className="py-2 pr-4 font-mono text-xs">{codes[s.email] ?? ''}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.weeksToNextStep ? `${s.weeksToNextStep} wk` : ''}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatCurrency(s.averageLast4)}/wk</td>
                  <td className="py-2 pr-4">{progressText(s)}</td>
                  <td className="py-2 pr-4 tabular-nums">{s.cards.length || ''}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(s.totalSpend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {snapshot && snapshot.result.sharedCards.length > 0 && (
          <p className="text-sm text-stone-100 mt-3">
            {snapshot.result.sharedCards.length} card{snapshot.result.sharedCards.length > 1 ? 's are' : ' is'} used by more than one member.
            Each counts only for the first member it was linked to.
          </p>
        )}
      </div>

      <div className="bg-white border border-[var(--border)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-stone-100">Cards to print</h2>
          {cardsToPrint.some(r => !loyaltyCardsIssued[r.key]) && (
            <button onClick={() => downloadCardBacks(cardsToPrint.filter(r => !loyaltyCardsIssued[r.key]), 'walleys-card-backs.pdf')}
              className="h-8 px-3 border border-[var(--border)] rounded-md text-sm text-stone-100 hover:bg-stone-800/10">
              Card backs for cards not handed out
            </button>
          )}
        </div>
        {cardsToPrint.length === 0 && <p className="text-sm text-stone-100">No one has reached a tier yet.</p>}
        {cardsToPrint.length > 0 && (
          <table className="w-full text-sm text-stone-100">
            <thead>
              <tr className="text-left border-b border-[var(--border)]">
                <th className="py-2 pr-4 font-medium">Card</th>
                <th className="py-2 pr-4 font-medium">Member</th>
                <th className="py-2 pr-4 font-medium">Reached</th>
                <th className="py-2 pr-4 font-medium">Back</th>
                <th className="py-2 font-medium text-right">Handed out</th>
              </tr>
            </thead>
            <tbody>
              {cardsToPrint.map(({ s, p, key }) => (
                <tr key={key} className="border-b border-[var(--border)]/60">
                  <td className="py-2 pr-4 tabular-nums">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ backgroundColor: TIER_COLOR[p.tier] }} />
                    {p.tier} {memberNumber(p.number)}
                  </td>
                  <td className="py-2 pr-4">{s.name || s.email}</td>
                  <td className="py-2 pr-4">week of {weekDate(p.weekStart).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">
                    <button onClick={() => downloadCardBacks([{ s, p, key }], `walleys-card-back-${p.tier.toLowerCase()}-${String(p.number).padStart(3, '0')}.pdf`)}
                      className="text-sm underline text-stone-100">PDF</button>
                  </td>
                  <td className="py-2 text-right">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!loyaltyCardsIssued[key]} onChange={() => toggleIssued(key)} />
                      {loyaltyCardsIssued[key] ? new Date(loyaltyCardsIssued[key]).toLocaleDateString() : ''}
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default LoyaltyView
