// The scheduled check: the server's own diff (a deliberate duplicate of
// src/marquee/changes.js — see api/_lib/marquee/diff.js's header for why),
// reading/writing Notion venues from the server, and the orchestration that
// ties them to scanVenue() for a cron-triggered run.

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { diff, toSnapshot, summarize, CHANGE } from '../_lib/marquee/diff.js'
import { queryActiveVenues, writeScanResult } from '../_lib/marquee/serverVenues.js'
import { marqueeEmailSection, marqueeOnlySubject } from '../_lib/marquee/emailSection.js'

const kv = vi.hoisted(() => ({ store: new Map() }))
vi.mock('../_lib/kv.js', () => ({
  kvGet: async (key) => kv.store.get(key) ?? null,
  kvSet: async (key, value) => { kv.store.set(key, value); return true },
  kvConfigured: () => true,
}))

const { runScheduledCheck } = await import('../_lib/marquee/serverScan.js')

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

  it('summarizes a scan result the same way the app does', () => {
    expect(summarize({ status: 'ok', events: [event({ ticketState: 'sold-out' })] })).toBe('1 event · 1 sold out')
    expect(summarize({ status: 'parser-broken', detail: 'Markup changed.', events: [] })).toBe('Markup changed.')
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
    expect(await runScheduledCheck(new Date())).toEqual({ configured: false, changes: [], venues: [] })
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
})
