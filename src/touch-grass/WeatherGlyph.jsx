// The small drawn sky glyph (sun, cloud, rain, snow, fog, storm), shared by the
// Threshold's current-sky line and the corner mark's weather line. Coloured so it
// reads as a little picture (a dark halo keeps it legible over any ground).
const CLOUD = '#c3d0de', GOLD = '#e7c24a'

function Cloud({ y = 13 }) {
  return (
    <g fill={CLOUD}>
      <ellipse cx="12" cy={y} rx="7.5" ry="4" />
      <circle cx="7.6" cy={y - 1} r="3.3" />
      <circle cx="12" cy={y - 3.4} r="4" />
      <circle cx="16" cy={y - 1.4} r="3.1" />
    </g>
  )
}
function rays(cx, cy, inner, outer, n = 8) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { x1: cx + Math.cos(a) * inner, y1: cy + Math.sin(a) * inner, x2: cx + Math.cos(a) * outer, y2: cy + Math.sin(a) * outer }
  })
}
function Sun({ cx = 12, cy = 12, r = 5, ri = 7, ro = 10 }) {
  return (
    <g>
      {rays(cx, cy, ri, ro).map((p, i) => <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" />)}
      <circle cx={cx} cy={cy} r={r} fill={GOLD} />
    </g>
  )
}

export default function ForecastGlyph({ condition }) {
  let body
  if (condition === 'clear') body = <Sun />
  else if (condition === 'partly-cloudy') body = <><Sun cx={15.5} cy={8} r={3.4} ri={4.6} ro={6.6} /><Cloud y={15} /></>
  else if (condition === 'fog') body = <><Cloud y={10} /><g stroke={CLOUD} strokeWidth="1.4" strokeLinecap="round" fill="none"><path d="M5 16 q3 -1.6 6 0 t6 0" /><path d="M5 19 q3 -1.6 6 0 t6 0" /></g></>
  else if (condition === 'rain') body = <><Cloud y={9} /><g stroke="#bcd6e4" strokeWidth="1.5" strokeLinecap="round"><line x1="8" y1="15" x2="7" y2="19" /><line x1="12" y1="15" x2="11" y2="19" /><line x1="16" y1="15" x2="15" y2="19" /></g></>
  else if (condition === 'snow') body = <><Cloud y={9} /><g fill="#eef2f4"><circle cx="8" cy="17" r="1.1" /><circle cx="12" cy="19" r="1.1" /><circle cx="16" cy="17" r="1.1" /></g></>
  else if (condition === 'thunder') body = <><Cloud y={9} /><path d="M12.5 14 L9.5 19 L12 19 L10.5 23 L15 16.5 L12.5 16.5 Z" fill={GOLD} /></>
  else body = <Cloud />
  return <svg className="tg-fc-glyph" viewBox="0 0 24 24" aria-hidden="true">{body}</svg>
}
