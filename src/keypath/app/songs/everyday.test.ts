import { describe, expect, it } from 'vitest'
import { melodyFile } from '../../engine/testing/smfBuilder'
import type { LogRecord } from '../log'
import { memoryStore } from '../store'
import { KEYBOARD, keyBoxes, widenRange } from './keyGeometry'
import { buildImport, choosePart, draftFromFile, MAX_TITLE, SongLibrary, type ImportDraft } from './library'
import { ProfileRepo } from '../profiles'
import { playedWhen, songProgress } from './songProgress'

const bytes = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
const rec = (at: string, e: Record<string, unknown>) => ({ at, profileId: 'nora', ...e }) as unknown as LogRecord

describe('widenRange', () => {
  it('grows a range to three octaves, keeping middle C near the middle, within the Yamaha’s 61 keys', () => {
    expect(widenRange({ low: 60, high: 72 }, 3)).toEqual({ low: 48, high: 84 }) // below first: that centres on middle C
    expect(widenRange({ low: 48, high: 72 }, 3)).toEqual({ low: 48, high: 84 }) // a tie goes above
    expect(widenRange({ low: 72, high: 84 }, 3)).toEqual({ low: 48, high: 84 }) // a high tune reaches down to middle C
    expect(widenRange({ low: 36, high: 48 }, 3)).toEqual({ low: 36, high: 72 }) // nothing below C2
    expect(widenRange({ low: 48, high: 84 }, 3)).toEqual({ low: 48, high: 84 }) // already wide enough
    expect(widenRange(KEYBOARD, 9)).toEqual(KEYBOARD) // never past the keyboard
    expect(keyBoxes(48, 84).filter((b) => !b.black)).toHaveLength(22)
  })
})

describe('songProgress', () => {
  it('keeps each song’s best stars and when it was last played', () => {
    const p = songProgress([
      rec('2026-09-20T17:00:00.000Z', { type: 'song_started', songId: 'a' }),
      rec('2026-09-20T17:01:00.000Z', { type: 'song_finished', songId: 'a', stars: 2 }),
      rec('2026-09-21T17:00:00.000Z', { type: 'song_finished', songId: 'a', stars: 1 }),
      rec('2026-09-22T17:00:00.000Z', { type: 'song_abandoned', songId: 'b' }),
      rec('2026-09-23T17:00:00.000Z', { type: 'door_opened', door: 'songs' }),
    ])
    expect(p.get('a')).toEqual({ bestStars: 2, lastPlayed: '2026-09-21T17:00:00.000Z' })
    expect(p.get('b')).toEqual({ bestStars: null, lastPlayed: '2026-09-22T17:00:00.000Z' })
    expect(p.has('c')).toBe(false)
  })

  it('says today, yesterday, or the date, on the phone’s calendar', () => {
    const now = new Date(2026, 8, 24, 9, 0) // 24 Sep, 09:00 local
    expect(playedWhen(new Date(2026, 8, 24, 0, 30).toISOString(), now)).toEqual({ kind: 'today' })
    expect(playedWhen(new Date(2026, 8, 23, 23, 50).toISOString(), now)).toEqual({ kind: 'yesterday' })
    expect(playedWhen(new Date(2026, 8, 20, 12).toISOString(), now)).toEqual({ kind: 'on', date: '2026-09-20' })
  })
})

describe('SongLibrary: rename and remove', () => {
  it('retitles and removes an added song, and leaves the starter pack alone', async () => {
    const lib = new SongLibrary(memoryStore())
    const { song } = buildImport(draftFromFile(bytes(melodyFile([[60, 1]])), 'a.mid') as ImportDraft, 'A')
    await lib.add(song)
    await lib.rename(song.id, '  Our   song ')
    expect((await lib.get(song.id, 'en'))?.title).toBe('Our song')
    await lib.rename(song.id, '   ') // a blank title changes nothing
    expect((await lib.get(song.id, 'en'))?.title).toBe('Our song')
    await lib.rename(song.id, 'x'.repeat(200))
    expect((await lib.get(song.id, 'en'))?.title).toHaveLength(MAX_TITLE)
    await lib.remove('starter:twinkle')
    expect(await lib.get('starter:twinkle', 'en')).not.toBeNull()
    await lib.remove(song.id)
    expect(await lib.get(song.id, 'en')).toBeNull()
  })
})

describe('choosePart', () => {
  const part = (key: string) => ({ key, track: 1, channel: 1, name: key, noteCount: 10, low: 48, high: 72, meanPitch: 60, isDrums: false }) as unknown as ImportDraft['parts'][number]
  const d: ImportDraft = { file: { notes: [] } as unknown as ImportDraft['file'], title: 't', parts: [part('a'), part('b'), part('c')], right: part('a'), left: part('b'), split: null, splitSuggested: null }

  it('never gives one part to both hands', () => {
    expect(choosePart(d, 'right', 'b')).toMatchObject({ right: { key: 'b' }, left: null })
    expect(choosePart(d, 'left', 'a')).toMatchObject({ left: { key: 'a' }, right: { key: 'b' } }) // the hands swap
    expect(choosePart({ ...d, left: null }, 'left', 'a')).toMatchObject({ left: { key: 'a' }, right: { key: 'b' } }) // the right moves to another part
    expect(choosePart(d, 'left', '')).toMatchObject({ right: { key: 'a' }, left: null })
    expect(choosePart(d, 'right', 'c')).toMatchObject({ right: { key: 'c' }, left: { key: 'b' } })
  })
})

describe('ProfileRepo.update', () => {
  it('renames and re-faces a player; a blank name keeps the old one', async () => {
    const repo = new ProfileRepo(memoryStore())
    const p = await repo.create('Nora', '🐺')
    await repo.update(p.id, { name: '  Nora B. ', avatar: '🦉' })
    expect((await repo.list())[0]).toMatchObject({ name: 'Nora B.', avatar: '🦉' })
    await repo.update(p.id, { name: '   ' })
    expect((await repo.list())[0].name).toBe('Nora B.')
  })
})
