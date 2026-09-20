// The scheduled check: the server's own diff (a deliberate duplicate of
// src/marquee/changes.js — see api/_lib/marquee/diff.js's header for why),
// reading/writing Notion venues from the server, and the orchestration that
// ties them to scanVenue() for a cron-triggered run.

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { diff, toSnapshot, summarize, carryUnanswered, CHANGE } from '../_lib/marquee/diff.js'
import { queryActiveVenues, writeScanResult, writeNotChecked } from '../_lib/marquee/serverVenues.js'
import { marqueeEmailSection, marqueeOnlySubject } from '../_lib/marquee/emailSection.js'

const kv = vi.hoisted(() => ({ store: new Map() }))
vi.mock('../_lib/kv.js', () => ({
  kvGet: async (key) => kv.store.get(key) ?? null,
  kvSet: async (key, value) => { kv.store.set(key, value); return true },
  kvConfigured: () => true,
}))

const { runScheduledCheck, rotate, notCheckedNote } = await import('../_lib/marquee/serverScan.js')

const event = (over = {}) => ({
  key: 'k', venue: 'Teatrul Excelsior', title: 'Tomcat', date: '2026-09-23', time: '20:00', ticketState: 'none', ...over,
})
const snap = (events, answered = ['Teatrul Excelsior']) => ({
  ...toSnapshot(events, '2026-08-26T09:00:00.000Z'), answeredVenues: answered,
})

describe('the server diff (parity with the client)', () => {
  it('says nothing on a first scan', () => {
    expect(diff(null, snap([event()]))).toEqual({ hadSnapshot: false, changes: [] })
  })

  it('reports tickets opening', () => {
    const before = snap([event({ ticketState: 'none' })])
    const after = snap([event({ ticketState: 'open' })])
    expect(diff(before, after).changes[0].kind).toBe(CHANGE.TICKETS_OPENED)
  })

  it('never calls an event cancelled when its venue did not answer', () => {
    const before = snap([event({ date: '2027-01-01' })])
    expect(diff(before, snap([], []), { now: new Date('2026-08-26') }).changes).toEqual([])
  })

  // §9.63 — the watchlist is a browser thing (localStorage), so the scheduled
  // check never has one. The parameter exists here only to keep the two copies
  // of the diff the same file; with nobody to pass it, the email reads exactly
  // as it did before.
  it('never claims a return, because the cron has no watchlist to consult', () => {
    const before = snap([event({ ticketState: 'sold-out' })])
    const after = snap([event({ ticketState: 'open' })])
    expect(diff(before, after).changes[0].kind).toBe(CHANGE.TICKETS_OPENED)
    expect(diff(before, after, { watching: ['teatrul excelsior::tomcat'] }).changes[0].kind)
      .toBe(CHANGE.RETURNED)
  })

  it('summarizes a scan result the same way the app does', () => {
    expect(summarize({ status: 'ok', events: [event({ ticketState: 'sold-out' })] })).toBe('1 event · 1 sold out')
    expect(summarize({ status: 'parser-broken', detail: 'Markup changed.', events: [] })).toBe('Markup changed.')
  })
})

// §9.89 — the rule that keeps a run which skipped a venue from erasing what that
// venue last showed, and so from reporting its whole programme as new next time.
describe('carryUnanswered', () => {
  const at = (venue, key) => event({ venue, key, title: key })

  it('keeps the entries of a venue that did not answer', () => {
    const previous = snap([at('Sala Radio', 'sr1'), at('Sala Radio', 'sr2')], ['Sala Radio'])
    const current = carryUnanswered(previous, snap([], []))
    expect(Object.keys(current.events).sort()).toEqual(['sr1', 'sr2'])
    // …and so the diff has nothing to report, rather than two new listings.
    expect(diff(previous, current, { now: new Date('2026-09-20') }).changes).toEqual([])
  })

  it('lets a venue that DID answer drop its own events', () => {
    const previous = snap([at('Sala Radio', 'sr1')], ['Sala Radio'])
    const current = carryUnanswered(previous, snap([], ['Sala Radio']))
    expect(current.events).toEqual({})
  })

  it('never lets a carried entry shadow this run’s fresher one', () => {
    const previous = snap([event({ key: 'k', ticketState: 'none' })], [])
    const current = carryUnanswered(previous, snap([event({ key: 'k', ticketState: 'open' })], ['Teatrul Excelsior']))
    expect(current.events.k.ticketState).toBe('open')
  })
})

