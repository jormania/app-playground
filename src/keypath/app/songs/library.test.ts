import { describe, expect, it } from 'vitest'
import { melodyFile, meta, on, off, pianoFile, smf, track, waltzPiano } from '../../engine/testing/smfBuilder'
import { memoryStore } from '../store'
import { ratedLevel } from './level'
import { chord as mchord, measure4, mscx, tempo as mtempo, timeSig } from '../../engine/testing/mscxBuilder'
import { attributes, CONTAINER, measure, note, pianoBar, repeatEnd, score, tempo, zip } from '../../engine/testing/xmlBuilder'
import { buildImport, choosePart, draftFromFile, openSongFile, SongLibrary, type ImportDraft } from './library'

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
    const { source, fit, easy: _easy, ...old } = wide().song
    expect(fit).toBe('moveNotes')
    await store.set('keypath:v1:songs', [{ ...old, notes: source }])
    const read = await lib.get(old.id, 'en')
    expect(read?.fit).toBe('moveNotes')
    expect(read?.notes.every((n) => n.pitch >= 36 && n.pitch <= 96)).toBe(true)
  })
})

describe('both hands in one track', () => {
  const draft = () => draftFromFile(bytes(pianoFile(waltzPiano(), { beatsPerBar: 3 })), 'waltz.mid') as ImportDraft

  it('is noticed, and split between the hands where they part', () => {
    const d = draft()
    expect(d.left).toBeNull()
    expect(d.split).toBe(67)
    // As written: the split is what's being checked, not the easy version a song this hard is offered.
    const { song } = buildImport(d, '', null, false)
    const hands = (h: string) => song.notes.filter((x) => x.hand === h).length
    expect([hands('left'), hands('right')]).toEqual([32, 8])
  })

  it('can be moved, or turned off to keep it all in the right hand', () => {
    expect(buildImport({ ...draft(), split: 60 }, '', null, false).song.notes.filter((x) => x.hand === 'left').length).toBe(16)
    expect(buildImport({ ...draft(), split: null }, '', null, false).song.notes.every((x) => x.hand === 'right')).toBe(true)
  })

  it('is rated as played, bass and chords in the left hand, and a level she sets is kept', async () => {
    const { song } = buildImport(draft(), 'Waltz', null, false)
    // The left hand jumps from the bass to the chords, and has four notes to the tune's one: Harder.
    expect(ratedLevel(song)).toBe(3)
    const lib = new SongLibrary(memoryStore())
    await lib.add(song)
    await lib.setLevel(song.id, 2)
    expect((await lib.get(song.id, 'en'))?.level).toBe(2)
    // Changing how it fits the keys keeps her level.
    await lib.refit(song.id, 'dropNotes')
    expect((await lib.get(song.id, 'en'))?.level).toBe(2)
    // Set back to its rating, nothing is kept.
    await lib.setLevel(song.id, 3)
    expect((await lib.get(song.id, 'en'))?.level).toBeUndefined()
  })

  it('a melody file is not offered a split', () => {
    expect(draftFromFile(bytes(melodyFile([[60, 1], [62, 1], [64, 1]])), 'm.mid')).toMatchObject({ split: null, splitSuggested: null })
  })

  it('choosing a part for the left hand turns the split off', () => {
    const d = { ...draft(), parts: [...draft().parts, { ...draft().parts[0], key: 'other', name: 'Bass' }] }
    expect(choosePart(d, 'left', 'other')).toMatchObject({ split: null })
  })
})

describe('a MusicXML score', () => {
  const text = score({
    title: 'Two Hands',
    parts: [
      {
        name: 'Piano',
        measures: [
          measure(1, attributes({ staves: 2 }) + tempo(60) + pianoBar([{ pitch: 'E4', beats: 2, finger: 3 }, { pitch: 'D4', beats: 2, finger: 2 }], [{ pitch: 'C3', beats: 4, finger: 5 }])),
          measure(2, pianoBar([{ pitch: 'C4', beats: 4, finger: 1 }], [{ pitch: 'G2', beats: 4, finger: 1 }]) + repeatEnd()),
          measure(3, pianoBar([{ pitch: 'G4', beats: 4, finger: 5 }], [{ pitch: 'C3', beats: 4, finger: 5 }])),
        ],
      },
    ],
  })
  const bytesOf = (s: string) => bytes(new TextEncoder().encode(s))

  it('takes the hands from its staves, its title from the score, and keeps fingers and printed bars', () => {
    const d = draftFromFile(bytesOf(text), 'two_hands.musicxml') as ImportDraft
    expect(d.title).toBe('Two Hands')
    expect([d.right?.staff, d.left?.staff]).toEqual([1, 2])
    // Both hands are printed apart, so nothing is offered to split.
    expect(d.split).toBeNull()
    const { song } = buildImport(d, '')
    expect(song.notes.filter((n) => n.hand === 'right').map((n) => [n.pitch, n.finger])).toEqual([
      [64, 3],
      [62, 2],
      [60, 1],
      [64, 3],
      [62, 2],
      [60, 1],
      [67, 5],
    ])
    expect(song.barLabels).toEqual(['1', '2', '1', '2', '3'])
  })

  it('opens MuseScore’s compressed download (.mxl) the same way', async () => {
    const mxl = await zip([
      { name: 'META-INF/container.xml', text: CONTAINER('two_hands.xml'), deflate: true },
      { name: 'two_hands.xml', text, deflate: true },
    ])
    const d = (await openSongFile(bytes(mxl), 'two_hands.mxl')) as ImportDraft
    expect(d.title).toBe('Two Hands')
    expect(d.parts).toHaveLength(2)
    // A MIDI file still opens through the same door.
    expect(((await openSongFile(bytes(melodyFile([[60, 1]])), 'a.mid')) as ImportDraft).parts).toHaveLength(1)
  })

  it('says what is wrong with a file that isn’t a song, or a score it can’t read', async () => {
    expect(draftFromFile(bytesOf('<html><body>hi</body></html>'), 'page.xml')).toBe('not-midi')
    expect(draftFromFile(bytesOf('<score-timewise version="4.0"/>'), 'x.musicxml')).toBe('unsupported')
    expect(await openSongFile(bytes(await zip([{ name: 'photo.jpg', text: 'x' }])), 'photos.zip')).toBe('not-midi')
    expect(draftFromFile(bytesOf(score({ parts: [{ name: 'Rests', measures: [measure(1, attributes() + note({ pitch: null, beats: 4 }))] }] })), 'r.xml')).toBe('no-notes')
  })
})

