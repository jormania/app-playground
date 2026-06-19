import { useState, useEffect, useMemo, useRef } from 'react'
import { getTimeOfDay, getSeason } from './context.js'
import { getZodiac, CONSTELLATIONS } from './zodiac.js'

const W = 300, H = 600, GROUND = 600

function dayOfYear(d) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
}

// small deterministic PRNG so a given day always yields the same sky
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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
  return { timeOfDay: getTimeOfDay(now), season: getSeason(now), date: now }
}

/* ---- One eye: almond white, teal iris with pupil + glint, heavy upper lid ---- */
function Eye({ cx, cy, r, sw, iris }) {
  const w = r * 0.21, h = r * 0.14
  const ir = r * 0.092
  const iy = cy + h * 0.22
  return (
    <g>
      <path d={`M ${cx - w} ${cy} Q ${cx} ${cy - h} ${cx + w} ${cy} Q ${cx} ${cy + h} ${cx - w} ${cy} Z`}
        fill={PARCHMENT} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      <circle cx={cx} cy={iy} r={ir} fill={iris} />
      <circle cx={cx} cy={iy} r={ir * 0.48} fill="#16302e" />
      <circle cx={cx - ir * 0.34} cy={iy - ir * 0.34} r={ir * 0.24} fill="#fdf7e6" />
      <path d={`M ${cx - w} ${cy} Q ${cx} ${cy - h} ${cx + w} ${cy}`}
        fill="none" stroke={INK} strokeWidth={sw * 1.25} strokeLinecap="round" />
    </g>
  )
}

/* ---- Faced celestial body — opera-doll warmth (shared by sun & moon) ---- */
function Face({ cx, cy, r, cheek, lip, iris }) {
  const ex = r * 0.44, ey = r * 0.04
  const sw = r * 0.05
  const brow = (sx) => `M ${sx - r * 0.15} ${cy - ey - r * 0.21} Q ${sx} ${cy - ey - r * 0.30} ${sx + r * 0.15} ${cy - ey - r * 0.20}`
  return (
    <g>
      {/* rosy rouged cheeks — sit behind the features */}
      <circle cx={cx - r * 0.53} cy={cy + r * 0.31} r={r * 0.135} fill={cheek} opacity="0.7" />
      <circle cx={cx + r * 0.53} cy={cy + r * 0.31} r={r * 0.135} fill={cheek} opacity="0.7" />
      {/* brows */}
      <path d={brow(cx - ex)} fill="none" stroke={INK} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <path d={brow(cx + ex)} fill="none" stroke={INK} strokeWidth={sw * 0.8} strokeLinecap="round" />
      <Eye cx={cx - ex} cy={cy - ey} r={r} sw={sw} iris={iris} />
      <Eye cx={cx + ex} cy={cy - ey} r={r} sw={sw} iris={iris} />
      {/* long elegant nose with a soft hook */}
      <path d={`M ${cx} ${cy + r * 0.01} Q ${cx + r * 0.12} ${cy + r * 0.20} ${cx + r * 0.02} ${cy + r * 0.28} `
        + `Q ${cx - r * 0.04} ${cy + r * 0.30} ${cx - r * 0.07} ${cy + r * 0.255}`}
        fill="none" stroke={INK} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      {/* small colored lips, gentle smile */}
      <path d={`M ${cx - r * 0.15} ${cy + r * 0.42} Q ${cx} ${cy + r * 0.39} ${cx + r * 0.15} ${cy + r * 0.42} `
        + `Q ${cx} ${cy + r * 0.54} ${cx - r * 0.15} ${cy + r * 0.42} Z`}
        fill={lip} stroke={INK} strokeWidth={sw * 0.55} strokeLinejoin="round" />
    </g>
  )
}

