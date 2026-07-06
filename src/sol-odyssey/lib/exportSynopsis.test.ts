import { describe, it, expect } from 'vitest'
import { buildSynopsisHtml, SYNOPSIS_FILENAME } from './exportSynopsis'
import type { OdysseyDetail } from './notion'

function detail(over: Partial<OdysseyDetail> = {}): OdysseyDetail {
  return {
    id: 'o1',
    title: 'Odyssey 1 — morning movement',
    number: 1,
    status: 'Maintenance',
    startDate: '2026-06-15',
    endDate: '2026-07-26',
    behaviour: 'move my body',
    identity: 'moves',
    tinyVersion: 'walk to the corner',
    anchor: 'after my first coffee',
    ifThen: 'if it rains, hallway',
    outcomePicture: 'a steadier mind',
    pairing: '',
    dailySuccess: 'shoes on, outside',
    whyValue: 'a body in motion',
    commitment: '',
    outcome: 'Keep',
    notes: 'feels automatic now',
    ...over,
  }
}

describe('buildSynopsisHtml', () => {
  it('produces a self-contained essence doc (identity + practised + why + pictured + installed)', () => {
    const html = buildSynopsisHtml([detail()])
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('Odyssey 1 — morning movement') // title header
    expect(html).toContain('I am someone who moves') // identity headline
    expect(html).toContain('walk to the corner') // practised (tiny version)
    expect(html).toContain('a body in motion') // why it mattered
    expect(html).toContain('a steadier mind') // pictured (outcome picture)
    expect(html).toContain('feels automatic now') // what installed (verdict)
    expect(html).toContain('Keep') // outcome
  })

  it('leaves out the run-time mechanics (no anchor / if-then / daily-success / pairing)', () => {
    const html = buildSynopsisHtml([detail()])
    expect(html).not.toContain('after my first coffee') // anchor
    expect(html).not.toContain('if it rains') // if-then
    expect(html).not.toContain('shoes on, outside') // daily success
  })

  it('escapes HTML in user content (no injection)', () => {
    const html = buildSynopsisHtml([detail({ identity: '<script>alert(1)</script>' })])
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('omits empty fields (no label for a blank pictured/outcome-picture)', () => {
    const html = buildSynopsisHtml([detail({ outcomePicture: '' })])
    expect(html).not.toContain('Pictured')
  })

  it('orders by Odyssey number and reports the count', () => {
    const html = buildSynopsisHtml([
      detail({ id: 'b', number: 2, title: 'Odyssey 2 — read' }),
      detail({ id: 'a', number: 1, title: 'Odyssey 1 — move' }),
    ])
    expect(html.indexOf('Odyssey 1 — move')).toBeLessThan(html.indexOf('Odyssey 2 — read'))
    expect(html).toContain('2 Odysseys')
  })

  it('exports under a stable filename', () => {
    expect(SYNOPSIS_FILENAME).toBe('sol-odyssey-synopsis.html')
  })
})
