import { describe, it, expect } from 'vitest'
import { parseRoute, href, type Route } from './router'

describe('routes', () => {
  it('round-trips every route', () => {
    const routes: Route[] = [
      { name: 'week' }, { name: 'programme', id: 'prog_1' }, { name: 'listen', programmeId: 'prog_1', itemId: 'item_2' },
      { name: 'journal' }, { name: 'library' }, { name: 'threads' }, { name: 'notebook' }, { name: 'settings' },
    ]
    for (const r of routes) expect(parseRoute(href(r))).toEqual(r)
  })

  it('keeps the old journal address working', () => {
    expect(parseRoute('#/listening')).toEqual({ name: 'journal' })
  })
})
