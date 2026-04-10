import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { formatCurrency } from '../utils/format'

export default function CatalogueProductsView() {
  const catalogue = useLiveQuery(() => db.catalogueProducts.orderBy('name').toArray(), []) ?? []
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [showDisabled, setShowDisabled] = useState(false)

  const categories = useMemo(() => {
    const cats = Array.from(new Set(catalogue.map(c => c.category).filter(Boolean)))
    return ['All', ...cats.sort()]
  }, [catalogue])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return catalogue.filter(c => {
      if (!showDisabled && !c.enabled) return false
      if (categoryFilter !== 'All' && c.category !== categoryFilter) return false
      if (q && !c.name.toLowerCase().includes(q) && !c.sku.toLowerCase().includes(q)) return false
      return true
    })
  }, [catalogue, search, categoryFilter, showDisabled])

  const enabledCount = catalogue.filter(c => c.enabled).length
  const disabledCount = catalogue.filter(c => !c.enabled).length

  if (catalogue.length === 0) {
    return (
      <EmptyState
        title="No catalogue products"
        subtitle="Import a Square catalogue XLSX or sync via Square to populate products."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Catalogue Products</h1>
        <p className="text-sm text-slate-500 mt-1">
          {enabledCount} enabled · {disabledCount} archived · {catalogue.length} total
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name or SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-slate-600 rounded-lg px-3 py-2 bg-slate-700/50 text-sm w-56 focus:outline-none focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-slate-600 rounded-lg px-3 py-2 bg-slate-700/50 text-sm focus:outline-none focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDisabled}
            onChange={e => setShowDisabled(e.target.checked)}
            className="rounded"
          />
          Show archived
        </label>
        <span className="ml-auto text-sm text-slate-500 self-center">{filtered.length} products</span>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-center">Taxable</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {filtered.map(product => (
                <tr key={product.id ?? product.name} className={`hover:bg-slate-700/50 ${!product.enabled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-slate-100">{product.name}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{product.sku || '—'}</td>
                  <td className="px-4 py-3">
                    {product.category ? (
                      <Badge variant="secondary">{product.category}</Badge>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {product.price != null ? formatCurrency(product.price) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {product.quantity != null ? product.quantity : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {product.taxable ? (
                      <span className="text-emerald-400 font-medium">Yes</span>
                    ) : (
                      <span className="text-slate-500">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      product.enabled
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}>
                      {product.enabled ? 'Active' : 'Archived'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">No products match your filters.</div>
        )}
      </div>
    </div>
  )
}
