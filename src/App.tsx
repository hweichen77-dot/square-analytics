import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, NavLink, useLocation } from 'react-router-dom'
import AppBackground from './components/kit/AppBackground'
import TopNav from './components/layout/TopNav'
import { DateRangePicker } from './components/layout/DateRangePicker'
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
      <div className="w-6 h-6 border-2 border-stone-700 border-t-amber-400 rounded-full animate-spin" />
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
    <div className="relative flex flex-col h-screen overflow-hidden">
      <AppBackground />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <header className="relative z-30 shrink-0 sticky top-0 bg-stone-950/80 backdrop-blur-md border-b border-amber-500/25 shadow-[0_1px_0_0_oklch(0.72_0.14_78/0.10),0_8px_24px_-12px_oklch(0.09_0.007_55/0.9)] h-14 px-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-7 min-w-0">
          <NavLink to="/dashboard" className="group flex items-center gap-2.5 shrink-0">
            <span className="grid place-items-center w-6 h-6 rounded-sm bg-amber-500 text-stone-950 font-display font-800 text-[13px] shadow-[0_0_18px_-2px_oklch(0.72_0.14_78/0.6)]">S</span>
            <span className="font-display text-[16px] font-800 text-stone-100 tracking-tight group-hover:text-white transition-colors">Square Analytics</span>
          </NavLink>
          <div className="hidden lg:flex min-w-0">
            <TopNav onSearch={() => setPaletteOpen(true)} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPaletteOpen(true)}
            className="lg:hidden p-1.5 text-stone-400 hover:text-stone-100"
            aria-label="Search"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          <DateRangePicker />
        </div>
      </header>
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="px-6 lg:px-10 py-8 mx-auto w-full max-w-[1600px]">
          <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <div key={pathname} className="cf-page-enter">
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
      <ToastContainer />
    </div>
    </AnalyticsProvider>
  )
}

