import Button from './Button'
interface EmptyStateProps {
  title: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="max-w-xl rounded-lg border border-dashed border-[var(--control)] bg-white px-6 py-8">
      <h3 className="text-base font-semibold text-stone-100">{title}</h3>
      {subtitle && <p className="text-sm text-stone-400 mt-1.5 leading-relaxed">{subtitle}</p>}
      {action && (
        <Button onClick={action.onClick} className="mt-5 h-9 px-4 bg-stone-100 text-white rounded-md text-sm font-medium hover:bg-stone-300 transition-colors cursor-pointer">
          {action.label}
        </Button>
      )}
    </div>
  )
}