describe('queryActiveVenues', () => {
  const page = (id, name, extra = {}) => ({
    id,
    properties: {
      Name: { title: [{ plain_text: name }] },
      'Programme URL': { url: `https://example.com/${id}` },
      Adapter: { select: { name: 'jsonld' } },
      'Adapter Config': { rich_text: [] },
      'Category Default': { select: { name: 'concert' } },
      ...extra,
    },
  })

  it('maps rows and follows pagination', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [page('a', 'Venue A')], has_more: true, next_cursor: 'c2' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [page('b', 'Venue B')], has_more: false }) })
    vi.stubGlobal('fetch', fetchImpl)

    const venues = await queryActiveVenues('token', 'db1')
    expect(venues).toEqual([
      { id: 'a', name: 'Venue A', url: 'https://example.com/a', adapter: 'jsonld', config: null, category: 'concert' },
      { id: 'b', name: 'Venue B', url: 'https://example.com/b', adapter: 'jsonld', config: null, category: 'concert' },
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    // Only Status=active rows, matching the app's own pause/resume.
    const firstCall = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(firstCall.filter).toEqual({ property: 'Status', select: { equals: 'active' } })
    vi.unstubAllGlobals()
  })

  it('throws with a readable message on a Notion error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'nope' }))
    await expect(queryActiveVenues('bad-token', 'db1')).rejects.toThrow(/401/)
    vi.unstubAllGlobals()
  })
})

describe('writeScanResult', () => {
  it('patches only Last Checked and Last Result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchImpl)
    await writeScanResult('token', 'page-1', { checkedAt: '2026-08-26', result: '4 events' })
    const [url, opts] = fetchImpl.mock.calls[0]
    expect(url).toContain('pages/page-1')
    expect(opts.method).toBe('PATCH')
    const body = JSON.parse(opts.body)
    expect(Object.keys(body.properties)).toEqual(['Last Checked', 'Last Result'])
    expect(body.properties['Last Checked'].date.start).toBe('2026-08-26')
    vi.unstubAllGlobals()
  })

  // It used to discard the response entirely, so a 404 on an unshared row read
  // exactly like a success and the caller's catch could only fire on a network
  // throw. A row that stopped accepting writes is indistinguishable from a venue
  // that was never scanned — §9.89's whole subject.
  it('throws when Notion refuses the patch, instead of reporting success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' }))
    await expect(writeScanResult('token', 'page-1', { checkedAt: '2026-09-20', result: 'x' })).rejects.toThrow(/404/)
    vi.unstubAllGlobals()
  })
})

describe('writeNotChecked', () => {
  // The omission is the feature: Last Checked keeps meaning "when this venue was
  // last actually read", so a skipped venue's date stays honestly stale.
  it('writes Last Result only, and never touches Last Checked', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchImpl)
    await writeNotChecked('token', 'page-1', 'not checked on 2026-09-20 — ran out of time')
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(Object.keys(body.properties)).toEqual(['Last Result'])
    expect(body.properties['Last Result'].rich_text[0].text.content).toMatch(/not checked on 2026-09-20/)
    vi.unstubAllGlobals()
  })

  it('says both halves — that it was skipped, and how far the run got', () => {
    const note = notCheckedNote({ on: '2026-09-20', checked: 16, total: 17 })
    expect(note).toMatch(/not checked on 2026-09-20/)
    expect(note).toMatch(/16 of 17/)
    expect(note).toMatch(/first in line/)
  })
})

