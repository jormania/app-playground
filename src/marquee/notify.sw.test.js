import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { kindFor, notifiableChanges, notifyTitle, notifyBody } from './notify.js'

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
})
