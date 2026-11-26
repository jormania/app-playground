/**
 * A CSV reader for bank statements (Release 2, experimental). RFC 4180: quoted fields, doubled
 * quotes, delimiters and line breaks inside quotes, CRLF, LF or a lone CR, a UTF-8 byte-order
 * mark. The delimiter (comma, semicolon or tab) is read from the header line: the one that splits
 * it into the most columns; a tie is refused rather than guessed.
 *
 * Malformed syntax is never smoothed over into plausible columns: text after a closing quote marks
 * that row malformed (reported by the statement reader), and a quote left open on the last line is
 * reported as a row cut short. A quote left open earlier would swallow every later line, so the
 * file is refused.
 *
 * Runs in the browser: the file never leaves the device.
 */

/** Files above this are refused, not read: a year of daily transactions is far smaller. In bytes. */
export const MAX_BYTES = 5 * 1024 * 1024
export const MAX_ROWS = 50_000

export interface CsvRow {
  /** 1-based line number in the file where the row starts (header = line 1). */
  line: number
  cells: string[]
  /** Set when the row's syntax is broken: the statement reader reports it and reads nothing from it. */
  error?: string
}

export interface CsvTable {
  header: string[]
  rows: CsvRow[]
  delimiter: ',' | ';' | '\t'
}

export class CsvError extends Error {}

const byteLength = (s: string) => new TextEncoder().encode(s).length

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
  const counts = options.map((d) => ({ d, n: count(d) })).sort((a, b) => b.n - a.n)
  if (counts[0].n > 0 && counts[0].n === counts[1].n) {
    throw new CsvError(`The first line splits equally by "${counts[0].d === '\t' ? 'tab' : counts[0].d}" and "${counts[1].d === '\t' ? 'tab' : counts[1].d}", so the delimiter can't be told. Export the file again, or save it with one delimiter.`)
  }
  return counts[0].n > 0 ? counts[0].d : ','
}

export function parseCsv(text: string): CsvTable {
  if (text.length > MAX_BYTES || byteLength(text) > MAX_BYTES) throw new CsvError(`That file is larger than ${MAX_BYTES / 1024 / 1024} MB. Export a shorter period and try again.`)
  const src = text.replace(/^\uFEFF/, '')
  if (!src.trim()) throw new CsvError('That file is empty.')
  const firstBreak = src.search(/\r\n|\r|\n/)
  const delimiter = sniff(firstBreak === -1 ? src : src.slice(0, firstBreak))
  const records: CsvRow[] = []
  let cells: string[] = []
  let field = ''
  let quoted = false
  /** Just past a closing quote: only a delimiter or a line break may follow. */
  let closed = false
  let error: string | undefined
  let line = 1
  let startLine = 1
  const endRecord = () => {
    cells.push(field)
    records.push(error ? { line: startLine, cells, error } : { line: startLine, cells })
    if (records.length > MAX_ROWS + 1) throw new CsvError(`That file has more than ${MAX_ROWS.toLocaleString('en-US')} rows. Export a shorter period and try again.`)
    cells = []
    field = ''
    closed = false
    error = undefined
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true }
      } else {
        if (ch === '\n' || (ch === '\r' && src[i + 1] !== '\n')) line++
        field += ch
      }
      continue
    }
    if (ch === '"' && field === '' && !closed) { quoted = true; continue }
    if (ch === delimiter) { cells.push(field); field = ''; closed = false; continue }
    if (ch === '\r' && src[i + 1] === '\n') continue
    if (ch === '\n' || ch === '\r') {
      endRecord()
      line++
      startLine = line
      continue
    }
    if (closed && !error) error = 'Text after a closing quote: the row is malformed, so nothing is read from it.'
    field += ch
  }
  if (quoted) {
    // An open quote on the last line is a row cut short; earlier, it would have swallowed later lines.
    if (line !== startLine) throw new CsvError(`A quoted value starting on line ${startLine} is never closed: the file may be cut short or damaged.`)
    error = 'A quoted value is never closed: the row looks cut short.'
  }
  if (field !== '' || cells.length || quoted) endRecord()
  const nonEmpty = records.filter((r) => r.error || r.cells.some((c) => c.trim() !== ''))
  if (!nonEmpty.length) throw new CsvError('That file is empty.')
  const [head, ...rows] = nonEmpty
  if (head.error) throw new CsvError(`The header line is malformed: ${head.error}`)
  return { header: head.cells.map((h) => h.trim()), rows, delimiter }
}
