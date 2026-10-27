import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import { ToastContainer } from './components/ui/ToastContainer'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { CommandPalette } from './components/ui/CommandPalette'
import { useAutoSync } from './hooks/useAutoSync'
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import { checkForAppUpdate } from './lib/appUpdate'
import { AnalyticsProvider } from './context/AnalyticsContext'

const DashboardView         = lazy(() => import('./views/DashboardView'))
const InventoryView         = lazy(() => import('./views/InventoryView'))
const ProductDetailView     = lazy(() => import('./views/ProductDetailView'))
const TimeAnalysisView      = lazy(() => import('./views/TimeAnalysisView'))
const StaffView             = lazy(() => import('./views/StaffView'))
const RestockView           = lazy(() => import('./views/RestockView'))
const ProfitView            = lazy(() => import('./views/ProfitView'))
const SeasonalView          = lazy(() => import('./views/SeasonalView'))
const DeadStockView         = lazy(() => import('./views/DeadStockView'))
const ShrinkView            = lazy(() => import('./views/ShrinkView'))
const BundleView            = lazy(() => import('./views/BundleView'))
const PriceOptimizationView = lazy(() => import('./views/PriceOptimizationView'))
const StaffShiftView        = lazy(() => import('./views/StaffShiftView'))
const CustomerView          = lazy(() => import('./views/CustomerView'))
const CatalogueCheckerView  = lazy(() => import('./views/CatalogueCheckerView'))
const CategoryTaxAuditView  = lazy(() => import('./views/CategoryTaxAuditView'))
const CatalogueProductsView = lazy(() => import('./views/CatalogueProductsView'))
const PurchaseOrderView     = lazy(() => import('./views/PurchaseOrderView'))
const ImportView            = lazy(() => import('./views/ImportView'))
const SquareSyncView        = lazy(() => import('./views/SquareSyncView'))
const SquareCallbackView    = lazy(() => import('./views/SquareCallbackView'))
const ReportsView           = lazy(() => import('./views/ReportsView'))
const ForecastView          = lazy(() => import('./views/ForecastView'))
const AnomalyView           = lazy(() => import('./views/AnomalyView'))
const BasketAnalysisView    = lazy(() => import('./views/BasketAnalysisView'))
const AccountantReportView  = lazy(() => import('./views/AccountantReportView'))
const OpexView              = lazy(() => import('./views/OpexView'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-stone-700 border-t-stone-100 rounded-full animate-spin" />
    </div>
  )
}

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
        }).then((handle: { remove: () => void }) => {
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
        }).then((unlisten: () => void) => {
          cancel = unlisten
        })
      })

      return () => cancel?.()
    }
  }, [navigate])
}

export default function App() {
  useDeepLinkHandler()
  useAuthBootstrap()
  useAutoSync()

  useEffect(() => { checkForAppUpdate() }, [])

  const { pathname } = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <AnalyticsProvider>
    <div className="flex h-screen overflow-hidden bg-[var(--ground)]">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <aside className="hidden lg:flex w-[240px] shrink-0 border-r border-[var(--border)]">
        <Sidebar onSearch={() => setPaletteOpen(true)} />
      </aside>
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[var(--ground)] flex flex-col">
          <div className="h-12 shrink-0 flex items-center justify-end px-4 border-b border-[var(--border)]">
            <button onClick={() => setMenuOpen(false)} className="h-11 px-3 text-sm text-stone-100" aria-label="Close menu">Close</button>
          </div>
          <div className="flex-1 min-h-0">
            <Sidebar onNavigate={() => setMenuOpen(false)} onSearch={() => { setMenuOpen(false); setPaletteOpen(true) }} />
          </div>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden h-12 shrink-0 flex items-center gap-3 px-4 border-b border-[var(--border)] bg-[var(--ground)]">
          <button onClick={() => setMenuOpen(true)} className="h-11 -ml-2 px-2 flex items-center gap-2 text-sm font-medium text-stone-100" aria-label="Open menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            Walley&apos;s
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-12 mx-auto w-full max-w-[1360px]">
          <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <div key={pathname}>
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
              <Route path="/shrink" element={<ShrinkView />} />
              <Route path="/bundles" element={<BundleView />} />
              <Route path="/price-optimization" element={<PriceOptimizationView />} />
              <Route path="/staff-shift" element={<StaffShiftView />} />
              <Route path="/customers" element={<CustomerView />} />
              <Route path="/catalogue-checker" element={<CatalogueCheckerView />} />
              <Route path="/category-tax-audit" element={<CategoryTaxAuditView />} />
              <Route path="/catalogue-products" element={<CatalogueProductsView />} />
              <Route path="/purchase-order" element={<PurchaseOrderView />} />
              <Route path="/import" element={<ImportView />} />
              <Route path="/square-sync" element={<SquareSyncView />} />
              <Route path="/square/callback" element={<SquareCallbackView />} />
              <Route path="/reports" element={<ReportsView />} />
              <Route path="/forecast" element={<ForecastView />} />
              <Route path="/anomalies" element={<AnomalyView />} />
              <Route path="/basket-analysis" element={<BasketAnalysisView />} />
              <Route path="/accountant-report" element={<AccountantReportView />} />
              <Route path="/opex" element={<OpexView />} />
            </Routes>
            </div>
          </Suspense>
          </ErrorBoundary>
        </div>
        </main>
      </div>
      <ToastContainer />
    </div>
    </AnalyticsProvider>
  )
}

