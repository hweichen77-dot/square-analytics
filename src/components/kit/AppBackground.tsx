import { lazy, Suspense } from 'react'
import { useReducedMotion } from 'motion/react'

const FaultyTerminal = lazy(() => import('./FaultyTerminal'))

export default function AppBackground() {
  const reducedMotion = useReducedMotion()

  return (
    <div className="fixed inset-0 z-0 pointer-events-none bg-stone-950" aria-hidden="true">
      {!reducedMotion && (
        <div className="absolute inset-0">
          <Suspense fallback={null}>
            <FaultyTerminal
              tint="#d98a2b"
              scale={1.6}
              gridMul={[2, 1]}
              digitSize={1.3}
              timeScale={0.28}
              scanlineIntensity={0.5}
              glitchAmount={1}
              flickerAmount={0.55}
              curvature={0.08}
              chromaticAberration={0}
              mouseReact
              mouseStrength={0.35}
              brightness={0.62}
              pageLoadAnimation
            />
          </Suspense>
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, oklch(0.72 0.14 78 / 0.16), transparent 55%), ' +
            'radial-gradient(100% 70% at 50% 60%, oklch(0.09 0.007 55 / 0.72), oklch(0.09 0.007 55 / 0.42) 70%, oklch(0.09 0.007 55 / 0.30)), ' +
            'linear-gradient(to bottom, oklch(0.09 0.007 55 / 0.30), oklch(0.09 0.007 55 / 0.55))',
        }}
      />
    </div>
  )
}
