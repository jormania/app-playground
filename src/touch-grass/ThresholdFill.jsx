import { useWorld } from './world.jsx'
import { getTimes, getMoonTimes } from 'suncalc'
import { moonPhaseName, sunDeclinationDeg, moonDeclinationDeg, riseSetDirections } from './context.js'
import { getZodiac, daysToNextSign } from './zodiac.js'

// A quiet reading that fills the sky above the invitation on the Threshold. One
// of three, chosen in the Keeper (persisted): tonight's sky, the sun & moon arcs,
// or a living-world (seasonal) reading. The evocative line in two of them comes
// from the oracle (the API), fresh each visit, with a hardcoded fallback.

const ok = (x) => x instanceof Date && Number.isFinite(x.getTime())
const fmt = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

function NeedPlace() {
  return <div className="tg-tf"><div className="tg-tf-line">turn on Place to read the sky here</div></div>
}

// ---- little glyphs ----
function SunGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="tg-tf-glyph" aria-hidden="true">
      <g stroke="#e7c24a" strokeWidth="1.8" strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return <line key={i} x1={12 + Math.cos(a) * 7} y1={12 + Math.sin(a) * 7} x2={12 + Math.cos(a) * 9.7} y2={12 + Math.sin(a) * 9.7} />
        })}
      </g>
      <circle cx="12" cy="12" r="4.2" fill="#f0b429" />
    </svg>
  )
}
function StarGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="tg-tf-glyph" aria-hidden="true">
      <path d="M12 3 L13.6 10.4 L21 12 L13.6 13.6 L12 21 L10.4 13.6 L3 12 L10.4 10.4 Z" fill="#dfe6ef" />
    </svg>
  )
}
// a small zodiac wheel — for the current sign
function ZodiacGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="tg-tf-glyph" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="#e7c24a" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.4" fill="#f0b429" />
    </svg>
  )
}
// the golden-hour sun, but blue — for the blue hour
function BlueGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="tg-tf-glyph" aria-hidden="true">
      <g stroke="#7fb1e6" strokeWidth="1.8" strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return <line key={i} x1={12 + Math.cos(a) * 7} y1={12 + Math.sin(a) * 7} x2={12 + Math.cos(a) * 9.7} y2={12 + Math.sin(a) * 9.7} />
        })}
      </g>
      <circle cx="12" cy="12" r="4.2" fill="#5b86bf" />
    </svg>
  )
}
function moonLitPath(phase) {
  const name = moonPhaseName(phase)
  if (name === 'new moon') return ''
  if (name === 'full moon') return null
  const limb = phase < 0.5 ? 1 : 0
  if (name.includes('quarter')) return `M12 2.5 A9.5 9.5 0 0 ${limb} 12 21.5 Z`
  const inner = name.includes('gibbous') ? 1 - limb : limb
  return `M12 2.5 A9.5 9.5 0 0 ${limb} 12 21.5 A5.5 9.5 0 0 ${inner} 12 2.5 Z`
}
function MoonGlyph({ phase }) {
  const lit = moonLitPath(phase)
  return (
    <svg viewBox="0 0 24 24" className="tg-tf-glyph" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="#cfd6e0" strokeWidth="1.2" opacity="0.55" />
      {lit === null ? <circle cx="12" cy="12" r="9.5" fill="#e8eef5" /> : (lit ? <path d={lit} fill="#e8eef5" /> : null)}
    </svg>
  )
}

// the soonest future time among a list of getTimes() keys, scanning neighbouring
// days (so it works across midnight, like the day-turn countdown does)
function soonestFuture(d, coords, keys) {
  const now = d.getTime()
  let best = null
  for (const off of [-1, 0, 1, 2]) {
    const dd = new Date(d); dd.setDate(dd.getDate() + off)
    const tt = getTimes(dd, coords.lat, coords.lon)
    for (const k of keys) {
      const v = tt[k]
      if (ok(v) && v.getTime() > now) { if (best == null || v.getTime() < best.getTime()) best = v; break }
    }
  }
  return best
}

