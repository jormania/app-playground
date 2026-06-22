import { getTimeOfDay, getSeason } from './context.js'

const DISCOVERIES = {
  // a small wrongness, a quiet omen — the world tilting half a degree
  common: [
    {
      name: 'The Listening Stone',
      description: 'A grey stone the size of a heart, faintly warm, that leans toward whatever you are about to say.',
    },
    {
      name: 'The Ninefold Shadow',
      description: 'Your shadow quietly divided into nine thin strands, each pointing toward a different, wrong noon.',
    },
    {
      name: 'A Coin Minted in No Year',
      description: 'A cold copper coin bearing a watching face on both sides and a date that has not happened.',
    },
    {
      name: 'The Door Drawn in Chalk',
      description: 'Someone chalked a door onto the path; its handle had been worn smooth by hands that used it.',
    },
  ],
  // an esoteric object or sign, clearly impossible, humming with hidden meaning
  uncommon: [
    {
      name: 'Reliquary of a Borrowed Hour',
      description: 'A glass vial sealed with wax, holding one hour you have not yet lived, already clouded with breath.',
    },
    {
      name: 'The Sigil That Keeps Count',
      description: 'A mark burned into bark adds a single stroke each time you blink, tallying something it will not name.',
    },
    {
      name: 'A Chart of Tomorrow\'s Rain',
      description: 'Damp parchment maps storms not yet arrived, the ink still creeping toward the place where you stand.',
    },
    {
      name: 'The Mirror\'s Quiet Tenant',
      description: 'A hand-mirror in the grass; your reflection arrives a moment late, and lingers a moment after you leave.',
    },
  ],
  // a divinatory apparition that bends sense — the veil thinning, something looking back
  rare: [
    {
      name: 'The Veil Drawn Thin',
      description: 'For three breaths the air parted like curtain-cloth, and something patient on the far side noted your name.',
    },
    {
      name: 'A Procession of Pale Lanterns',
      description: 'Lights without bearers drifted single-file across the field, pausing only where the dead are said to have paused.',
    },
    {
      name: 'The Hour the Birds Knelt',
      description: 'Every bird turned to face one empty point of sky and bowed, and the air dropped a single deliberate degree.',
    },
    {
      name: 'Your Name in an Older Mouth',
      description: 'From the treeline a voice spoke your name in a tongue that predates names, and waited, kindly, for reply.',
    },
  ],
  // a cosmic, mythic revelation — vast, ancient, indifferent; the kind that rearranges you
  legendary: [
    {
      name: 'The Geometry Beneath the Field',
      description: 'The ground turned briefly to glass, revealing vast wheels of stone and light that have always been dreaming us upward.',
    },
    {
      name: 'The Sleeping Cartographer',
      description: 'You glimpsed the immense, slow being that maps all walks ever taken; it added yours with a gesture older than the sun.',
    },
    {
      name: 'A Star That Opened an Eye',
      description: 'One point of the dusk unhooded itself, regarded the whole of your small life at once, and judged it worth continuing.',
    },
  ],
}


function formatDuration(minutes) {
  if (minutes < 1) return 'less than a minute'
  if (minutes < 60) return `${Math.round(minutes)} minutes`
  const h = Math.floor(minutes / 60)
  return `${h} hour${h > 1 ? 's' : ''}`
}

