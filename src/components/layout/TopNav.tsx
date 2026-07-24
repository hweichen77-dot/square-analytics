import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

type NavItem = { label: string; path: string }
type NavMenu = { label: string; items: NavItem[] }

const MENUS: NavMenu[] = [
  { label: 'Overview', items: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Transactions', path: '/inventory' },
  ] },
  { label: 'Analytics', items: [
    { label: 'Time Analysis', path: '/time-analysis' },
    { label: 'Staff Performance', path: '/staff' },
    { label: 'Profit Margins', path: '/profit' },
    { label: 'Seasonal & Events', path: '/seasonal' },
    { label: 'Customer Frequency', path: '/customers' },
  ] },
  { label: 'Inventory', items: [
    { label: 'Restock Alerts', path: '/restock' },
    { label: 'Dead Stock', path: '/dead-stock' },
    { label: 'Purchase Order', path: '/purchase-order' },
  ] },
  { label: 'Insights', items: [
    { label: 'Sales Forecast', path: '/forecast' },
    { label: 'Anomaly Alerts', path: '/anomalies' },
    { label: 'Basket Analysis', path: '/basket-analysis' },
    { label: 'Bundle & Cross-Sell', path: '/bundles' },
    { label: 'Price Optimization', path: '/price-optimization' },
    { label: 'Staff Shift Analysis', path: '/staff-shift' },
  ] },
  { label: 'Catalogue', items: [
    { label: 'Catalogue Checker', path: '/catalogue-checker' },
    { label: 'Catalogue Products', path: '/catalogue-products' },
  ] },
  { label: 'Finance', items: [
    { label: 'Operating Expenses', path: '/opex' },
    { label: 'Reports', path: '/reports' },
    { label: 'Accountant Report', path: '/accountant-report' },
  ] },
  { label: 'Data', items: [
    { label: 'Import Data', path: '/import' },
    { label: 'Square Sync', path: '/square-sync' },
  ] },
]

export default function TopNav({ onSearch }: { onSearch: () => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [])

  useEffect(() => { setOpen(null) }, [pathname])

  return (
    <nav ref={navRef} className="flex items-center gap-1" aria-label="Primary">
      {MENUS.map(menu => {
        const active = menu.items.some(i => pathname === i.path || (i.path === '/inventory' && pathname.startsWith('/inventory')))
        const isOpen = open === menu.label
        return (
          <div key={menu.label} className="relative">
            <button
              onClick={() => setOpen(isOpen ? null : menu.label)}
              onMouseEnter={() => { if (open) setOpen(menu.label) }}
              aria-expanded={isOpen}
              aria-haspopup="true"
              className={`wa-navlink relative px-3 py-1.5 text-[13px] rounded-sm transition-colors ${
                active ? 'wa-navlink-active text-amber-400 font-medium' : isOpen ? 'text-stone-100' : 'text-stone-400 hover:text-stone-100'
              }`}
            >
              {menu.label}
            </button>
            {isOpen && (
              <div className="absolute left-0 top-full mt-1 min-w-[200px] py-1.5 bg-stone-900 border border-stone-700/70 shadow-xl shadow-black/40 rounded-md z-50 animate-[dropIn_.14s_cubic-bezier(0.16,1,0.3,1)]">
                {menu.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setOpen(null)}
                    className={({ isActive }) =>
                      `block px-4 py-1.5 text-[13px] transition-colors ${
                        isActive ? 'text-amber-400' : 'text-stone-300 hover:text-stone-100 hover:bg-stone-800/60'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <button
        onClick={onSearch}
        aria-label="Search products"
        className="ml-1 p-1.5 text-stone-500 hover:text-stone-200 transition-colors"
      >
        <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </button>
    </nav>
  )
}
