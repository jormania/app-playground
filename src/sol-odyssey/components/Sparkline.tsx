// A small, legible temperature chart (hand-rolled SVG, no charting dependency). Plots 1–10 over
// weeks 1–6 with faint gridlines, a 1/10 scale, week labels, the trend line, and the value at each
// point — so it orients at a glance instead of floating barren.

export interface SparkPoint {
  week: number
  temperature: number
}

const WEEKS = 6
const W = 360
const PAD_L = 22 // room for the y-scale (1 / 10)
const PAD_R = 12
const PAD_T = 16 // room for value labels above the top point
const PLOT_H = 84
const PAD_B = 18 // room for week labels
const H = PAD_T + PLOT_H + PAD_B
const PLOT_BOTTOM = PAD_T + PLOT_H

export function Sparkline({ points }: { points: SparkPoint[] }) {
  const valid = points.filter((p) => p.temperature >= 1).sort((a, b) => a.week - b.week)
  if (valid.length < 2) return null // a trend needs at least two weeks

  const x = (week: number) => PAD_L + ((week - 1) / (WEEKS - 1)) * (W - PAD_L - PAD_R)
  const y = (t: number) => PAD_T + (1 - (t - 1) / 9) * PLOT_H
  const line = valid.map((p) => `${x(p.week).toFixed(1)},${y(p.temperature).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Weekly temperature trend">
      {/* horizontal gridlines + y-scale (1, 5, 10) */}
      {[1, 5, 10].map((lvl) => (
        <g key={`h${lvl}`} className="text-border-tertiary">
          <line x1={PAD_L} x2={W - PAD_R} y1={y(lvl)} y2={y(lvl)} stroke="currentColor" strokeWidth={1} />
          <text x={PAD_L - 6} y={y(lvl) + 3} textAnchor="end" className="fill-text-secondary font-mono" fontSize={9}>
            {lvl}
          </text>
        </g>
      ))}

      {/* vertical week guides + x labels */}
      {Array.from({ length: WEEKS }, (_, i) => i + 1).map((wk) => (
        <g key={`v${wk}`}>
          <line x1={x(wk)} x2={x(wk)} y1={PAD_T} y2={PLOT_BOTTOM} className="text-border-tertiary" stroke="currentColor" strokeWidth={1} strokeDasharray="2 3" />
          <text x={x(wk)} y={H - 5} textAnchor="middle" className="fill-text-secondary font-mono" fontSize={9}>
            W{wk}
          </text>
        </g>
      ))}

      {/* the trend, in the energy violet */}
      <g className="text-energy">
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {valid.map((p) => (
          <g key={p.week}>
            <circle cx={x(p.week)} cy={y(p.temperature)} r={3.5} fill="currentColor" />
            <text x={x(p.week)} y={y(p.temperature) - 7} textAnchor="middle" className="fill-text-primary font-mono" fontSize={10} fontWeight={600}>
              {p.temperature}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}