describe('a MuseScore file (.mscz)', () => {
  const text = mscx({
    version: '4.20',
    title: 'Two Staves',
    parts: [{ name: 'Piano', staves: [[measure4([timeSig(4, 4) + mtempo(60) + mchord({ type: 'whole', notes: [{ pitch: 64, finger: 3 }] })])], [measure4([mchord({ type: 'whole', notes: [{ pitch: 48, finger: 5 }] })])]] }],
  })

  it('opens like any score: the hands from its staves, its title, its fingers', async () => {
    const mscz = await zip([
      { name: 'META-INF/container.xml', text: CONTAINER('two_staves.mscx'), deflate: true },
      { name: 'two_staves.mscx', text, deflate: true },
    ])
    const d = (await openSongFile(bytes(mscz), 'two_staves.mscz')) as ImportDraft
    expect(d.title).toBe('Two Staves')
    expect([d.right?.staff, d.left?.staff]).toEqual([1, 2])
    const { song } = buildImport(d, '')
    expect(song.notes.map((n) => [n.hand, n.pitch, n.finger])).toEqual([
      ['left', 48, 5],
      ['right', 64, 3],
    ])
    // Uncompressed (.mscx) too.
    expect((draftFromFile(bytes(new TextEncoder().encode(text)), 'two_staves.mscx') as ImportDraft).parts).toHaveLength(2)
  })

  it('says so for a MuseScore file it can’t read', () => {
    expect(draftFromFile(bytes(new TextEncoder().encode('<museScore version="1.14"><Score/></museScore>')), 'old.mscx')).toBe('unsupported')
  })
})

describe('the easy version', () => {
  const waltz = () => draftFromFile(bytes(pianoFile(waltzPiano(), { beatsPerBar: 3 })), 'waltz.mid') as ImportDraft
  const tune = () => draftFromFile(bytes(melodyFile([[60, 1], [62, 1], [64, 1]])), 'tune.mid') as ImportDraft

  it('is suggested for a song rated Harder as written, and is what it comes in as unless she chooses', () => {
    const hard = buildImport(waltz(), 'Waltz')
    expect(hard.easySuggested).toBe(true)
    expect(hard.song.easy).toBe(true)
    const written = buildImport(waltz(), 'Waltz', null, false).song
    expect(hard.song.notes.length).toBeLessThan(written.notes.length)
    expect(hard.song.source).toEqual(written.notes)
    const easyTune = buildImport(tune(), 'Tune')
    expect([easyTune.easySuggested, easyTune.song.easy]).toEqual([false, false])
  })

  it('can be switched off, which is the song exactly as written, and on again', async () => {
    const lib = new SongLibrary(memoryStore())
    const hard = buildImport(waltz(), 'Waltz').song
    const written = buildImport(waltz(), 'Waltz', null, false).song
    await lib.add(hard)
    await lib.setEasy(hard.id, false)
    const off = await lib.get(hard.id, 'en')
    expect(off?.easy).toBe(false)
    expect(off?.notes).toEqual(written.notes)
    await lib.setEasy(hard.id, true)
    expect((await lib.get(hard.id, 'en'))?.notes).toEqual(hard.notes)
  })

  it('comes to a song added before it existed when the song is rated Harder, and not otherwise', async () => {
    const store = memoryStore()
    const lib = new SongLibrary(store)
    const { easy: _a, ...oldHard } = buildImport(waltz(), 'Waltz', null, false).song
    const { easy: _b, ...oldEasy } = buildImport(tune(), 'Tune', null, false).song
    oldEasy.id = 'import:tune'
    await store.set('keypath:v1:songs', [oldHard, oldEasy])
    expect((await lib.get(oldHard.id, 'en'))?.easy).toBe(true)
    expect((await lib.get(oldEasy.id, 'en'))?.easy).toBe(false)
    expect((await lib.get(oldEasy.id, 'en'))?.notes).toEqual(oldEasy.notes)
  })
})
