import { useState, useEffect, useLayoutEffect } from 'react'
import LoadingLine from './LoadingLine.jsx'
import { useWorld } from './world.jsx'
import ThresholdFill from './ThresholdFill.jsx'
import { describeSetting, describeMoments } from './engine.js'

const FALLBACKS = [
  'The world is larger than this screen',
  'Nothing to find here. Everything out there',
  'This tab will still be here when you get back',
  'The app works better when you\'re not looking at it',
  'Whatever\'s out there has been waiting',
  'Somewhere nearby, something impossible is sitting in the grass',
  'Your phone will survive without you',
  'The best things don\'t load',
  'Close enough to outside that you can almost smell it',
  'Everything you\'re looking for is the wrong size to fit on this screen',
]

function randomFallback() {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]
}

// Short invitations to step outside — the card's heading. A different way of
// saying "touch grass" without those words (the masthead already carries them).
// Used as fallbacks when there's no API key, and as a safety net for the AI.
// Time-neutral ones plus a set matched to the hour, so the fallback never says
// "chase the light" at night or invokes the moon by day.
const INVITES_ANY = [
  'Wander Out', 'Slip Away', 'Roam Free', 'Venture Forth', 'Get Lost',
  'Drift Away', 'Into the Open', 'Leave the Glow', 'Find the Edge',
  'Be Somewhere Real', 'Outside Is Waiting', 'Step Outside', 'Off You Go',
]
const INVITES_BY_TOD = {
  dawn:  ['Greet the Dawn', 'Meet the Morning', 'Follow First Birds', 'Into First Light'],
  day:   ['Chase the Sun', 'Find the Light', 'Into the Day', 'Follow the Light'],
  dusk:  ['Chase Dusk', 'Catch Last Light', 'Into the Gold', 'Meet the Evening'],
  night: ['Under the Moon', 'Follow the Stars', 'Into the Dark', 'Meet the Night'],
}

function randomInvite(timeOfDay) {
  const pool = INVITES_ANY.concat(INVITES_BY_TOD[timeOfDay] || [])
  return pool[Math.floor(Math.random() * pool.length)]
}

const MINOR_WORDS = new Set(['a', 'an', 'the', 'to', 'of', 'and', 'in', 'into', 'on', 'by', 'with', 'for', 'at', 'from'])

