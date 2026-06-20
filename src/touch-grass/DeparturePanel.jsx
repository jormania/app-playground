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

// ---- the forecast "reading": glyph + warmth-coloured temps + divinatory prose ----
const CREAM = '#f3ead4', GOLD = '#e7c24a'

function tempColor(t) {
  if (t <= 0) return '#9ec6e0'
  if (t <= 10) return '#7fc4cc'
  if (t <= 20) return '#cdd6a2'
  if (t <= 28) return '#e7c24a'
  return '#e0894a'
}

const CONDITION_PROSE = {
  clear: 'the sky bare and bright',
  'partly-cloudy': 'a few clouds drifting, unhurried',
  overcast: 'a grey lid drawn over everything',
  fog: 'a fog keeping its counsel close',
  rain: 'rain threading down',
  snow: 'snow settling in silence',
  thunder: 'a storm muttering somewhere overhead',
}

function Cloud({ y = 13 }) {
  return (
    <g fill={CREAM}>
      <ellipse cx="12" cy={y} rx="7.5" ry="4" />
      <circle cx="7.6" cy={y - 1} r="3.3" />
      <circle cx="12" cy={y - 3.4} r="4" />
      <circle cx="16" cy={y - 1.4} r="3.1" />
    </g>
  )
}
function rays(cx, cy, inner, outer, n = 8) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { x1: cx + Math.cos(a) * inner, y1: cy + Math.sin(a) * inner, x2: cx + Math.cos(a) * outer, y2: cy + Math.sin(a) * outer }
  })
}
function Sun({ cx = 12, cy = 12, r = 5, ri = 7, ro = 10 }) {
  return (
    <g>
      {rays(cx, cy, ri, ro).map((p, i) => <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" />)}
      <circle cx={cx} cy={cy} r={r} fill={GOLD} />
    </g>
  )
}

function ForecastGlyph({ condition }) {
  let body
  if (condition === 'clear') body = <Sun />
  else if (condition === 'partly-cloudy') body = <><Sun cx={15.5} cy={8} r={3.4} ri={4.6} ro={6.6} /><Cloud y={15} /></>
  else if (condition === 'fog') body = <><Cloud y={10} /><g stroke={CREAM} strokeWidth="1.4" strokeLinecap="round" fill="none"><path d="M5 16 q3 -1.6 6 0 t6 0" /><path d="M5 19 q3 -1.6 6 0 t6 0" /></g></>
  else if (condition === 'rain') body = <><Cloud y={9} /><g stroke="#bcd6e4" strokeWidth="1.5" strokeLinecap="round"><line x1="8" y1="15" x2="7" y2="19" /><line x1="12" y1="15" x2="11" y2="19" /><line x1="16" y1="15" x2="15" y2="19" /></g></>
  else if (condition === 'snow') body = <><Cloud y={9} /><g fill="#eef2f4"><circle cx="8" cy="17" r="1.1" /><circle cx="12" cy="19" r="1.1" /><circle cx="16" cy="17" r="1.1" /></g></>
  else if (condition === 'thunder') body = <><Cloud y={9} /><path d="M12.5 14 L9.5 19 L12 19 L10.5 23 L15 16.5 L12.5 16.5 Z" fill={GOLD} /></>
  else body = <Cloud />
  return <svg className="tg-fc-glyph" viewBox="0 0 24 24" aria-hidden="true">{body}</svg>
}

function Temp({ value }) {
  const v = Math.round(value)
  return <b style={{ color: tempColor(v) }}>{v}°</b>
}

function ForecastReading({ weather }) {
  const t = Math.round(weather.temp)
  const cond = CONDITION_PROSE[weather.condition] || 'the sky keeping its counsel'
  const td = weather.today
  const hi = td && td.high != null ? Math.round(td.high) : null
  const lo = td && td.low != null ? Math.round(td.low) : null
  return (
    <p className="tg-forecast-body">
      The air holds at <Temp value={t} />, {cond}.
      {hi != null && lo != null && (hi > t + 1
        ? <> It will climb toward <Temp value={hi} /> before the night draws it down to <Temp value={lo} />.</>
        : <> It rests here, then the dark will draw it down to <Temp value={lo} />.</>)}
    </p>
  )
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
              <div className="tg-forecast-head">
                <ForecastGlyph condition={world.weather.condition} />
                <span className="tg-forecast-label">the sky's augury</span>
              </div>
              <ForecastReading weather={world.weather} />
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
