import { stepsOf, type Song } from '../../engine'

// How hard a song is, 1 to 3, for the song list and "Try next". The starter
// pack says so itself; an added song is judged from its notes: how quick they
// come, how far they spread, black keys, chords, and both hands at once.

export type Level = 1 | 2 | 3

const BLACK = new Set([1, 3, 6, 8, 10])

export function levelOf(song: Song): Level {
  if (song.level) return song.level
  if (song.notes.length === 0) return 1
  const pitches = song.notes.map((n) => n.pitch)
  const perSecond = song.notes.length / Math.max(1, song.durationMs / 1000)
  const spread = Math.max(...pitches) - Math.min(...pitches)
  const black = pitches.filter((p) => BLACK.has(p % 12)).length / pitches.length
  const steps = stepsOf(song.notes)
  const chords = steps.filter((s) => s.notes.length > 1).length / steps.length
  const hands = new Set(song.notes.map((n) => n.hand)).size
  let score = 0
  if (perSecond > 2.5) score++
  if (perSecond > 4) score++
  if (spread > 12) score++
  if (spread > 24) score++
  if (black > 0.1) score++
  if (chords > 0.15) score++
  if (hands > 1) score++
  return score <= 1 ? 1 : score <= 3 ? 2 : 3
}

/**
 * What to try after this song: the first song, easiest first, that she hasn't
 * finished yet, at this song's level or above; failing that, any she hasn't
 * finished. Null once she has finished them all.
 */
export function tryNext<T extends { song: Song }>(entries: readonly T[], finished: (songId: string) => boolean, currentId: string): T | null {
  const current = entries.find((e) => e.song.id === currentId)
  const floor = current ? levelOf(current.song) : 1
  const open = byLevel(entries).filter((e) => e.song.id !== currentId && !finished(e.song.id))
  return open.find((e) => levelOf(e.song) >= floor) ?? open[0] ?? null
}

/** Easiest first; songs of one level keep their order. */
export function byLevel<T extends { song: Song }>(entries: readonly T[]): T[] {
  return entries
    .map((e, i) => ({ e, i, l: levelOf(e.song) }))
    .sort((a, b) => a.l - b.l || a.i - b.i)
    .map((x) => x.e)
}