// keep only a clean 1–3 word invite that avoids touch/grass, in light title case
function cleanInvite(s) {
  if (!s || typeof s !== 'string') return null
  if (/touch|grass/i.test(s)) return null
  const words = s.trim().replace(/["'.]/g, '').split(/\s+/).filter(Boolean)
  if (words.length < 1 || words.length > 3) return null
  return words
    .map((w, i) => {
      const lw = w.toLowerCase()
      if (i > 0 && MINOR_WORDS.has(lw)) return lw
      return lw.charAt(0).toUpperCase() + lw.slice(1)
    })
    .join(' ')
}

// a varied, stable colour per moment (so the event "pops" unpredictably)
const MOMENT_PALETTE = ['#e2a92f', '#3ab0c0', '#c060e0', '#df5b3f', '#6fae72', '#5a9fd4', '#d4738f', '#c49830']
function momentColor(key) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return MOMENT_PALETTE[h % MOMENT_PALETTE.length]
}

// the extra "reading" the oracle writes for the Threshold's chosen display:
//   tonight → a short atmospheric "Tonight, …" fragment
//   almanac → one bright, enticing line of nature's call (the living world now)
//   arc     → none (it's pure data)
function readingSpec(mode) {
  if (mode === 'tonight') return `\n"reading": ONE short fragment beginning with "Tonight," and ending with a period — evocative and grounded, at most FIVE words after "Tonight,", never a second sentence. Each visit, lean on a DIFFERENT facet and vary widely: the lie of the land (coast, forest, city, mountain, plain), the season and the turning year, the hour, the place itself — and only now and then the weather. Do NOT default to warmth, stillness, exhaling, or the sky. Examples across facets: "Tonight, the tideline keeps glowing." (coast) · "Tonight, the pines stand close." (forest) · "Tonight, the streets cool slowly." (city) · "Tonight, thin air sharpens the dark." (mountain) · "Tonight, the meadow lies open." (plain) · "Tonight, midsummer lingers late." (season).`
  if (mode === 'almanac') return `\n"reading": one line under 14 words, no trailing punctuation — nature's call: paint what the living world just outside is doing right now in bright, enticing, sensory words, true to the season, hour, place and weather below. Inviting, never a forecast.`
  return ''
}

async function fetchThreshold(apiKey, ctx, mode) {
  const wantReading = mode === 'tonight' || mode === 'almanac'
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
      max_tokens: 160,
      temperature: 1,
      system: `You write the home screen of a walking app whose whole purpose is to get the user to put the phone down and go outside. Respond with valid JSON only: {"invite": "...", "tagline": "..."${wantReading ? ', "reading": "..."' : ''}}.
"invite": one to three words (lean short when you can), Title Case — a fresh, compelling call to step outside (e.g. "Slip Away", "Leave the Glow", "Into the Gold"). It is really an invitation to touch grass, said another way. Never exceed three words. Never use the words "touch" or "grass". Vary it; surprise me.
"tagline": one line under 12 words — dreamy, witty, a quiet play on leaving the screen for the world. No quotes, no trailing punctuation.${readingSpec(mode)}
Everything MUST fit the real time of day stated below. At night never invoke the sun, daylight, dawn, or "chasing the light"; by day never invoke the moon, stars, or the dark. Match what is actually outside right now.`,
      messages: [{
        role: 'user',
        content: `Compose for right now. ${describeSetting(ctx)}${(ctx.moments && ctx.moments.length) ? ` Today is ${describeMoments(ctx.moments)} — you may nod to it.` : ''} Let the hour above guide the imagery — the light by day, the moon and dark by night.`,
      }],
    }),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  const text = data.content[0].text.trim()
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON in response')
  const parsed = JSON.parse(text.slice(start, end + 1))
  const tagline = (parsed.tagline || '').trim().replace(/^["']|["'.]+$/g, '')
  let reading = wantReading ? (parsed.reading || '').trim().replace(/^["']|["']$/g, '') : null
  // hard cap the Tonight fragment: one sentence, at most five words after "Tonight,"
  if (reading && mode === 'tonight') reading = clampTonight(reading)
  return {
    invite: cleanInvite(parsed.invite) || randomInvite(),
    tagline: tagline || randomFallback(),
    reading: reading || null,
  }
}

// keep the Tonight line to one short fragment: first sentence only, and no more
// than five words trailing "Tonight,"
function clampTonight(s) {
  const first = s.split(/(?<=[.!?])\s/)[0].trim()
  const words = first.replace(/[.!?]+$/, '').split(/\s+/)
  const capped = words.slice(0, 6).join(' ') // "Tonight," + up to five words
  return capped.replace(/[,;:]$/, '') + '.'
}

export default function DeparturePanel({ onDepart, apiKey, fill = 'almanac' }) {
  const world = useWorld()
  const [invite, setInvite] = useState(() => randomInvite(world.timeOfDay))
  const [tagline, setTagline] = useState(null)
  const [reading, setReading] = useState(null)
  const [loading, setLoading] = useState(true)

  // Runs synchronously before the browser paints — prevents any flash
  // of previous content regardless of how the component was re-entered.
  useLayoutEffect(() => {
    setInvite(randomInvite(world.timeOfDay))
    setTagline(null)
    setReading(null)
    setLoading(true)
  }, [])

  useEffect(() => {
    if (!apiKey) {
      setTagline(randomFallback())
      setLoading(false)
      return
    }
    const ctx = { timeOfDay: world.timeOfDay, season: world.season, weather: world.weather, moon: world.moon, coords: world.coords, biome: world.biome, moments: world.moments }
    fetchThreshold(apiKey, ctx, fill)
      .then(({ invite, tagline, reading }) => { setInvite(invite); setTagline(tagline); setReading(reading) })
      .catch(() => setTagline(randomFallback()))
      .finally(() => setLoading(false))
  }, [])

  const moments = world.moments || []

  return (
    <div>
      <ThresholdFill mode={fill} reading={reading} />
      <h1>{invite}</h1>
      {loading ? <LoadingLine /> : <p>{tagline}</p>}
      {moments.length > 0 && (
        <div className="tg-threshold-info">
          <div className="tg-moment">
            Today's moment ·{' '}
            {moments.map((m, i) => (
              <span key={m.key}>{i > 0 ? ' · ' : ''}<span style={{ color: momentColor(m.key) }}>{m.name}</span></span>
            ))}
          </div>
        </div>
      )}
      <button onClick={onDepart}>Head outside</button>
    </div>
  )
}