// The current (or next) warm/cool light window — golden hour or blue hour — as an
// interval. Both shift through the year; one is always on offer, never both, never
// none. Morning: blue = dawn→sunrise, golden = sunrise→goldenHourEnd. Evening:
// golden = goldenHour→sunset, blue = sunset→dusk.
function lightWindow(now, coords) {
  const wins = []
  for (const off of [-1, 0, 1]) {
    const d = new Date(now); d.setDate(d.getDate() + off)
    const t = getTimes(d, coords.lat, coords.lon)
    if (ok(t.dawn) && ok(t.sunrise)) wins.push({ kind: 'blue', s: t.dawn, e: t.sunrise })
    if (ok(t.sunrise) && ok(t.goldenHourEnd)) wins.push({ kind: 'golden', s: t.sunrise, e: t.goldenHourEnd })
    if (ok(t.goldenHour) && ok(t.sunset)) wins.push({ kind: 'golden', s: t.goldenHour, e: t.sunset })
    if (ok(t.sunset) && ok(t.dusk)) wins.push({ kind: 'blue', s: t.sunset, e: t.dusk })
  }
  const cur = wins.find(w => now >= w.s.getTime() && now <= w.e.getTime())
  if (cur) return cur
  return wins.filter(w => w.s.getTime() > now).sort((a, b) => a.s - b.s)[0] || null
}

// ---- A · tonight ----
function Tonight({ coords, now, moon, reading }) {
  if (!coords) return <NeedPlace />
  const d = new Date(now)
  const t = getTimes(d, coords.lat, coords.lon)

  // moon: the next event ahead — "rises" until it's up, then "sets"
  const evs = []
  for (const off of [0, 1]) {
    const dd = new Date(d); dd.setDate(dd.getDate() + off)
    const m = getMoonTimes(dd, coords.lat, coords.lon)
    if (ok(m.rise)) evs.push(['rises', m.rise])
    if (ok(m.set)) evs.push(['sets', m.set])
  }
  const next = evs.filter(([, x]) => x.getTime() > now).sort((a, b) => a[1] - b[1])[0]
  const moonPhrase = moonPhaseName(moon.phase)
  const moonVerb = next ? (next[0] === 'rises' ? 'ascends at' : 'descends at') : null
  const moonTime = next ? fmt(next[1]) : null

  // the light window — golden hour or blue hour, whichever is current or next (always one)
  const lw = lightWindow(now, coords)
  // if it's already happening, the START has passed — point at when it ENDS instead,
  // so we never say "turns to honey at 05:31" once 05:31 is behind us
  const lwNow = lw && d.getTime() >= lw.s.getTime() && d.getTime() <= lw.e.getTime()
  const lwLabel = !lw ? null
    : lw.kind === 'golden'
      ? (lwNow ? 'honey light until' : 'light turns to honey at')
      : (lwNow ? 'Twilight’s Edge until' : 'Twilight’s Edge starts at')
  const lwTime = lw ? fmt(lwNow ? lw.e : lw.s) : null

  // stars: if darkness is still to come, count to it; if it's already dark, the
  // stars will fade at dawn, so count to that instead
  const duskNext = soonestFuture(d, coords, ['night', 'nauticalDusk', 'dusk'])
  const dawnNext = soonestFuture(d, coords, ['nightEnd', 'nauticalDawn', 'dawn'])
  let starPhrase = null, starVerb = null, starTime = null
  if (duskNext && (!dawnNext || duskNext.getTime() <= dawnNext.getTime())) { starVerb = 'emerge by'; starTime = fmt(duskNext) }
  else if (dawnNext) { starVerb = 'fade by'; starTime = fmt(dawnNext) }
  if (starTime) starPhrase = 'stars'

  // the current zodiac sign and when its reign turns to the next
  const sign = getZodiac(d)
  const signDays = daysToNextSign(d)

  return (
    <div className="tg-tf tg-tf-tonight">
      <div className="tg-tf-head">{reading || 'tonight'}</div>
      {lw && (
        <div className="tg-tf-row">{lw.kind === 'golden' ? <SunGlyph /> : <BlueGlyph />}<span>{lwLabel} <span className="tg-nowrap"><span className="tg-time">{lwTime}</span></span></span></div>
      )}
      <div className="tg-tf-row"><MoonGlyph phase={moon.phase} /><span>{moonPhrase}{moonVerb ? <>, <span className="tg-nowrap">{moonVerb} <span className="tg-time">{moonTime}</span></span></> : ''}</span></div>
      {starPhrase && <div className="tg-tf-row"><StarGlyph /><span>{starPhrase} <span className="tg-nowrap">{starVerb} <span className="tg-time">{starTime}</span></span></span></div>}
      {signDays != null && <div className="tg-tf-row"><ZodiacGlyph /><span>In {sign}, <span className="tg-nowrap">the wheel turns in <span className="tg-time">{signDays}d</span></span></span></div>}
    </div>
  )
}