function sunRays(r) {
  const N = 24
  return Array.from({ length: N }, (_, i) => {
    const wavy = i % 2 === 0
    const d = wavy
      ? `M ${r - 1} -2 Q ${r + 9} -7 ${r + 17} -2 Q ${r + 26} 0 ${r + 17} 2 Q ${r + 9} 7 ${r - 1} 2 Z`
      : `M ${r - 1} -2.2 L ${r + 14} 0 L ${r - 1} 2.2 Z`
    return { d, deg: (360 / N) * i }
  })
}

function Sun({ cx, cy, r, dawn }) {
  const color = dawn ? '#ef9a3c' : '#f3cb3e'
  const deep = dawn ? '#d97c2a' : '#e0ad28'
  const rays = useMemo(() => sunRays(r), [r])
  return (
    <g>
      {rays.map((ray, i) => (
        <path key={i} d={ray.d} fill={i % 2 === 0 ? color : deep}
          transform={`translate(${cx} ${cy}) rotate(${ray.deg})`} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={color} stroke={deep} strokeWidth={r * 0.04} />
      <Face cx={cx} cy={cy} r={r} cheek="#e0664a" lip="#d8543a" iris="#2f7a86" />
    </g>
  )
}

function Moon({ cx, cy, r }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 12} fill="rgba(243,234,212,0.07)" />
      <circle cx={cx} cy={cy} r={r + 6} fill="rgba(243,234,212,0.06)" />
      <circle cx={cx} cy={cy} r={r} fill={PARCHMENT} stroke="rgba(28,74,71,0.18)" strokeWidth="1" />
      <Face cx={cx} cy={cy} r={r} cheek="#ecc24f" lip="#e08a46" iris="#2f8a9a" />
    </g>
  )
}

function starPath(s) {
  return `M 0 ${-6 * s} Q ${s} ${-s} ${6 * s} 0 Q ${s} ${s} 0 ${6 * s} `
    + `Q ${-s} ${s} ${-6 * s} 0 Q ${-s} ${-s} 0 ${-6 * s} Z`
}

// constellation sits top-left; moon lives top-right, so they never collide
const CON_BOX = { gx: 14, gy: 84, gw: 122, gh: 90 }

function Sky({ bright, dayKey, date }) {
  const con = CONSTELLATIONS[getZodiac(date)] || CONSTELLATIONS.aries
  const { gx, gy, gw, gh } = CON_BOX
  const pts = con.points.map(([px, py]) => ({ x: gx + px * gw, y: gy + py * gh }))
  const op = bright ? 0.95 : 0.55

  // background scatter — reseeded per calendar day; small, faint, slowly drifting
  const scatter = useMemo(() => {
    const rand = rng(dayKey)
    const out = []
    let tries = 0
    while (out.length < 10 && tries < 100) {
      tries++
      const x = 12 + rand() * 276
      const y = 14 + rand() * 168
      if (Math.hypot(x - 210, y - 110) < 58) continue          // clear of the moon
      if (x > gx - 8 && x < gx + gw + 8 && y > gy - 8 && y < gy + gh + 8 && rand() < 0.7) continue // thin near constellation
      const dx = (rand() - 0.5) * 30, dy = (rand() - 0.5) * 22
      const dx2 = (rand() - 0.5) * 30, dy2 = (rand() - 0.5) * 22
      const driftDur = 16 + rand() * 18
      out.push({
        x, y,
        s: 0.45 + rand() * 0.55,
        dur: (2.6 + rand() * 3.6).toFixed(2),
        drift: `0,0; ${dx.toFixed(1)},${dy.toFixed(1)}; ${dx2.toFixed(1)},${dy2.toFixed(1)}; 0,0`,
        driftDur: driftDur.toFixed(1),
        begin: (-rand() * driftDur).toFixed(1),
      })
    }
    return out
  }, [dayKey, gx, gy, gw, gh])

  return (
    <g>
      <g stroke={PARCHMENT} strokeWidth="0.6" opacity={op * 0.32}>
        {con.lines.map(([a, b], i) => (
          <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} />
        ))}
      </g>
      <g fill={PARCHMENT} opacity={op}>
        {pts.map((p, i) => (
          <path key={i} d={starPath(i === 0 ? 1.8 : 1.25)} transform={`translate(${p.x} ${p.y})`} />
        ))}
      </g>
      <g fill={PARCHMENT}>
        {scatter.map((st, i) => {
          const faint = op * 0.55
          return (
            <g key={i}>
              <animateTransform attributeName="transform" type="translate" values={st.drift}
                dur={`${st.driftDur}s`} begin={`${st.begin}s`} repeatCount="indefinite" />
              <path d={starPath(st.s)} transform={`translate(${st.x} ${st.y})`} opacity={faint}>
                <animate attributeName="opacity" values={`${faint * 0.3};${faint};${faint * 0.3}`}
                  dur={`${st.dur}s`} repeatCount="indefinite" />
              </path>
            </g>
          )
        })}
      </g>
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

/* ---- Wildflowers nestled in the grass, colored by season ---- */
const FLOWER_COLORS = {
  spring: { petal: '#f3cdd9', center: '#ecc24f', stem: '#4f8f56' },
  summer: { petal: '#f4d452', center: '#e0902e', stem: '#4a8030' },
  autumn: { petal: '#e3934a', center: '#8f5126', stem: '#7a6030' },
  winter: { petal: '#d6e3e0', center: '#a9c0bb', stem: '#4f6a5e' },
}
const FLOWERS = [
  { x: 26, h: 44, lean: 4 }, { x: 78, h: 32, lean: -5 }, { x: 150, h: 50, lean: 3 },
  { x: 212, h: 36, lean: -4 }, { x: 268, h: 46, lean: 5 },
]

function Flower({ x, h, lean, c }) {
  const hx = x + lean, hy = GROUND - h
  const petals = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    return { x: hx + Math.cos(a) * 3, y: hy + Math.sin(a) * 3 }
  })
  return (
    <g>
      <path d={`M ${x} ${GROUND} Q ${hx - lean} ${GROUND - h * 0.5} ${hx} ${hy}`}
        fill="none" stroke={c.stem} strokeWidth="1.4" strokeLinecap="round" />
      {petals.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={c.petal} />)}
      <circle cx={hx} cy={hy} r="2" fill={c.center} />
    </g>
  )
}

