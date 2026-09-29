import type { Song } from '../../engine'
import { handCount } from './SongFacts'
import { levelOf, type Level } from './level'

// Finding a song in a longer list (KEYPATH_ROADMAP.md, "Search and filter the
// song list"): by what its title says, its level, and one hand or two.

export interface SongFilter {
  /** Part of the title, in any case; blank matches every song. */
  text: string
  level: Level | 'any'
  hands: 1 | 2 | 'any'
}

export const NO_FILTER: SongFilter = { text: '', level: 'any', hands: 'any' }

/** From this many songs a list gets its filter: shorter than that, it fits on a screen and is just the list. */
export const FILTER_FROM = 12

/** Letters without their accents, lower case: "Für Elise" is found by "fur", "Încălzire" by "incalz". */
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export const isFiltering = (f: SongFilter) => f.text.trim() !== '' || f.level !== 'any' || f.hands !== 'any'

export function matches(song: Song, f: SongFilter): boolean {
  if (f.text.trim() && !plain(song.title).includes(plain(f.text.trim()))) return false
  if (f.level !== 'any' && levelOf(song) !== f.level) return false
  if (f.hands !== 'any' && handCount(song) !== f.hands) return false
  return true
}

export const filterSongs = <T extends { song: Song }>(entries: readonly T[], f: SongFilter): T[] => entries.filter((e) => matches(e.song, f))
