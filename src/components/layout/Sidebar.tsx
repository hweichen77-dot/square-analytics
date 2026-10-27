import { NavLink } from 'react-router-dom'
import { format, isToday } from 'date-fns'
import { useRestockAlertCount } from '../../hooks/useRestockAlertCount'
import { useFabsAuditCount } from '../../hooks/useFabsAuditCount'
import { useAuthStore } from '../../store/authStore'
import { DateRangePicker } from './DateRangePicker'

type NavItem = { label: string; path: string }

const NAV_SECTIONS: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: 'Overview', path: '/dashboard' },
      { label: 'Transactions', path: '/inventory' },
    ],
  },
  {
    heading: 'Stock',
    items: [
      { label: 'Restock alerts', path: '/restock' },
      { label: 'Purchase order', path: '/purchase-order' },
      { label: 'Dead stock', path: '/dead-stock' },
      { label: 'Shrink and loss', path: '/shrink' },
    ],
  },
  {
    heading: 'Sales',
    items: [
      { label: 'Time of day', path: '/time-analysis' },
      { label: 'Seasonal and events', path: '/seasonal' },
      { label: 'Profit margins', path: '/profit' },
      { label: 'Customers', path: '/customers' },
    ],
  },
  {
    heading: 'Team',
    items: [
      { label: 'Staff performance', path: '/staff' },
      { label: 'Shifts', path: '/staff-shift' },
    ],
  },
  {
    heading: 'Insights',
    items: [
      { label: 'Forecast', path: '/forecast' },
      { label: 'Anomalies', path: '/anomalies' },
      { label: 'Baskets', path: '/basket-analysis' },
      { label: 'Bundles', path: '/bundles' },
      { label: 'Pricing', path: '/price-optimization' },
    ],
  },
  {
    heading: 'Catalogue',
    items: [
      { label: 'Category and tax audit', path: '/category-tax-audit' },
      { label: 'Catalogue checker', path: '/catalogue-checker' },
      { label: 'Products', path: '/catalogue-products' },
    ],
  },
  {
    heading: 'Money',
    items: [
      { label: 'Operating expenses', path: '/opex' },
      { label: 'Reports', path: '/reports' },
      { label: 'Accountant report', path: '/accountant-report' },
    ],
  },
]

const DATA_ITEMS: NavItem[] = [
  { label: 'Square sync', path: '/square-sync' },
  { label: 'Import a file', path: '/import' },
]

function WalleysMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
      <rect width="28" height="28" rx="6" fill="#121110" />
      <path d="M6.5 9l2.6 10 2.4-7.4L14 19l2.5-7.4L19 19l2.5-10" fill="none" stroke="#f4f3f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NavRow({ item, count, countNoun, onNavigate }: { item: NavItem; count?: number; countNoun?: string; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        `mx-2 flex items-center gap-2 h-8 px-3 rounded-md text-[14px] transition-colors ${
          isActive ? 'bg-[var(--active)] text-stone-100 font-medium' : 'text-stone-400 hover:text-stone-100 hover:bg-[#ecebe8]'
        }`
      }
    >
      <span className="truncate flex-1">{item.label}</span>
      {count != null && count > 0 && (
        <span className="shrink-0 tabular-nums text-xs text-red-500" aria-label={`${count} ${countNoun ?? ''}`}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  )
}

function SyncStamp() {
  const lastSyncDate = useAuthStore(s => s.lastSyncDate)
  if (!lastSyncDate) return <p className="px-5 text-xs text-stone-500">Not synced with Square yet</p>
  const d = new Date(lastSyncDate)
  return (
    <p className="px-5 text-xs text-stone-500">
      Synced {isToday(d) ? format(d, 'h:mm a') : format(d, 'MMM d, h:mm a')}
    </p>
  )
}

export default function Sidebar({ onNavigate, onSearch }: { onNavigate?: () => void; onSearch: () => void }) {
  const restockAlertCount = useRestockAlertCount()
  const fabsAuditCount = useFabsAuditCount()

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-4 flex items-center gap-3">
        <WalleysMark />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-stone-100 leading-tight">Walley&apos;s</p>
          <p className="text-xs text-stone-500 leading-tight mt-0.5 truncate">Valley Christian school store</p>
        </div>
      </div>

      <div className="px-4 space-y-2 pb-3">
        <DateRangePicker />
        <button
          onClick={onSearch}
          className="w-full flex items-center gap-2 h-8 px-3 rounded-md border border-[var(--control)] bg-white text-[13px] text-stone-500 hover:text-stone-100 hover:border-[#b9b6b1] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-xs text-stone-500 font-sans">⌘K</kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto pb-4 [scrollbar-width:thin]" aria-label="Main">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} role={section.heading ? 'group' : undefined} aria-label={section.heading}>
            {section.heading && (
              <p aria-hidden="true" className="px-5 pt-5 pb-1.5 text-xs text-stone-500 select-none">{section.heading}</p>
            )}
            {section.items.map(item => (
              <NavRow
                key={item.path}
                item={item}
                count={item.path === '/restock' ? restockAlertCount : item.path === '/category-tax-audit' ? fabsAuditCount : undefined}
                countNoun={item.path === '/restock' ? 'products to restock' : 'items to fix'}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] pt-3 pb-4 space-y-0.5">
        {DATA_ITEMS.map(item => <NavRow key={item.path} item={item} onNavigate={onNavigate} />)}
        <div className="pt-2"><SyncStamp /></div>
      </div>
    </div>
  )
}