function Flowers({ season }) {
  const c = FLOWER_COLORS[season]
  return <g opacity="0.92">{FLOWERS.map((f, i) => <Flower key={i} {...f} c={c} />)}</g>
}

/* ---- Fireflies at dusk/night, a butterfly by day ---- */
const FIREFLIES = [
  { x: 56, y: GROUND - 72, dur: 2.6 }, { x: 118, y: GROUND - 52, dur: 3.4 },
  { x: 176, y: GROUND - 84, dur: 2.2 }, { x: 238, y: GROUND - 58, dur: 3.0 },
  { x: 30, y: GROUND - 46, dur: 3.8 },
]

const SNOW = Array.from({ length: 14 }, (_, i) => ({
  x: ((i * 53) % 288) + 6,
  r: 0.9 + (i % 3) * 0.4,
  dur: 6 + (i % 5),
  delay: -(i * 0.8),
}))

function Snow() {
  return (
    <g fill="#eef2f4">
      {SNOW.map((s, i) => (
        <circle key={i} cx={s.x} cy={60} r={s.r}>
          <animate attributeName="cy" values={`50;${GROUND - 12}`} dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.85;0.85;0" dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  )
}

function Firefly({ x, y, dur, i }) {
  const d = 7 + (i % 3) * 4
  const drift = `0,0; ${d},${-d}; ${-d * 0.6},${d * 0.5}; ${d * 0.5},${d}; 0,0`
  return (
    <g>
      <animateTransform attributeName="transform" type="translate" values={drift}
        dur={`${dur * 3.2}s`} repeatCount="indefinite" />
      <circle cx={x} cy={y} r="3.6" fill="#eef0a0" opacity="0.16">
        <animate attributeName="opacity" values="0.04;0.28;0.04" dur={`${dur}s`} repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r="1.2" fill="#f6f2b0">
        <animate attributeName="opacity" values="0.3;1;0.3" dur={`${dur}s`} repeatCount="indefinite" />
      </circle>
    </g>
  )
}

// each butterfly meanders its own loop of waypoints across the lower scene
const BUTTERFLIES = [
  { dur: 26, begin: 0, s: 1, up: '#df6a4a', lo: '#e89a4a',
    flight: '60,520; 150,470; 240,505; 270,555; 180,575; 90,535; 50,565; 60,520' },
  { dur: 31, begin: -9, s: 0.82, up: '#e8c24a', lo: '#f0d878',
    flight: '210,455; 130,415; 70,480; 150,525; 250,490; 285,530; 220,560; 210,455' },
  { dur: 23, begin: -16, s: 1.12, up: '#d4738f', lo: '#e6a6b6',
    flight: '120,560; 210,515; 270,545; 230,498; 150,468; 80,512; 60,560; 120,560' },
]

function Butterfly({ flight, dur, begin, s, up, lo }) {
  return (
    <g opacity="0.92">
      <animateTransform attributeName="transform" type="translate" values={flight}
        dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
      <g transform={`scale(${s})`}>
        <ellipse cx="-3" cy="-2" rx="3.4" ry="4.4" fill={up} transform="rotate(-18 -3 -2)" />
        <ellipse cx="3" cy="-2" rx="3.4" ry="4.4" fill={up} transform="rotate(18 3 -2)" />
        <ellipse cx="-2.6" cy="3" rx="2.4" ry="3" fill={lo} transform="rotate(-26 -2.6 3)" />
        <ellipse cx="2.6" cy="3" rx="2.4" ry="3" fill={lo} transform="rotate(26 2.6 3)" />
        <line x1="0" y1="-5" x2="0" y2="5" stroke="#16302e" strokeWidth="0.9" strokeLinecap="round" />
      </g>
    </g>
  )
}

function Bugs({ dim, season }) {
  if (season === 'winter') return <Snow />
  if (dim) return <g>{FIREFLIES.map((f, i) => <Firefly key={i} {...f} i={i} />)}</g>
  return <g>{BUTTERFLIES.map((b, i) => <Butterfly key={i} {...b} />)}</g>
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduce
}

export default function CardScene() {
  const [ctx, setCtx] = useState(getCtx)
  const svgRef = useRef(null)
  const reduceMotion = usePrefersReducedMotion()

  useEffect(() => {
    const id = setInterval(() => setCtx(getCtx()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { timeOfDay, season, date } = ctx

  // honour the OS "reduce motion" setting by freezing the whole SVG timeline
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || typeof svg.pauseAnimations !== 'function') return
    if (reduceMotion) svg.pauseAnimations()
    else svg.unpauseAnimations()
  }, [reduceMotion, timeOfDay, season])
  const stops = SKY[timeOfDay]
  const glow = HORIZON_GLOW[timeOfDay]
  const [scrimColor, scrimAlpha] = SCRIM[timeOfDay]
  const showSun = timeOfDay === 'dawn' || timeOfDay === 'day'
  const showMoon = timeOfDay === 'dusk' || timeOfDay === 'night'
  const dim = timeOfDay === 'dusk' || timeOfDay === 'night'
  const dayKey = date.getFullYear() * 1000 + dayOfYear(date)

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
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
      {dim && <Sky bright={timeOfDay === 'night'} dayKey={dayKey} date={date} />}
      {showSun && <Sun cx={210} cy={110} r={34} dawn={timeOfDay === 'dawn'} />}
      {showMoon && <Moon cx={210} cy={110} r={36} />}
      {dim && <CityLights color={glow} />}
      <rect x="0" y="0" width={W} height={H} fill="url(#tg-scrim)" />
      <Grass color={GRASS[season]} />
      <Flowers season={season} />
      <Bugs dim={dim} season={season} />
    </svg>
  )
}
