import Button from './Button'
interface EmptyStateProps {
  title: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="max-w-lg py-16 border-l-2 border-amber-500/60 pl-6">
      <h3 className="font-display text-2xl font-700 text-stone-100 tracking-tight">{title}</h3>
      {subtitle && <p className="text-sm text-stone-400 mt-2 leading-relaxed">{subtitle}</p>}
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-6 px-4 py-2 bg-amber-500 text-stone-950 rounded text-sm font-semibold hover:bg-amber-400 transition-colors cursor-pointer"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
