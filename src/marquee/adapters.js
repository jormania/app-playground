// Which parser can read which venue — the client's half of the adapter registry.
//
// Marquee only ever scans a page it has an adapter for. This module is what lets
// Settings answer "can you actually watch this venue?" the moment a URL is pasted,
// without a round trip, and what stops a venue being added that would silently
// return nothing forever.
//
// Each adapter is named after the SITE, not the venue, because one site can host
// many venues: `eventbook` alone covers four of the seven venues watched today.
// `config` is the per-venue parameter that site needs (the eventbook hall slug);
// it is derived from the URL here so nobody has to type it.
//
// The server keeps the matching parse implementations under api/_lib/marquee/.
// These ids are the contract between the two halves — change one, change both.

/** Ordered most-specific first; `jsonld` is the generic fallback and is only ever
 *  chosen explicitly, never by domain match. */
export const ADAPTERS = [
  {
    id: 'excelsior',
    label: 'Teatrul Excelsior',
    rung: 'selector',
    hosts: ['teatrul-excelsior.ro'],
    note: 'Server-rendered programme table. Ticket state is in the markup.',
  },
  {
    id: 'eventbook',
    label: 'Eventbook',
    rung: 'selector',
    hosts: ['eventbook.ro'],
    note: 'One adapter, many halls — the hall slug comes from the URL.',
    /** eventbook.ro/hall/<slug> — the slug IS the venue. */
    config: (url) => {
      const m = /\/hall\/([a-z0-9-]+)/i.exec(url.pathname)
      return m ? m[1].toLowerCase() : null
    },
    requiresConfig: true,
  },
  {
    id: 'filarmonica',
    label: 'Filarmonica George Enescu',
    rung: 'feed',
    hosts: ['filarmonicaenescu.ro', 'fgestrapi.filarmonicaenescu.ro'],
    note: 'Reads the public Strapi feed behind the site, not the page itself.',
  },
  {
    id: 'oveit',
    label: 'Oveit',
    rung: 'feed',
    hosts: ['oveit.com'],
    note: 'Reads the ticketing platform’s own feed — the hub page itself has no events in it.',
    /** oveit.com/hub/org/<vendor> — the vendor id IS the venue. */
    config: (url) => {
      const m = /\/hub\/(?:org|vendor)\/([A-Za-z0-9_-]+)/.exec(url.pathname)
      return m ? m[1] : null
    },
    requiresConfig: true,
  },
  {
    id: 'iabilet',
    label: 'iabilet.ro venue page',
    rung: 'selector',
    hosts: ['iabilet.ro'],
    note: 'A venue page fans out into weekly-bundle child pages, each read for its own showings.',
    /** iabilet.ro/bilete-<slug>-venue-<id>/ — the id IS the venue. Deliberately
     *  narrower than "any iabilet.ro URL": a single EVENT page on the same
     *  domain (no "-venue-<id>") is not a venue this adapter can watch, and
     *  matching it anyway would add a row that can never resolve to a
     *  programme. */
    config: (url) => {
      const m = /-venue-(\d+)\/?$/.exec(url.pathname)
      return m ? m[1] : null
    },
    requiresConfig: true,
  },
  {
    /** Deliberately no `hosts` entry — `matchAdapter` would otherwise
     *  suggest THIS for any `iabilet.ro/bilete-*-venue-<id>/` URL, including
     *  Cinema Europa's, which genuinely needs the `iabilet` two-hop reader
     *  just above. Quantic's own venue page happens to already carry
     *  complete, real Event JSON-LD directly (confirmed against the live
     *  page) — the two sites share a host and a URL shape but not a
     *  structure, which no URL pattern can tell apart. Exists here only so
     *  `getAdapter('quantic')` resolves to a real label for display; the row
     *  itself was added with this id chosen deliberately, not through the
     *  add-venue form's guess. */
    id: 'quantic',
    label: 'Quantic / iabilet.ro venue page',
    rung: 'jsonld',
    hosts: [],
    note: 'Real per-event schema.org JSON-LD directly on the venue page — no bundle hop needed, unlike Cinema Europa.',
  },
  {
    id: 'expirat',
    label: 'Expirat / iabilet whitelabel',
    rung: 'jsonld',
    hosts: ['tickets.expirat.org'],
    note: 'Emits full schema.org Event JSON-LD per listing.',
  },
  {
    id: 'odeon',
    label: 'Teatrul Odeon',
    rung: 'jsonld',
    hosts: ['teatrul-odeon.ro'],
    note: 'Emits full schema.org Event JSON-LD per listing.',
  },
  {
    id: 'tnb',
    label: 'Teatrul Național București',
    rung: 'selector',
    hosts: ['tnb.ro'],
    note: 'One page, all 7 halls — the hall comes off each row, not off the venue.',
  },
  {
    id: 'mystage',
    label: 'mystage.ro venue page',
    rung: 'embedded-json',
    hosts: ['mystage.ro'],
    note: 'A Next.js venue page that embeds its full event list as JSON — no HTML parsing needed.',
  },
  {
    id: 'jsonld',
    label: 'Generic schema.org',
    rung: 'jsonld',
    hosts: [],
    note: 'Works on any page that publishes schema.org Event objects.',
  },
  {
    id: 'arcub',
    label: 'ARCUB',
    rung: 'selector',
    hosts: ['arcub.ro'],
    note: 'Interdisciplinary — reads its own per-event category tag, not one guess for the whole venue.',
  },
]

export const ADAPTER_IDS = ADAPTERS.map((a) => a.id)

export function getAdapter(id) {
  return ADAPTERS.find((a) => a.id === id) ?? null
}

/** Parse a pasted URL, tolerating a missing scheme and surrounding whitespace.
 *  Returns null rather than throwing — Settings shows a message, not a stack. */
export function parseUrl(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
}

function hostMatches(host, pattern) {
  return host === pattern || host.endsWith(`.${pattern}`)
}

/** The adapter that can read `rawUrl`, or null if no built-in one can.
 *
 *  A null here is not a failure state — it means "this venue needs an adapter
 *  written, or has to rely on the generic JSON-LD reader". Settings says exactly
 *  that rather than pretending the venue was added and works. */
export function matchAdapter(rawUrl) {
  const url = parseUrl(rawUrl)
  if (!url) return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  for (const adapter of ADAPTERS) {
    if (!adapter.hosts.some((h) => hostMatches(host, h))) continue
    const config = adapter.config ? adapter.config(url) : null
    // An eventbook URL that isn't a hall page (a single film, the homepage) has
    // no venue to watch — treat it as unmatched rather than adding a row that
    // can never resolve to a programme.
    if (adapter.requiresConfig && !config) return null
    return { adapter: adapter.id, config, rung: adapter.rung, label: adapter.label }
  }
  return null
}
