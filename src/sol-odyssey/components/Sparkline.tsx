// A tiny hand-rolled SVG sparkline (no charting dependency) for the weekly temperature trend —
// 1..10 over weeks 1..6. Colour comes from the energy token via `currentColor`.

export interface SparkPoint {
  week: number
  temperature: number
}

export function Sparkline({ points }: { points: SparkPoint[] }) {
  // A wide viewBox + a capped max width keep the rendered height ~64px instead of ballooning
  // with the container width (the old w-full + 240×56 bug stretched it to ~300px tall).
  const W = 360
  const H = 64
  const PAD = 10
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2

  const valid = points.filter((p) => p.temperature >= 1).sort((a, b) => a.week - b.week)
  if (valid.length < 2) return null // a trend needs at least two weeks

  const x = (week: number) => PAD + ((week - 1) / 5) * innerW
  const y = (t: number) => PAD + (1 - (t - 1) / 9) * innerH
  const line = valid.map((p) => `${x(p.week).toFixed(1)},${y(p.temperature).toFixed(1)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full max-w-sm text-energy"
      role="img"
      aria-label="Weekly temperature trend"
    >
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {valid.map((p) => (
        <circle key={p.week} cx={x(p.week)} cy={y(p.temperature)} r={3.5} fill="currentColor" />
      ))}
    </svg>
  )
}
