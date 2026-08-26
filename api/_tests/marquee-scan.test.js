// The endpoint's one piece of per-venue policy: a `movie` venue gets a 10-day
// horizon, everything else gets 120 (see api/_lib/marquee/scan.js's `horizonFor`).
// That rule lives in a pure function with its own tests; what's worth pinning
// here is that the ENDPOINT actually calls it per venue rather than applying one
// horizon to the whole batch — a mistake that wouldn't show up testing either
// piece alone.

import { describe, it, expect, vi } from 'vitest'

vi.mock('../_shared.js', async (importOriginal) => ({
  ...(await importOriginal()),
  originAllowed: () => true,
  rateLimited: () => false,
}))

const { default: handler } = await import('../marquee-scan.js')

function makeRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.body = obj; return res }
  return res
}

/** Two schema.org Events on the one page: one 5 days out, one 40 days out. A
 *  movie venue should keep only the first; anything else keeps both. */
function eventPage(now) {
  const iso = (days) => new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10)
  const event = (name, days) => JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Event', name, startDate: `${iso(days)}T19:00:00`,
  })
  // Padded past 500 bytes: the health gate treats a shorter body as a
  // placeholder page and calls the whole venue parser-broken before the
  // horizon rule this test is actually about ever gets a chance to run.
  return `<!-- ${'padding '.repeat(80)} -->
    <script type="application/ld+json">${event('Soon', 5)}</script>
    <script type="application/ld+json">${event('Later', 40)}</script>
  `
}

describe('marquee-scan: per-venue horizon', () => {
  it('limits a movie venue to 10 days but not a venue of any other category', async () => {
    const now = new Date()
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, text: async () => eventPage(now), json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchImpl)

    const res = makeRes()
    await handler({
      method: 'POST',
      headers: { origin: 'http://localhost' },
      body: JSON.stringify({
        venues: [
          { id: 'cinema', name: 'A Cinema', url: 'https://example.com/a', adapter: 'jsonld', category: 'movie' },
          { id: 'hall', name: 'A Concert Hall', url: 'https://example.com/b', adapter: 'jsonld', category: 'concert' },
        ],
      }),
    }, res)

    vi.unstubAllGlobals()

    const [cinema, hall] = res.body.venues
    expect(cinema.events.map((e) => e.title)).toEqual(['Soon'])
    expect(hall.events.map((e) => e.title)).toEqual(['Soon', 'Later'])
  })
})
