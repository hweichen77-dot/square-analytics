import { useRef } from 'react'
import { motion, useMotionValue, useAnimationFrame, useTransform, useReducedMotion } from 'motion/react'

interface ShinyTextProps {
  text: string
  speed?: number
  color?: string
  shineColor?: string
  spread?: number
  className?: string
}

export default function ShinyText({
  text,
  speed = 3,
  color = '#d98a2b',
  shineColor = '#ffe4b3',
  spread = 120,
  className = '',
}: ShinyTextProps) {
  const reduced = useReducedMotion()
  const progress = useMotionValue(0)
  const elapsedRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)
  const animationDuration = speed * 1000

  useAnimationFrame(time => {
    if (reduced) return
    if (lastTimeRef.current === null) { lastTimeRef.current = time; return }
    elapsedRef.current += time - lastTimeRef.current
    lastTimeRef.current = time
    const cycleTime = elapsedRef.current % animationDuration
    progress.set((cycleTime / animationDuration) * 100)
  })

  const backgroundPosition = useTransform(progress, p => `${150 - p * 2}% center`)

  const gradientStyle = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  } as const

  if (reduced) {
    return <span className={className} style={{ color }}>{text}</span>
  }

  return (
    <motion.span
      className={className}
      style={{ ...gradientStyle, backgroundPosition, display: 'inline-block' }}
    >
      {text}
    </motion.span>
  )
}
