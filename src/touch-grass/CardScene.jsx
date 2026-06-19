import { useState, useEffect, useMemo, useRef } from 'react'
import { getTimeOfDay, getSeason } from './context.js'
import { getZodiac, CONSTELLATIONS } from './zodiac.js'

const W = 300, H = 500, GROUND = 500

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

// sharp, slender four-point sparkle — for the constellation's "real" stars
function sparkPath(r) {
  const L = r * 3.1, w = r * 0.52
  return `M 0 ${-L} Q ${w} ${-w} ${L} 0 Q ${w} ${w} 0 ${L} `
    + `Q ${-w} ${w} ${-L} 0 Q ${-w} ${-w} 0 ${-L} Z`
}

// a constellation star: warm glow + cream sparkle + bright core, gently twinkling.
// Shares the moon/sun palette so it reads as part of the celestial family.
function ConStar({ x, y, r, op, dur }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r * 2.9} fill="url(#tg-star)" opacity={op}>
        <animate attributeName="opacity" values={`${(op * 0.5).toFixed(2)};${op};${(op * 0.5).toFixed(2)}`}
          dur={`${dur}s`} repeatCount="indefinite" />
      </circle>
      <path d={sparkPath(r)} fill="#f6efda" opacity={op} />
      <circle r={r * 0.48} fill="#fffdf3" opacity={op} />
    </g>
  )
}

