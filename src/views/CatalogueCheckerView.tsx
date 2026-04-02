import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { useFilteredTransactions, useOverridesMap } from '../db/useTransactions'
import { useDateRangeStore } from '../store/dateRangeStore'
import { computeProductStats } from '../engine/analyticsEngine'
import { EmptyState } from '../components/ui/EmptyState'
import { formatCurrency } from '../utils/format'

interface DiscrepancyRow {
  name: string
  issue: string
  severity: 'warning' | 'info'
  detail: string
}

export default function CatalogueCheckerView() {
  const { range } = useDateRangeStore()
  const transactions = useFilteredTransactions(range)
  const overrides = useOverridesMap()
  const catalogue = useLiveQuery(() => db.catalogueProducts.toArray(), []) ?? []

  const { inSalesNotCatalogue, inCatalogueNotSales, discrepancies } = useMemo(() => {
    const stats = computeProductStats(transactions, overrides)
    const catNames = new Set(catalogue.map(c => c.name))
    const saleNames = new Set(stats.map(s => s.name))
    const inSalesNotCatalogue = stats.filter(s => !catNames.has(s.name))
    const inCatalogueNotSales = catalogue.filter(c => c.enabled && !saleNames.has(c.name))
    const discrepancies: DiscrepancyRow[] = []
    for (const product of stats) {
      const cp = catalogue.find(c => c.name === product.name)
      if (!cp) {
        discrepancies.push({
          name: product.name,
          issue: 'Not in catalogue',
          severity: 'warning',
          detail: `Sold ${product.totalUnitsSold} units but missing from Square catalogue`,
        })
      } else if (cp.price != null && Math.abs(cp.price - product.avgPrice) > 0.50) {
        discrepancies.push({
          name: product.name,
          issue: 'Price mismatch',
          severity: 'info',
          detail: `Catalogue: $${cp.price.toFixed(2)} vs avg sold: $${product.avgPrice.toFixed(2)}`,
        })
      }
    }
    return { inSalesNotCatalogue, inCatalogueNotSales, discrepancies }
  }, [transactions, overrides, catalogue])

  if (transactions.length === 0) {
    return <EmptyState title="No transaction data" subtitle="Import sales data to check catalogue alignment." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Catalogue Checker</h1>
        <p className="text-sm text-gray-500 mt-1">Compare your sales data against your Square catalogue for gaps and mismatches.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-700 font-medium">Sold — Not in Catalogue</p>
          <p className="text-3xl font-bold text-yellow-800 mt-1">{inSalesNotCatalogue.length}</p>
          <p className="text-xs text-yellow-600 mt-1">Products you sold that Square doesn't know about</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-700 font-medium">In Catalogue — Never Sold</p>
          <p className="text-3xl font-bold text-blue-800 mt-1">{inCatalogueNotSales.length}</p>
          <p className="text-xs text-blue-600 mt-1">Enabled catalogue items with no sales in this period</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm text-orange-700 font-medium">Price Mismatches</p>
          <p className="text-3xl font-bold text-orange-800 mt-1">{discrepancies.filter(d => d.severity === 'info').length}</p>
          <p className="text-xs text-orange-600 mt-1">Items where catalogue price differs from avg sold price by &gt;$0.50</p>
        </div>
      </div>

      {/* Sold but not in catalogue */}
      {inSalesNotCatalogue.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <h2 className="font-semibold text-gray-800">Sold — Not in Catalogue ({inSalesNotCatalogue.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-right">Units Sold</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">Avg Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inSalesNotCatalogue.map(p => (
                  <tr key={p.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{p.totalUnitsSold}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(p.totalRevenue)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(p.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* In catalogue but never sold */}
      {inCatalogueNotSales.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-lg">📦</span>
            <h2 className="font-semibold text-gray-800">In Catalogue — Never Sold ({inCatalogueNotSales.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-left">SKU</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-right">Catalogue Price</th>
                  <th className="px-4 py-2 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inCatalogueNotSales.map(c => (
                  <tr key={c.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-2 text-gray-500">{c.sku || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{c.category || '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{c.price != null ? formatCurrency(c.price) : '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{c.quantity ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Price mismatches */}
      {discrepancies.filter(d => d.severity === 'info').length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-lg">💰</span>
            <h2 className="font-semibold text-gray-800">Price Mismatches</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-left">Detail</th>
                  <th className="px-4 py-2 text-left">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {discrepancies.filter(d => d.severity === 'info').map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{d.name}</td>
                    <td className="px-4 py-2 text-gray-600">{d.detail}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        {d.issue}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inSalesNotCatalogue.length === 0 && inCatalogueNotSales.length === 0 && discrepancies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">Catalogue looks clean!</p>
          <p className="text-sm mt-1">No gaps or mismatches found in this date range.</p>
        </div>
      )}
    </div>
  )
}