// Random "anchor" domains, one chosen per call, to force variety and stop the
// model fixating on a single recurring motif (moths, butterflies, watching eyes…).
const ANCHORS = [
  'a stone, the soil, or something rooted',
  'water, rain, frost, dew, or mist',
  'light, shadow, or reflection',
  'a sound, an echo, a hum, or sudden silence',
  'a door, a threshold, a stair, a gate, or a path',
  'bone, breath, hair, teeth, or the body',
  'time, an hour, a date, or a clock',
  'a written thing — a name, a map, a sigil, a page',
  'glass, a lens, a window, or a mirror',
  'wind, air, smoke, or breath made visible',
  'a number, an angle, a knot, or a geometry',
  'an old object — a coin, a key, a lantern, a jar, a bell',
  'a plant, a seed, a root, a fungus, or a thorn',
  'a bird, a fish, a hare, a fox, or some four-legged animal',
  'an insect — a beetle, a spider, a moth, a dragonfly, or something winged',
  'cold, heat, fever, or weather',
  'a memory, a dream, a debt, or a voice',
  'the moon, a star, a planet, or the distance overhead',
  'a color, a smell, or a taste',
  'a coincidence, a number repeating, or a pattern in chance',
  'cloth, thread, a garment, or something woven',
]

function moonPhaseName(phase) {
  if (phase == null) return null
  const p = ((phase % 1) + 1) % 1
  if (p < 0.03 || p > 0.97) return 'a new moon'
  if (p < 0.22) return 'a waxing crescent moon'
  if (p < 0.28) return 'a first-quarter moon'
  if (p < 0.47) return 'a waxing gibbous moon'
  if (p < 0.53) return 'a full moon'
  if (p < 0.72) return 'a waning gibbous moon'
  if (p < 0.78) return 'a last-quarter moon'
  return 'a waning crescent moon'
}

const WEATHER_PHRASE = {
  clear: 'clear skies', 'partly-cloudy': 'a partly cloudy sky', overcast: 'an overcast sky',
  fog: 'fog', rain: 'rain', snow: 'snow', thunder: 'a thunderstorm',
}
function weatherPhrase(weather) {
  if (!weather) return null
  let s = WEATHER_PHRASE[weather.condition] || null
  if (typeof weather.temp === 'number') {
    const t = `${Math.round(weather.temp)}°C`
    s = s ? `${s} around ${t}` : t
  }
  return s
}

const BIOME_PHRASE = {
  coast: 'by the sea — salt air, the tideline, the cries of gulls',
  forest: 'deep among trees — moss, bark, and green shade',
  city: 'in a city — stone, brick, and the hum of streets',
  mountain: 'high in the mountains — thin air, bare rock, and distance',
  plain: 'out on open ground — fields, wind, and a wide sky',
}

function placePhrase(coords) {
  if (!coords) return null
  const lat = Math.abs(coords.lat)
  const band = lat < 23.5 ? 'the tropics'
    : lat < 50 ? 'temperate latitudes'
    : lat < 66.5 ? 'far northern or southern latitudes'
    : 'the polar circle'
  return `${coords.lat >= 0 ? 'the northern hemisphere' : 'the southern hemisphere'}, ${band}`
}

// Esoteric "moments" active today (solstice, meteor shower, full moon …).
export function describeMoments(moments) {
  if (!moments || !moments.length) return ''
  const names = moments.map(m => m.name).join(' and ')
  const themes = moments.map(m => m.theme).join('; ')
  return `${names} — ${themes}`
}

// A one-line "where & when" for the prompts, woven from the live world state.
export function describeSetting(ctx = {}) {
  const time = ctx.timeOfDay || getTimeOfDay(new Date())
  const season = ctx.season || getSeason(new Date())
  const parts = [`It is ${time} in ${season}`]
  const w = weatherPhrase(ctx.weather)
  if (w) parts.push(`under ${w}`)
  const moon = moonPhaseName(ctx.moon && ctx.moon.phase)
  if (moon && (time === 'night' || time === 'dusk')) parts.push(`with ${moon} overhead`)
  // a concrete biome (when known) is more evocative than the latitude band;
  // fall back to the hemisphere/latitude estimate when there's no biome
  if (ctx.biome && BIOME_PHRASE[ctx.biome]) {
    parts.push(BIOME_PHRASE[ctx.biome])
  } else {
    const place = placePhrase(ctx.coords)
    if (place) parts.push(`in ${place}`)
  }
  return parts.join(', ') + '.'
}