// ---- B · the sun's and moon's arcs, tucked left and right ----
// the exact sun and moon objects from the corner ticker, ridden along the arc
function SunDisc() {
  return (
    <g>
      <g stroke="#e7c24a" strokeWidth="1.8" strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return <line key={i} x1={12 + Math.cos(a) * 7} y1={12 + Math.sin(a) * 7} x2={12 + Math.cos(a) * 9.7} y2={12 + Math.sin(a) * 9.7} />
        })}
      </g>
      <circle cx="12" cy="12" r="4.4" fill="#f0b429" />
    </g>
  )
}
function MoonDisc() {
  return (
    <g>
      <defs>
        <radialGradient id="tg-arcmoon" cx="38%" cy="34%" r="78%">
          <stop offset="0" stopColor="#fff7e0" /><stop offset="0.62" stopColor="#f2e2ac" /><stop offset="1" stopColor="#e7c97e" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="9.5" fill="url(#tg-arcmoon)" />
      <circle cx="9" cy="9" r="1.5" fill="#dcc07a" opacity="0.55" />
      <circle cx="14.6" cy="13.2" r="2" fill="#dcc07a" opacity="0.5" />
      <circle cx="9.8" cy="15.2" r="1.1" fill="#dcc07a" opacity="0.5" />
    </g>
  )
}

