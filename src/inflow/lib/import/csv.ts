/**
 * A CSV reader for bank statements (Release 2, experimental). RFC 4180: quoted fields, doubled
 * quotes, commas and line breaks inside quotes, CRLF or LF, a UTF-8 byte-order mark. The
 * delimiter (comma, semicolon or tab) is read from the header line, the one line it can be
 * judged from without guessing: the delimiter that splits it into the most columns.
 *
 * Runs in the browser: the file never leaves the device.
 */

/** Files above this are refused, not read: a year of daily transactions is far smaller. */
export const MAX_BYTES = 5 * 1024 * 1024
export const MAX_ROWS = 50_000

export interface CsvTable {
  header: string[]
  /** Data rows, each with its 1-based line number in the file (header = line 1). */
  rows: { line: number; cells: string[] }[]
  delimiter: ',' | ';' | '\t'
}

export class CsvError extends Error {}

function sniff(headerLine: string): CsvTable['delimiter'] {
  const count = (d: string) => {
    let n = 0
    let quoted = false
    for (const ch of headerLine) {
      if (ch === '"') quoted = !quoted
      else if (ch === d && !quoted) n++
    }
    return n
  }
  const options: CsvTable['delimiter'][] = [',', ';', '\t']
  return options.reduce((best, d) => (count(d) > count(best) ? d : best), ',')
}

export function parseCsv(text: string): CsvTable {
  if (text.length > MAX_BYTES) throw new CsvError(`That file is larger than ${MAX_BYTES / 1024 / 1024} MB. Export a shorter period and try again.`)
  const src = text.replace(/^\uFEFF/, '')
  if (!src.trim()) throw new CsvError('That file is empty.')
  const firstBreak = src.search(/\r?\n/)
  const delimiter = sniff(firstBreak === -1 ? src : src.slice(0, firstBreak))
  const records: { line: number; cells: string[] }[] = []
  let cells: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let startLine = 1
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else {
        if (ch === '\n') line++
        field += ch
      }
      continue
    }
    if (ch === '"' && field === '') { quoted = true; continue }
    if (ch === delimiter) { cells.push(field); field = ''; continue }
    if (ch === '\r' && src[i + 1] === '\n') continue
    if (ch === '\n') {
      cells.push(field)
      records.push({ line: startLine, cells })
      if (records.length > MAX_ROWS + 1) throw new CsvError(`That file has more than ${MAX_ROWS.toLocaleString('en-US')} rows. Export a shorter period and try again.`)
      cells = []
      field = ''
      line++
      startLine = line
      continue
    }
    field += ch
  }
  if (quoted) throw new CsvError(`A quoted value starting on line ${startLine} is never closed: the file may be cut short or damaged.`)
  if (field !== '' || cells.length) { cells.push(field); records.push({ line: startLine, cells }) }
  const nonEmpty = records.filter((r) => r.cells.some((c) => c.trim() !== ''))
  if (!nonEmpty.length) throw new CsvError('That file is empty.')
  const [head, ...rows] = nonEmpty
  return { header: head.cells.map((h) => h.trim()), rows, delimiter }
}
