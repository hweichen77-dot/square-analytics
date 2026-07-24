interface StarBorderGlowProps {
  color?: string
  speed?: string
}

export default function StarBorderGlow({ color = 'oklch(0.86 0.10 82)', speed = '5s' }: StarBorderGlowProps) {
  const bg = `radial-gradient(circle, ${color}, transparent 10%)`
  return (
    <span className="wa-star-glow" aria-hidden="true">
      <span className="wa-star-top" style={{ background: bg, animationDuration: speed }} />
      <span className="wa-star-bottom" style={{ background: bg, animationDuration: speed }} />
    </span>
  )
}
