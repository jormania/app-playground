import { useState, useEffect, useMemo, useRef } from 'react'
import { getZodiac, CONSTELLATIONS } from './zodiac.js'
import { useWorld } from './world.jsx'

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

const INK = '#1c4a47'
const PARCHMENT = '#f3ead4'

// golden- & blue-hour palettes, overlaid on the base sky by their strength.
// Golden keeps a touch of upper violet/rose over a warm horizon; blue is deep
// twilight with a thin band of leftover warmth where the sun went down.
const GOLDEN_SKY = [[0, '#6a5a8e'], [34, '#b06a78'], [64, '#e8915a'], [100, '#f6c46e']]
const BLUE_SKY = [[0, '#141a3e'], [40, '#23386e'], [72, '#3a5c8e'], [88, '#86686e'], [100, '#caa06a']]
const GRASS_WARM = '#e6a64e' // grass leans toward this in golden light

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lerpColor(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b)
  const m = ca.map((v, i) => Math.round(v + (cb[i] - v) * t))
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`
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

function Sun({ cx, cy, r, dawn, golden = 0 }) {
  let color = dawn ? '#ef9a3c' : '#f3cb3e'
  let deep = dawn ? '#d97c2a' : '#e0ad28'
  if (golden > 0) {
    // sink the disc toward a deep sunset orange as the golden light strengthens
    color = lerpColor(color, '#ec7a2e', golden * 0.55)
    deep = lerpColor(deep, '#c2541c', golden * 0.55)
  }
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

// the unlit portion of the disc for a given phase (0 new … 0.5 full … 1 new).
// A translucent overlay on the full faced disc — never a thin crescent — so the
// artwork stays the strong central element; full moon yields a zero-area path.
function moonShadowPath(cx, cy, r, phase) {
  const cos = Math.cos(2 * Math.PI * phase)
  const rx = Math.abs(cos) * r
  const waxing = phase < 0.5
  const sweepOuter = waxing ? 0 : 1
  const innerSweep = ((cos > 0) === waxing) ? 1 : 0
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${sweepOuter} ${cx} ${cy + r} `
    + `A ${rx.toFixed(2)} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`
}

function Moon({ cx, cy, r, phase = 0.5 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 12} fill="rgba(243,234,212,0.07)" />
      <circle cx={cx} cy={cy} r={r + 6} fill="rgba(243,234,212,0.06)" />
      <circle cx={cx} cy={cy} r={r} fill={PARCHMENT} stroke="rgba(28,74,71,0.18)" strokeWidth="1" />
      <Face cx={cx} cy={cy} r={r} cheek="#ecc24f" lip="#e08a46" iris="#2f8a9a" />
      <path d={moonShadowPath(cx, cy, r, phase)} fill="rgba(20,28,50,0.5)" />
    </g>
  )
}

function starPath(s) {
  return `M 0 ${-6 * s} Q ${s} ${-s} ${6 * s} 0 Q ${s} ${s} 0 ${6 * s} `
    + `Q ${-s} ${s} ${-6 * s} 0 Q ${-s} ${-s} 0 ${-6 * s} Z`
}

// sharp, slender four-point sparkle — for the constellation's "real" stars
function sparkPath(r) {
  const L = r * 2.6, w = r * 0.5
  return `M 0 ${-L} Q ${w} ${-w} ${L} 0 Q ${w} ${w} 0 ${L} `
    + `Q ${-w} ${w} ${-L} 0 Q ${-w} ${-w} 0 ${-L} Z`
}

// a constellation star: warm glow + cream sparkle + bright core, gently twinkling.
// Shares the moon/sun palette so it reads as part of the celestial family.
function ConStar({ x, y, r, op, dur }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r * 2.4} fill="url(#tg-star)" opacity={op}>
        <animate attributeName="opacity" values={`${(op * 0.5).toFixed(2)};${op};${(op * 0.5).toFixed(2)}`}
          dur={`${dur}s`} repeatCount="indefinite" />
      </circle>
      <path d={sparkPath(r)} fill="#f6efda" opacity={op} />
      <circle r={r * 0.5} fill="#fffdf3" opacity={op} />
    </g>
  )
}

