import { parseSmf, partsOf, songFromParts, suggestParts, checkRange, transposeSong, SmfError, type Part, type Song, type SmfFile } from '../../engine'
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
    const imported = ((await this.store.get<Song[]>(SONGS_KEY)) ?? []).map((song): LibraryEntry => ({ song, source: 'import' }))
    return [...starters, ...imported]
  }

  async get(id: string, lang: Language): Promise<Song | null> {
    return (await this.list(lang)).find((e) => e.song.id === id)?.song ?? null
  }

  async add(song: Song): Promise<void> {
    const imported = (await this.store.get<Song[]>(SONGS_KEY)) ?? []
    await this.store.set(SONGS_KEY, [...imported.filter((s) => s.id !== song.id), song])
  }
}

export interface ImportDraft {
  file: SmfFile
  title: string
  parts: Part[]
  right: Part | null
  left: Part | null
}

export type ImportProblem = 'not-midi' | 'unsupported' | 'no-notes'

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
  return { file, title, parts, right, left }
}

export interface Built {
  song: Song
  /** Semitones applied to fit the 61 keys (0 if none were needed). */
  shifted: number
  /** Notes still off the keyboard after any shift (0 when it fits). */
  outside: number
}

/** Build the song from the chosen parts, moving it by whole octaves if it doesn't fit the keyboard. */
export function buildImport(d: ImportDraft, title: string): Built {
  const song = songFromParts(d.file, { id: `import:${Date.now().toString(36)}`, title: title.trim() || d.title, right: d.right, left: d.left })
  const range = checkRange(song.notes.map((n) => n.pitch))
  if (range.fits || range.suggestedShift === null) return { song, shifted: 0, outside: range.outside }
  return { song: transposeSong(song, range.suggestedShift), shifted: range.suggestedShift, outside: 0 }
}
