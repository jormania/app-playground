// Selection logic for the Map view (pure, tested). The map plots the entries that carry a
// place, ordered so the one you most need to act on leads — the default the map centres on.
import { sortEntries } from './search.js'

// Entries worth mapping: those with a non-empty place. Ordered Expiring-first (the same
// tested comparator the list uses), so the leader is the next unattended thing to expire
// that has a place — which is exactly where the map should open. Attended items still map
// (you might want to find a place you've been), they just sink to the bottom like everywhere.
export function mapEntries(entries, today) {
  const withPlace = (entries || []).filter(e => e && e.place && String(e.place).trim())
  return sortEntries(withPlace, 'expiring', today)
}

// The place a keyless Google Maps embed centres on for a given entry — its resolved place
// text, URL-encoded into the classic `?q=…&output=embed` form (no API key needed). Returns
// '' for an entry without a place. Google's embed only shows ONE pin (the query) — deliberate:
// we chose Google's familiar map over a multi-pin custom-map stack, one place at a time.
export function embedSrc(entry, { zoom = 14 } = {}) {
  const place = entry?.place ? String(entry.place).trim() : ''
  if (!place) return ''
  return `https://maps.google.com/maps?q=${encodeURIComponent(place)}&z=${zoom}&output=embed`
}
