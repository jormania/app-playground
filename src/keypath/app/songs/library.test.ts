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

  it('moves a song that sits too high by whole octaves by default, keeping the notes as written', () => {
    const draft = draftFromFile(bytes(melodyFile([[100, 1], [103, 1]])), 'high.mid') as ImportDraft
    const built = buildImport(draft, '')
    expect(built.options.map((o) => o.mode)).toEqual(['moveSong', 'moveNotes', 'dropNotes'])
    expect(built.outside).toBe(2)
    expect(built.song).toMatchObject({ fit: 'moveSong', title: 'high' })
    expect(built.song.notes.map((n) => n.pitch)).toEqual([88, 91])
    expect(built.song.source?.map((n) => n.pitch)).toEqual([100, 103])
    // Or the other ways, when chosen.
    expect(buildImport(draft, '', 'dropNotes').song.notes).toEqual([])
  })

  it('a song that fits carries no choice', () => {
    const draft = draftFromFile(bytes(melodyFile([[60, 1], [62, 1]])), 'ok.mid') as ImportDraft
    const built = buildImport(draft, '')
    expect(built.options).toEqual([])
    expect(built.song.fit).toBeUndefined()
  })
})

describe('songs wider than the keyboard', () => {
  // A melody from A0 to C8: 87 keys, wider than the 61 on the Yamaha.
  const wide = () => buildImport(draftFromFile(bytes(melodyFile([[21, 1], [60, 1], [108, 1]])), 'wide.mid') as ImportDraft, 'Wide')

  it('too wide to move whole: the stray notes move by default, and the choice can be changed later', async () => {
    const built = wide()
    expect(built.options.map((o) => o.mode)).toEqual(['moveNotes', 'dropNotes'])
    expect(built.song.notes.map((n) => n.pitch)).toEqual([45, 60, 96])
    const store = memoryStore()
    const lib = new SongLibrary(store)
    await lib.add(built.song)
    await lib.refit(built.song.id, 'dropNotes')
    expect((await lib.get(built.song.id, 'en'))?.notes.map((n) => n.pitch)).toEqual([60])
    await lib.refit(built.song.id, 'moveNotes')
    expect((await lib.get(built.song.id, 'en'))?.notes.map((n) => n.pitch)).toEqual([45, 60, 96])
  })

  it('a song saved before the choice existed, with notes past the keys, is fitted when read, so it never waits for a key that isn’t there', async () => {
    const store = memoryStore()
    const lib = new SongLibrary(store)
    const { source, fit, ...old } = wide().song
    expect(fit).toBe('moveNotes')
    await store.set('keypath:v1:songs', [{ ...old, notes: source }])
    const read = await lib.get(old.id, 'en')
    expect(read?.fit).toBe('moveNotes')
    expect(read?.notes.every((n) => n.pitch >= 36 && n.pitch <= 96)).toBe(true)
  })
})
