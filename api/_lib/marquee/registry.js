// The server half of the adapter registry. These ids are the contract with
// src/marquee/adapters.js — change one, change both.
//
// `expirat` is not its own module: the site is an iabilet.ro whitelabel that emits
// complete schema.org Event objects, so it IS the generic reader, registered under
// its own id so the venue row and the UI can name what is reading it.

import excelsior from './excelsior.js'
import eventbook from './eventbook.js'
import filarmonica from './filarmonica.js'
import oveit from './oveit.js'
import iabilet from './iabilet.js'
import jsonld from './jsonld.js'

const expirat = { ...jsonld, id: 'expirat', label: 'Expirat / iabilet whitelabel', minItems: 3 }

export const ADAPTERS = {
  excelsior,
  eventbook,
  filarmonica,
  oveit,
  iabilet,
  expirat,
  jsonld,
}

export function getAdapter(id) {
  return ADAPTERS[id] ?? null
}
