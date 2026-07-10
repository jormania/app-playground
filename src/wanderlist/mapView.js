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

// Wanderlist is a Bucharest backlog, so a bare venue name gets the city appended before
// it's handed to the map — see embedSrc.
const DEFAULT_CITY = 'București'

// The place a keyless Google Maps embed centres on for a given entry — its resolved place
// text, URL-encoded into the classic `?q=…&output=embed` form (no API key needed). Returns
// '' for an entry without a place. Google's embed only shows ONE pin (the query) — deliberate:
// we chose Google's familiar map over a multi-pin custom-map stack, one place at a time.
//
// The embed only DROPS a pin when Google resolves the query to one confident place: a full
// address ("Cinema Pro, Str. Ion Ghica 3, București") pins, but a bare name ("Hanul
// Gabroveni") often just centres the map without a marker. So when the place looks like a
// bare name (no comma → no street/city), we append the city to give Google enough to pin it;
// anything already carrying a comma is assumed address-shaped and left as-is.
export function embedSrc(entry, { zoom = 14 } = {}) {
  const place = entry?.place ? String(entry.place).trim() : ''
  if (!place) return ''
  const q = place.includes(',') ? place : `${place}, ${DEFAULT_CITY}`
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&output=embed`
}
