import { useState, useEffect, useLayoutEffect } from 'react'
import LoadingLine from './LoadingLine.jsx'

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

async function fetchTagline(apiKey) {
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
        content: 'Write one tagline under 12 words. Dreamy, witty, a quiet play on words about leaving your screen and going outside. Avoid clichés.',
      }],
    }),
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json()
  return data.content[0].text.trim().replace(/^["']|["'.]$/g, '')
}

export default function DeparturePanel({ onDepart, apiKey }) {
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
    fetchTagline(apiKey)
      .then(setTagline)
      .catch(() => setTagline(randomFallback()))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1>Touch Grass</h1>
      {loading ? <LoadingLine /> : <p>{tagline}</p>}
      <button onClick={onDepart}>Head outside</button>
    </div>
  )
}
