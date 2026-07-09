// Turn a place string into { lat, lon } for the map, via OpenStreetMap's free Nominatim
// geocoder (no API key). Results — hits AND misses — are cached in localStorage so a place
// is only ever looked up once; on later map opens everything resolves instantly. Nominatim's
// usage policy asks for low volume, which a personal backlog of a few dozen places easily
// respects (the cache means we hit it once per place, ever), and callers geocode
// sequentially with a small delay (see MapModal) to stay polite.
const CACHE_KEY = 'wanderlist_geocode'

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {} } catch { return {} }
}
function writeCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* quota / private mode */ }
}

// Already-known coordinates for a place, or undefined if it's never been looked up. Lets a
// caller show cached pins immediately and only network-fetch the rest. A cached MISS is
// stored as null (distinct from undefined "unknown"), so we don't re-query a place that has
// no result.
export function cachedGeocode(place) {
  const key = String(place || '').trim()
  if (!key) return null
  const cache = readCache()
  return key in cache ? cache[key] : undefined
}

// Geocode a place string to { lat, lon } | null, caching the outcome. Network only when the
// place isn't already cached. Never throws — a failed lookup resolves to null.
export async function geocode(place) {
  const key = String(place || '').trim()
  if (!key) return null
  const cached = cachedGeocode(key)
  if (cached !== undefined) return cached
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(key)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const hit = Array.isArray(data) && data[0] ? { lat: Number(data[0].lat), lon: Number(data[0].lon) } : null
    const cache = readCache()
    cache[key] = hit
    writeCache(cache)
    return hit
  } catch {
    return null
  }
}
