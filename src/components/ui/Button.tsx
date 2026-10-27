import { forwardRef, type ButtonHTMLAttributes } from 'react'

const DEFAULT_PRIMARY = 'h-9 px-4 bg-stone-100 text-white rounded-md text-sm font-medium hover:bg-stone-300 disabled:opacity-60 transition-colors'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string
  glow?: boolean
  spark?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, children, glow: _glow, spark: _spark, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={className ?? DEFAULT_PRIMARY} {...rest}>
      {children}
    </button>
  )
})

export default Button
