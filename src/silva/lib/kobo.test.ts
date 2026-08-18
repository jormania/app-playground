import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import initSqlJs from 'sql.js'
import { parseKoboDatabase, KoboParseError } from './kobo'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = join(__dirname, 'fixtures', 'kobo-sample.sqlite')

function loadFixtureBytes(): Uint8Array {
  return new Uint8Array(readFileSync(FIXTURE_PATH))
}

describe('parseKoboDatabase', () => {
  it('reads highlights joined against their book title/author, filtering out position-only bookmarks', async () => {
    const highlights = await parseKoboDatabase(loadFixtureBytes())
    // bm-3 has no Text — a position-only bookmark, not a highlight.
    expect(highlights.map((h) => h.bookmarkId).sort()).toEqual(['bm-1', 'bm-2', 'bm-4'])
  })

  it('maps a full row exactly', async () => {
    const highlights = await parseKoboDatabase(loadFixtureBytes())
    const first = highlights.find((h) => h.bookmarkId === 'bm-1')
    expect(first).toEqual({
      bookmarkId: 'bm-1',
      volumeId: 'book-meditations-ch1',
      bookTitle: 'Meditations',
      author: 'Marcus Aurelius',
      text: 'You have power over your mind - not outside events.',
      annotation: 'Read this the week everything felt out of control.',
      dateCreated: '2026-05-01',
    })
  })

  it('carries a bare highlight with no annotation as an empty string, not null', async () => {
    const highlights = await parseKoboDatabase(loadFixtureBytes())
    const second = highlights.find((h) => h.bookmarkId === 'bm-2')
    expect(second?.annotation).toBe('')
  })

  it('reads a highlight from a second, unrelated book correctly — proves the join, not a fluke', async () => {
    const highlights = await parseKoboDatabase(loadFixtureBytes())
    const odyssey = highlights.find((h) => h.bookmarkId === 'bm-4')
    expect(odyssey?.bookTitle).toBe('The Odyssey')
    expect(odyssey?.author).toBe('Homer')
  })

  it('throws a legible KoboParseError for a file that is not a SQLite database at all', async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5])
    await expect(parseKoboDatabase(garbage)).rejects.toThrow(KoboParseError)
  })

  it('throws a legible KoboParseError for a valid SQLite file with no Bookmark table — the firmware-drift case', async () => {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    db.run('CREATE TABLE unrelated (id TEXT)')
    const bytes = db.export()
    db.close()

    await expect(parseKoboDatabase(bytes)).rejects.toThrow(/doesn't look like a KoboReader/)
  })
})