// constellation sits top-left; moon lives top-right, so they never collide
const CON_BOX = { gx: 10, gy: 28, gw: 124, gh: 74 }

function Sky({ bright, clarity = 1, dayKey, date, signs, moonFraction = 0 }) {
  const con = CONSTELLATIONS[getZodiac(date)] || CONSTELLATIONS.aries
  const { gx, gy, gw, gh } = CON_BOX
  const pts = con.points.map(([px, py]) => ({ x: gx + px * gw, y: gy + py * gh }))
  const base = bright ? 0.95 : 0.55
  // the sign lingers through cloud (and stays put through moonlight — it's a
  // reading, meant to stay legible) while only the faint ambient scatter washes
  // out under a bright moon, exactly as real faint stars vanish first and named
  // ones persist
  const conOp = base * (0.3 + 0.7 * clarity)
  const moonWash = Math.max(0, Math.min(1, moonFraction))
  const scOp = base * clarity * (1 - moonWash * 0.75) // never fully to 0 — even a full moon leaves the brightest handful

  // background scatter — reseeded per calendar day; small, faint, slowly drifting.
  // Sorted brightest-first so moonWash below can shed the faintest end of the
  // list first, same as a real moonlit sky loses its dimmest stars first.
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
    return out.sort((a, b) => b.s - a.s)
  }, [dayKey, gx, gy, gw, gh])

  // fewer of the (day-seeded, brightest-first) scatter stars actually render as
  // moonlight rises — never fewer than 3, so the sky never reads as empty
  const visibleCount = Math.max(3, Math.round(scatter.length * (1 - moonWash * 0.6)))
  const shown = scatter.slice(0, visibleCount)

  return (
    <g>
      {signs && (
        <>
          <g stroke={PARCHMENT} strokeWidth="0.45" opacity={conOp * 0.22}>
            {con.lines.map(([a, b], i) => (
              <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} />
            ))}
          </g>
          <g>
            {pts.map((p, i) => (
              <ConStar key={i} x={p.x} y={p.y}
                r={1.5 + ((i * 29) % 4) * 0.4 + (i === 0 ? 0.6 : 0)}
                op={conOp}
                dur={(3.6 + ((i * 53) % 5) * 0.7).toFixed(1)} />
            ))}
          </g>
        </>
      )}
      <g fill={PARCHMENT}>
        {shown.map((st, i) => {
          const faint = scOp * 0.55
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

const FLOWER_TYPES = ['daisy', 'bud', 'cluster', 'tiny']

// Vegetation is regenerated each calendar day from the day seed, so its
// arrangement shifts daily. Tall blooms/weeds are biased toward the edges,
// keeping the center (under the text) short — so they don't crowd the words.
function buildFlora(dayKey) {
  const rand = rng((dayKey ^ 0x9e3779b1) >>> 0)
  const n = 9 + Math.floor(rand() * 3)
  return Array.from({ length: n }, (_, i) => {
    const x = 14 + ((i + 0.2 + rand() * 0.6) / n) * 272
    const dist = Math.abs(x - 150) / 150          // 0 center → 1 edge
    const maxH = 24 + dist * 58                    // central stays short, edges can be tall
    return {
      x,
      h: 14 + rand() * (maxH - 14),
      type: FLOWER_TYPES[Math.floor(rand() * FLOWER_TYPES.length)],
      size: 0.7 + rand() * 0.75,
      ci: Math.floor(rand() * 4),
      lean: (rand() - 0.5) * 12,
    }
  })
}

function buildBushes(dayKey) {
  const rand = rng((dayKey ^ 0x2545f491) >>> 0)
  const n = 1 + Math.floor(rand() * 2)
  return Array.from({ length: n }, () => ({
    x: 28 + rand() * 244,
    w: 26 + rand() * 16,
    h: 18 + rand() * 12,
  }))
}

function buildWeeds(dayKey) {
  const rand = rng((dayKey ^ 0x27d4eb2f) >>> 0)
  const n = 1 + Math.floor(rand() * 2)
  return Array.from({ length: n }, () => {
    const x = rand() < 0.5 ? 18 + rand() * 70 : 212 + rand() * 70  // kept to the sides
    return { x, h: 60 + rand() * 26, lean: (rand() - 0.5) * 12 }
  })
}

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

function Flowers({ season, dayKey }) {
  const flora = useMemo(() => buildFlora(dayKey), [dayKey])
  if (season === 'winter') return null
  const palette = FLOWER_PALETTE[season]
  const stem = STEM[season]
  return (
    <g opacity="0.95">
      {flora.map((f, i) => {
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

function Bushes({ season, dayKey }) {
  const bushes = useMemo(() => buildBushes(dayKey), [dayKey])
  const color = BUSH_COLOR[season]
  return (
    <g opacity="0.9">
      {bushes.map((b, i) => {
        const lumps = [[-b.w * 0.32, 0, b.h * 0.7], [0, b.h * 0.22, b.h * 0.95],
          [b.w * 0.32, 0, b.h * 0.7], [-b.w * 0.12, b.h * 0.05, b.h * 0.62], [b.w * 0.14, b.h * 0.05, b.h * 0.6]]
        return <g key={i}>{lumps.map(([dx, dy, r], k) =>
          <circle key={k} cx={b.x + dx} cy={GROUND - dy} r={r} fill={color} />)}</g>
      })}
    </g>
  )
}

function Weeds({ season, dayKey }) {
  const weeds = useMemo(() => buildWeeds(dayKey), [dayKey])
  const color = WEED_COLOR[season]
  return (
    <g opacity="0.85">
      {weeds.map((w, i) => {
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

/* ---- Weather layers (driven by world.weather) ---- */

// falling snow — count scales with intensity
function Snow({ count = 14 }) {
  const flakes = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: ((i * 53) % 288) + 6,
    r: 0.9 + (i % 3) * 0.4,
    dur: 6 + (i % 5),
    delay: -(i * 0.8),
  })), [count])
  return (
    <g fill="#eef2f4">
      {flakes.map((s, i) => (
        <circle key={i} cx={s.x} cy={40} r={s.r}>
          <animate attributeName="cy" values={`40;${GROUND - 12}`} dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.85;0.85;0" dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  )
}

// falling rain — density by intensity, slant by wind
function Rain({ intensity, wind }) {
  const count = Math.round(24 + intensity * 60)
  const slant = Math.min(11, wind * 0.4)
  const drops = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: (i * 37) % W,
    len: 7 + (i % 3) * 4,
    dur: (0.42 + (i % 5) * 0.08).toFixed(2),
    delay: (-(i * 0.05)).toFixed(2),
  })), [count])
  return (
    <g stroke="#c4d6e4" strokeWidth="1" strokeLinecap="round" opacity="0.5">
      {drops.map((d, i) => (
        <line key={i} x1={d.x} y1="-14" x2={d.x - slant * 0.4} y2={-14 + d.len}>
          <animateTransform attributeName="transform" type="translate"
            values={`0 0; ${slant} ${H + 18}`} dur={`${d.dur}s`} begin={`${d.delay}s`} repeatCount="indefinite" />
        </line>
      ))}
    </g>
  )
}

// drifting clouds — count by cloud cover, colour by time/cover. Each cloud has
// its own size, speed, height, opacity and a gentle vertical bob, so the field
// flows naturally instead of marching in lockstep.
function Clouds({ frac, wind, fill }) {
  const n = Math.min(7, Math.round(frac * 6) + 1)
  const base = Math.max(38, 96 - wind * 1.4) // windier → faster overall
  const clouds = useMemo(() => Array.from({ length: n }, (_, i) => {
    const r1 = ((i * 73 + 13) % 100) / 100
    const r2 = ((i * 137 + 41) % 100) / 100
    const r3 = ((i * 191 + 7) % 100) / 100
    const scale = 0.55 + r1 * 0.75
    return {
      y: 16 + r2 * 142,
      scale,
      // bigger clouds drift slower; ±45% random spread so no two match
      dur: (base * (0.65 + r3 * 0.9) / scale).toFixed(1),
      begin: (-(r1 + r3) * base).toFixed(1),
      op: (0.55 + r2 * 0.32).toFixed(2),
      bob: (4 + r3 * 7).toFixed(1),
      bobDur: (8 + r1 * 9).toFixed(1),
    }
  }), [n, base])
  return (
    <g fill={fill}>
      {clouds.map((c, i) => (
        <g key={i} opacity={c.op}>
          <animateTransform attributeName="transform" type="translate" additive="sum"
            values={`-84 ${c.y}; ${W + 84} ${c.y}`} dur={`${c.dur}s`} begin={`${c.begin}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="translate" additive="sum"
            values={`0 0; 0 ${c.bob}; 0 0; 0 ${-c.bob}; 0 0`} dur={`${c.bobDur}s`} repeatCount="indefinite" />
          <g transform={`scale(${c.scale})`}>
            <ellipse cx="0" cy="2" rx="26" ry="12" />
            <circle cx="-15" cy="0" r="11" />
            <circle cx="-2" cy="-7" r="13" />
            <circle cx="12" cy="-4" r="11" />
            <circle cx="21" cy="1" r="9" />
          </g>
        </g>
      ))}
    </g>
  )
}

// fog — a desaturating veil plus slow drifting banks
function Fog() {
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill="#cdd2d4" opacity="0.32" />
      {[0.34, 0.54, 0.72].map((yf, i) => (
        <g key={i} opacity="0.22">
          <animateTransform attributeName="transform" type="translate"
            values={i % 2 ? `-60 0; 0 0` : `0 0; -60 0`} dur={`${24 + i * 8}s`} repeatCount="indefinite" />
          <ellipse cx={W / 2} cy={H * yf} rx={W * 0.85} ry="20" fill="#e8eced" />
        </g>
      ))}
    </g>
  )
}

// shooting stars on meteor-shower nights — each darts across briefly, then waits
const METEORS = [
  { x: 36, y: 38, len: 14, begin: 0, cycle: 11 },
  { x: 150, y: 26, len: 12, begin: 3.5, cycle: 13 },
  { x: 88, y: 66, len: 16, begin: 7, cycle: 9 },
  { x: 206, y: 48, len: 12, begin: 5, cycle: 12 },
]
function Meteors() {
  return (
    <g stroke="#f6efda" strokeWidth="1.2" strokeLinecap="round">
      {METEORS.map((m, i) => (
        <g key={i} opacity="0">
          <line x1="0" y1="0" x2={-m.len} y2={-m.len * 0.42} />
          <animateTransform attributeName="transform" type="translate"
            values={`${m.x} ${m.y}; ${m.x} ${m.y}; ${m.x + 96} ${m.y + 40}; ${m.x + 96} ${m.y + 40}`}
            keyTimes="0;0.86;0.95;1" dur={`${m.cycle}s`} begin={`${m.begin}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0;0.95;0;0"
            keyTimes="0;0.86;0.905;0.95;1" dur={`${m.cycle}s`} begin={`${m.begin}s`} repeatCount="indefinite" />
        </g>
      ))}
    </g>
  )
}

// occasional lightning flash
function Lightning() {
  return (
    <rect x="0" y="0" width={W} height={H} fill="#eef0ff" opacity="0">
      <animate attributeName="opacity"
        values="0;0;0.65;0.12;0.42;0;0;0;0;0;0;0"
        keyTimes="0;0.74;0.76;0.78;0.80;0.82;0.86;0.9;0.93;0.96;0.98;1"
        dur="8s" repeatCount="indefinite" />
    </rect>
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
  if (season === 'winter') return null // winter snow is now weather-driven, not seasonal
  if (dim) return <g>{FIREFLIES.map((f, i) => <Firefly key={i} {...f} i={i} />)}</g>
  return <g>{BUTTERFLIES.map((b, i) => <Butterfly key={i} {...b} />)}</g>
}

/* ---- Seasonal accents: tumbling leaves (autumn), drifting petals (spring) ---- */
const AUTUMN_COLORS = ['#c96a2e', '#d9a441', '#b5503a', '#a8642a']
const SPRING_COLORS = ['#f3cdd9', '#f7e6ee', '#e9b8cb']

function SeasonAccents({ season }) {
  const leaf = season === 'autumn'
  const items = useMemo(() => {
    if (season !== 'autumn' && season !== 'spring') return []
    const colors = leaf ? AUTUMN_COLORS : SPRING_COLORS
    const n = leaf ? 8 : 9
    return Array.from({ length: n }, (_, i) => ({
      x: ((i * 71) % 280) + 10,
      c: colors[i % colors.length],
      dur: 9 + (i % 5) * 1.7,
      delay: -(i * 1.5),
      sway: 11 + (i % 3) * 7,
      swayDur: 3 + (i % 4) * 0.7,
      s: 0.8 + (i % 3) * 0.25,
    }))
  }, [season, leaf])
  if (!items.length) return null
  return (
    <g opacity="0.85">
      {items.map((p, i) => (
        <g key={i}>
          <animateTransform attributeName="transform" type="translate" additive="sum"
            values={`${p.x} -16; ${p.x} ${H + 16}`} dur={`${p.dur}s`} begin={`${p.delay}s`} repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="translate" additive="sum"
            values={`0 0; ${p.sway} 0; 0 0; ${-p.sway} 0; 0 0`} dur={`${p.swayDur * 2}s`} repeatCount="indefinite" />
          <g transform={`scale(${p.s})`}>
            {leaf ? (
              <g>
                <animateTransform attributeName="transform" type="rotate" values="0;360" dur={`${p.swayDur * 3}s`} repeatCount="indefinite" />
                <path d="M0 -5 Q4.2 -0.5 0 6 Q-4.2 -0.5 0 -5 Z" fill={p.c} />
                <path d="M0 -4 L0 5" stroke="rgba(0,0,0,0.18)" strokeWidth="0.5" />
              </g>
            ) : (
              <ellipse cx="0" cy="0" rx="2.6" ry="4" fill={p.c} />
            )}
          </g>
        </g>
      ))}
    </g>
  )
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

export default function CardScene({ showSigns = true, motionOn = true }) {
  const { timeOfDay, season, now, weather, moon, moments, light } = useWorld()
  const svgRef = useRef(null)
  const reduceMotion = usePrefersReducedMotion()

  const stops = SKY[timeOfDay]
  const glow = HORIZON_GLOW[timeOfDay]
  const showSun = timeOfDay === 'dawn' || timeOfDay === 'day'
  const showMoon = timeOfDay === 'dusk' || timeOfDay === 'night'
  const dim = timeOfDay === 'dusk' || timeOfDay === 'night'
  const dayKey = now.getFullYear() * 1000 + dayOfYear(now)

  // ---- weather → scene ----
  const cond = weather ? weather.condition : null
  const cloudFrac = weather ? weather.cloud : 0
  const wind = weather ? weather.wind : 0
  const foggy = cond === 'fog'
  const thunder = cond === 'thunder'
  let precip = null
  if (weather) {
    if (cond === 'snow') precip = 'snow'
    else if (cond === 'rain' || thunder) precip = 'rain'
  } else if (season === 'winter') {
    precip = 'snow' // fallback when no live weather (Phase 5 behaviour)
  }
  const intensity = weather ? weather.intensity : 0.5
  const skyObscured = foggy || thunder || cond === 'overcast' || cloudFrac >= 0.6 || precip === 'rain'
  // the named constellation lingers (faintly) through mere cloud — it's only the
  // truly opaque sky (fog, storm, falling rain/snow) that blots it out entirely
  const starsHidden = foggy || thunder || precip === 'rain' || precip === 'snow'
  const clarity = Math.max(0, Math.min(1, 1 - cloudFrac * 1.1))
  const celestialOpacity = (foggy || thunder) ? 0.22 : 1 - Math.min(0.78, cloudFrac * 0.82)
  const cloudFill = (timeOfDay === 'night' || timeOfDay === 'dusk')
    ? '#39414f'
    : (cloudFrac > 0.7 ? '#c9cdd4' : '#eef0f2')
  const showBugs = !precip && !foggy && !thunder
  const meteorNight = dim && !skyObscured && (moments || []).some(m => m.meteor)
  const freeze = reduceMotion || !motionOn

  // ---- golden / blue hour → warm the sky, grass and sun (muted under cloud) ----
  const golden = light ? light.golden : 0
  const blue = light ? light.blue : 0
  const tintScale = 1 - Math.min(0.6, cloudFrac * 0.6) // overcast mutes the wash
  const goldenOp = golden * tintScale
  const blueOp = blue * tintScale
  const grassColor = golden > 0.01 ? lerpColor(GRASS[season], GRASS_WARM, golden * 0.4) : GRASS[season]

  // freeze the whole SVG timeline for OS reduce-motion or the in-app Motion toggle
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || typeof svg.pauseAnimations !== 'function') return
    if (freeze) svg.pauseAnimations()
    else svg.unpauseAnimations()
  }, [freeze, timeOfDay, season, weather, meteorNight])

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="tg-sky" x1="0" y1="0" x2="0" y2="1">
          {stops.map(([off, col]) => <stop key={off} offset={`${off}%`} stopColor={col} />)}
        </linearGradient>
        <linearGradient id="tg-golden" x1="0" y1="0" x2="0" y2="1">
          {GOLDEN_SKY.map(([off, col]) => <stop key={off} offset={`${off}%`} stopColor={col} />)}
        </linearGradient>
        <linearGradient id="tg-blue" x1="0" y1="0" x2="0" y2="1">
          {BLUE_SKY.map(([off, col]) => <stop key={off} offset={`${off}%`} stopColor={col} />)}
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
      </defs>

      <rect x="0" y="0" width={W} height={H} fill="url(#tg-sky)" />
      {goldenOp > 0.01 && <rect x="0" y="0" width={W} height={H} fill="url(#tg-golden)" opacity={goldenOp.toFixed(3)} />}
      {blueOp > 0.01 && <rect x="0" y="0" width={W} height={H} fill="url(#tg-blue)" opacity={blueOp.toFixed(3)} />}
      {glow && <rect x="0" y={H * 0.45} width={W} height={H * 0.55} fill="url(#tg-glow)" />}
      {dim && !starsHidden && <Sky bright={timeOfDay === 'night'} clarity={clarity} dayKey={dayKey} date={now} signs={showSigns} moonFraction={moon ? moon.fraction : 0} />}
      <g opacity={celestialOpacity}>
        {showSun && <Sun cx={226} cy={82} r={41} dawn={timeOfDay === 'dawn'} golden={golden} />}
        {showMoon && <Moon cx={226} cy={82} r={43} phase={moon ? moon.phase : 0.5} />}
      </g>
      {meteorNight && <Meteors />}
      {cloudFrac > 0.05 && <Clouds frac={cloudFrac} wind={wind} fill={cloudFill} />}
      {dim && !skyObscured && <CityLights color={glow} />}
      <Bushes season={season} dayKey={dayKey} />
      <Grass color={grassColor} />
      <Weeds season={season} dayKey={dayKey} />
      <Flowers season={season} dayKey={dayKey} />
      {showBugs && <Bugs dim={dim} season={season} />}
      {!precip && <SeasonAccents season={season} />}
      {precip === 'rain' && <Rain intensity={intensity} wind={wind} />}
      {precip === 'snow' && <Snow count={Math.round(10 + intensity * 28)} />}
      {foggy && <Fog />}
      {thunder && <Lightning />}
    </svg>
  )
}