async function fetchDiscovery(tier, durationMinutes, apiKey, ctx = {}) {
  const anchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)]
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 130,
      temperature: 1,
      system: `You generate eldritch, dreamlike discoveries for a divination-themed walking app cast as a deck of unknown tarot cards. Each find is an impossible object, omen, or apparition the walker encountered outside — drawn from the surreal, the esoteric, divination and the occult, threaded with the macabre and with cosmic, Lovecraftian dread. Never mundane, never realistic, never ordinary comfort. Let the subject range widely across finds and rarely repeat — moths, butterflies and other insects are welcome but should be occasional guests, never your default. Respond with valid JSON only: {"name": "...", "description": "..."}. The name is an evocative title of 2–6 words, like an entry in a grimoire or the face of a tarot card; use Title Case, no leading article unless it truly belongs. The description is a single sentence of 12 to 20 words — and NEVER more than 24 words; 24 is a hard ceiling, count and obey it. Lean short; never pad. Hushed, precise, and strange; dread through implication, never gore for shock. No quotes.`,
      messages: [
        {
          role: 'user',
          content: `Conjure a ${tier} find. The walker was outside for ${formatDuration(durationMinutes)}. ${describeSetting(ctx)} Let the setting — the hour, season, weather and sky — seep into its mood.${(ctx.moments && ctx.moments.length) ? `\n\nToday is a rare moment: ${describeMoments(ctx.moments)}. Let it strongly shape the find, like an omen of the day.` : ''}\n\nAnchor the imagery in ${anchor}. Reach for something you would not usually choose; surprise me.\n\nTier guide (escalating strangeness):\n- common: a small wrongness, a quiet omen — the world tilting half a degree.\n- uncommon: an esoteric object or sign, clearly impossible, humming with hidden meaning.\n- rare: a divinatory apparition that bends sense — the veil thinning, something looking back.\n- legendary: a cosmic, mythic revelation — vast, ancient, indifferent; the kind of thing that rearranges you.`,
        },
      ],
    }),
  })

  if (!res.ok) throw new Error(`API ${res.status}`)

  const data = await res.json()
  const text = data.content[0].text.trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON in response')
  const parsed = JSON.parse(text.slice(start, end + 1))

  if (!parsed.name || !parsed.description) throw new Error('bad shape')
  parsed.description = clampWords(parsed.description, 24)
  return parsed
}

// a hard ceiling on the description length, in case the oracle runs long: keep
// the first N words and let it trail off rather than ramble
function clampWords(text, max) {
  const words = String(text).trim().split(/\s+/)
  if (words.length <= max) return text
  return words.slice(0, max).join(' ').replace(/[,;:.—-]+$/, '') + '…'
}

export function rollTier(durationMinutes) {
  let weights = { common: 60, uncommon: 30, rare: 8, legendary: 2 }

  if (durationMinutes >= 60) {
    weights = { common: 30, uncommon: 42, rare: 20, legendary: 8 }
  } else if (durationMinutes >= 30) {
    weights = { common: 48, uncommon: 36, rare: 13, legendary: 3 }
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let roll = Math.random() * total

  for (const [tier, weight] of Object.entries(weights)) {
    roll -= weight
    if (roll <= 0) return tier
  }
  return 'common'
}

export async function generateDiscovery(tier, durationMinutes, apiKey, ctx = {}) {
  if (apiKey) {
    try {
      const discovery = await fetchDiscovery(tier, durationMinutes, apiKey, ctx)
      return { discovery, isStatic: false, apiAttempted: true }
    } catch (err) {
      console.warn('[touch-grass] API call failed, using static fallback:', err)
      const pool = DISCOVERIES[tier]
      return { discovery: pool[Math.floor(Math.random() * pool.length)], isStatic: true, apiAttempted: true }
    }
  }
  const pool = DISCOVERIES[tier]
  return { discovery: pool[Math.floor(Math.random() * pool.length)], isStatic: true, apiAttempted: false }
}
