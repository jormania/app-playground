import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { kindFor, notifiableChanges, notifyTitle, notifyBody, isQuietHours, nextSnapshot, toSnapshotMap, answeredVenues } from './notify.js'

/**
 * The service worker is a classic script and cannot import the ES module the
 * page uses, so `kindFor`/`notifiableChanges`/`notifyTitle`/`notifyBody` each
 * exist twice: once in notify.js and once inline in public/marquee-sw.js.
 * NOTIFICATIONS.md calls this out as the one place duplication reliably creeps
 * back in. Same technique as WhereItWent's own reminders.sw.test.js: lift the
 * worker's copy straight out of the file and run both against the same cases.
 * If either side is edited alone, this fails.
 */
const swSource = readFileSync(resolve(process.cwd(), 'public/marquee-sw.js'), 'utf8')

function extractFunction(name) {
  const start = swSource.indexOf(`function ${name}(`)
  if (start === -1) throw new Error(`${name} not found in the service worker`)
  let depth = 0
  let i = swSource.indexOf('{', start)
  for (; i < swSource.length; i++) {
    if (swSource[i] === '{') depth++
    else if (swSource[i] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return swSource.slice(start, i + 1)
}

// LABEL is a module-level `var` the four functions all close over — pulled in
// once, ahead of whichever function is being built, same as WhereItWent's own
// helper composes daysUntilDue ahead of billsToNotify.
const labelSource = swSource.slice(swSource.indexOf("var LABEL ="), swSource.indexOf("var LABEL =") + swSource.slice(swSource.indexOf("var LABEL =")).indexOf(';') + 1)

function build(...names) {
  const body = [labelSource, ...names.map(extractFunction)].join('\n')
  return new Function(`${body}\nreturn { ${names.join(', ')} };`)()
}

const { kindFor: swKindFor } = build('kindFor')
const { notifiableChanges: swNotifiableChanges } = build('kindFor', 'notifiableChanges')
const { notifyTitle: swNotifyTitle } = build('notifyTitle')
const { notifyBody: swNotifyBody } = build('notifyBody')
const { isQuietHours: swIsQuietHours } = build('isQuietHours')
const { nextSnapshot: swNextSnapshot } = build('toSnapshotMap', 'answeredVenues', 'nextSnapshot')

describe('service worker mirrors notify.js', () => {
  it('has the notification half wired up at all', () => {
    expect(swSource).toContain("importScripts('/shared-notify-idb.js')")
    expect(swSource).toContain("addEventListener('periodicsync'")
    expect(swSource).toContain("addEventListener('notificationclick'")
  })

  const cases = [
    [undefined, { ticketState: 'open' }],
    [{ ticketState: 'none' }, { ticketState: 'open' }],
    [{ ticketState: 'open' }, { ticketState: 'sold-out' }],
    [{ ticketState: 'open' }, { ticketState: 'open' }],
  ]
  it.each(cases)('kindFor(%o, %o) agrees', (before, after) => {
    expect(swKindFor(before, after)).toBe(kindFor(before, after))
  })

  it('notifiableChanges agrees for a mixed batch', () => {
    const before = { a: { ticketState: 'none' }, b: { ticketState: 'open' } }
    const events = [
      { key: 'a', title: 'Tomcat', venue: 'Excelsior', ticketState: 'open' },
      { key: 'b', title: 'Solaris', venue: 'Excelsior', ticketState: 'sold-out' },
      { key: 'c', title: 'New Show', venue: 'TNB', ticketState: 'none' },
    ]
    const kinds = ['tickets-opened', 'sold-out', 'new-event']
    expect(swNotifiableChanges(before, events, kinds)).toEqual(notifiableChanges(before, events, kinds))
  })

  it('notifyTitle and notifyBody agree, single and grouped', () => {
    const one = [{ kind: 'tickets-opened', title: 'Tomcat', venue: 'Excelsior' }]
    const many = Array.from({ length: 4 }, (_, i) => ({ kind: 'tickets-opened', title: `Show ${i}`, venue: 'V' }))
    expect(swNotifyTitle(one)).toBe(notifyTitle(one))
    expect(swNotifyTitle(many)).toBe(notifyTitle(many))
    expect(swNotifyBody(one)).toBe(notifyBody(one))
    expect(swNotifyBody(many)).toBe(notifyBody(many))
  })

  it('isQuietHours agrees at the window edges', () => {
    const hours = [0, 7, 8, 12, 22, 23]
    for (const h of hours) {
      const now = new Date(2026, 8, 5, h, 0)
      expect(swIsQuietHours(now)).toBe(isQuietHours(now))
    }
  })
})

describe('nextSnapshot — the bug the pure helpers could not catch', () => {
  // The worker's helpers were all pinned; `runNotifyCheck`, the function that
  // orchestrates them, was not — and that is exactly where the bug lived. It
  // persisted `toSnapshotMap(data.events)` directly, so a venue that did not
  // answer silently dropped out of the snapshot. Both halves of the damage
  // are asserted below; `nextSnapshot` is the extracted, testable fix.
  const scanned = (over = {}) => [
    { venue: 'Excelsior', status: 'ok' },
    { venue: 'Filarmonica', status: 'ok' },
    ...(over.extra ?? []),
  ]

  const before = toSnapshotMap([
    { key: 'exc:a', venue: 'Excelsior', ticketState: 'none' },
    { key: 'fil:b', venue: 'Filarmonica', ticketState: 'none' },
  ])

  it('carries a throttled venue’s events forward rather than dropping them', () => {
    const events = [{ key: 'exc:a', venue: 'Excelsior', ticketState: 'none' }]
    const venues = [{ venue: 'Excelsior', status: 'ok' }, { venue: 'Filarmonica', status: 'throttled' }]
    const after = nextSnapshot(before, events, venues)
    expect(after['fil:b']).toEqual({ ticketState: 'none', venue: 'Filarmonica' })
  })

  it('so a ticket opening across that gap is still tickets-opened, not a swallowed new-event', () => {
    // The default setting notifies on `tickets-opened` only. Before the fix the
    // dropped entry made this read as `new-event`, which the default filters
    // out — the feature silently failing at its one job.
    const gap = nextSnapshot(before, [{ key: 'exc:a', venue: 'Excelsior', ticketState: 'none' }],
      [{ venue: 'Excelsior', status: 'ok' }, { venue: 'Filarmonica', status: 'throttled' }])
    const back = [
      { key: 'exc:a', venue: 'Excelsior', title: 'Tomcat', ticketState: 'none' },
      { key: 'fil:b', venue: 'Filarmonica', title: 'Concert', ticketState: 'open' },
    ]
    expect(notifiableChanges(gap, back, ['tickets-opened']).map((c) => c.kind)).toEqual(['tickets-opened'])
  })

  it('and no false "new" storm when everything is being notified about', () => {
    const gap = nextSnapshot(before, [{ key: 'exc:a', venue: 'Excelsior', ticketState: 'none' }],
      [{ venue: 'Excelsior', status: 'ok' }, { venue: 'Filarmonica', status: 'throttled' }])
    const back = [
      { key: 'exc:a', venue: 'Excelsior', title: 'Tomcat', ticketState: 'none' },
      { key: 'fil:b', venue: 'Filarmonica', title: 'Concert', ticketState: 'none' },
    ]
    expect(notifiableChanges(gap, back, ['tickets-opened', 'new-event', 'sold-out'])).toEqual([])
  })

  it('DOES drop an event a venue that genuinely answered stopped listing', () => {
    // The other direction has to keep working: a venue we truly read, whose
    // event is gone, must not linger in the snapshot forever.
    const after = nextSnapshot(before, [{ key: 'exc:a', venue: 'Excelsior', ticketState: 'none' }], scanned())
    expect(after['fil:b']).toBeUndefined()
  })

  it('carries an entry with no venue recorded, rather than reproducing the bug on upgrade', () => {
    // Snapshots written before `venue` was kept. Carrying an unknown too long
    // costs nothing (removals are never notified); dropping it re-creates the
    // exact failure above. Self-heals on the next scan of that venue.
    const legacy = { 'old:x': { ticketState: 'none' } }
    expect(nextSnapshot(legacy, [], scanned())['old:x']).toEqual({ ticketState: 'none' })
  })

  it('treats a first-ever run as the baseline, with nothing to carry', () => {
    expect(nextSnapshot(null, [{ key: 'a', venue: 'V', ticketState: 'open' }], scanned()))
      .toEqual({ a: { ticketState: 'open', venue: 'V' } })
  })

  it('agrees with the worker’s own copy', () => {
    const events = [{ key: 'exc:a', venue: 'Excelsior', ticketState: 'none' }]
    const venues = [{ venue: 'Excelsior', status: 'ok' }, { venue: 'Filarmonica', status: 'throttled' }]
    expect(swNextSnapshot(before, events, venues)).toEqual(nextSnapshot(before, events, venues))
  })
})

describe('answeredVenues', () => {
  it('counts ok and empty as answered, every failure as not', () => {
    const set = answeredVenues([
      { venue: 'A', status: 'ok' }, { venue: 'B', status: 'empty' },
      { venue: 'C', status: 'throttled' }, { venue: 'D', status: 'parser-broken' },
      { venue: 'E', status: 'unreachable' }, { venue: 'F', status: 'unsupported' },
    ])
    expect([...set].sort()).toEqual(['A', 'B'])
  })
})

describe('the worker orchestrates in the right order', () => {
  const source = swSource

  it('decides quiet hours BEFORE fetching, not after', () => {
    // Same outcome either way (the snapshot is held deliberately), but doing
    // it after meant a full ~80-request scrape of other people's sites was
    // made and then discarded, every quiet-hours wake.
    const quiet = source.indexOf('prefs.quietHours && isQuietHours')
    const fetchAt = source.indexOf('fetch(SCAN_URL')
    expect(quiet).toBeGreaterThan(-1)
    expect(fetchAt).toBeGreaterThan(-1)
    expect(quiet).toBeLessThan(fetchAt)
  })

  it('persists nextSnapshot, never the raw scan', () => {
    expect(source).toContain('nextSnapshot(snapshot, data.events, data.venues)')
    expect(source).not.toContain('set(SNAPSHOT_KEY, toSnapshotMap(')
  })
})
