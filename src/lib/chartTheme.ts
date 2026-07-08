// Shared "ledger" chart palette — warm amber/stone tones only.
// No blue/teal/indigo/cyan/violet/pink. Positive/negative stay green/red.
export const chart = {
  bar: 'oklch(0.80 0.13 80)',       // amber-400, primary series
  barMuted: 'oklch(0.50 0.10 76)',  // amber-700, secondary series
  line: 'oklch(0.80 0.13 80)',
  grid: 'oklch(0.23 0.006 55)',     // warm stone hairline
  axis: '#d6d3d1',                   // warm stone-300 labels
  tooltipBg: '#1c1917', tooltipBorder: '#44403c', tooltipText: '#fafaf9',
  positive: '#34D399', negative: '#F87171',
  // categorical (warm, NO blue/teal/indigo/cyan/violet/pink):
  categorical: ['#F59E0B', '#D97706', '#B45309', '#9A3412', '#65A30D', '#CA8A04', '#A8A29E', '#78716C'],
} as const
