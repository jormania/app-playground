// The server half of the adapter registry. These ids are the contract with
// src/marquee/adapters.js — change one, change both.
//
// `expirat` and `quantic` are not their own modules: each site's venue page
// already emits complete schema.org Event objects, so each IS the generic
// reader, aliased under its own id so the venue row and the UI can name what
// is reading it. `odeon` STARTED that way and outgrew it — its JSON-LD has no
// offers and no location, and the hall and prices it does publish live in the
// surrounding HTML, so it needs a real module to join the two (see odeon.js).
//
// `quantic` is the one worth a second look, because its URL would fool the
// client's own host-based auto-detection (adapters.js) into suggesting
// `iabilet` — same domain, same `-venue-<id>` URL shape as Cinema Europa. But
// Cinema Europa's venue page carries only ONE Event block per weekly themed
// BUNDLE, with the real showings living on a child page's tariff accordion —
// that's what `iabilet.js`'s two-hop reader exists for. Quantic's own venue
// page already carries one real, complete Event per show, offers and all,
// directly — no bundle, no second hop, nothing for that reader to do. Two
// venues, same host, same URL shape, genuinely different page structure —
// confirmed by reading the real markup, not assumed from the domain.

import excelsior from './excelsior.js'
import eventbook from './eventbook.js'
import filarmonica from './filarmonica.js'
import oveit from './oveit.js'
import iabilet from './iabilet.js'
import jsonld from './jsonld.js'
import tnb from './tnb.js'
import mystage from './mystage.js'
import odeon from './odeon.js'
import arcub from './arcub.js'

const expirat = { ...jsonld, id: 'expirat', label: 'Expirat / iabilet whitelabel', minItems: 3 }
const quantic = { ...jsonld, id: 'quantic', label: 'Quantic / iabilet.ro venue page', minItems: 6 }

export const ADAPTERS = {
  excelsior,
  eventbook,
  filarmonica,
  oveit,
  iabilet,
  expirat,
  jsonld,
  tnb,
  mystage,
  odeon,
  quantic,
  arcub,
}

export function getAdapter(id) {
  return ADAPTERS[id] ?? null
}
