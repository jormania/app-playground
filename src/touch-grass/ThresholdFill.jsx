import { useWorld } from './world.jsx'
import { getTimes, getMoonTimes } from 'suncalc'
import { moonPhaseName } from './context.js'
import { CONSTELLATIONS, getZodiac } from './zodiac.js'

// A quiet reading that fills the empty sky above the invitation on the Threshold.
// One of four, chosen in the Keeper (persisted): the real sky tonight, the sun's
// arc today, the rising zodiac sign, or a living-world (seasonal) almanac. Kept
// faint and small so it never competes with the invitation below it.

const ok = (x) => x instanceof Date && Number.isFinite(x.getTime())
const fmt = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

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

// ---- B · the sun's arc today, with a marker for where it is now ----
function SunArc({ coords, now }) {
  if (!coords) return <NeedPlace />
  const t = getTimes(new Date(now), coords.lat, coords.lon)
  if (!ok(t.sunrise) || !ok(t.sunset)) return <NeedPlace />
  const sr = t.sunrise.getTime(), ss = t.sunset.getTime()
  const up = now >= sr && now <= ss
  const p = Math.max(0, Math.min(1, (now - sr) / (ss - sr)))
  // quadratic arc P0(12,60) → C(100,-32) → P2(188,60); point at t = p
  const q = 1 - p
  const x = q * q * 12 + 2 * q * p * 100 + p * p * 188
  const y = q * q * 60 + 2 * q * p * -32 + p * p * 60
  return (
    <div className="tg-tf tg-tf-arc">
      <svg className="tg-tf-arcsvg" viewBox="0 0 200 72" aria-hidden="true">
        <line x1="6" y1="60" x2="194" y2="60" stroke="currentColor" strokeWidth="1" opacity="0.28" />
        <path d="M12 60 Q100 -32 188 60" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        {up && <>
          <circle cx={x} cy={y} r="7" fill="#e7c24a" opacity="0.18" />
          <circle cx={x} cy={y} r="3.6" fill="#f0b429" />
        </>}
      </svg>
      <div className="tg-tf-arc-times"><span>{fmt(t.sunrise)}</span><span>{fmt(t.sunset)}</span></div>
    </div>
  )
}

// ---- C · tonight's rising zodiac constellation ----
function RisingSign({ now }) {
  const sign = getZodiac(now)
  const con = CONSTELLATIONS[sign] || CONSTELLATIONS.aries
  const X = (i) => 10 + con.points[i][0] * 100
  const Y = (i) => 8 + con.points[i][1] * 54
  return (
    <div className="tg-tf tg-tf-sign">
      <svg className="tg-tf-signsvg" viewBox="0 0 120 70" aria-hidden="true">
        {con.lines.map(([a, b], i) => <line key={i} x1={X(a)} y1={Y(a)} x2={X(b)} y2={Y(b)} stroke="currentColor" strokeWidth="1" opacity="0.45" />)}
        {con.points.map((_, i) => <circle key={i} cx={X(i)} cy={Y(i)} r="1.7" fill="#f3ead4" />)}
      </svg>
      <div className="tg-tf-line">{sign} rising in the east</div>
    </div>
  )
}

// ---- D · a living-world almanac, by month (Northern hemisphere) ----
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
  if (mode === 'arc') return <SunArc coords={coords} now={now} />
  if (mode === 'sign') return <RisingSign now={now} />
  return <Almanac now={now} />
}
