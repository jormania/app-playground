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
