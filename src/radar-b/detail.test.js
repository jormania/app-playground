import { describe, expect, test } from 'vitest'
import { goUrlFor } from './EventDetail.jsx'

const src = (url) => ({ name: 'B365', url, kind: 'editorial' })

describe('goUrlFor', () => {
  test('tickets always win — that is what the screen is building towards', () => {
    expect(goUrlFor({ tickets: 'https://iabilet.ro/x', link: 'https://a.ro', sources: [] }))
      .toBe('https://iabilet.ro/x')
  })

  test('tickets are offered even when they are also a listed source', () => {
    expect(goUrlFor({ tickets: 'https://iabilet.ro/x', sources: [src('https://iabilet.ro/x')] }))
      .toBe('https://iabilet.ro/x')
  })

  test('an event link is offered when provenance does not already point there', () => {
    expect(goUrlFor({ link: 'https://venue.ro/event', sources: [src('https://b365.ro/weekend')] }))
      .toBe('https://venue.ro/event')
  })

  test('no button when the link is a source already listed above it', () => {
    // A Radar row's `Link` is often the article it was found in, so this is the
    // common case, not the edge one.
    expect(goUrlFor({ link: 'https://b365.ro/weekend', sources: [src('https://b365.ro/weekend')] }))
      .toBeNull()
  })

  test('no link, no button', () => {
    expect(goUrlFor({ sources: [] })).toBeNull()
    expect(goUrlFor({ link: null, sources: [src('https://b365.ro/x')] })).toBeNull()
  })

  test('survives a source with no url at all', () => {
    expect(goUrlFor({ link: 'https://venue.ro/e', sources: [src(null)] })).toBe('https://venue.ro/e')
  })
})
