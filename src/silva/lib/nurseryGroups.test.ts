import { describe, it, expect } from 'vitest'
import { groupNurseryBySource } from './nurseryGroups'
import type { Thing } from './notion'
import type { Source } from './sources'

function thing(id: string, sourceId: string | null = null): Thing {
  return {
    id, handle: id, body: `body ${id}`, kind: null, state: 'Understory', sourceId,
    locator: '', encountered: '2026-08-01', kept: null, note: '',
    lociIds: [], image: null, link: null, koboBookmarkId: null, arrived: null,
  }
}

function source(id: string, title: string): Source {
  return { id, title, author: '', kind: 'Book', cover: null, koboVolumeId: null, notes: '' }
}

describe('groupNurseryBySource', () => {
  // A nursery of typed captures is exactly the flat list it always was — a
  // heading over one untitled section is noise.
  it('leaves an all-unsourced nursery as a single unheaded section', () => {
    const things = [thing('a'), thing('b')]
    expect(groupNurseryBySource(things, [])).toEqual([{ source: null, things }])
  })

  it('gathers each book into its own section', () => {
    const sources = [source('s1', 'Meditations'), source('s2', 'The Odyssey')]
    const things = [thing('a', 's1'), thing('b', 's2'), thing('c', 's1')]
    const groups = groupNurseryBySource(things, sources)
    expect(groups.map((g) => [g.source?.title, g.things.map((t) => t.id)])).toEqual([
      ['Meditations', ['a', 'c']],
      ['The Odyssey', ['b']],
    ])
  })

  // Your own captures are why you opened the nursery.
  it('puts the unsourced section first', () => {
    const groups = groupNurseryBySource([thing('a', 's1'), thing('mine')], [source('s1', 'Meditations')])
    expect(groups.map((g) => g.source?.title ?? null)).toEqual([null, 'Meditations'])
  })

  it('keeps the order within a section untouched', () => {
    const things = [thing('a', 's1'), thing('b', 's1'), thing('c', 's1')]
    expect(groupNurseryBySource(things, [source('s1', 'M')])[0].things.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  // Better an unheaded row than a section titled with a Notion id.
  it('treats a thing whose source is not loaded as unsourced', () => {
    const groups = groupNurseryBySource([thing('a', 'missing')], [source('s1', 'Meditations')])
    expect(groups).toEqual([{ source: null, things: [thing('a', 'missing')] }])
  })

  it('never invents an empty section for a source with nothing in the nursery', () => {
    const groups = groupNurseryBySource([thing('a', 's1')], [source('s1', 'M'), source('s2', 'Unused')])
    expect(groups).toHaveLength(1)
  })
})