// The arc's height tracks how high the body actually climbs at its peak (its
// culmination altitude), so a high summer sun draws a tall dome and a low winter
// sun a flat one — and the moon, riding its own declination, differs again. The
// horizontal span stays fixed to keep the line clean; only the height varies.
const ARC = { p0x: 8, p2x: 102, cx: 55, y0: 52 }
function arcControlY(peakAlt) {
  const a = Math.max(0, Math.min(90, peakAlt || 0))
  const dome = 9 + (a / 90) * 26 // apex height above the horizon: ~9 (flat winter) … ~35 (tall summer)
  return ARC.y0 - 2 * dome       // quadratic control y (apex sits at y0 - dome)
}
function arcPoint(p, cy) {
  const q = 1 - p
  return { x: q * q * ARC.p0x + 2 * q * p * ARC.cx + p * p * ARC.p2x, y: q * q * ARC.y0 + 2 * q * p * cy + p * p * ARC.y0 }
}
function Arc({ progress, marker, peakAlt }) {
  const cy = arcControlY(peakAlt)
  const pt = progress == null ? null : arcPoint(progress, cy)
  return (
    <svg className="tg-tf-arcsvg" viewBox="0 6 110 58" aria-hidden="true">
      <line x1="4" y1={ARC.y0} x2="106" y2={ARC.y0} stroke="currentColor" strokeWidth="1.8" opacity="0.5" />
      <path d={`M${ARC.p0x} ${ARC.y0} Q${ARC.cx} ${cy} ${ARC.p2x} ${ARC.y0}`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.85" />
      {pt && <svg x={pt.x - 12} y={pt.y - 12} width="24" height="24" viewBox="0 0 24 24">{marker}</svg>}
    </svg>
  )
}
function moonUpInterval(coords, now) {
  const evs = []
  for (const off of [-1, 0, 1]) {
    const d = new Date(now); d.setDate(d.getDate() + off)
    const m = getMoonTimes(d, coords.lat, coords.lon)
    if (ok(m.rise)) evs.push(['rise', m.rise.getTime()])
    if (ok(m.set)) evs.push(['set', m.set.getTime()])
  }
  const rises = evs.filter(e => e[0] === 'rise').map(e => e[1]).sort((a, b) => a - b)
  const sets = evs.filter(e => e[0] === 'set').map(e => e[1]).sort((a, b) => a - b)
  for (const r of rises) {
    const s = sets.find(x => x > r)
    if (s != null && now >= r && now <= s) return { rise: r, set: s }
  }
  return null
}

function SunMoonArcs({ coords, now, moon }) {
  if (!coords) return <NeedPlace />
  const d = new Date(now)
  const t = getTimes(d, coords.lat, coords.lon)
  if (!ok(t.sunrise) || !ok(t.sunset)) return <NeedPlace />
  const sunP = (now >= t.sunrise.getTime() && now <= t.sunset.getTime())
    ? (now - t.sunrise.getTime()) / (t.sunset.getTime() - t.sunrise.getTime()) : null
  const sDec = sunDeclinationDeg(d)
  const sDir = riseSetDirections(sDec, coords.lat)
  const sunPeak = 90 - Math.abs(coords.lat - sDec) // how high the sun climbs at noon
  const sunLines = [
    `rises ${sDir ? sDir.rise + ' · ' : ''}${fmt(t.sunrise)}`,
    `sets ${sDir ? sDir.set + ' · ' : ''}${fmt(t.sunset)}`,
  ]

  const mt = getMoonTimes(d, coords.lat, coords.lon)
  const upi = moonUpInterval(coords, now)
  const moonP = upi ? (now - upi.rise) / (upi.set - upi.rise) : null
  const moonPeak = 90 - Math.abs(coords.lat - moonDeclinationDeg(d)) // the moon rides its own declination
  const moonLines = []
  if (mt.alwaysUp) moonLines.push('aloft all night')
  else if (mt.alwaysDown) moonLines.push('hidden all night')
  else {
    if (ok(mt.rise)) { const dr = riseSetDirections(moonDeclinationDeg(mt.rise), coords.lat); moonLines.push(`rises ${dr ? dr.rise + ' · ' : ''}${fmt(mt.rise)}`) }
    if (ok(mt.set)) { const ds = riseSetDirections(moonDeclinationDeg(mt.set), coords.lat); moonLines.push(`sets ${ds ? ds.set + ' · ' : ''}${fmt(mt.set)}`) }
  }

  return (
    <div className="tg-tf tg-tf-arcs">
      <div className="tg-tf-arc-col">
        <div className="tg-tf-arc-title">the sun's road</div>
        <Arc progress={sunP} marker={<SunDisc />} peakAlt={sunPeak} />
        <div className="tg-tf-arc-cap">{sunLines.map((l, i) => <div key={i}>{l}</div>)}</div>
      </div>
      <div className="tg-tf-arc-col">
        <div className="tg-tf-arc-title">the moon's road</div>
        <Arc progress={moonP} marker={<MoonDisc />} peakAlt={moonPeak} />
        <div className="tg-tf-arc-cap">{moonLines.map((l, i) => <div key={i}>{l}</div>)}</div>
      </div>
    </div>
  )
}
// ---- C · the living world (month nickname + the oracle's nature-call line) ----
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const NICKNAMES = [
  'Long Nights, Quickening Light', 'Late Frost, First Snowdrops', 'Equinox, Rising Sap',
  'Climbing Sun, Sudden Blossom', 'Soaring Light, Full Chorus', 'Peak Daylight, Deepening Green',
  'Long Dusks, Ripening Meadows', 'Waning Light, Heavy Harvest', 'Equinox, Gathering Gold',
  'Shortening Days, Turning Leaves', 'Low Sun, Bare Branches', 'Longest Night, Deep Stillness',
]
const ALMANAC = [
  'Bare branches and long shadows — the year at its quietest, the light already turning back.',
  'Snowdrops break the frost; the first birds try their songs before dawn.',
  'Buds swelling, the days drawing even, the dawn chorus beginning to gather.',
  'Blossom and birdsong, swallows returning, everything greening at once.',
  'Hawthorn foaming white in the hedges; the dawn chorus at its fullest.',
  'Swifts screaming at dusk, elderflower in the hedges, the year’s shortest nights.',
  'Long warm evenings, meadows going to seed, swifts still wheeling high.',
  'Heavy green and ripening blackberries, a first cool edge to the mornings.',
  'Dew-strung webs at dawn, swallows gathering on the wires, the light turning gold.',
  'Leaves turning and falling, fungi in the leaf-litter, woodsmoke on the air.',
  'Bare trees and low gold light, the last leaves down, geese moving south.',
  'The longest nights, frost on the grass — the year holding its breath before the turn.',
]
function LivingWorld({ now, reading }) {
  const m = now.getMonth()
  return (
    <div className="tg-tf tg-tf-living">
      <div className="tg-tf-head tg-tf-eyebrow">{MONTHS[m]}, {NICKNAMES[m]}</div>
      <div className="tg-tf-line">{reading || ALMANAC[m]}</div>
    </div>
  )
}

export default function ThresholdFill({ mode, reading }) {
  const { coords, now, moon } = useWorld()
  if (mode === 'tonight') return <Tonight coords={coords} now={now} moon={moon} reading={reading} />
  if (mode === 'arc') return <SunMoonArcs coords={coords} now={now} moon={moon} />
  return <LivingWorld now={now} reading={reading} />
}
