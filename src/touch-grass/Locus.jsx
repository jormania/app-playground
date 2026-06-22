import { Fragment, useRef, useEffect } from 'react'
import { useWorld } from './world.jsx'
import { daysToFullMoon, getNextSunAnchor } from './context.js'
import { getZodiac } from './zodiac.js'
import { weatherWord } from './weather.js'
import ForecastGlyph from './WeatherGlyph.jsx'
import Sparkle from './Sparkle.jsx'

// A very faint "you are here" ticker in the bottom-right of the stage (outside
// the card): the place, the zodiac season, the next turn of the day, the
// daylight, the moon and the weather — one line, hugging the right edge. Each
// reading wears a small COLOURED glyph (a little picture), with a soft dark halo
// so it reads over any ground; the text inverts with the daily surface (cream on
// the dark midday ground, dark ink on the pale ones).
//
// When it's too wide for the screen it becomes a true ticker: you can drag it
// with a finger, and on its own it drifts at a steady pace, bouncing off each
// end and reversing — never wrapping. It honours reduced-motion (no auto-drift,
// but still draggable). The separator between readings can be previewed live
// with ?sep=hairline|gap|dot|slash|sparkle.

// shared palette for the little pictures
const C = {
  gold: '#e7c24a', amber: '#f0b429', slate: '#8294ac', slate2: '#6f86a6', window: '#f4cc55',
  sea: '#5aa6c4', leaf: '#5a9a5f', trunk: '#8a5a3c', rock: '#8a93a0', snow: '#eef3f6',
  grass: '#6fae72', silver: '#dfe6ef',
}

const BIOME_GLYPH = {
  coast: (
    <g fill="none" stroke={C.sea} strokeWidth="1.9" strokeLinecap="round">
      <path d="M3 12 q3 -2.6 6 0 t6 0 t6 0" />
      <path d="M3 17 q3 -2.6 6 0 t6 0 t6 0" />
    </g>
  ),
  forest: (
    <g>
      <path d="M12 3 L6 12 H9 L5 18 H19 L15 12 H18 Z" fill={C.leaf} />
      <rect x="11" y="17" width="2" height="4" fill={C.trunk} />
    </g>
  ),
  city: (
    <g>
      <rect x="3" y="11" width="6.6" height="10" rx="0.6" fill={C.slate} />
      <rect x="11" y="5" width="7.6" height="16" rx="0.6" fill={C.slate2} />
      <g fill={C.window}>
        <rect x="12.6" y="8" width="1.5" height="1.5" /><rect x="15.4" y="8" width="1.5" height="1.5" />
        <rect x="12.6" y="11.5" width="1.5" height="1.5" /><rect x="5.3" y="14" width="1.5" height="1.5" />
      </g>
    </g>
  ),
  mountain: (
    <g>
      <path d="M2 20 L9 7 L13 13 L16 9 L22 20 Z" fill={C.rock} />
      <path d="M9 7 L11.1 10 L6.9 10 Z" fill={C.snow} />
      <path d="M16 9 L17.5 11 L14.5 11 Z" fill={C.snow} />
    </g>
  ),
  plain: <path d="M2 20 q4 -5 8 -2 q4 -5 8 -2 q2 1 4 0 V21 H2 Z" fill={C.grass} />,
}

// a warm zodiac wheel — the sun riding the ring of signs
const ZODIAC_GLYPH = (
  <g>
    <circle cx="12" cy="12" r="8" fill="none" stroke={C.gold} strokeWidth="1.9" />
    <circle cx="12" cy="12" r="2.4" fill={C.amber} />
  </g>
)

// a full golden sun — for daylight and the noon turn
const SUN_FULL = (
  <g>
    <g stroke={C.gold} strokeWidth="1.7" strokeLinecap="round">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return <line key={i} x1={12 + Math.cos(a) * 7} y1={12 + Math.sin(a) * 7} x2={12 + Math.cos(a) * 9.7} y2={12 + Math.sin(a) * 9.7} />
      })}
    </g>
    <circle cx="12" cy="12" r="4.4" fill={C.amber} />
  </g>
)

// a sun on the horizon — for sunrise / sunset turns
const SUN_HORIZON = (
  <g>
    <path d="M7 17 A5 5 0 0 1 17 17 Z" fill={C.amber} />
    <line x1="3" y1="17" x2="21" y2="17" stroke={C.gold} strokeWidth="1.7" strokeLinecap="round" />
    <g stroke={C.gold} strokeWidth="1.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="8" /><line x1="5" y1="9.5" x2="6.8" y2="11" /><line x1="19" y1="9.5" x2="17.2" y2="11" />
    </g>
  </g>
)

// a silver crescent — for the midnight turn
const CRESCENT = <path d="M16.5 13.5 A6 6 0 1 1 11 6 A4.6 4.6 0 0 0 16.5 13.5 Z" fill={C.silver} />

// the lovely full moon — a warm gradient disc with a few faint craters
const MOON = (
  <g>
    <defs>
      <radialGradient id="tg-moon" cx="38%" cy="34%" r="78%">
        <stop offset="0" stopColor="#fff7e0" />
        <stop offset="0.62" stopColor="#f2e2ac" />
        <stop offset="1" stopColor="#e7c97e" />
      </radialGradient>
    </defs>
    <circle cx="12" cy="12" r="9.5" fill="url(#tg-moon)" />
    <circle cx="9" cy="9" r="1.5" fill="#dcc07a" opacity="0.55" />
    <circle cx="14.6" cy="13.2" r="2" fill="#dcc07a" opacity="0.5" />
    <circle cx="9.8" cy="15.2" r="1.1" fill="#dcc07a" opacity="0.5" />
  </g>
)

