/**
 * Kobo highlight parsing. Silva reads `.kobo/KoboReader.sqlite` entirely in
 * the browser via `sql.js` (SQLite via WASM) — nothing uploaded, no account
 * (SILVA.md "Kobo import").
 *
 * Kobo's schema is not a public API and has shifted across firmware
 * versions (SILVA.md's explicit "known risk"), so this queries
 * `PRAGMA table_info` first and only ever selects columns actually present,
 * rather than assuming a fixed shape. A file missing the load-bearing
 * columns fails with a legible `KoboParseError`, never a silent empty import.
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
// The wasm loading strategy differs by environment: a real browser needs an
// explicit servable URL, since Vite rewrites the module's on-disk location —
// sql.js's own "look next to me" default breaks after bundling. But under
// Vitest (Node, no HTTP server for that URL to resolve against) sql.js's
// built-in Node fs-based default is what actually works; overriding
// `locateFile` there just points it at an unfetchable string. `VITEST` is
// set by the test runner itself, so this branch is not a guess.
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const isTestEnv = typeof process !== 'undefined' && Boolean(process.env?.VITEST)

let sqlJsPromise: Promise<SqlJsStatic> | null = null

function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = isTestEnv ? initSqlJs() : initSqlJs({ locateFile: () => sqlWasmUrl })
  }
  return sqlJsPromise
}

export class KoboParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KoboParseError'
  }
}

export interface KoboHighlight {
  bookmarkId: string
  volumeId: string
  bookTitle: string
  author: string
  text: string
  annotation: string
  /** ISO date (YYYY-MM-DD), or null if Kobo's DateCreated column is absent
   *  or unparseable. */
  dateCreated: string | null
}

function tableColumns(db: Database, table: string): Set<string> {
  let result
  try {
    result = db.exec(`PRAGMA table_info("${table}")`)
  } catch {
    return new Set()
  }
  if (!result.length) return new Set()
  const nameIndex = result[0].columns.indexOf('name')
  return new Set(result[0].values.map((row) => String(row[nameIndex])))
}

/** Kobo stores e.g. "2026-05-01T12:34:56.000" — the date part is all Silva
 *  needs (Things' `encountered` is a plain date, not a datetime). */
function normalizeKoboDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

const REQUIRED_BOOKMARK_COLUMNS = ['BookmarkID', 'VolumeID', 'Text']

/**
 * Parses a `KoboReader.sqlite` byte array into highlights. Filters out
 * position-only bookmarks (no `Text`) — those aren't things, they're
 * reading-position markers. Never throws for a merely sparse/unusual schema;
 * only for one missing the columns a highlight can't exist without.
 */
export async function parseKoboDatabase(bytes: Uint8Array): Promise<KoboHighlight[]> {
  const SQL = await loadSqlJs()

  let db: Database
  try {
    db = new SQL.Database(bytes)
  } catch {
    throw new KoboParseError('This file could not be read as a SQLite database.')
  }

  try {
    const bookmarkColumns = tableColumns(db, 'Bookmark')
    const missing = REQUIRED_BOOKMARK_COLUMNS.filter((c) => !bookmarkColumns.has(c))
    if (missing.length > 0) {
      throw new KoboParseError(
        `This doesn't look like a KoboReader.sqlite file, or its format has changed (missing: ${missing.join(', ')}).`,
      )
    }

    const contentColumns = tableColumns(db, 'content')
    const hasAnnotation = bookmarkColumns.has('Annotation')
    const hasDateCreated = bookmarkColumns.has('DateCreated')
    const hasBookTitle = contentColumns.has('BookTitle')
    const hasTitle = contentColumns.has('Title')
    const hasAttribution = contentColumns.has('Attribution')

    // A chapter row's BookTitle names its parent book; a bare book row only
    // has Title. Prefer BookTitle when non-empty, fall back to Title.
    const titleExpr = hasBookTitle && hasTitle
      ? 'COALESCE(NULLIF(c.BookTitle, \'\'), c.Title)'
      : hasBookTitle ? 'c.BookTitle' : hasTitle ? 'c.Title' : '\'\''

    const sql = `
      SELECT
        b.BookmarkID as bookmarkId,
        b.VolumeID as volumeId,
        ${titleExpr} as bookTitle,
        ${hasAttribution ? 'c.Attribution' : '\'\''} as author,
        b.Text as text,
        ${hasAnnotation ? 'b.Annotation' : '\'\''} as annotation,
        ${hasDateCreated ? 'b.DateCreated' : 'NULL'} as dateCreated
      FROM Bookmark b
      LEFT JOIN content c ON c.ContentID = b.VolumeID
      WHERE b.Text IS NOT NULL AND TRIM(b.Text) != ''
    `

    const result = db.exec(sql)
    if (!result.length) return []

    const { columns, values } = result[0]
    return values
      .map((row) => {
        const record: Record<string, unknown> = {}
        columns.forEach((col, i) => { record[col] = row[i] })
        return {
          bookmarkId: String(record.bookmarkId ?? ''),
          volumeId: String(record.volumeId ?? ''),
          bookTitle: String(record.bookTitle ?? '').trim() || 'Untitled',
          author: String(record.author ?? ''),
          text: String(record.text ?? ''),
          annotation: String(record.annotation ?? ''),
          dateCreated: normalizeKoboDate(record.dateCreated),
        }
      })
      .filter((h) => h.bookmarkId && h.text)
  } finally {
    db.close()
  }
}