describe('rotate', () => {
  const vs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('starts at the top when there is no cursor', () => {
    expect(rotate(vs, null).map((v) => v.id)).toEqual(['a', 'b', 'c'])
  })

  it('resumes from the venue the last run gave up on', () => {
    expect(rotate(vs, 'c').map((v) => v.id)).toEqual(['c', 'a', 'b'])
  })

  it('falls back to the top when the cursor names a venue that is gone or already first', () => {
    expect(rotate(vs, 'gone').map((v) => v.id)).toEqual(['a', 'b', 'c'])
    expect(rotate(vs, 'a').map((v) => v.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('runScheduledCheck', () => {
  const OLD_ENV = { ...process.env }

  beforeEach(() => {
    process.env = { ...OLD_ENV, MARQUEE_NOTION_TOKEN: 'server-token', MARQUEE_VENUES_DB_ID: 'db1' }
    kv.store = new Map()
  })

  const venueRow = (id, name, url) => ({
    id,
    properties: {
      Name: { title: [{ plain_text: name }] },
      'Programme URL': { url },
      Adapter: { select: { name: 'jsonld' } },
      'Adapter Config': { rich_text: [] },
      'Category Default': { select: { name: 'concert' } },
    },
  })

  // Padded past 500 bytes so the health gate doesn't call the page a placeholder
  // before the diff logic this test is actually about ever runs.
  function eventPage(title, days, now, ticketed) {
    const date = new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10)
    const offers = ticketed ? ',"offers":{"url":"https://example.com/buy"}' : ''
    return `<!-- ${'padding '.repeat(80)} -->
      <script type="application/ld+json">{"@type":"Event","name":"${title}","startDate":"${date}T19:00:00"${offers}}</script>`
  }

  function mockFetch(notionRows, pageBody) {
    return vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('api.notion.com/v1/databases')) {
        return { ok: true, json: async () => ({ results: notionRows, has_more: false }) }
      }
      if (u.includes('api.notion.com/v1/pages/')) {
        return { ok: true }
      }
      return { ok: true, status: 200, text: async () => pageBody, json: async () => ({}) }
    })
  }

  it('is not configured without MARQUEE_NOTION_TOKEN, and touches nothing', async () => {
    delete process.env.MARQUEE_NOTION_TOKEN
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    expect(await runScheduledCheck(new Date())).toEqual({ configured: false, changes: [], venues: [], truncated: null, writeFailures: [] })
    expect(fetchImpl).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('establishes a baseline on the first run, then reports what changed on the second', async () => {
    const now = new Date('2026-08-26T09:00:00Z')
    const rows = [venueRow('v1', 'Venue', 'https://example.com/venue')]

    vi.stubGlobal('fetch', mockFetch(rows, eventPage('Solaris', 5, now, false)))
    const first = await runScheduledCheck(now)
    expect(first.configured).toBe(true)
    expect(first.changes).toEqual([]) // baseline — see diff.js's own rule

    vi.stubGlobal('fetch', mockFetch(rows, eventPage('Solaris', 5, now, true)))
    const second = await runScheduledCheck(now)
    expect(second.changes).toHaveLength(1)
    expect(second.changes[0]).toMatchObject({ kind: CHANGE.TICKETS_OPENED, title: 'Solaris', venue: 'Venue' })
    vi.unstubAllGlobals()
  })

  it('writes Last Checked / Last Result back to the venue’s own Notion row', async () => {
    const now = new Date('2026-08-26T09:00:00Z')
    const rows = [venueRow('v1', 'Venue', 'https://example.com/venue')]
    const fetchImpl = mockFetch(rows, eventPage('Solaris', 5, now, false))
    vi.stubGlobal('fetch', fetchImpl)
    await runScheduledCheck(now)
    const writeCall = fetchImpl.mock.calls.find(([url]) => String(url).includes('/pages/v1'))
    expect(writeCall).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('never claims a venue is configured-but-broken from a bad Notion query alone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, text: async () => 'nope' })))
    await expect(runScheduledCheck(new Date())).rejects.toThrow()
    vi.unstubAllGlobals()
  })

  it('reports nothing truncated on a run that gets through the list', async () => {
    const now = new Date('2026-08-26T09:00:00Z')
    const rows = [venueRow('v1', 'Venue', 'https://example.com/venue')]
    vi.stubGlobal('fetch', mockFetch(rows, eventPage('Solaris', 5, now, false)))
    const out = await runScheduledCheck(now)
    expect(out.truncated).toBeNull()
    expect(out.writeFailures).toEqual([])
    vi.unstubAllGlobals()
  })

  // ── §9.89: the run that ran out of time ────────────────────────────────────
  // The bug this whole section exists for: 16 of 17 venues checked, the 17th
  // wearing yesterday's date, and nothing anywhere saying the run was cut short.
  describe('when the clock runs out', () => {
    /** A run where every venue costs `costMs` of wall clock, so the budget can be
     *  spent deterministically without waiting for it. */
    function timedRun(rows, pageBody, costMs) {
      const base = 1_760_000_000_000
      let tick = 0
      vi.spyOn(Date, 'now').mockImplementation(() => base + tick)
      vi.stubGlobal('fetch', vi.fn(async (url) => {
        const u = String(url)
        if (u.includes('api.notion.com/v1/databases')) return { ok: true, json: async () => ({ results: rows, has_more: false }) }
        if (u.includes('api.notion.com/v1/pages/')) return { ok: true }
        tick += costMs
        return { ok: true, status: 200, text: async () => pageBody, json: async () => ({}) }
      }))
      return base
    }

    const cleanup = () => { vi.restoreAllMocks(); vi.unstubAllGlobals() }

    it('stops, names what it skipped, and says how far it got', async () => {
      const now = new Date('2026-09-20T16:00:00Z')
      const rows = ['CNDB', 'Filarmonica', 'Sala Radio'].map((n, i) => venueRow(`v${i}`, n, `https://example.com/v${i}`))
      const startedAt = timedRun(rows, eventPage('Solaris', 5, now, false), 100_000)

      const out = await runScheduledCheck(now, { startedAt, startBudgetMs: 150_000 })
      expect(out.truncated).toEqual({ checked: 2, total: 3, skipped: ['Sala Radio'] })
      expect(out.venues.map((v) => v.venue)).toEqual(['CNDB', 'Filarmonica'])
      cleanup()
    })

    it('writes the skip onto the skipped venue’s own row, leaving Last Checked alone', async () => {
      const now = new Date('2026-09-20T16:00:00Z')
      const rows = ['CNDB', 'Sala Radio'].map((n, i) => venueRow(`v${i}`, n, `https://example.com/v${i}`))
      const startedAt = timedRun(rows, eventPage('Solaris', 5, now, false), 100_000)

      await runScheduledCheck(now, { startedAt, startBudgetMs: 50_000 })
      const write = fetch.mock.calls.find(([url]) => String(url).includes('/pages/v1'))
      expect(write).toBeTruthy()
      const props = JSON.parse(write[1].body).properties
      // The one assertion the whole fix turns on: the date is NOT restamped, so
      // "checked a while ago" can never be confused with "never checked".
      expect(Object.keys(props)).toEqual(['Last Result'])
      expect(props['Last Result'].rich_text[0].text.content).toMatch(/not checked on 2026-09-20/)
      cleanup()
    })

    it('begins the next run with the venue it dropped', async () => {
      const now = new Date('2026-09-20T16:00:00Z')
      const rows = ['CNDB', 'Sala Radio'].map((n, i) => venueRow(`v${i}`, n, `https://example.com/v${i}`))
      let startedAt = timedRun(rows, eventPage('Solaris', 5, now, false), 100_000)
      await runScheduledCheck(now, { startedAt, startBudgetMs: 50_000 })
      expect(kv.store.get('marquee:server-scan-cursor')).toBe('v1')
      cleanup()

      startedAt = timedRun(rows, eventPage('Solaris', 5, now, false), 100_000)
      const second = await runScheduledCheck(now, { startedAt, startBudgetMs: 50_000 })
      expect(second.venues.map((v) => v.venue)).toEqual(['Sala Radio'])
      expect(second.truncated.skipped).toEqual(['CNDB'])
      cleanup()
    })

    it('does not report a skipped venue’s programme as brand new next time', async () => {
      const now = new Date('2026-09-20T16:00:00Z')
      const rows = ['CNDB', 'Sala Radio'].map((n, i) => venueRow(`v${i}`, n, `https://example.com/v${i}`))
      const body = eventPage('Solaris', 5, now, false)

      // A complete run first, so both venues are on the record.
      vi.stubGlobal('fetch', mockFetch(rows, body))
      await runScheduledCheck(now)
      vi.unstubAllGlobals()

      // Then one that only reaches the first venue — and must still say nothing,
      // because the second venue's showings were carried, not forgotten.
      let startedAt = timedRun(rows, body, 100_000)
      const truncatedRun = await runScheduledCheck(now, { startedAt, startBudgetMs: 50_000 })
      expect(truncatedRun.changes).toEqual([])
      cleanup()

      // And the run after that, which does reach it, must not announce it either.
      startedAt = timedRun(rows, body, 0)
      const full = await runScheduledCheck(now, { startedAt })
      expect(full.truncated).toBeNull()
      expect(full.changes).toEqual([])
      cleanup()
    })

    it('counts a venue whose Notion write was refused, rather than swallowing it', async () => {
      const now = new Date('2026-08-26T09:00:00Z')
      const rows = [venueRow('v1', 'Venue', 'https://example.com/venue')]
      vi.stubGlobal('fetch', vi.fn(async (url) => {
        const u = String(url)
        if (u.includes('api.notion.com/v1/databases')) return { ok: true, json: async () => ({ results: rows, has_more: false }) }
        if (u.includes('api.notion.com/v1/pages/')) return { ok: false, status: 404, text: async () => 'gone' }
        return { ok: true, status: 200, text: async () => eventPage('Solaris', 5, now, false), json: async () => ({}) }
      }))
      const out = await runScheduledCheck(now)
      expect(out.writeFailures).toEqual(['Venue'])
      // …and the check itself still completed. Bookkeeping is not the product.
      expect(out.venues).toHaveLength(1)
      vi.unstubAllGlobals()
    })
  })
})

describe('marqueeEmailSection / marqueeOnlySubject', () => {
  it('renders nothing for an empty change list', () => {
    expect(marqueeEmailSection([])).toEqual({ text: '', html: '' })
  })

  it('renders a readable line per change, in both formats', () => {
    const changes = [event({ kind: CHANGE.TICKETS_OPENED })]
    const section = marqueeEmailSection(changes)
    expect(section.text).toContain('Tomcat')
    expect(section.text).toContain('tickets on sale')
    expect(section.html).toContain('Tomcat')
    expect(section.html).toMatch(/<ul/)
  })

  it('qualifies a return worth one seat, in both formats (§9.68)', () => {
    // The evening email says the same thing the app does, or the two
    // disagree about a night in the one direction that matters.
    const section = marqueeEmailSection([event({ kind: CHANGE.TICKETS_OPENED, seatsLeft: 1 })])
    expect(section.text).toContain('tickets on sale, 1 seat left')
    expect(section.html).toContain('1 seat left')
  })

  it('leaves a plentiful or uncounted night unqualified', () => {
    for (const seatsLeft of [140, null]) {
      const section = marqueeEmailSection([event({ kind: CHANGE.TICKETS_OPENED, seatsLeft })])
      expect(section.text).toContain('tickets on sale')
      expect(section.text).not.toContain('left')
    }
  })

  it('escapes html in a title', () => {
    const section = marqueeEmailSection([event({ kind: CHANGE.NEW, title: '<script>' })])
    expect(section.html).not.toContain('<script>')
    expect(section.html).toContain('&lt;script&gt;')
  })

  it('picks a Marquee-flavoured subject when there is nothing else to lead with', () => {
    expect(marqueeOnlySubject([event({ kind: CHANGE.TICKETS_OPENED })])).toMatch(/Tomcat/)
    expect(marqueeOnlySubject([event({ kind: CHANGE.TICKETS_OPENED }), event({ kind: CHANGE.TICKETS_OPENED, key: 'k2' })]))
      .toMatch(/2 tickets just opened/)
    expect(marqueeOnlySubject([event({ kind: CHANGE.CANCELLED }), event({ kind: CHANGE.NEW, key: 'k2' })]))
      .toMatch(/2 changes/)
  })

  // §9.89 — an email from a run that reached 16 of 17 venues used to be
  // indistinguishable from one from a complete run. These are the assertions that
  // keep it distinguishable.
  describe('an unfinished run', () => {
    const truncated = { checked: 16, total: 17, skipped: ['Sala Radio'] }

    it('is worth an email even on a night when nothing changed', () => {
      const section = marqueeEmailSection([], { truncated })
      expect(section.text).not.toBe('')
      expect(section.text).toMatch(/16 of 17/)
      expect(section.text).toMatch(/Sala Radio/)
      expect(section.html).toMatch(/16 of 17/)
    })

    it('names the shortfall alongside the changes it did find', () => {
      const section = marqueeEmailSection([event({ kind: CHANGE.TICKETS_OPENED })], { truncated })
      expect(section.text).toContain('Tomcat')
      expect(section.text).toMatch(/did not finish/)
      expect(section.html).toContain('Tomcat')
      expect(section.html).toMatch(/did not finish/)
    })

    it('leads the subject with the shortfall, even over a ticket opening', () => {
      expect(marqueeOnlySubject([event({ kind: CHANGE.TICKETS_OPENED })], { truncated }))
        .toMatch(/ran out of time \(16\/17\)/)
    })

    it('reports a refused bookkeeping write on its own', () => {
      const section = marqueeEmailSection([], { writeFailures: ['Sala Radio'] })
      expect(section.text).toMatch(/Notion refused/)
      expect(section.text).toMatch(/Sala Radio/)
      expect(marqueeOnlySubject([], { writeFailures: ['Sala Radio'] })).toMatch(/had trouble/)
    })

    it('still says nothing at all when the run was clean and quiet', () => {
      expect(marqueeEmailSection([], { truncated: null, writeFailures: [] })).toEqual({ text: '', html: '' })
    })

    it('escapes a venue name in the warning, like every other line', () => {
      const section = marqueeEmailSection([], { truncated: { checked: 1, total: 2, skipped: ['<script>'] } })
      expect(section.html).not.toContain('<script>')
      expect(section.html).toContain('&lt;script&gt;')
    })
  })
})