const ANCHOR_GLYPH = { sunrise: SUN_HORIZON, noon: SUN_FULL, sunset: SUN_HORIZON, midnight: CRESCENT }
const ANCHOR_LABEL = { sunrise: 'sunrise', noon: 'noon', sunset: 'sunset', midnight: 'midnight' }

// the separator between readings — switchable for previewing (?sep=)
function readSep() {
  try { return new URLSearchParams(window.location.search).get('sep') || 'hairline' } catch (_) { return 'hairline' }
}
function Separator({ mode }) {
  if (mode === 'gap') return <span className="tg-locus-gap" />
  if (mode === 'dot') return <span className="tg-locus-mark">·</span>
  if (mode === 'slash') return <span className="tg-locus-mark">/</span>
  if (mode === 'sparkle') return <Sparkle className="tg-locus-sep" />
  return <span className="tg-locus-rule" /> // hairline (default)
}

function untilWords(ms) {
  if (ms < 60000) return 'under a minute'
  const m = Math.round(ms / 60000)
  const h = Math.floor(m / 60), mm = m % 60
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`
}

const Glyph = ({ children }) => <svg viewBox="0 0 24 24">{children}</svg>

export default function Locus() {
  const { biome, timeOfDay, moon, weather, coords, now } = useWorld()
  const boxRef = useRef(null)

  // the midday ground is the only dark one — cream there, dark ink otherwise
  const onDark = timeOfDay === 'day'

  // ---- the readings ----
  // the place is just the biome — the hour reads from the card's own scene; the
  // word "sign" makes clear this is the zodiac sign (not, well, the other thing)
  const zodiacText = `${getZodiac(now)} sign`

  const anchor = getNextSunAnchor(new Date(now), coords)
  const remaining = anchor.at.getTime() - now.getTime()
  const sunText = remaining > 0 ? `${ANCHOR_LABEL[anchor.key]} in ${untilWords(remaining)}` : null

  const toFull = moon ? Math.round(daysToFullMoon(moon.phase)) : null
  const moonText = toFull == null ? null
    : toFull <= 0 ? 'full moon tonight'
    : `${toFull}d to full moon`

  const cond = weather && weather.condition
  const windy = weather && (weather.wind || 0) >= 28 && !['rain', 'snow', 'thunder'].includes(cond)
  const wxText = cond
    ? [weatherWord(cond), Number.isFinite(weather.temp) ? `${Math.round(weather.temp)}°` : null, windy ? 'windy' : null].filter(Boolean).join(' · ')
    : null

  // Order, left → right, from the ground up and outward: where you are, what it's
  // doing, where the day is going, the moon, the sign. Short enough that on many
  // days it fits without needing to tick at all.
  const sep = readSep()
  const segs = []
  if (biome) segs.push({ key: 'place', glyph: <Glyph>{BIOME_GLYPH[biome]}</Glyph>, text: biome })
  if (wxText) segs.push({ key: 'wx', glyph: <ForecastGlyph condition={cond} />, text: wxText })
  if (sunText) segs.push({ key: 'sun', glyph: <Glyph>{ANCHOR_GLYPH[anchor.key] || SUN_FULL}</Glyph>, text: sunText })
  if (moonText) segs.push({ key: 'moon', glyph: <Glyph>{MOON}</Glyph>, text: moonText })
  segs.push({ key: 'zodiac', glyph: <Glyph>{ZODIAC_GLYPH}</Glyph>, text: zodiacText })

  // ---- the ticker: drag with a finger; auto-drift at a steady pace; bounce ----
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const SPEED = 24 // px per second — a calm, readable drift
    let dir = -1     // start at the right edge and drift left to reveal the rest
    let max = 0
    let paused = false
    let inited = false
    let last = null
    let raf = 0

    const measure = () => { max = el.scrollWidth - el.clientWidth }
    const onResize = () => { measure(); inited = false }
    const pause = () => { paused = true }
    const resume = () => { paused = false; last = null }

    measure()
    window.addEventListener('resize', onResize)
    // dragging (touch or mouse) pauses the auto-drift; release resumes it
    el.addEventListener('pointerdown', pause)
    window.addEventListener('pointerup', resume)
    el.addEventListener('pointercancel', resume)

    const tick = (t) => {
      measure()
      if (!inited && max > 1) { el.scrollLeft = max; inited = true } // hug the right edge first
      if (last == null) last = t
      const dt = (t - last) / 1000
      last = t
      if (!reduce && !paused && max > 1) {
        let next = el.scrollLeft + dir * SPEED * dt
        if (next <= 0) { next = 0; dir = 1 }
        else if (next >= max) { next = max; dir = -1 }
        el.scrollLeft = next
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      el.removeEventListener('pointerdown', pause)
      window.removeEventListener('pointerup', resume)
      el.removeEventListener('pointercancel', resume)
    }
  }, [])

  return (
    <div className={onDark ? 'tg-locus on-dark' : 'tg-locus'} ref={boxRef} aria-hidden="true">
      {segs.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 && <Separator mode={sep} />}
          <span className="tg-locus-item">{s.glyph}<span>{s.text}</span></span>
        </Fragment>
      ))}
    </div>
  )
}
