import { useEffect, useRef, useState } from 'react'

export function useDeferredCompute<T>(compute: () => T, deps: unknown[]): { value: T | null; loading: boolean } {
  const [value, setValue] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const computeRef = useRef(compute)
  computeRef.current = compute

  useEffect(() => {
    let cancelled = false
    let raf2 = 0
    setLoading(true)
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return
        const result = computeRef.current()
        if (cancelled) return
        setValue(result)
        setLoading(false)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { value, loading }
}