// constellation sits top-left; moon lives top-right, so they never collide
const CON_BOX = { gx: 10, gy: 36, gw: 128, gh: 96 }

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
      const y = 12 + rand() * 150
      if (Math.hypot(x - 226, y - 82) < 64) continue           // clear of the moon
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
      <g>
        {pts.map((p, i) => (
          <ConStar key={i} x={p.x} y={p.y}
            r={i === 0 ? 3.6 : 2.3 + ((i * 41) % 6) * 0.3}
            op={op}
            dur={(3.6 + ((i * 53) % 5) * 0.7).toFixed(1)} />
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
  const h = 22 + ((i * 37) % 42)
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

/* ---- Wildflowers, bushes & weeds — varied, hand-illustrated, season-colored ---- */
const FLOWER_PALETTE = {
  spring: ['#f3cdd9', '#f7e6ee', '#ecc24f', '#c9a8e0'],
  summer: ['#f4d452', '#ef9a3c', '#df5b3f', '#f6efda'],
  autumn: ['#e3934a', '#c96a2e', '#d9a441', '#b5503a'],
}
const STEM = { spring: '#4f8f56', summer: '#4a8030', autumn: '#7a6030' }
const BUSH_COLOR = { spring: '#3f7d46', summer: '#3c7026', autumn: '#6f5226', winter: '#46685a' }
const WEED_COLOR = { spring: '#5a7d40', summer: '#6a7a30', autumn: '#8a6a32', winter: '#5a6f60' }

// varied mix: tall pop-outs, short ground blooms, different shapes
const FLORA = [
  { x: 20, h: 72, type: 'daisy', size: 1.25, ci: 0, lean: 5 },
  { x: 48, h: 24, type: 'tiny', size: 0.8, ci: 2, lean: -3 },
  { x: 86, h: 50, type: 'bud', size: 1.05, ci: 1, lean: 6 },
  { x: 116, h: 16, type: 'cluster', size: 0.85, ci: 3, lean: 0 },
  { x: 150, h: 78, type: 'daisy', size: 1.4, ci: 1, lean: -4 },
  { x: 182, h: 28, type: 'tiny', size: 0.7, ci: 0, lean: 3 },
  { x: 210, h: 44, type: 'bud', size: 1.0, ci: 2, lean: 4 },
  { x: 244, h: 62, type: 'cluster', size: 1.15, ci: 3, lean: -5 },
  { x: 270, h: 20, type: 'tiny', size: 0.85, ci: 1, lean: 2 },
  { x: 292, h: 52, type: 'daisy', size: 1.05, ci: 2, lean: 3 },
]
const BUSHES = [{ x: 64, w: 30, h: 22 }, { x: 232, w: 36, h: 26 }]
const WEEDS = [{ x: 104, h: 80, lean: 6 }, { x: 256, h: 72, lean: -5 }]

function flowerHead(type, hx, hy, s, color) {
  if (type === 'daisy') {
    const n = 7, pr = 3.2 * s
    return (
      <g>
        {Array.from({ length: n }, (_, k) => {
          const a = (k / n) * Math.PI * 2
          const px = hx + Math.cos(a) * pr, py = hy + Math.sin(a) * pr
          return <ellipse key={k} cx={px} cy={py} rx={2.6 * s} ry={1.5 * s}
            transform={`rotate(${(a * 180) / Math.PI} ${px} ${py})`} fill={color} />
        })}
        <circle cx={hx} cy={hy} r={2.2 * s} fill="#e7b23f" />
      </g>
    )
  }
  if (type === 'bud') {
    return (
      <path d={`M ${hx} ${hy - 7 * s} Q ${hx + 4.2 * s} ${hy} ${hx} ${hy + 3 * s} `
        + `Q ${hx - 4.2 * s} ${hy} ${hx} ${hy - 7 * s} Z`} fill={color} />
    )
  }
  if (type === 'cluster') {
    const dots = [[0, -3], [-3, 0.5], [3, 0.5], [-1.4, 3], [1.4, 3]]
    return <g>{dots.map(([dx, dy], k) => <circle key={k} cx={hx + dx * s} cy={hy + dy * s} r={2 * s} fill={color} />)}</g>
  }
  return <g><circle cx={hx} cy={hy} r={2.4 * s} fill={color} /><circle cx={hx} cy={hy} r={1 * s} fill="#e7b23f" /></g>
}

function Flowers({ season }) {
  if (season === 'winter') return null
  const palette = FLOWER_PALETTE[season]
  const stem = STEM[season]
  return (
    <g opacity="0.95">
      {FLORA.map((f, i) => {
        const hx = f.x + f.lean, hy = GROUND - f.h
        return (
          <g key={i}>
            <path d={`M ${f.x} ${GROUND} Q ${f.x + f.lean * 0.4} ${GROUND - f.h * 0.55} ${hx} ${hy}`}
              fill="none" stroke={stem} strokeWidth="1.3" strokeLinecap="round" />
            {flowerHead(f.type, hx, hy, f.size, palette[f.ci % palette.length])}
          </g>
        )
      })}
    </g>
  )
}

function Bushes({ season }) {
  const color = BUSH_COLOR[season]
  return (
    <g opacity="0.9">
      {BUSHES.map((b, i) => {
        const lumps = [[-b.w * 0.32, 0, b.h * 0.7], [0, b.h * 0.22, b.h * 0.95],
          [b.w * 0.32, 0, b.h * 0.7], [-b.w * 0.12, b.h * 0.05, b.h * 0.62], [b.w * 0.14, b.h * 0.05, b.h * 0.6]]
        return <g key={i}>{lumps.map(([dx, dy, r], k) =>
          <circle key={k} cx={b.x + dx} cy={GROUND - dy} r={r} fill={color} />)}</g>
      })}
    </g>
  )
}

function Weeds({ season }) {
  const color = WEED_COLOR[season]
  return (
    <g opacity="0.85">
      {WEEDS.map((w, i) => {
        const tx = w.x + w.lean, ty = GROUND - w.h
        return (
          <g key={i}>
            <path d={`M ${w.x} ${GROUND} Q ${w.x + w.lean * 0.5} ${GROUND - w.h * 0.6} ${tx} ${ty}`}
              fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
            <ellipse cx={tx} cy={ty} rx="2.8" ry="6" fill={color} />
            <path d={`M ${w.x + w.lean * 0.4} ${GROUND - w.h * 0.5} l 6 -3`} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
            <path d={`M ${w.x + w.lean * 0.55} ${GROUND - w.h * 0.72} l -6 -3`} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )
      })}
    </g>
  )
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
        <circle key={i} cx={s.x} cy={40} r={s.r}>
          <animate attributeName="cy" values={`40;${GROUND - 12}`} dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
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
    flight: '60,430; 150,382; 240,416; 268,462; 180,480; 92,440; 50,468; 60,430' },
  { dur: 31, begin: -9, s: 0.82, up: '#e8c24a', lo: '#f0d878',
    flight: '210,378; 130,338; 70,402; 150,442; 250,408; 282,448; 220,470; 210,378' },
  { dur: 23, begin: -16, s: 1.12, up: '#d4738f', lo: '#e6a6b6',
    flight: '120,470; 210,428; 268,458; 230,410; 150,382; 80,424; 60,468; 120,470' },
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
        <radialGradient id="tg-star" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5dc9a" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#f3d98a" stopOpacity="0" />
        </radialGradient>
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
      {showSun && <Sun cx={226} cy={82} r={41} dawn={timeOfDay === 'dawn'} />}
      {showMoon && <Moon cx={226} cy={82} r={43} />}
      {dim && <CityLights color={glow} />}
      <rect x="0" y="0" width={W} height={H} fill="url(#tg-scrim)" />
      <Bushes season={season} />
      <Grass color={GRASS[season]} />
      <Weeds season={season} />
      <Flowers season={season} />
      <Bugs dim={dim} season={season} />
    </svg>
  )
}
