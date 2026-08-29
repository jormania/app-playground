// Demo mode: the app with no Notion token at all.
//
// Same contract as Wanderlist and Radar-B — no token means fixtures, so the venue
// manager can be opened, played with and understood before anyone pastes a
// secret. Edits are held in memory only and vanish on reload, which is the honest
// behaviour for a demo: nothing here reaches Notion.
//
// The venues below are the real ones, as inspected on 2026-08-26 — kept in step
// with what the readers actually cover, so demo mode exercises every rung the
// app ships (selector, feed, embedded-json, two-hop) rather than the subset
// that happened to exist the week it was written.

import { normalizeVenue } from './venues.js'

export const DEMO_VENUES = [
  {
    id: 'demo-excelsior',
    name: 'Teatrul Excelsior',
    area: 'centru',
    address: 'Strada Academiei 28, sector 1, București',
    url: 'https://teatrul-excelsior.ro/program/',
    adapter: 'excelsior',
    status: 'active',
    category: 'play',
    lastChecked: '2026-08-26',
    lastResult: '24 events · 1 sold out',
  },
  {
    id: 'demo-filarmonica',
    name: 'Filarmonica George Enescu',
    url: 'https://www.filarmonicaenescu.ro/ro/evenimente',
    adapter: 'filarmonica',
    status: 'active',
    category: 'concert',
    area: 'centru',
    address: 'Str. Benjamin Franklin 1-3, sector 1, București',
    lastChecked: '2026-08-26',
    lastResult: '87 events',
  },
  {
    id: 'demo-union',
    name: 'Cinema Union',
    url: 'https://eventbook.ro/hall/cinema-union',
    adapter: 'eventbook',
    config: 'cinema-union',
    status: 'active',
    category: 'movie',
    area: 'centru',
    address: 'Str. Ion Câmpineanu 21, sector 1, București',
    lastChecked: '2026-08-26',
    lastResult: '1 event',
  },
  {
    id: 'demo-elvire',
    name: 'Cinema Elvira Popescu',
    area: 'dorobanti',
    address: 'Bulevardul Dacia 77, sector 2, București',
    url: 'https://eventbook.ro/hall/cinema-elvire-popesco',
    adapter: 'eventbook',
    config: 'cinema-elvire-popesco',
    status: 'active',
    category: 'movie',
    lastChecked: '2026-08-26',
    lastResult: '10 events (page 1 of 8)',
  },
  {
    id: 'demo-taranului',
    name: 'Cinema Muzeul Țăranului',
    area: 'victoriei',
    address: 'Strada Monetăriei 3, sector 1, București',
    url: 'https://eventbook.ro/hall/cinema-muzeul-taranului-studio-horia-bernea',
    adapter: 'eventbook',
    config: 'cinema-muzeul-taranului-studio-horia-bernea',
    status: 'active',
    category: 'movie',
  },
  {
    id: 'demo-control',
    name: 'Club Control',
    area: 'centru',
    address: 'Strada Constantin Mille 4, sector 1, București',
    url: 'https://eventbook.ro/hall/club-control',
    adapter: 'eventbook',
    config: 'club-control',
    status: 'paused',
    category: 'concert',
    notes: 'Paused over the summer — nothing programmed until October.',
  },
  {
    id: 'demo-tnb',
    name: 'Teatrul Național București',
    url: 'https://www.tnb.ro/ro/bilete-online',
    adapter: 'tnb',
    status: 'active',
    category: 'play',
    area: 'centru',
    address: 'Bulevardul Nicolae Bălcescu 2, sector 1, București',
    lastChecked: '2026-08-26',
    lastResult: '108 events',
  },
  {
    id: 'demo-unteatru',
    name: 'Teatrul Unteatru',
    area: 'dorobanti',
    address: 'Strada Secerei 14, sector 2, București',
    url: 'https://www.mystage.ro/teatre/unteatru-2',
    adapter: 'mystage',
    status: 'active',
    category: 'play',
    lastChecked: '2026-08-26',
    lastResult: '10 events',
  },
  {
    id: 'demo-europa',
    name: 'Cinema Europa',
    url: 'https://www.iabilet.ro/bilete-cinema-europa-venue-5877/',
    adapter: 'iabilet',
    config: '5877',
    status: 'active',
    category: 'movie',
    area: 'mosilor',
    address: 'Calea Moșilor 127, sector 2, București',
    lastChecked: '2026-08-26',
    lastResult: '7 events',
  },
  {
    id: 'demo-odeon',
    name: 'Teatrul Odeon',
    url: 'https://teatrul-odeon.ro/programul-teatrului-odeon-pe-zile/',
    adapter: 'odeon',
    status: 'active',
    category: 'play',
    area: 'centru',
    address: 'Calea Victoriei 40-42, sector 1, București',
    lastChecked: '2026-08-27',
    lastResult: '15 events',
  },
  {
    id: 'demo-quantic',
    name: 'Quantic',
    area: 'grozavesti',
    url: 'https://www.iabilet.ro/bilete-quantic-venue-1705/',
    adapter: 'quantic',
    status: 'active',
    category: 'concert',
    address: 'Șoseaua Grozăvești 82, 060752, București',
    lastChecked: '2026-08-27',
    lastResult: '24 events',
  },
  {
    id: 'demo-expirat',
    name: 'Expirat Halele Carol',
    url: 'https://tickets.expirat.org/',
    adapter: 'expirat',
    status: 'active',
    category: 'concert',
    area: 'carol',
    address: 'Strada Doctor Constantin Istrati 1, București 040542',
    lastChecked: '2026-08-26',
    lastResult: '16 events',
  },
  {
    id: 'demo-arcub',
    // ARCUB is the one interdisciplinary venue in this list — theatre,
    // exhibitions, guided tours, concerts and street festivals, often in the
    // same week, each read off its OWN `.tags` label rather than forced
    // under this one Category Default (see programme.js's `categoryFor`,
    // MARQUEE.md). `event` here is only the fallback for a listing whose tag
    // this app's mapping doesn't recognise.
    name: 'ARCUB',
    url: 'https://arcub.ro/agenda',
    adapter: 'arcub',
    status: 'active',
    category: 'event',
    area: 'centru',
    address: 'Strada Gabroveni 50-53, București',
    lastChecked: '2026-08-29',
    lastResult: '7 events',
  },
].map(normalizeVenue)

