// Client for the Google Places autocomplete used by the Place field. All requests go
// through this site's /api/places proxy so the Google key stays server-side (never
// shipped to the browser). Every call degrades gracefully: if the proxy says the key
// isn't configured, or the network is down, the caller falls back to a plain text field
// (see PlaceInput.jsx) — Place is never a hard dependency on Google being reachable.
const ENDPOINT = '/api/places'

// A per-editing-session token lets Google bill autocomplete + the final details call as
// one session. Cheap random id; regenerated each time the editor opens a fresh Place.
export function newSessionToken() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch { /* ignore */ }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function post(body, signal) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 501) return { configured: false }
  if (!res.ok) throw new Error(data.message || `Places request failed (${res.status})`)
  return { configured: true, ...data }
}

// Returns { configured, predictions: [{ description, placeId }] }. On any error returns
// configured:false so the UI quietly falls back rather than surfacing a scary message
// for what is only a typeahead nicety.
export async function autocomplete(input, sessionToken, signal) {
  const q = String(input || '').trim()
  if (q.length < 2) return { configured: true, predictions: [] }
  try {
    const data = await post({ action: 'autocomplete', input: q, sessionToken }, signal)
    if (!data.configured) return { configured: false, predictions: [] }
    return { configured: true, predictions: data.predictions || [] }
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return { configured: false, predictions: [] }
  }
}

// Resolve a chosen prediction to a stored place. Returns { configured, place } where
// place is { name, address, mapsUrl }. Falls back to configured:false on any error.
export async function details(placeId, sessionToken) {
  try {
    const data = await post({ action: 'details', placeId, sessionToken })
    if (!data.configured || !data.place) return { configured: false }
    return { configured: true, place: data.place }
  } catch {
    return { configured: false }
  }
}
