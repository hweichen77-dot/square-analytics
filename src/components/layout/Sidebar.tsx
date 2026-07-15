import { NavLink } from 'react-router-dom'
import { useRestockAlertCount } from '../../hooks/useRestockAlertCount'

type NavItem = { label: string; path: string }

const NAV_SECTIONS: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Transactions', path: '/inventory' },
    ],
  },
  {
    heading: 'Analytics',
    items: [
      { label: 'Time Analysis', path: '/time-analysis' },
      { label: 'Staff Performance', path: '/staff' },
      { label: 'Profit Margins', path: '/profit' },
      { label: 'Seasonal & Events', path: '/seasonal' },
      { label: 'Customer Frequency', path: '/customers' },
    ],
  },
  {
    heading: 'Inventory',
    items: [
      { label: 'Restock Alerts', path: '/restock' },
      { label: 'Dead Stock', path: '/dead-stock' },
      { label: 'Shrink & Loss', path: '/shrink' },
      { label: 'Purchase Order', path: '/purchase-order' },
    ],
  },
  {
    heading: 'Insights',
    items: [
      { label: 'Sales Forecast', path: '/forecast' },
      { label: 'Anomaly Alerts', path: '/anomalies' },
      { label: 'Basket Analysis', path: '/basket-analysis' },
      { label: 'Bundle & Cross-Sell', path: '/bundles' },
      { label: 'Price Optimization', path: '/price-optimization' },
      { label: 'Staff Shift Analysis', path: '/staff-shift' },
    ],
  },
  {
    heading: 'Catalogue',
    items: [
      { label: 'Catalogue Checker', path: '/catalogue-checker' },
      { label: 'Catalogue Products', path: '/catalogue-products' },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { label: 'Operating Expenses', path: '/opex' },
    ],
  },
]

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Reports', path: '/reports' },
  { label: 'Accountant Report', path: '/accountant-report' },
  { label: 'Import Data', path: '/import' },
  { label: 'Square Sync', path: '/square-sync' },
]

function NavRow({ item, badge, onClose }: { item: NavItem; badge?: number; onClose?: () => void }) {
  return (
    <NavLink
      to={item.path}
      onClick={onClose}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 pl-6 pr-4 py-[5px] text-[13.5px] transition-colors duration-150 ${
          isActive
            ? 'text-amber-400 font-medium'
            : 'text-stone-400 hover:text-stone-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={`h-[3px] w-[3px] rounded-full shrink-0 transition-colors ${
              isActive ? 'bg-amber-400' : 'bg-transparent group-hover:bg-stone-600'
            }`}
          />
          <span className="truncate flex-1">{item.label}</span>
          {badge != null && badge > 0 && (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-red-400">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const restockAlertCount = useRestockAlertCount()

  return (
    <aside className={[
      'w-56 shrink-0 bg-stone-900 border-r border-stone-800/80 flex flex-col h-full',
      'fixed inset-y-0 left-0 z-50 transition-transform duration-200',
      'lg:static lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ].join(' ')}>
      <div className="px-6 pt-7 pb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-[22px] font-800 text-stone-100 leading-none tracking-tight">
            Walley&apos;s
          </h1>
          <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-amber-500/80 mt-2">
            Store Ledger
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 text-stone-400 hover:text-stone-100 -mt-1 -mr-1" aria-label="Close menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto pb-3 [scrollbar-width:thin]">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} role={section.heading ? 'group' : undefined} aria-label={section.heading}>
            {section.heading && (
              <p aria-hidden="true" className="pl-6 pr-4 pt-5 pb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500 select-none">
                {section.heading}
              </p>
            )}
            {section.items.map(item => (
              <NavRow
                key={item.path}
                item={item}
                badge={item.path === '/restock' ? restockAlertCount : undefined}
                onClose={onClose}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-stone-800/80 py-3">
        {BOTTOM_ITEMS.map(item => (
          <NavRow key={item.path} item={item} onClose={onClose} />
        ))}
      </div>
    </aside>
  )
}
