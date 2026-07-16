import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { EmptyState } from '../components/ui/EmptyState'
import { useToastStore } from '../store/toastStore'
import { formatCurrency } from '../utils/format'
import { splitItemVariation } from '../types/models'
import type { CatalogueProduct } from '../types/models'
import { shouldBeTaxed, isUncategorized, TAXABLE_CATEGORY_LABEL } from '../engine/catalogueAuditEngine'
import { KNOWN_CATEGORIES } from './CatalogueProductsView'

interface TaxMismatch {
  product: CatalogueProduct
  expected: boolean
  reason: string
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'bad' ? 'text-red-400' : tone === 'good' ? 'text-emerald-400' : 'text-stone-100'
  return (
    <div className="bg-stone-800/30 border border-stone-700/40 p-4">
      <p className="text-xs text-stone-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

export default function CategoryTaxAuditView() {
  const catalogue = useLiveQuery(() => db.catalogueProducts.toArray(), []) ?? []
  const showToast = useToastStore(s => s.show)
  const [search, setSearch] = useState('')
  const [fixing, setFixing] = useState(false)

  const enabled = useMemo(() => catalogue.filter(p => p.enabled), [catalogue])

  const uncategorized = useMemo(() => {
    const q = search.toLowerCase().trim()
    return enabled
      .filter(p => isUncategorized(p))
      .filter(p => !q || String(p.name ?? '').toLowerCase().includes(q))
      .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
  }, [enabled, search])

  const taxMismatches = useMemo<TaxMismatch[]>(() => {
    return enabled
      .filter(p => shouldBeTaxed(p) !== p.taxable)
      .map(p => {
        const expected = shouldBeTaxed(p)
        return {
          product: p,
          expected,
          reason: expected
            ? `Should be TAXED (${TAXABLE_CATEGORY_LABEL}) but is marked non-taxable.`
            : `Marked TAXABLE but is not merch, ramen, or a carbonated drink — should be non-taxable.`,
        }
      })
      .sort((a, b) => String(a.product.name ?? '').localeCompare(String(b.product.name ?? '')))
  }, [enabled])

  const totalUncategorized = enabled.filter(p => isUncategorized(p)).length
  const auditReady = totalUncategorized === 0 && taxMismatches.length === 0

  async function assignCategory(id: number | undefined, category: string) {
    if (id == null || !category) return
    await db.catalogueProducts.update(id, { category })
    showToast(`Category set to "${category}"`, 'success')
  }

  async function fixTax(m: TaxMismatch) {
    if (m.product.id == null) return
    await db.catalogueProducts.update(m.product.id, { taxable: m.expected })
    showToast(`${m.product.name} → ${m.expected ? 'taxable' : 'non-taxable'}`, 'success')
  }

  async function fixAllTax() {
    setFixing(true)
    let n = 0
    for (const m of taxMismatches) {
      if (m.product.id == null) continue
      try { await db.catalogueProducts.update(m.product.id, { taxable: m.expected }); n++ } catch { /* skip */ }
    }
    setFixing(false)
    showToast(`Corrected tax status on ${n} item${n !== 1 ? 's' : ''}`, 'success')
  }

  if (catalogue.length === 0) {
    return (
      <EmptyState
        title="No catalogue loaded"
        subtitle="Import a Square catalogue XLSX or sync via Square to run the category & tax audit."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-700 text-stone-100 tracking-tight">Category &amp; Tax Audit</h1>
        <p className="text-sm text-stone-400 mt-1">
          Run this after adding items. Confirms every item has a category and that only the right items are taxed —
          catches mistakes before a FABS audit does.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Uncategorized" value={String(totalUncategorized)} tone={totalUncategorized > 0 ? 'bad' : 'good'} />
        <StatCard label="Tax mismatches" value={String(taxMismatches.length)} tone={taxMismatches.length > 0 ? 'bad' : 'good'} />
        <StatCard label="Active items" value={String(enabled.length)} tone="neutral" />
      </div>

      <div className="bg-stone-800/60 border border-stone-700 px-4 py-3 text-sm text-stone-400 flex items-start gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
        <span>
          <span className="text-stone-300 font-medium">Taxable: </span>
          <span className="text-amber-400">{TAXABLE_CATEGORY_LABEL}.</span>{' '}
          Everything else (water, juice, tea, snacks, candy, ice cream, grocery) is non-taxable.
        </span>
      </div>

      {auditReady && (
        <div className="text-center py-14">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <p className="font-semibold text-stone-100 text-lg">Audit-ready</p>
          <p className="text-sm text-stone-400 mt-1">All {enabled.length} active items are categorized and taxed correctly.</p>
        </div>
      )}

      {totalUncategorized > 0 && (
        <div className="bg-stone-800/30 border border-stone-700/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-700/50 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-stone-200">Uncategorized items</h2>
              <p className="text-xs text-stone-400 mt-0.5">{uncategorized.length} shown · assign a category to each</p>
            </div>
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-stone-900 text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 w-44"
            />
          </div>
          <div className="divide-y divide-stone-700/30 max-h-[32rem] overflow-y-auto">
            {uncategorized.map(p => {
              const { itemName, variationName } = splitItemVariation(p.name)
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-stone-700/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-100 truncate">{itemName}</p>
                    <p className="text-xs text-stone-400">
                      {variationName !== 'Regular' ? `${variationName} · ` : ''}{p.price != null ? formatCurrency(p.price) : 'no price'}
                    </p>
                  </div>
                  <select
                    defaultValue=""
                    onChange={e => assignCategory(p.id, e.target.value)}
                    className="shrink-0 border border-stone-600 rounded-lg px-2 py-1.5 text-sm bg-stone-900 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="" disabled>Set category…</option>
                    {KNOWN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )
            })}
            {uncategorized.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-stone-400">No matches.</p>
            )}
          </div>
        </div>
      )}

      {taxMismatches.length > 0 && (
        <div className="bg-stone-800/30 border border-stone-700/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-700/50 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-stone-200">Tax mismatches</h2>
              <p className="text-xs text-stone-400 mt-0.5">{taxMismatches.length} item{taxMismatches.length !== 1 ? 's' : ''} taxed incorrectly</p>
            </div>
            <button
              onClick={fixAllTax}
              disabled={fixing}
              className="shrink-0 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              {fixing ? 'Fixing…' : `Fix all (${taxMismatches.length})`}
            </button>
          </div>
          <div className="divide-y divide-stone-700/30 max-h-[32rem] overflow-y-auto">
            {taxMismatches.map(m => (
              <div key={m.product.id} className="flex items-start gap-3 px-5 py-3 hover:bg-stone-700/20">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${m.expected ? 'bg-amber-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-stone-100">{m.product.name}</span>
                    <span className="text-[11px] text-stone-400">{m.product.category || 'no category'}</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">{m.reason}</p>
                </div>
                <button
                  onClick={() => fixTax(m)}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-md bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 border border-amber-500/30 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Set {m.expected ? 'taxable' : 'non-taxable'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
