export const chart = {
  bar: '#1d5fbf',
  barMuted: '#9db6dd',
  line: '#1d5fbf',
  ink: '#121110',
  grey: '#b9b6b1',
  grid: '#ebe9e6',
  axis: '#625f5b',
  tooltipBg: '#ffffff', tooltipBorder: '#e6e4e1', tooltipText: '#121110',
  positive: '#2e7d32', negative: '#c4242a',
  categorical: ['#1d5fbf', '#121110', '#8a8783', '#9db6dd', '#55524e', '#cfccc8', '#3f3c39', '#e2e0dc'],
} as const

export function heatBlue(t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const mix = (a: number, b: number) => Math.round(a + (b - a) * k)
  return `rgb(${mix(238, 29)}, ${mix(242, 95)}, ${mix(249, 191)})`
}
