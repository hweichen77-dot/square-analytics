import { useEffect, useRef, useState } from 'react'

// Count a number up to its target once, on mount / when the target changes.
// Ease-out cubic; honors prefers-reduced-motion by jumping to the final value.
// Returns the live value — format it (currency, etc.) at the call site.
export function useCountUp(target: number, ms = 700): number {
  const [val, setVal] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const from = fromRef.current
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !Number.isFinite(target)) { setVal(target); fromRef.current = target; return }
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const p = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = from + (target - from) * eased
      setVal(v)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return val
}
