// Coarse biome detection — turns the cached coordinates into a single band
// (coast | forest | city | mountain | plain) used to flavour finds and ambience.
// Intentionally coarse and privacy-light: one word, never a street or a town.
// Two free, no-key sources: Open-Meteo elevation + OSM Nominatim reverse-geocode.
// Resolved once and cached; degrades silently to null (no band) on any failure.

const PLACE_KEY = 'tg-react-place'
export const BIOMES = ['coast', 'forest', 'city', 'mountain', 'plain']

// ~1 km granularity — enough to cache, coarse enough not to track
function roundKey(c) {
  return `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`
}

function loadCached(c) {
  try {
    const raw = localStorage.getItem(PLACE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p && p.key === roundKey(c) && BIOMES.includes(p.biome)) return p.biome
    }
  } catch (_) {}
  return null
}

function saveCached(c, biome) {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify({ key: roundKey(c), biome }))
  } catch (_) {}
}

// Collapse the raw signals into one band. Strong, unambiguous signals win first;
// everything uncertain falls through to open ground. Biased to under-label rather
// than mislabel — a band is a flavour, never a gate. Exported for unit tests.
export function classify(address = {}, category, type, elevation) {
  const t = (type || '').toLowerCase()
  const e = typeof elevation === 'number' && Number.isFinite(elevation) ? elevation : null

  if (e != null && e >= 1500) return 'mountain' // unambiguously alpine
  if (/beach|bay|cape|shore|coast|strand|dune/.test(t)) return 'coast'
  if (/wood|forest/.test(t)) return 'forest'
  if (/peak|ridge|cliff|volcano|fell|massif|saddle|glacier/.test(t)) return 'mountain'
  if (address && address.city) return 'city'
  if (e != null && e >= 900) return 'mountain' // upland, no named city
  return 'plain'
}

async function fetchElevation(lat, lon) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`)
    if (!r.ok) return null
    const d = await r.json()
    return Array.isArray(d.elevation) ? d.elevation[0] : d.elevation
  } catch (_) {
    return null
  }
}

async function fetchPlace(lat, lon) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=14&addressdetails=1`,
      { headers: { Accept: 'application/json' } }
    )
    if (!r.ok) return {}
    const d = await r.json()
    return { address: d.address || {}, category: d.category, type: d.type }
  } catch (_) {
    return {}
  }
}

export async function resolveBiome(coords) {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lon !== 'number') return null
  const cached = loadCached(coords)
  if (cached) return cached

  const [elevation, place] = await Promise.all([
    fetchElevation(coords.lat, coords.lon),
    fetchPlace(coords.lat, coords.lon),
  ])
  const biome = classify(place.address, place.category, place.type, elevation)
  if (biome) saveCached(coords, biome)
  return biome
}
