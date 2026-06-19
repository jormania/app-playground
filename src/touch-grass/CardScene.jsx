import { useState, useEffect, useMemo } from 'react'
import { getTimeOfDay, getSeason } from './context.js'

const W = 300, H = 190, GROUND = H

const SKY = {
  dawn:  ['#3a2a55', '#b5567a', '#e89a55'],
  day:   ['#4a86c0', '#8fc0e0', '#cfe8f2'],
  dusk:  ['#2a1f4a', '#8a3a5a', '#d2723a'],
  night: ['#142d44', '#1f4561', '#2f5d7c'],
}

const GRASS = { spring: '#8fc49b', summer: '#7bbf85', autumn: '#c79a5b', winter: '#93b0a4' }

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
    const len = i % 2 === 0 ? 24 : 14
    const d = `M ${r - 2} -3 Q ${r + len * 0.5} -7 ${r + len} 0 Q ${r + len * 0.5} 7 ${r - 2} 3 Z`
    return { d, deg: (360 / N) * i }
  })
}

function Sun({ cx, cy, r, dawn }) {
  const color = dawn ? '#ef9a3c' : '#f0c838'
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
      <circle cx={cx} cy={cy} r={r + 7} fill="rgba(243,234,212,0.10)" />
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
  { x: 56, y: 34, s: 1.5 }, { x: 90, y: 22, s: 1.0 }, { x: 38, y: 64, s: 1.1 },
  { x: 250, y: 30, s: 1.4 }, { x: 268, y: 60, s: 1.0 }, { x: 224, y: 18, s: 1.2 },
  { x: 150, y: 16, s: 1.0 },
]

function Stars({ bright }) {
  return (
    <g fill={PARCHMENT} opacity={bright ? 0.9 : 0.45}>
      {STARS.map((st, i) => (
        <path key={i} d={starPath(st.s)} transform={`translate(${st.x} ${st.y})`} />
      ))}
    </g>
  )
}

/* ---- Grass ---- */
const BLADES = Array.from({ length: 64 }, (_, i) => {
  const x = (i / 63) * W
  const h = 18 + ((i * 37) % 26)
  const lean = ((i * 53) % 16) - 8
  const base = 4 + ((i * 29) % 4)
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
      <rect x={0} y={GROUND - 6} width={W} height={6} fill={color} />
      <path d={d} fill={color} opacity="0.92" />
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
  const [c0, c1, c2] = SKY[timeOfDay]
  const showSun = timeOfDay === 'dawn' || timeOfDay === 'day'
  const showMoon = timeOfDay === 'dusk' || timeOfDay === 'night'
  const showStars = timeOfDay === 'dusk' || timeOfDay === 'night'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="tg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c0} />
          <stop offset="55%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#tg-sky)" />
      {showStars && <Stars bright={timeOfDay === 'night'} />}
      {showSun && <Sun cx={216} cy={58} r={30} dawn={timeOfDay === 'dawn'} />}
      {showMoon && <Moon cx={216} cy={58} r={28} />}
      <Grass color={GRASS[season]} />
    </svg>
  )
}
