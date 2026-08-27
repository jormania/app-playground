import { describe, it, expect } from 'vitest'
import { kindFor, notifiableChanges, notifyKinds, notifyTitle, notifyBody, isQuietHours } from './notify.js'

describe('kindFor', () => {
  it('calls a key with no prior entry new-event', () => {
    expect(kindFor(undefined, { ticketState: 'none' })).toBe('new-event')
  })

  it('calls a none/sold-out → open transition tickets-opened', () => {
    expect(kindFor({ ticketState: 'none' }, { ticketState: 'open' })).toBe('tickets-opened')
    expect(kindFor({ ticketState: 'sold-out' }, { ticketState: 'open' })).toBe('tickets-opened')
  })

  it('calls an open → sold-out transition sold-out', () => {
    expect(kindFor({ ticketState: 'open' }, { ticketState: 'sold-out' })).toBe('sold-out')
  })

  it('is null for no real change, and for open→open', () => {
    expect(kindFor({ ticketState: 'none' }, { ticketState: 'none' })).toBeNull()
    expect(kindFor({ ticketState: 'open' }, { ticketState: 'open' })).toBeNull()
  })
})

describe('notifiableChanges', () => {
  const events = [
    { key: 'a', title: 'Tomcat', venue: 'Excelsior', ticketState: 'open' },
    { key: 'b', title: 'Solaris', venue: 'Excelsior', ticketState: 'sold-out' },
    { key: 'c', title: 'New Show', venue: 'TNB', ticketState: 'none' },
  ]
  const before = {
    a: { ticketState: 'none' },
    b: { ticketState: 'open' },
    // 'c' absent — a first sighting.
  }

  it('only surfaces kinds the caller actually asked for', () => {
    expect(notifiableChanges(before, events, ['tickets-opened'])).toEqual([
      { kind: 'tickets-opened', key: 'a', title: 'Tomcat', venue: 'Excelsior' },
    ])
  })

  it('surfaces every requested kind when asked for all three', () => {
    const out = notifiableChanges(before, events, ['tickets-opened', 'sold-out', 'new-event'])
    expect(out.map((c) => c.kind)).toEqual(['tickets-opened', 'sold-out', 'new-event'])
  })

  it('is a first-scan-produces-nothing baseline when there is no before map at all', () => {
    // Mirrors changes.js's own rule: with nothing to diff against, everything
    // technically "new" would be noise, not news. The caller is expected to
    // skip the notify pass entirely on a baseline write; this just confirms
    // the shape holds if it didn't — every key reads as new-event, not silence.
    expect(notifiableChanges({}, events, ['new-event']).map((c) => c.key)).toEqual(['a', 'b', 'c'])
  })
})

describe('notifyKinds', () => {
  it('defaults to tickets-opened alone', () => {
    expect(notifyKinds({})).toEqual(['tickets-opened'])
    expect(notifyKinds(undefined)).toEqual(['tickets-opened'])
  })

  it('adds new-event and sold-out, never cancelled, when notifyAllKinds is on', () => {
    expect(notifyKinds({ notifyAllKinds: true })).toEqual(['tickets-opened', 'new-event', 'sold-out'])
  })
})

describe('isQuietHours', () => {
  it('is true from 11pm up to (not including) 8am', () => {
    expect(isQuietHours(new Date(2026, 8, 5, 22, 59))).toBe(false)
    expect(isQuietHours(new Date(2026, 8, 5, 23, 0))).toBe(true)
    expect(isQuietHours(new Date(2026, 8, 6, 2, 0))).toBe(true)
    expect(isQuietHours(new Date(2026, 8, 6, 7, 59))).toBe(true)
    expect(isQuietHours(new Date(2026, 8, 6, 8, 0))).toBe(false)
  })

  it('is false through the middle of the day', () => {
    expect(isQuietHours(new Date(2026, 8, 5, 14, 30))).toBe(false)
  })
})

describe('notifyTitle — same voice as the email’s marqueeOnlySubject', () => {
  it('names the one show for a single change', () => {
    expect(notifyTitle([{ kind: 'tickets-opened', title: 'Tomcat' }])).toBe('Marquee: "Tomcat" — tickets on sale')
  })

  it('counts tickets-opened when several things changed', () => {
    const changes = [
      { kind: 'tickets-opened', title: 'A' },
      { kind: 'tickets-opened', title: 'B' },
      { kind: 'sold-out', title: 'C' },
    ]
    expect(notifyTitle(changes)).toBe('Marquee: 2 tickets just opened')
  })

  it('falls back to a bare count when nothing opened', () => {
    const changes = [{ kind: 'sold-out', title: 'A' }, { kind: 'new-event', title: 'B' }]
    expect(notifyTitle(changes)).toBe('Marquee: 2 changes at your venues')
  })
})

describe('notifyBody', () => {
  it('lists up to three, then a count for the rest', () => {
    const changes = Array.from({ length: 5 }, (_, i) => ({
      kind: 'tickets-opened', title: `Show ${i}`, venue: 'Excelsior',
    }))
    const lines = notifyBody(changes).split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[3]).toBe('+2 more')
  })

  it('has no trailing count line when three or fewer', () => {
    const changes = [{ kind: 'tickets-opened', title: 'A', venue: 'V' }]
    expect(notifyBody(changes)).toBe('A — tickets on sale (V)')
  })
})
