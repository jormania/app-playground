// Builds src/silva/lib/fixtures/kobo-sample.sqlite — a miniature, checked-in
// KoboReader.sqlite for lib/kobo.ts's tests to parse for real, per SILVA.md's
// "fixture-based tests using a checked-in miniature .sqlite" requirement.
//
// Run with `npm run gen:kobo-fixture`. Re-run only if the assumed Kobo schema
// (Bookmark/content columns) needs to change.
//
// Includes bm-3: a position-only bookmark (no Text) — proves the parser's
// "filters out position-only bookmarks with no text" rule against a real
// row, not just a hand-built JS object.
import initSqlJs from 'sql.js'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '../src/silva/lib/fixtures/kobo-sample.sqlite')

async function main() {
  const SQL = await initSqlJs()
  const db = new SQL.Database()

  db.run(`
    CREATE TABLE content (
      ContentID TEXT PRIMARY KEY,
      ContentType TEXT,
      BookTitle TEXT,
      Title TEXT,
      Attribution TEXT
    );
    CREATE TABLE Bookmark (
      BookmarkID TEXT PRIMARY KEY,
      VolumeID TEXT,
      Text TEXT,
      Annotation TEXT,
      DateCreated TEXT,
      Type TEXT,
      Hidden TEXT
    );
  `)

  db.run(`
    INSERT INTO content (ContentID, ContentType, BookTitle, Title, Attribution) VALUES
      ('book-meditations',     '6', NULL,             'Meditations', 'Marcus Aurelius'),
      ('book-meditations-ch1', '9', 'Meditations',     'Book I',      'Marcus Aurelius'),
      ('book-odyssey',         '6', NULL,             'The Odyssey', 'Homer'),
      ('book-odyssey-ch1',     '9', 'The Odyssey',     'Book I',      'Homer');
  `)

  db.run(`
    INSERT INTO Bookmark (BookmarkID, VolumeID, Text, Annotation, DateCreated, Type, Hidden) VALUES
      ('bm-1', 'book-meditations-ch1', 'You have power over your mind - not outside events.', 'Read this the week everything felt out of control.', '2026-05-01T12:00:00.000', 'highlight', 'false'),
      ('bm-2', 'book-meditations-ch1', 'Waste no more time arguing what a good man should be. Be one.', NULL, '2026-05-02T09:30:00.000', 'highlight', 'false'),
      ('bm-3', 'book-meditations-ch1', NULL, NULL, '2026-05-02T09:31:00.000', 'bookmark', 'false'),
      ('bm-4', 'book-odyssey-ch1', 'Tell me, Muse, of the man of many ways.', NULL, '2026-06-10T20:00:00.000', 'highlight', 'false');
  `)

  const bytes = db.export()
  db.close()
  await writeFile(OUT_PATH, Buffer.from(bytes))
  console.log(`Wrote ${OUT_PATH} (${bytes.length} bytes)`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
