// Shared helpers for the two "open something external" affordances that recur across
// the list row, detail view, and calendar agenda: the Place pin (opens Maps) and the
// Paid badge (opens ticket files).

// Best-effort Maps link for a place: prefer the resolved placeUrl (set when the entry
// was created via Google Places autocomplete); fall back to a plain Maps search by name
// for places that were typed as free text and never got a resolved link.
export function mapsLink(place, placeUrl) {
  if (placeUrl) return placeUrl
  if (!place) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
}

// Tickets on file: exactly one has an obvious target, so open it directly. More than
// one has no single "the" ticket to jump to, so open the entry instead — its detail
// view already lists every ticket, each individually clickable.
export function openTickets(entry, onOpen) {
  const tickets = entry?.tickets || []
  if (tickets.length === 1) window.open(tickets[0].url, '_blank', 'noopener')
  else if (tickets.length > 1) onOpen?.(entry)
}
