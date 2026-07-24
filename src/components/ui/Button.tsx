import { forwardRef, useRef, type ButtonHTMLAttributes, type MouseEvent } from 'react'
import StarBorderGlow from '../kit/StarBorderGlow'
import ClickSparkCanvas, { type ClickSparkHandle } from '../kit/ClickSparkCanvas'

const DEFAULT_PRIMARY = 'px-4 py-2 bg-amber-500 text-stone-950 rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string
  glow?: boolean
  spark?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, onClick, children, glow = false, spark = false, ...rest },
  ref,
) {
  const sparkRef = useRef<ClickSparkHandle>(null)

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (spark) {
      const rect = e.currentTarget.getBoundingClientRect()
      sparkRef.current?.spark(e.clientX - rect.left, e.clientY - rect.top)
    }
    onClick?.(e)
  }

  return (
    <button
      ref={ref}
      onClick={handleClick}
      className={`relative overflow-hidden isolate ${className ?? DEFAULT_PRIMARY}`}
      {...rest}
    >
      {glow && <StarBorderGlow />}
      {spark && <ClickSparkCanvas ref={sparkRef} />}
      {children}
    </button>
  )
})

export default Button
