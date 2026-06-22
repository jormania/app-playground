import { useWorld } from './world.jsx'

// The ground the card rests on — the earth you're about to walk out onto. Its
// character comes from the real place (your biome) or, without a location, the
// season. The time of day sets its lightness, kept inverted against the card's
// interior sky so the card always reads against it and the drop shadow holds.
// A faint sheen tracks the sun, and a soft vignette frames the card.
// Subtle by design — most of the screen is the card.

// Surfaces as hue/saturation only (lightness is set later, by time of day).
// Each place keeps a small palette so there's still a little day-to-day variety
// without ever drifting away from what's true to it.
const COAST    = [{ h: 44, s: 32 }, { h: 40, s: 22 }, { h: 200, s: 14 }] // sand, pale dune, wet shore
const FOREST   = [{ h: 104, s: 24 }, { h: 90, s: 20 }, { h: 34, s: 26 }] // meadow, moss, loam
const CITY     = [{ h: 216, s: 11 }, { h: 18, s: 32 }, { h: 248, s: 10 }] // stone, brick, slate
const MOUNTAIN = [{ h: 248, s: 13 }, { h: 216, s: 11 }, { h: 270, s: 12 }] // slate, bare stone, cold grey
const PLAIN    = [{ h: 104, s: 24 }, { h: 120, s: 20 }, { h: 88, s: 26 }] // open meadow greens

const SPRING = [{ h: 104, s: 24 }, { h: 120, s: 22 }, { h: 344, s: 20 }] // fresh meadow, wild rose
const SUMMER = [{ h: 44, s: 30 }, { h: 104, s: 22 }, { h: 54, s: 30 }]   // sun-baked earth, dry grass, wheat
const AUTUMN = [{ h: 18, s: 38 }, { h: 30, s: 32 }, { h: 270, s: 18 }]   // terracotta, ochre, heather
const WINTER = [{ h: 216, s: 8 }, { h: 248, s: 10 }, { h: 200, s: 6 }]   // frost-stone, slate, pale ice

const BIOME_SURFACES = { coast: COAST, forest: FOREST, city: CITY, mountain: MOUNTAIN, plain: PLAIN }
const SEASON_SURFACES = { spring: SPRING, summer: SUMMER, autumn: AUTUMN, winter: WINTER }

// the legacy flat list, kept only so ?surface=0..8 still previews a fixed surface
const SURFACES = [
  { h: 33, s: 40 }, { h: 44, s: 34 }, { h: 18, s: 44 }, { h: 216, s: 11 }, { h: 248, s: 14 },
  { h: 104, s: 24 }, { h: 150, s: 18 }, { h: 270, s: 20 }, { h: 344, s: 22 },
]

// lightness by time of day, inverted against the card's interior:
// bright midday → a dark surface; dim dawn/dusk/night → a pale one
const STAGE_L = { dawn: 82, day: 26, dusk: 80, night: 80 }

// the sheen drifts with the sun — low and left at dawn, overhead by day, low and
// right at dusk, and barely there at night
const SHEEN = {
  dawn:  { x: 18, y: 18, a: 0.06 },
  day:   { x: 50, y: 8,  a: 0.07 },
  dusk:  { x: 82, y: 18, a: 0.06 },
  night: { x: 50, y: 14, a: 0.025 },
}

function dayOfYear(d) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
}

function dayHash(d) {
  const key = d.getFullYear() * 1000 + dayOfYear(d)
  return (key * 2654435761) >>> 0 // spread consecutive days apart
}

// the surface for today: from the real biome, else the season; a small palette
// each, picked by the day so it still shifts gently but stays true to the place
function surfaceFor(biome, season, d) {
  const palette = (biome && BIOME_SURFACES[biome]) || SEASON_SURFACES[season] || PLAIN
  return palette[dayHash(d) % palette.length]
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
  const { timeOfDay, season, biome, now } = useWorld()
  const sfc = previewSurface() || surfaceFor(biome, season, now)
  const L = STAGE_L[timeOfDay] ?? 72
  const sheen = SHEEN[timeOfDay] || SHEEN.day

  const top = hsl(sfc.h, Math.max(0, sfc.s - 8), Math.min(96, L + 9))
  const mid = hsl(sfc.h, sfc.s, L)
  const bot = hsl(sfc.h, Math.min(100, sfc.s + 10), Math.max(6, L - 13))

  const bg =
    'radial-gradient(135% 110% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.22) 100%), ' + // vignette frames the card
    `radial-gradient(120% 80% at ${sheen.x}% ${sheen.y}%, rgba(255,255,255,${sheen.a}), rgba(0,0,0,0) 60%), ` + // sheen tracks the sun
    `linear-gradient(160deg, ${top} 0%, ${mid} 52%, ${bot} 100%)`

  return <div className="tg-stage" style={{ background: bg }} />
}
