type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default:   'bg-[#eeeeee] text-[#3d3d3d]',
  secondary: 'bg-[#eeeeee] text-[#3d3d3d]',
  success:   'bg-[#dcfae5] text-[#04250e]',
  warning:   'bg-[#fffbeb] text-[#92400e]',
  danger:    'bg-[#ffedea] text-[#831c1e]',
}


interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex flex-none items-center whitespace-nowrap h-5 px-2 rounded text-xs font-medium ${VARIANT_CLASSES[variant]}`}>
      {children}
    </span>
  )
}

export function CategoryBadge({ category }: { category: string }) {
  return <Badge variant="secondary">{category}</Badge>
}
