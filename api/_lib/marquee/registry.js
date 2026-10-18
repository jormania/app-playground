// The server half of the adapter registry. These ids are the contract with
// src/marquee/adapters.js — change one, change both.
//
// **Three ids, one reader, as of §9.94.** `iabilet`, `quantic` and `expirat`
// are all `iabilet.js`: Cinema Europa and Quantic on iabilet.ro's own venue
// pages, Expirat Halele Carol on an iabilet whitelabel under its own domain.
// They are kept as separate ids rather than collapsed into one, because the id
// is what the venue row and the Venues tab name — "the iabilet reader" is a
// fact about our code, and "Expirat" is what the person reading the tab is
// looking for — and because each carries its own `minItems`, which is the
// per-venue judgement that catches the next template change.
//
// They were three different things until recently, and the history is the
// reason the ids exist at all: `expirat` was the generic JSON-LD reader,
// `quantic` was that reader plus a hop for the hour iabilet would not publish,
// and `iabilet` was a two-hop bundle reader for Cinema Europa's themed
// weekends. iabilet.ro then removed the schema.org markup from every listing
// page it serves, all three broke in the same check, and rebuilding them on the
// row markup produced one reader three times. `odeon` is the counter-example
// that stayed separate: its JSON-LD has no offers and no location, and the hall
// and prices it does publish live in the surrounding HTML, so it needs a real
// module to join the two.
//
// The client's host-based auto-detection (adapters.js) suggests `iabilet` for
// any `-venue-<id>` URL on this host, which is now simply right — it used to be
// a trap, because Quantic's page and Europa's needed different readers.

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
import metropolis from './metropolis.js'
import cndb from './cndb.js'
import salaradio from './salaradio.js'
import quantic from './quantic.js'
import expirat from './expirat.js'

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
  metropolis,
  cndb,
  salaradio,
}

export function getAdapter(id) {
  return ADAPTERS[id] ?? null
}
