import { useWorld } from './world.jsx'
import { getTimes, getMoonTimes } from 'suncalc'
import { moonPhaseName } from './context.js'

// A quiet reading that fills the empty sky above the invitation on the Threshold.
// One of three, chosen in the Keeper (persisted): the real sky tonight, the sun
// and moon arcs across today, or a living-world (seasonal) almanac. Kept faint
// and small so it never competes with the invitation below it.

const ok = (x) => x instanceof Date && Number.isFinite(x.getTime())
const fmt = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` // 24h, compact

function NeedPlace() {
  return <div className="tg-tf"><div className="tg-tf-line">turn on Place to read the sky here</div></div>
}

// ---- A · tonight: golden hour & sunset, the moon, when the stars come ----
function Tonight({ coords, now, moon }) {
  if (!coords) return <NeedPlace />
  const d = new Date(now)
  const t = getTimes(d, coords.lat, coords.lon)
  const lines = []
  if (ok(t.goldenHour) && ok(t.sunset)) lines.push(`gold at ${fmt(t.goldenHour)}, gone by ${fmt(t.sunset)}`)

  let moonLine = `${moonPhaseName(moon.phase)}, ${Math.round((moon.fraction || 0) * 100)}% lit`
  const evs = []
  for (const off of [0, 1]) {
    const dd = new Date(d); dd.setDate(dd.getDate() + off)
    const m = getMoonTimes(dd, coords.lat, coords.lon)
    if (ok(m.rise)) evs.push(['rises', m.rise])
    if (ok(m.set)) evs.push(['sets', m.set])
  }
  const next = evs.filter(([, x]) => x.getTime() > now).sort((a, b) => a[1] - b[1])[0]
  if (next) moonLine += ` · ${next[0]} ${fmt(next[1])}`
  lines.push(moonLine)

  const stars = ok(t.night) ? t.night : (ok(t.dusk) ? t.dusk : null)
  if (stars) lines.push(`stars by ${fmt(stars)}`)

  return (
    <div className="tg-tf">
      <div className="tg-tf-head">tonight</div>
      {lines.map((l, i) => <div className="tg-tf-line" key={i}>{l}</div>)}
    </div>
  )
}

// ---- B · the sun's and moon's arcs across today, side by side ----
// one shared little arc shape, so the two sit perfectly level
const ARC = { p0x: 8, p2x: 102, cx: 55, cy: -28, y0: 48 }
function arcPoint(p) {
  const q = 1 - p
  return {
    x: q * q * ARC.p0x + 2 * q * p * ARC.cx + p * p * ARC.p2x,
    y: q * q * ARC.y0 + 2 * q * p * ARC.cy + p * p * ARC.y0,
  }
}
function Arc({ progress, halo, core }) {
  const pt = progress == null ? null : arcPoint(progress)
  return (
    <svg className="tg-tf-arcsvg" viewBox="0 0 110 56" aria-hidden="true">
      <line x1="4" y1={ARC.y0} x2="106" y2={ARC.y0} stroke="currentColor" strokeWidth="1" opacity="0.28" />
      <path d={`M${ARC.p0x} ${ARC.y0} Q${ARC.cx} ${ARC.cy} ${ARC.p2x} ${ARC.y0}`} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      {pt && <>
        <circle cx={pt.x} cy={pt.y} r="6" fill={halo} opacity="0.18" />
        <circle cx={pt.x} cy={pt.y} r="3.2" fill={core} />
      </>}
    </svg>
  )
}

// the moon's current up-interval (rise → next set bracketing now), or null if down
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

function moonSpan(mt) {
  if (mt.alwaysUp) return 'up all night'
  if (mt.alwaysDown) return 'below'
  return `${ok(mt.rise) ? fmt(mt.rise) : '—'}–${ok(mt.set) ? fmt(mt.set) : '—'}`
}

function SunMoonArcs({ coords, now }) {
  if (!coords) return <NeedPlace />
  const d = new Date(now)
  const t = getTimes(d, coords.lat, coords.lon)
  if (!ok(t.sunrise) || !ok(t.sunset)) return <NeedPlace />
  const sunP = (now >= t.sunrise.getTime() && now <= t.sunset.getTime())
    ? (now - t.sunrise.getTime()) / (t.sunset.getTime() - t.sunrise.getTime())
    : null
  const mt = getMoonTimes(d, coords.lat, coords.lon)
  const upi = moonUpInterval(coords, now)
  const moonP = upi ? (now - upi.rise) / (upi.set - upi.rise) : null
  return (
    <div className="tg-tf tg-tf-arcs">
      <div className="tg-tf-arc-col">
        <Arc progress={sunP} halo="#e7c24a" core="#f0b429" />
        <div className="tg-tf-arc-cap">sun · {fmt(t.sunrise)}–{fmt(t.sunset)}</div>
      </div>
      <div className="tg-tf-arc-col">
        <Arc progress={moonP} halo="#cfd6e0" core="#e8eef5" />
        <div className="tg-tf-arc-cap">moon · {moonSpan(mt)}</div>
      </div>
    </div>
  )
}

// ---- C · a living-world almanac, by month (Northern hemisphere) ----
const ALMANAC = [
  { head: 'january', note: 'Bare branches and long shadows — the year at its quietest, the light already turning back.' },
  { head: 'february', note: 'Snowdrops break the frost; the first birds try their songs before dawn.' },
  { head: 'march', note: 'Buds swelling, the days drawing even, the dawn chorus beginning to gather.' },
  { head: 'april', note: 'Blossom and birdsong, swallows returning, everything greening at once.' },
  { head: 'may', note: 'Hawthorn foaming white in the hedges; the dawn chorus at its fullest.' },
  { head: 'june', note: 'Swifts screaming at dusk, elderflower in the hedges, the year’s shortest nights.' },
  { head: 'july', note: 'Long warm evenings, meadows going to seed, swifts still wheeling high.' },
  { head: 'august', note: 'Heavy green and ripening blackberries, a first cool edge to the mornings.' },
  { head: 'september', note: 'Dew-strung webs at dawn, swallows gathering on the wires, the light turning gold.' },
  { head: 'october', note: 'Leaves turning and falling, fungi in the leaf-litter, woodsmoke on the air.' },
  { head: 'november', note: 'Bare trees and low gold light, the last leaves down, geese moving south.' },
  { head: 'december', note: 'The longest nights, frost on the grass — the year holding its breath before the turn.' },
]
function Almanac({ now }) {
  const a = ALMANAC[now.getMonth()]
  return (
    <div className="tg-tf">
      <div className="tg-tf-head">{a.head}</div>
      <div className="tg-tf-line">{a.note}</div>
    </div>
  )
}

export default function ThresholdFill({ mode }) {
  const { coords, now, moon } = useWorld()
  if (mode === 'tonight') return <Tonight coords={coords} now={now} moon={moon} />
  if (mode === 'arc') return <SunMoonArcs coords={coords} now={now} />
  return <Almanac now={now} />
}
