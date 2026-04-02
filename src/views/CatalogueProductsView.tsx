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
        <h1 className="text-2xl font-bold text-gray-900">Catalogue Products</h1>
        <p className="text-sm text-gray-500 mt-1">
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDisabled}
            onChange={e => setShowDisabled(e.target.checked)}
            className="rounded"
          />
          Show archived
        </label>
        <span className="ml-auto text-sm text-gray-400 self-center">{filtered.length} products</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
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
            <tbody className="divide-y divide-gray-100">
              {filtered.map(product => (
                <tr key={product.id ?? product.name} className={`hover:bg-gray-50 ${!product.enabled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{product.sku || '—'}</td>
                  <td className="px-4 py-3">
                    {product.category ? (
                      <Badge variant="secondary">{product.category}</Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {product.price != null ? formatCurrency(product.price) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {product.quantity != null ? product.quantity : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {product.taxable ? (
                      <span className="text-green-600 font-medium">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      product.enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
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
          <div className="text-center py-10 text-gray-400 text-sm">No products match your filters.</div>
        )}
      </div>
    </div>
  )
}
