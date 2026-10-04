import type { Song } from '../../engine'

/**
 * The beat counted in before a song on the clock (3, 2, 1, with the first
 * notes already falling): its own beat, or, where that is too quick to count
 * aloud (Für Elise is written in sixteenths), two, three, four or six of them
 * together. How long the lead-in lasts, nothing else.
 */
export const countBeatMs = (song: Pick<Song, 'bpm'>) => {
  const beat = 60000 / (song.bpm || 120)
  return beat * ([1, 2, 3, 4, 6].find((k) => beat * k >= 400) ?? 6)
}
