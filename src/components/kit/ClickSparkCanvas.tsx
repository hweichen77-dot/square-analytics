import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface ClickSparkHandle {
  spark: (x: number, y: number) => void
}

interface ClickSparkCanvasProps {
  sparkColor?: string
  sparkSize?: number
  sparkRadius?: number
  sparkCount?: number
  duration?: number
}

interface Spark {
  x: number
  y: number
  angle: number
  startTime: number
}

const ClickSparkCanvas = forwardRef<ClickSparkHandle, ClickSparkCanvasProps>(function ClickSparkCanvas(
  { sparkColor = '#ffcf8a', sparkSize = 9, sparkRadius = 14, sparkCount = 8, duration = 420 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sparksRef = useRef<Spark[]>([])
  const rafRef = useRef(0)

  const easeOut = (t: number) => t * (2 - t)

  const draw = (timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    sparksRef.current = sparksRef.current.filter(spark => {
      const elapsed = timestamp - spark.startTime
      if (elapsed >= duration) return false
      const eased = easeOut(elapsed / duration)
      const distance = eased * sparkRadius
      const lineLength = sparkSize * (1 - eased)
      const x1 = spark.x + distance * Math.cos(spark.angle)
      const y1 = spark.y + distance * Math.sin(spark.angle)
      const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle)
      const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle)
      ctx.strokeStyle = sparkColor
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      return true
    })

    if (sparksRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(draw)
    } else {
      rafRef.current = 0
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  useImperativeHandle(ref, () => ({
    spark(x: number, y: number) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const canvas = canvasRef.current
      if (!canvas) return
      const parent = canvas.parentElement
      if (parent) {
        const rect = parent.getBoundingClientRect()
        if (canvas.width !== rect.width) canvas.width = rect.width
        if (canvas.height !== rect.height) canvas.height = rect.height
      }
      const now = performance.now()
      for (let i = 0; i < sparkCount; i++) {
        sparksRef.current.push({ x, y, angle: (2 * Math.PI * i) / sparkCount, startTime: now })
      }
      if (rafRef.current === 0) rafRef.current = requestAnimationFrame(draw)
    },
  }))

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
})

export default ClickSparkCanvas
