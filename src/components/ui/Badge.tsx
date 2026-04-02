type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-indigo-100 text-indigo-700',
  secondary: 'bg-gray-100 text-gray-600',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
}

const CATEGORY_BADGE_VARIANT: Record<string, BadgeVariant> = {
  'Food': 'warning',
  'Drinks': 'default',
  'Ice Cream': 'success',
  'Ramen/Hot Food': 'danger',
  'Merch': 'secondary',
  'Other': 'secondary',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${VARIANT_CLASSES[variant]}`}>
      {children}
    </span>
  )
}

export function CategoryBadge({ category }: { category: string }) {
  const variant = CATEGORY_BADGE_VARIANT[category] ?? 'secondary'
  return <Badge variant={variant}>{category}</Badge>
}
