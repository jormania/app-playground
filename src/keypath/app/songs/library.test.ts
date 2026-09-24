import { describe, expect, it } from 'vitest'
import { melodyFile, meta, on, off, smf, track } from '../../engine/testing/smfBuilder'
import { memoryStore } from '../store'
import { buildImport, draftFromFile, SongLibrary, type ImportDraft } from './library'

const bytes = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

describe('SongLibrary', () => {
  it('lists the starter pack first, in the player’s language, then the family’s own songs', async () => {
    const lib = new SongLibrary(memoryStore())
    const before = await lib.list('ro')
    expect(before.every((e) => e.source === 'starter')).toBe(true)
    expect(before.find((e) => e.song.id === 'starter:jacques')?.song.title).toBe('Frate Ioane')

    const draft = draftFromFile(bytes(melodyFile([[60, 1], [62, 1]], { name: 'Melody' })), 'my_song.mid') as ImportDraft
    const { song } = buildImport(draft, 'Our song')
    await lib.add(song)
    const after = await lib.list('en')
    expect(after.at(-1)).toMatchObject({ source: 'import', song: { id: song.id, title: 'Our song' } })
    expect(await lib.get(song.id, 'en')).toMatchObject({ title: 'Our song' })
    expect(await lib.get('nope', 'en')).toBeNull()
  })

  it('replaces a song saved again under the same id rather than listing it twice', async () => {
    const lib = new SongLibrary(memoryStore())
    const draft = draftFromFile(bytes(melodyFile([[60, 1]])), 'a.mid') as ImportDraft
    const { song } = buildImport(draft, 'A')
    await lib.add(song)
    await lib.add({ ...song, title: 'A again' })
    const own = (await lib.list('en')).filter((e) => e.source === 'import')
    expect(own.map((e) => e.song.title)).toEqual(['A again'])
  })
})

describe('Add a song', () => {
  it('names the draft after the file and picks the melody as the right hand', () => {
    const draft = draftFromFile(bytes(melodyFile([[60, 1], [64, 1], [67, 1]])), 'Ode_to-joy.MID')
    expect(draft).toMatchObject({ title: 'Ode to joy', right: { noteCount: 3 }, left: null })
  })

  it('says what is wrong with a file it cannot use', () => {
    expect(draftFromFile(bytes(new TextEncoder().encode('not midi at all')), 'x.mid')).toBe('not-midi')
    // A file with only drums has nothing to play.
    const drums = smf(0, 480, [track([meta.tempo(0, 120), on(0, 10, 36), off(480, 10, 36)])])
    expect(draftFromFile(bytes(drums), 'beat.mid')).toBe('no-notes')
  })

  it('moves a song that sits too high by whole octaves, and says so', () => {
    const draft = draftFromFile(bytes(melodyFile([[100, 1], [103, 1]])), 'high.mid') as ImportDraft
    const built = buildImport(draft, '')
    expect(built.shifted).toBe(-12)
    expect(built.song.notes.map((n) => n.pitch)).toEqual([88, 91])
    expect(built.song.title).toBe('high')
  })
})