/** Two rows standing in for Wanderlist's Findings, so demo mode shows the
 *  "already kept" behaviour rather than pretending nothing is ever saved. The
 *  first matches a real Expirat listing; the second is a near-miss on purpose —
 *  same title, different venue — so the matcher's venue check is visible. */
const DEMO_FINDINGS = [
  {
    id: 'demo-finding-seed-1',
    url: null,
    name: 'Ana Coman • Hidden Gems',
    place: 'Expirat Halele Carol, Strada Doctor Constantin Istrati 1, București',
    plannedDate: '2026-08-26',
    dateExpiring: '2026-08-26',
    attended: false,
    going: false,
  },
  {
    id: 'demo-finding-seed-2',
    url: null,
    name: 'Ana Coman • Hidden Gems',
    place: 'Club Control, Strada Constantin Mille 4, București',
    plannedDate: '2026-09-30',
    dateExpiring: null,
    attended: false,
    going: false,
  },
]

export function createFixtureClient() {
  let venues = DEMO_VENUES.map((v) => ({ ...v }))
  let findings = DEMO_FINDINGS.map((f) => ({ ...f }))
  let counter = 0

  return {
    mode: 'demo',
    venuesDatabaseId: null,

    async listVenues() {
      return venues.map((v) => ({ ...v }))
    },

    async addVenue(venue) {
      const saved = normalizeVenue({ ...venue, id: `demo-new-${++counter}` })
      venues = [...venues, saved]
      return { ...saved }
    },

    async updateVenue(venue) {
      const saved = normalizeVenue(venue)
      venues = venues.map((v) => (v.id === saved.id ? saved : v))
      return { ...saved }
    },

    async setStatus(id, status) {
      venues = venues.map((v) => (v.id === id ? { ...v, status } : v))
      return { ...venues.find((v) => v.id === id) }
    },

    async removeVenue(id) {
      venues = venues.filter((v) => v.id !== id)
      return { id, archived: true }
    },

    async recordScan(id, { checkedAt, result }) {
      venues = venues.map((v) => (v.id === id ? { ...v, lastChecked: checkedAt, lastResult: result } : v))
      return { ...venues.find((v) => v.id === id) }
    },

    async listFindings() {
      return findings.map((f) => ({ ...f }))
    },

    /** Demo saves go nowhere real, but they DO join the in-memory Findings list —
     *  otherwise the dedupe guard could never be seen working without a token. */
    async saveToWanderlist(draft) {
      const saved = {
        id: `demo-finding-${++counter}`,
        url: null,
        name: draft.name,
        place: draft.place,
        plannedDate: draft.plannedDate ?? null,
        dateExpiring: draft.dateExpiring ?? null,
        attended: false,
        going: false,
      }
      findings = [...findings, saved]
      return { ...saved, demo: true }
    },

    async unsaveFromWanderlist(id) {
      findings = findings.filter((f) => f.id !== id)
      return { id, archived: true }
    },

    async probe() {
      return {
        ok: true,
        hasRows: venues.length > 0,
        venues: { ok: true, hasRows: venues.length > 0 },
        findings: { ok: true, hasRows: findings.length > 0 },
      }
    },
  }
}
