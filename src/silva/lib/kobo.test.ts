import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import initSqlJs from 'sql.js'
import { parseKoboDatabase, koboLocator, KoboParseError } from './kobo'

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
      // The fixture's content table has no ISBN column — the feature-
      // detected path again, and the reason a cover stays optional.
      isbn: null,
      // This fixture predates Kobo's ContentID/ChapterProgress columns, so
      // the locator has nothing to read — the feature-detected path.
      locator: '',
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

// `Locator` is documented as "chapter, page, timestamp" and was empty on
// every imported highlight: the importer read VolumeID (the book) and never
// ContentID (the chapter the highlight actually points into).
describe('koboLocator', () => {
  it('prefers the chapter\'s own title', () => {
    expect(koboLocator('Book I', 'Meditations', 0.42)).toBe('Book I')
  })

  it('falls back to a percentage when the chapter names nothing useful', () => {
    expect(koboLocator('', 'Meditations', 0.63)).toBe('63% in')
    expect(koboLocator(null, 'Meditations', 0.05)).toBe('5% in')
  })

  // A chapter row that repeats the book, or is named after the file on
  // disk, locates nothing — both are common in real EPUBs.
  it('refuses a chapter title that is the book, or machinery', () => {
    expect(koboLocator('Meditations', 'Meditations', 0.5)).toBe('50% in')
    expect(koboLocator('index_split_014.html', 'Meditations', 0.5)).toBe('50% in')
    expect(koboLocator('part0007.xhtml', 'Meditations', 0.5)).toBe('50% in')
  })

  it('gives up rather than print a nonsense position', () => {
    expect(koboLocator('', 'Meditations', null)).toBe('')
    expect(koboLocator('', 'Meditations', 'not a number')).toBe('')
    expect(koboLocator('', 'Meditations', 0)).toBe('')
    expect(koboLocator('', 'Meditations', 1.4)).toBe('')
  })
})

describe('parseKoboDatabase — chapter locators', () => {
  async function dbWithChapters(): Promise<Uint8Array> {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    db.run(`
      CREATE TABLE content (ContentID TEXT, BookTitle TEXT, Title TEXT, Attribution TEXT, ISBN TEXT);
      CREATE TABLE Bookmark (BookmarkID TEXT, VolumeID TEXT, ContentID TEXT, Text TEXT, Annotation TEXT, DateCreated TEXT, ChapterProgress REAL);
      INSERT INTO content VALUES ('book-1', NULL, 'Meditations', 'Marcus Aurelius', '978-0-14-044933-4');
      INSERT INTO content VALUES ('book-1!ch2', 'Meditations', 'Book II', 'Marcus Aurelius', '978-0-14-044933-4');
      INSERT INTO content VALUES ('book-1!ch9', 'Meditations', 'index_split_009.html', 'Marcus Aurelius', '');
      INSERT INTO Bookmark VALUES ('bm-a', 'book-1', 'book-1!ch2', 'A passage.', '', '2026-05-01T12:00:00.000', 0.42);
      INSERT INTO Bookmark VALUES ('bm-b', 'book-1', 'book-1!ch9', 'Another passage.', '', '2026-05-02T12:00:00.000', 0.63);
    `)
    const bytes = db.export()
    db.close()
    return bytes
  }

  it('locates a highlight by the chapter Kobo names, still resolving the book', async () => {
    const highlights = await parseKoboDatabase(await dbWithChapters())
    const a = highlights.find((h) => h.bookmarkId === 'bm-a')
    expect(a?.locator).toBe('Book II')
    expect(a?.bookTitle).toBe('Meditations')
    expect(a?.author).toBe('Marcus Aurelius')
  })

  // An exact key for the cover lookup — a title match would happily return
  // the wrong edition of the wrong "Meditations" (lib/bookCover.ts).
  it('reads the book\'s ISBN, normalised', async () => {
    const highlights = await parseKoboDatabase(await dbWithChapters())
    expect(highlights.find((h) => h.bookmarkId === 'bm-a')?.isbn).toBe('9780140449334')
  })

  it('falls back to the chapter progress when the chapter is named after a file', async () => {
    const highlights = await parseKoboDatabase(await dbWithChapters())
    expect(highlights.find((h) => h.bookmarkId === 'bm-b')?.locator).toBe('63% in')
  })
})
