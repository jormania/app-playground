import { describe, expect, it } from 'vitest'
import { STARTER_PACK, starterSong } from '../../engine/starterPack'
import { filterSongs, FILTER_FROM, isFiltering, NO_FILTER } from './filter'

const entries = STARTER_PACK.map((s) => ({ song: starterSong(s) }))
const titles = (f: Partial<typeof NO_FILTER>) => filterSongs(entries, { ...NO_FILTER, ...f }).map((e) => e.song.title)

describe('filterSongs', () => {
  it('finds a title by part of it, in any case and without accents', () => {
    expect(titles({ text: 'FUR' })).toEqual(['Für Elise (opening)'])
    expect(titles({ text: '  bridge ' })).toEqual(['London Bridge'])
    expect(titles({ text: 'zzz' })).toEqual([])
  })

  it('filters by level and by one hand or two, together', () => {
    const harder = titles({ level: 3 })
    expect(harder).toEqual(expect.arrayContaining(['Happy Birthday', 'Für Elise (opening)', 'Minuet in G']))
    expect(harder.every((t) => !['Twinkle, Twinkle, Little Star', 'Hot Cross Buns'].includes(t))).toBe(true)
    expect(titles({ hands: 2 })).toEqual(expect.arrayContaining(['Twinkle, Twinkle, Little Star', 'Ode to Joy']))
    expect(titles({ hands: 2 }).includes('Hot Cross Buns')).toBe(false)
    expect(titles({ level: 1, hands: 1 })).toEqual(expect.arrayContaining(['Hot Cross Buns']))
  })

  it('says whether anything is being filtered, and gives a list its filter from twelve songs', () => {
    expect(isFiltering(NO_FILTER)).toBe(false)
    expect(isFiltering({ ...NO_FILTER, text: ' ' })).toBe(false)
    expect(isFiltering({ ...NO_FILTER, level: 2 })).toBe(true)
    expect(FILTER_FROM).toBe(12)
  })
})
