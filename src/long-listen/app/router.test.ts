import { describe, it, expect } from 'vitest'
import { parseRoute, href, stepTrail, cameFrom, type Route } from './router'

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

  it('reads a link it cannot decode as no address, never as a crash, and round-trips composer names', () => {
    expect(parseRoute('#/composer/100%')).toEqual({ name: 'library' })
    expect(parseRoute(href({ name: 'composer', composer: 'Carl Philipp Emanuel Bach / C.P.E.' }))).toEqual({ name: 'composer', composer: 'Carl Philipp Emanuel Bach / C.P.E.' })
    expect(parseRoute(href({ name: 'before', key: '2026-10-23T1900~sala-radio~bach' }))).toEqual({ name: 'before', key: '2026-10-23T1900~sala-radio~bach' })
  })
})

describe('where you were', () => {
  it('going back to the programme from a work lands where it was read to; a page opened afresh starts at the top', () => {
    const toListen = stepTrail([], '#/p/w1', 2400, '#/listen/w1/i3')
    expect(toListen.y).toBe(0)
    const back = stepTrail(toListen.trail, '#/listen/w1/i3', 800, '#/p/w1')
    expect(back.y).toBe(2400)
    // Back on the programme, the listening view is forgotten: opened again, it starts at its top.
    expect(back.trail).toEqual([])
    expect(stepTrail(back.trail, '#/p/w1', 2600, '#/listen/w1/i3').y).toBe(0)
  })

  it('reaches back more than one page, through a composer or a concert, and drops what came after', () => {
    let t = stepTrail([], '#/', 1500, '#/p/w1').trail
    t = stepTrail(t, '#/p/w1', 900, '#/composer/Sibelius').trail
    const back = stepTrail(t, '#/composer/Sibelius', 300, '#/')
    expect(back.y).toBe(1500)
    expect(back.trail).toEqual([])
  })

  it('"#/" and "" are the same page, and a page left again keeps only its latest place', () => {
    let t = stepTrail([], '', 100, '#/journal').trail
    const back = stepTrail(t, '#/journal', 50, '#/')
    expect(back.y).toBe(100)
    t = stepTrail(back.trail, '#/', 700, '#/library').trail
    t = stepTrail(t, '#/library', 20, '#/notebook').trail
    expect(t.map((p) => [p.hash, p.y])).toEqual([['#/', 700], ['#/library', 20]])
  })
})

describe('the way back to a programme', () => {
  it('goes to the address it was read at: "#/" from This week, "#/p/<id>" from elsewhere', () => {
    const fromWeek = stepTrail([], '#/', 2927, '#/listen/w1/i3').trail
    expect(cameFrom(fromWeek, ['#/', '#/p/w1'])).toBe('#/')
    expect(stepTrail(fromWeek, '#/listen/w1/i3', 0, '#/').y).toBe(2927)
    let fromJournal = stepTrail([], '#/', 100, '#/p/w1').trail
    fromJournal = stepTrail(fromJournal, '#/p/w1', 800, '#/listen/w1/i3').trail
    expect(cameFrom(fromJournal, ['#/', '#/p/w1'])).toBe('#/p/w1')
    expect(cameFrom([], ['#/', '#/p/w1'])).toBeUndefined()
  })
})
