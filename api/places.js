// Server-side proxy for Google Places autocomplete, powering Wanderlist's Place field.
// The Google key lives ONLY here (GOOGLE_PLACES_KEY env var) — never in the browser. If
// the key isn't set we answer 501 so the app quietly falls back to a plain text Place
// field. Two actions: `autocomplete` (as you type) and `details` (resolve a picked
// prediction to a name + address + Maps link). Uses the Places API (New).
import { originAllowed, rateLimited, clientIp } from './_shared.js'

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'
const DETAILS_BASE = 'https://places.googleapis.com/v1/places/'

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ message: 'Use POST.' }); return }
  if (!originAllowed(req.headers.origin)) { res.status(403).json({ message: 'Origin not allowed.' }); return }
  if (rateLimited(clientIp(req))) { res.status(429).json({ message: 'Too many requests — try again shortly.' }); return }

  const key = process.env.GOOGLE_PLACES_KEY
  if (!key) { res.status(501).json({ configured: false, message: 'Place search isn’t configured (GOOGLE_PLACES_KEY).' }); return }

  const payload = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  const { action, input, placeId, sessionToken } = payload

  try {
    if (action === 'autocomplete') {
      const gres = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
        body: JSON.stringify({ input: String(input || ''), ...(sessionToken ? { sessionToken } : {}) }),
      })
      const data = await gres.json().catch(() => ({}))
      if (!gres.ok) { res.status(502).json({ message: data?.error?.message || `Places autocomplete failed (${gres.status})` }); return }
      const predictions = (data.suggestions || [])
        .map(s => s.placePrediction)
        .filter(Boolean)
        .map(p => ({ description: p.text?.text || '', placeId: p.placeId }))
        .filter(p => p.placeId)
      res.status(200).json({ configured: true, predictions })
      return
    }

    if (action === 'details') {
      if (!placeId) { res.status(400).json({ message: 'Missing placeId.' }); return }
      const url = DETAILS_BASE + encodeURIComponent(placeId) + (sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : '')
      const gres = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,googleMapsUri',
        },
      })
      const data = await gres.json().catch(() => ({}))
      if (!gres.ok) { res.status(502).json({ message: data?.error?.message || `Place details failed (${gres.status})` }); return }
      const name = data.displayName?.text || data.formattedAddress || ''
      const mapsUrl = data.googleMapsUri
        || (data.location ? `https://www.google.com/maps/search/?api=1&query=${data.location.latitude},${data.location.longitude}` : '')
      res.status(200).json({ configured: true, place: { name, address: data.formattedAddress || '', mapsUrl } })
      return
    }

    res.status(400).json({ message: 'Unknown action.' })
  } catch (err) {
    res.status(502).json({ message: `Places proxy error: ${err.message}` })
  }
}

function safeParse(str) {
  try { return JSON.parse(str) } catch { return {} }
}
