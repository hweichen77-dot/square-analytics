import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import { ToastContainer } from './components/ui/ToastContainer'
import DashboardView from './views/DashboardView'
import InventoryView from './views/InventoryView'
import ProductDetailView from './views/ProductDetailView'
import TimeAnalysisView from './views/TimeAnalysisView'
import StaffView from './views/StaffView'
import RestockView from './views/RestockView'
import ProfitView from './views/ProfitView'
import SeasonalView from './views/SeasonalView'
import DeadStockView from './views/DeadStockView'
import BundleView from './views/BundleView'
import PriceOptimizationView from './views/PriceOptimizationView'
import StaffShiftView from './views/StaffShiftView'
import CustomerView from './views/CustomerView'
import CatalogueCheckerView from './views/CatalogueCheckerView'
import CatalogueProductsView from './views/CatalogueProductsView'
import PurchaseOrderView from './views/PurchaseOrderView'
import ImportView from './views/ImportView'
import SquareSyncView from './views/SquareSyncView'
import SquareCallbackView from './views/SquareCallbackView'

function useDeepLinkHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      let cleanup: (() => void) | undefined

      import('@capacitor/app').then(({ App }) => {
        App.addListener('appUrlOpen', (event: { url: string }) => {
          try {
            const parsed = new URL(event.url)
            if (parsed.hostname === 'square' && parsed.pathname === '/callback') {
              const code = parsed.searchParams.get('code') ?? ''
              const state = parsed.searchParams.get('state') ?? ''
              navigate(`/square/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
              import('@capacitor/browser').then(({ Browser }) => Browser.close())
            }
          } catch {
          }
        }).then(handle => {
          cleanup = () => handle.remove()
        })
      })

      return () => cleanup?.()
    }

    if ((window as any).__TAURI_INTERNALS__ !== undefined) {
      let cancel: (() => void) | undefined

      import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
        onOpenUrl((urls: string[]) => {
          for (const url of urls) {
            try {
              const parsed = new URL(url)
              if (parsed.hostname === 'square' && parsed.pathname === '/callback') {
                const code = parsed.searchParams.get('code') ?? ''
                const state = parsed.searchParams.get('state') ?? ''
                navigate(`/square/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
              }
            } catch {
            }
          }
        }).then(unlisten => {
          cancel = unlisten
        })
      })

      return () => cancel?.()
    }
  }, [navigate])
}

export default function App() {
  useDeepLinkHandler()

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/inventory" element={<InventoryView />} />
            <Route path="/inventory/:productName" element={<ProductDetailView />} />
            <Route path="/time-analysis" element={<TimeAnalysisView />} />
            <Route path="/staff" element={<StaffView />} />
            <Route path="/restock" element={<RestockView />} />
            <Route path="/profit" element={<ProfitView />} />
            <Route path="/seasonal" element={<SeasonalView />} />
            <Route path="/dead-stock" element={<DeadStockView />} />
            <Route path="/bundles" element={<BundleView />} />
            <Route path="/price-optimization" element={<PriceOptimizationView />} />
            <Route path="/staff-shift" element={<StaffShiftView />} />
            <Route path="/customers" element={<CustomerView />} />
            <Route path="/catalogue-checker" element={<CatalogueCheckerView />} />
            <Route path="/catalogue-products" element={<CatalogueProductsView />} />
            <Route path="/purchase-order" element={<PurchaseOrderView />} />
            <Route path="/import" element={<ImportView />} />
            <Route path="/square-sync" element={<SquareSyncView />} />
            <Route path="/square/callback" element={<SquareCallbackView />} />
          </Routes>
        </div>
      </main>
      <ToastContainer />
    </div>
  )
}
