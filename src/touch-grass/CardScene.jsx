import { useState, useEffect, useMemo } from 'react'
import { getTimeOfDay, getSeason } from './context.js'

const W = 300, H = 600, GROUND = 600

// Rich multi-stop skies. [offset%, color] pairs, top -> bottom.
const SKY = {
  dawn: [
    [0, '#1f1a3a'], [28, '#492f5e'], [55, '#a8506a'], [80, '#e8895a'], [100, '#f6b86e'],
  ],
  day: [
    [0, '#2f6fb0'], [32, '#5a9fd4'], [66, '#9fcce8'], [100, '#dceef4'],
  ],
  dusk: [
    [0, '#171633'], [30, '#46285e'], [58, '#8a3a5e'], [80, '#d2683a'], [100, '#f2a85a'],
  ],
  night: [
    [0, '#0b1a2e'], [34, '#15314e'], [64, '#21415e'], [86, '#3c4a5c'], [100, '#6b5847'],
  ],
}

// warm light sitting on the horizon — city glow, sunset embers, dawn break
const HORIZON_GLOW = {
  dawn:  '#f3b070',
  day:   null,
  dusk:  '#f0935a',
  night: '#d4a45e',
}

const GRASS = { spring: '#6fae72', summer: '#5f9c3e', autumn: '#b7853e', winter: '#5f7d6e' }

const SCRIM = {
  dawn:  ['#1a1230', 0.52],
  day:   ['#173040', 0.50],
  dusk:  ['#160f28', 0.56],
  night: ['#06101e', 0.58],
}

const INK = '#1c4a47'
const PARCHMENT = '#f3ead4'

function getCtx() {
  const now = new Date()
  return { timeOfDay: getTimeOfDay(now), season: getSeason(now) }
}

/* ---- Faced celestial body (shared by sun & moon) ---- */
function Face({ cx, cy, r, cheek }) {
  const ex = r * 0.40, ey = r * 0.10
  return (
    <g>
      <ellipse cx={cx - ex} cy={cy - ey} rx={r * 0.09} ry={r * 0.15} fill={INK} />
      <ellipse cx={cx + ex} cy={cy - ey} rx={r * 0.09} ry={r * 0.15} fill={INK} />
      <path d={`M ${cx} ${cy - ey} Q ${cx + r * 0.07} ${cy + r * 0.13} ${cx} ${cy + r * 0.20}`}
        fill="none" stroke={INK} strokeWidth={r * 0.05} strokeLinecap="round" />
      <path d={`M ${cx - r * 0.20} ${cy + r * 0.34} Q ${cx} ${cy + r * 0.52} ${cx + r * 0.20} ${cy + r * 0.34}`}
        fill="none" stroke={INK} strokeWidth={r * 0.05} strokeLinecap="round" />
      <circle cx={cx - r * 0.52} cy={cy + r * 0.30} r={r * 0.10} fill={cheek} opacity="0.6" />
      <circle cx={cx + r * 0.52} cy={cy + r * 0.30} r={r * 0.10} fill={cheek} opacity="0.6" />
    </g>
  )
}

function sunRays(r) {
  const N = 16
  return Array.from({ length: N }, (_, i) => {
    const len = i % 2 === 0 ? 30 : 17
    const d = `M ${r - 2} -3.5 Q ${r + len * 0.5} -8 ${r + len} 0 Q ${r + len * 0.5} 8 ${r - 2} 3.5 Z`
    return { d, deg: (360 / N) * i }
  })
}

