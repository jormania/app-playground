import { useWorld } from './world.jsx'

// The "table" the card rests on — a surface whose character changes each day:
// a warm wooden table, cool stone, a brick road, a green meadow, heather, wild
// rose… The day picks one hue family; the time of day sets its lightness, kept
// inverted against the card's interior sky so the card always reads against it
// and the drop shadow holds. Subtle by design — most of the screen is the card.
const SURFACES = [
  { h: 33,  s: 40 }, // warm table / wood
  { h: 44,  s: 34 }, // pale sand
  { h: 18,  s: 44 }, // terracotta / brick road
  { h: 216, s: 11 }, // cool stone
  { h: 248, s: 14 }, // slate
  { h: 104, s: 24 }, // meadow
  { h: 150, s: 18 }, // sage
  { h: 270, s: 20 }, // heather
  { h: 344, s: 22 }, // wild rose
]

// lightness by time of day, inverted against the card's interior:
// bright midday → a dark surface; dim dawn/dusk/night → a pale one
const STAGE_L = { dawn: 82, day: 26, dusk: 80, night: 80 }

function dayOfYear(d) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
}

function surfaceForDay(d) {
  const key = d.getFullYear() * 1000 + dayOfYear(d)
  const hash = (key * 2654435761) >>> 0 // spread consecutive days apart
  return SURFACES[hash % SURFACES.length]
}

// Preview override: ?surface=0..8 forces a particular ground surface.
function previewSurface() {
  try {
    const v = new URLSearchParams(window.location.search).get('surface')
    if (v == null) return null
    const i = parseInt(v, 10)
    return Number.isInteger(i) ? SURFACES[((i % SURFACES.length) + SURFACES.length) % SURFACES.length] : null
  } catch (_) {
    return null
  }
}

const hsl = (h, s, l) => `hsl(${h}, ${s}%, ${l}%)`

export default function Stage() {
  const { timeOfDay, now } = useWorld()
  const sfc = previewSurface() || surfaceForDay(now)
  const L = STAGE_L[timeOfDay] ?? 72

  const top = hsl(sfc.h, Math.max(0, sfc.s - 8), Math.min(96, L + 9))
  const mid = hsl(sfc.h, sfc.s, L)
  const bot = hsl(sfc.h, Math.min(100, sfc.s + 10), Math.max(6, L - 13))

  const bg =
    'radial-gradient(125% 85% at 28% 12%, rgba(255,255,255,0.06), rgba(0,0,0,0) 58%), ' +
    `linear-gradient(160deg, ${top} 0%, ${mid} 52%, ${bot} 100%)`

  return <div className="tg-stage" style={{ background: bg }} />
}
