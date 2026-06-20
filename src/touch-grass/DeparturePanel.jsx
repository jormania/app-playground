import { useState, useEffect, useLayoutEffect } from 'react'
import LoadingLine from './LoadingLine.jsx'
import { useWorld } from './world.jsx'
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

// a varied, stable colour per moment (so the event "pops" unpredictably)
const MOMENT_PALETTE = ['#e2a92f', '#3ab0c0', '#c060e0', '#df5b3f', '#6fae72', '#5a9fd4', '#d4738f', '#c49830']
function momentColor(key) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return MOMENT_PALETTE[h % MOMENT_PALETTE.length]
}

const COND_WORD = {
  clear: 'clear', 'partly-cloudy': 'a few clouds', overcast: 'overcast',
  fog: 'foggy', rain: 'rain', snow: 'snow', thunder: 'storms',
}

async function fetchTagline(apiKey, ctx) {
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
      max_tokens: 50,
      system: 'You write short poetic taglines for a walking app. Return plain text only — no quotes, no punctuation at the end.',
      messages: [{
        role: 'user',
        content: `Write one tagline under 12 words. Dreamy, witty, a quiet play on words about leaving your screen and going outside. ${describeSetting(ctx)}${(ctx.moments && ctx.moments.length) ? ` Today is ${describeMoments(ctx.moments)} — you may nod to it.` : ''} You may let the hour, weather or moon tint it, lightly. Avoid clichés.`,
      }],
    }),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  return data.content[0].text.trim().replace(/^["']|["'.]$/g, '')
}

export default function DeparturePanel({ onDepart, apiKey }) {
  const world = useWorld()
  const [tagline, setTagline] = useState(null)
  const [loading, setLoading] = useState(true)

  // Runs synchronously before the browser paints — prevents any flash
  // of previous content regardless of how the component was re-entered.
  useLayoutEffect(() => {
    setTagline(null)
    setLoading(true)
  }, [])

  useEffect(() => {
    if (!apiKey) {
      setTagline(randomFallback())
      setLoading(false)
      return
    }
    const ctx = { timeOfDay: world.timeOfDay, season: world.season, weather: world.weather, moon: world.moon, coords: world.coords, moments: world.moments }
    fetchTagline(apiKey, ctx)
      .then(setTagline)
      .catch(() => setTagline(randomFallback()))
      .finally(() => setLoading(false))
  }, [])

  const moments = world.moments || []
  const today = world.weather && world.weather.today

  return (
    <div>
      {(moments.length > 0 || today) && (
        <div className="tg-threshold-info">
          {moments.length > 0 && (
            <div className="tg-moment">
              Today's moment ·{' '}
              {moments.map((m, i) => (
                <span key={m.key}>{i > 0 ? ' · ' : ''}<span style={{ color: momentColor(m.key) }}>{m.name}</span></span>
              ))}
            </div>
          )}
          {today && (
            <div className="tg-forecast">
              <span className="tg-fc-now">{Math.round(world.weather.temp)}° · {COND_WORD[world.weather.condition] || world.weather.condition}</span>
              {today.high != null && today.low != null && (
                <span className="tg-fc-range"> · up to {Math.round(today.high)}°, {Math.round(today.low)}° by night</span>
              )}
              {today.alerts.length > 0 && (
                <div className="tg-fc-alerts">{today.alerts.map((a, i) => <span key={i}>~ {a}</span>)}</div>
              )}
            </div>
          )}
        </div>
      )}
      <h1>Touch Grass</h1>
      {loading ? <LoadingLine /> : <p>{tagline}</p>}
      <button onClick={onDepart}>Head outside</button>
    </div>
  )
}
