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
  'Drift Away', 'Step Into the Open', 'Leave the Glow Behind',
  'Find the Edge of Here', 'Let the World Back In', 'Trade Screen for Sky',
  'Walk Until You Forget', 'Go Be Somewhere Real', 'Outside Is Waiting',
]
const INVITES_BY_TOD = {
  dawn:  ['Follow the First Bird', 'Meet the Morning Air', 'Greet the Early Sky', 'Go Where the Light Returns'],
  day:   ['Chase the Sun', 'Go Where the Light Goes', 'Find the Warm Light', 'Follow the First Bird'],
  dusk:  ['Chase Dusk', 'Catch the Last Light', 'Walk Into the Gold', 'Meet the Evening Air'],
  night: ['Walk Under the Moon', 'Follow the Stars Out', 'Into the Cool Dark', 'Meet the Night Air'],
}

function randomInvite(timeOfDay) {
  const pool = INVITES_ANY.concat(INVITES_BY_TOD[timeOfDay] || [])
  return pool[Math.floor(Math.random() * pool.length)]
}

const MINOR_WORDS = new Set(['a', 'an', 'the', 'to', 'of', 'and', 'in', 'into', 'on', 'by', 'with', 'for', 'at', 'from'])

// keep only a clean 1–5 word invite that avoids touch/grass, in light title case
function cleanInvite(s) {
  if (!s || typeof s !== 'string') return null
  if (/touch|grass/i.test(s)) return null
  const words = s.trim().replace(/["'.]/g, '').split(/\s+/).filter(Boolean)
  if (words.length < 1 || words.length > 5) return null
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

async function fetchThreshold(apiKey, ctx) {
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
      max_tokens: 80,
      temperature: 1,
      system: `You write the home screen of a walking app whose whole purpose is to get the user to put the phone down and go outside. Respond with valid JSON only: {"invite": "...", "tagline": "..."}.
"invite": one to five words (lean short when you can), Title Case — a fresh, compelling call to step outside (e.g. "Slip Away", "Leave the Glow Behind", "Go Where the Light Goes"). It is really an invitation to touch grass, said another way. Never use the words "touch" or "grass". Vary it; surprise me.
"tagline": one line under 12 words — dreamy, witty, a quiet play on leaving the screen for the world. No quotes, no trailing punctuation.
Both MUST fit the real time of day stated below. At night never invoke the sun, daylight, dawn, or "chasing the light"; by day never invoke the moon, stars, or the dark. Match what is actually outside right now.`,
      messages: [{
        role: 'user',
        content: `Compose the invite and tagline for right now. ${describeSetting(ctx)}${(ctx.moments && ctx.moments.length) ? ` Today is ${describeMoments(ctx.moments)} — you may nod to it.` : ''} Let the hour above guide the imagery — the light by day, the moon and dark by night.`,
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
  return {
    invite: cleanInvite(parsed.invite) || randomInvite(),
    tagline: tagline || randomFallback(),
  }
}

export default function DeparturePanel({ onDepart, apiKey, fill = 'almanac' }) {
  const world = useWorld()
  const [invite, setInvite] = useState(() => randomInvite(world.timeOfDay))
  const [tagline, setTagline] = useState(null)
  const [loading, setLoading] = useState(true)

  // Runs synchronously before the browser paints — prevents any flash
  // of previous content regardless of how the component was re-entered.
  useLayoutEffect(() => {
    setInvite(randomInvite(world.timeOfDay))
    setTagline(null)
    setLoading(true)
  }, [])

  useEffect(() => {
    if (!apiKey) {
      setTagline(randomFallback())
      setLoading(false)
      return
    }
    const ctx = { timeOfDay: world.timeOfDay, season: world.season, weather: world.weather, moon: world.moon, coords: world.coords, biome: world.biome, moments: world.moments }
    fetchThreshold(apiKey, ctx)
      .then(({ invite, tagline }) => { setInvite(invite); setTagline(tagline) })
      .catch(() => setTagline(randomFallback()))
      .finally(() => setLoading(false))
  }, [])

  const moments = world.moments || []

  return (
    <div>
      <ThresholdFill mode={fill} />
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
