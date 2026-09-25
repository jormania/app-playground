import { parseSmf, partsOf, songFromParts, suggestParts, suggestSplit, splitHands, fitOptions, fitSong, SmfError, type FitMode, type FitOption, type Part, type Song, type SmfFile } from '../../engine'
import { STARTER_PACK, starterSong } from '../../engine/starterPack'
import type { Language } from '../profiles'
import { PREFIX, type KeyValueStore } from '../store'

const SONGS_KEY = `${PREFIX}songs`

export interface LibraryEntry {
  song: Song
  source: 'starter' | 'import'
}

/**
 * The songs on this phone: the starter pack, built in, plus MIDI files added
 * with "Add a song". Imported songs are the family's — every player on the
 * phone sees them — and they never leave it (KEYPATH_TUTOR.md §5).
 */
export class SongLibrary {
  constructor(private readonly store: KeyValueStore) {}

  async list(lang: Language): Promise<LibraryEntry[]> {
    const starters = STARTER_PACK.map((s): LibraryEntry => ({ song: starterSong(s, lang), source: 'starter' }))
    // A song saved before the fitting choice existed, with notes past the keys, gets the best one on the way out:
    // left as it was, the song would wait for keys that aren't there.
    const imported = ((await this.store.get<Song[]>(SONGS_KEY)) ?? []).map((song): LibraryEntry => ({ song: song.fit ? song : fitSong(song, null), source: 'import' }))
    return [...starters, ...imported]
  }

  async get(id: string, lang: Language): Promise<Song | null> {
    return (await this.list(lang)).find((e) => e.song.id === id)?.song ?? null
  }

  async add(song: Song): Promise<void> {
    const imported = (await this.store.get<Song[]>(SONGS_KEY)) ?? []
    await this.store.set(SONGS_KEY, [...imported.filter((s) => s.id !== song.id), song])
  }

  /** Retitle an added song. A blank title leaves it as it was; starter songs can't be renamed. */
  async rename(id: string, title: string): Promise<void> {
    const clean = title.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE)
    if (!clean) return
    const imported = (await this.store.get<Song[]>(SONGS_KEY)) ?? []
    await this.store.set(
      SONGS_KEY,
      imported.map((s) => (s.id === id ? { ...s, title: clean } : s)),
    )
  }

  /** Change how an added song's notes are fitted to the keyboard, from the notes as written. */
  async refit(id: string, mode: FitMode): Promise<void> {
    const imported = (await this.store.get<Song[]>(SONGS_KEY)) ?? []
    await this.store.set(
      SONGS_KEY,
      imported.map((s) => (s.id === id ? fitSong(s, mode) : s)),
    )
  }

  /**
   * Take an added song off the phone, for every player. Their logs keep its
   * plays (Progress shows the id where the title is gone); the starter pack
   * can't be removed.
   */
  async remove(id: string): Promise<void> {
    const imported = (await this.store.get<Song[]>(SONGS_KEY)) ?? []
    await this.store.set(
      SONGS_KEY,
      imported.filter((s) => s.id !== id),
    )
  }
}

/** Song titles are kept short enough for the list and the play screen's title bar. */
export const MAX_TITLE = 80

export interface ImportDraft {
  file: SmfFile
  title: string
  parts: Part[]
  right: Part | null
  left: Part | null
  /** With no left-hand part: split the right-hand part between the hands below this pitch; null keeps it whole. */
  split: number | null
  /** Where a split would go, when the right-hand part looks like both hands in one; null if it doesn't. */
  splitSuggested: number | null
}

/** Where to split a part between the hands, if it looks like both hands in one track. */
function splitFor(file: SmfFile, part: Part | null): number | null {
  if (!part) return null
  return suggestSplit(file.notes.filter((n) => `${n.track}:${n.channel}` === part.key))
}

/** The split offered with this choice of parts: only when there's no left-hand part, and on when the part looks two-handed. */
function withSplit(d: Omit<ImportDraft, 'split' | 'splitSuggested'>): ImportDraft {
  const suggested = d.left ? null : splitFor(d.file, d.right)
  return { ...d, split: suggested, splitSuggested: suggested }
}

export type ImportProblem = 'not-midi' | 'unsupported' | 'no-notes'

/**
 * Give a hand a part ('' for none). One part can't be both hands, or every
 * note would be there twice: taking the left hand's part for the right leaves
 * the left with none; taking the right's for the left moves the right hand to
 * the left's old part, or else to any other.
 */
export function choosePart(d: ImportDraft, hand: 'right' | 'left', key: string): ImportDraft {
  const part = d.parts.find((p) => p.key === key) ?? null
  if (part && hand === 'right' && d.left?.key === part.key) return withSplit({ ...d, right: part, left: null })
  if (part && hand === 'left' && d.right?.key === part.key) return withSplit({ ...d, left: part, right: d.left ?? d.parts.find((p) => p.key !== part.key) ?? null })
  return withSplit({ ...d, [hand]: part })
}

/** Read a picked file into a draft for the "Which part?" step. */
export function draftFromFile(bytes: ArrayBuffer, fileName: string): ImportDraft | ImportProblem {
  let file: SmfFile
  try {
    file = parseSmf(bytes)
  } catch (err) {
    if (err instanceof SmfError) return /not a MIDI file/i.test(err.message) ? 'not-midi' : 'unsupported'
    throw err
  }
  const parts = partsOf(file).filter((p) => !p.isDrums)
  if (parts.length === 0) return 'no-notes'
  const { right, left } = suggestParts(parts)
  const title = fileName.replace(/\.(mid|midi|kar)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled'
  return withSplit({ file, title, parts, right, left })
}

export interface Built {
  /** The song as it will be saved: fitted to the keyboard the chosen way. */
  song: Song
  /** The ways to fit it, best first; empty when every note is on the keyboard as written. */
  options: FitOption[]
  /** Notes past the keyboard as written. */
  outside: number
}

/** Build the song from the chosen parts, fitted to the keyboard the chosen way (the best way, if none is chosen). */
export function buildImport(d: ImportDraft, title: string, fit: FitMode | null = null): Built {
  const built = songFromParts(d.file, { id: `import:${Date.now().toString(36)}`, title: title.trim() || d.title, right: d.right, left: d.left })
  // One part holding both hands: shared out by pitch before anything else, so each hand fits the keys on its own terms.
  const song = !d.left && d.split !== null ? splitHands(built, d.split) : built
  const options = fitOptions(song.notes)
  const outside = options.find((o) => o.mode === 'dropNotes')?.dropped ?? 0
  return { song: fitSong(song, fit), options, outside }
}