function Sun({ cx, cy, r, dawn }) {
  const color = dawn ? '#ef9a3c' : '#f3cb3e'
  const rays = useMemo(() => sunRays(r), [r])
  return (
    <g>
      {rays.map((ray, i) => (
        <path key={i} d={ray.d} fill={color}
          transform={`translate(${cx} ${cy}) rotate(${ray.deg})`} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={color} />
      <Face cx={cx} cy={cy} r={r} cheek="#df5b3f" />
    </g>
  )
}

function Moon({ cx, cy, r }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 10} fill="rgba(243,234,212,0.08)" />
      <circle cx={cx} cy={cy} r={r} fill={PARCHMENT} />
      <Face cx={cx} cy={cy} r={r} cheek="#e2a92f" />
    </g>
  )
}

function starPath(s) {
  return `M 0 ${-6 * s} Q ${s} ${-s} ${6 * s} 0 Q ${s} ${s} 0 ${6 * s} `
    + `Q ${-s} ${s} ${-6 * s} 0 Q ${-s} ${-s} 0 ${-6 * s} Z`
}

const STARS = [
  { x: 54, y: 60, s: 1.7 }, { x: 96, y: 38, s: 1.1 }, { x: 36, y: 120, s: 1.2 },
  { x: 250, y: 54, s: 1.6 }, { x: 274, y: 104, s: 1.1 }, { x: 150, y: 30, s: 1.2 },
  { x: 120, y: 96, s: 0.9 }, { x: 210, y: 150, s: 1.0 }, { x: 70, y: 184, s: 0.9 },
]

function Stars({ bright }) {
  return (
    <g fill={PARCHMENT} opacity={bright ? 0.92 : 0.5}>
      {STARS.map((st, i) => (
        <path key={i} d={starPath(st.s)} transform={`translate(${st.x} ${st.y})`} />
      ))}
    </g>
  )
}

/* city lights twinkling low on the horizon */
const CITY = Array.from({ length: 22 }, (_, i) => ({
  x: 10 + (i / 21) * 280,
  y: GROUND - 26 - ((i * 13) % 16),
  r: 0.8 + ((i * 7) % 3) * 0.35,
}))

function CityLights({ color }) {
  return (
    <g fill={color}>
      {CITY.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={c.r} opacity={0.45 + ((i * 17) % 5) * 0.1} />
      ))}
    </g>
  )
}

/* ---- Grass ---- */
const BLADES = Array.from({ length: 90 }, (_, i) => {
  const x = (i / 89) * W
  const h = 30 + ((i * 37) % 56)
  const lean = ((i * 53) % 22) - 11
  const base = 5 + ((i * 29) % 5)
  return { x, h, lean, base }
})

function bladePath({ x, h, lean, base }) {
  const tipX = x + lean, tipY = GROUND - h
  return `M ${x - base / 2} ${GROUND} Q ${tipX} ${GROUND - h * 0.6} ${tipX} ${tipY} `
    + `Q ${tipX + base * 0.4} ${GROUND - h * 0.55} ${x + base / 2} ${GROUND} Z`
}

function Grass({ color }) {
  const d = useMemo(() => BLADES.map(bladePath).join(' '), [])
  return (
    <g>
      <rect x={0} y={GROUND - 14} width={W} height={14} fill={color} />
      <path d={d} fill={color} opacity="0.95" />
    </g>
  )
}

export default function CardScene() {
  const [ctx, setCtx] = useState(getCtx)

  useEffect(() => {
    const id = setInterval(() => setCtx(getCtx()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { timeOfDay, season } = ctx
  const stops = SKY[timeOfDay]
  const glow = HORIZON_GLOW[timeOfDay]
  const [scrimColor, scrimAlpha] = SCRIM[timeOfDay]
  const showSun = timeOfDay === 'dawn' || timeOfDay === 'day'
  const showMoon = timeOfDay === 'dusk' || timeOfDay === 'night'
  const dim = timeOfDay === 'dusk' || timeOfDay === 'night'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="tg-sky" x1="0" y1="0" x2="0" y2="1">
          {stops.map(([off, col]) => <stop key={off} offset={`${off}%`} stopColor={col} />)}
        </linearGradient>
        <radialGradient id="tg-glow" cx="50%" cy="100%" r="75%">
          <stop offset="0%" stopColor={glow || '#ffffff'} stopOpacity="0.55" />
          <stop offset="55%" stopColor={glow || '#ffffff'} stopOpacity="0.16" />
          <stop offset="100%" stopColor={glow || '#ffffff'} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tg-scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scrimColor} stopOpacity="0" />
          <stop offset="40%" stopColor={scrimColor} stopOpacity="0" />
          <stop offset="100%" stopColor={scrimColor} stopOpacity={scrimAlpha} />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={W} height={H} fill="url(#tg-sky)" />
      {glow && <rect x="0" y={H * 0.45} width={W} height={H * 0.55} fill="url(#tg-glow)" />}
      {dim && <Stars bright={timeOfDay === 'night'} />}
      {showSun && <Sun cx={212} cy={112} r={40} dawn={timeOfDay === 'dawn'} />}
      {showMoon && <Moon cx={212} cy={112} r={36} />}
      {dim && <CityLights color={glow} />}
      <Grass color={GRASS[season]} />
      <rect x="0" y="0" width={W} height={H} fill="url(#tg-scrim)" />
    </svg>
  )
}
