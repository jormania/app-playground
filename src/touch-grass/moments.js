// Esoteric / astronomical "moments" through the year — solstices, equinoxes,
// the pagan cross-quarter sabbats, meteor showers, zodiac ingresses, perihelion
// /aphelion, and full/new moons. Pure & date-driven (lunar needs the phase).
// No Christian feasts — only what sits naturally in the tarot/celestial scheme.

const FIXED = [
  // turning points of the solar year
  { key: 'spring-equinox', month: 3,  day: 20, name: 'the Spring Equinox', theme: 'day and night in perfect balance as the year tilts toward growth' },
  { key: 'summer-solstice', month: 6, day: 21, name: 'the Summer Solstice', theme: 'the longest day, the sun crowned at its zenith and most generous' },
  { key: 'autumn-equinox', month: 9,  day: 22, name: 'the Autumn Equinox', theme: 'the scales of light and dark level again before the long descent' },
  { key: 'winter-solstice', month: 12, day: 21, name: 'the Winter Solstice', theme: 'the longest night, the still point where the light is reborn' },

  // the cross-quarter sabbats
  { key: 'imbolc',     month: 2,  day: 1,  name: 'Imbolc', theme: 'the first quickening beneath frozen ground, a single candle against winter' },
  { key: 'beltane',    month: 5,  day: 1,  name: 'Beltane', theme: 'the fire-festival of bloom and union, spring tipping into summer' },
  { key: 'lughnasadh', month: 8,  day: 1,  name: 'Lughnasadh', theme: 'the first harvest, the year beginning quietly to die' },
  { key: 'samhain',    month: 10, day: 31, name: 'Samhain', theme: 'the night the veil wears thin and the dead draw near', window: 1 },

  // meteor showers (peak ± a night)
  { key: 'quadrantids', month: 1,  day: 3,  name: 'the Quadrantids', theme: 'a brief, sharp fall of winter meteors', meteor: true, window: 1 },
  { key: 'lyrids',      month: 4,  day: 22, name: 'the Lyrids', theme: 'old comet-dust streaking the spring sky', meteor: true, window: 1 },
  { key: 'eta-aquariids', month: 5, day: 6, name: 'the Eta Aquariids', theme: 'fragments of Halley raining before dawn', meteor: true, window: 1 },
  { key: 'delta-aquariids', month: 7, day: 30, name: 'the Delta Aquariids', theme: 'a slow drizzle of midsummer meteors', meteor: true, window: 1 },
  { key: 'perseids',    month: 8,  day: 12, name: 'the Perseids', theme: 'the sky shedding fire on the warmest nights', meteor: true, window: 1 },
  { key: 'draconids',   month: 10, day: 8,  name: 'the Draconids', theme: 'the dragon breathing sparks low in the north', meteor: true, window: 1 },
  { key: 'orionids',    month: 10, day: 21, name: 'the Orionids', theme: 'swift meteors loosed from the hunter', meteor: true, window: 1 },
  { key: 'leonids',     month: 11, day: 17, name: 'the Leonids', theme: "the lion's brief storm of shooting stars", meteor: true, window: 1 },
  { key: 'geminids',    month: 12, day: 14, name: 'the Geminids', theme: 'the richest fall of the year, slow and bright', meteor: true, window: 1 },
  { key: 'ursids',      month: 12, day: 22, name: 'the Ursids', theme: 'a quiet shower around the longest night', meteor: true, window: 1 },

  // earth's orbit
  { key: 'perihelion', month: 1, day: 4, name: 'Perihelion', theme: 'Earth swung closest to the sun, though the world lies cold' },
  { key: 'aphelion',   month: 7, day: 4, name: 'Aphelion', theme: 'Earth at its farthest from the sun, though the world lies warm' },
]

// dates the sun crosses into each zodiac sign (the ingress)
const INGRESS = [
  { month: 1, day: 20, sign: 'aquarius' }, { month: 2, day: 19, sign: 'pisces' },
  { month: 3, day: 21, sign: 'aries' }, { month: 4, day: 20, sign: 'taurus' },
  { month: 5, day: 21, sign: 'gemini' }, { month: 6, day: 21, sign: 'cancer' },
  { month: 7, day: 23, sign: 'leo' }, { month: 8, day: 23, sign: 'virgo' },
  { month: 9, day: 23, sign: 'libra' }, { month: 10, day: 23, sign: 'scorpio' },
  { month: 11, day: 22, sign: 'sagittarius' }, { month: 12, day: 22, sign: 'capricorn' },
]

function withinWindow(date, month, day, window) {
  const y = date.getFullYear()
  const ev = new Date(y, month - 1, day)
  const cur = new Date(y, date.getMonth(), date.getDate())
  return Math.abs(Math.round((cur - ev) / 86400000)) <= (window || 0)
}

const cap = (s) => s[0].toUpperCase() + s.slice(1)

export function getActiveMoments(date, moonPhase) {
  const out = []
  for (const ev of FIXED) {
    if (withinWindow(date, ev.month, ev.day, ev.window)) {
      out.push({ key: ev.key, name: ev.name, theme: ev.theme, meteor: !!ev.meteor })
    }
  }
  const ing = INGRESS.find(s => s.month === date.getMonth() + 1 && s.day === date.getDate())
  if (ing) {
    out.push({
      key: 'ingress-' + ing.sign,
      name: `the Sun's entry into ${cap(ing.sign)}`,
      theme: `the Sun crossing into ${cap(ing.sign)}, a spoke of the zodiac wheel turning`,
    })
  }
  if (typeof moonPhase === 'number') {
    const p = ((moonPhase % 1) + 1) % 1
    if (p < 0.025 || p > 0.975) {
      out.push({ key: 'new-moon', name: 'a New Moon', theme: 'the moon gone dark, the sky holding its breath' })
    } else if (Math.abs(p - 0.5) < 0.025) {
      out.push({ key: 'full-moon', name: 'a Full Moon', theme: 'the moon full and watchful, the tides of the strange at their height' })
    }
  }
  return out
}

// for the ?event= preview override
export function getMomentByKey(key) {
  if (key === 'full-moon') return { key, name: 'a Full Moon', theme: 'the moon full and watchful, the tides of the strange at their height' }
  if (key === 'new-moon') return { key, name: 'a New Moon', theme: 'the moon gone dark, the sky holding its breath' }
  const ev = FIXED.find(e => e.key === key)
  return ev ? { key: ev.key, name: ev.name, theme: ev.theme, meteor: !!ev.meteor } : null
}
