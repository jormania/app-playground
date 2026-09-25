import { fileFromParts, type Bar, type ReadPart, type Written } from './musicxml'
import type { SmfFile } from './smf'
import type { Finger } from './song'
import { child, childrenOf, parseXml, textOf, XmlError, type XmlElement } from './xml'

// MuseScore's own format (KEYPATH_TUTOR.md §9, "Songs from MuseScore"): the
// .mscx score inside an .mscz, as MuseScore 2, 3 and 4 write it. Read into
// the same bars as a MusicXML score (engine/musicxml.ts), which lays them
// out in time; so both formats get the same repeats, ties, tempo and bars.
//
// What differs by version, and is read:
//   voices   MuseScore 3–4 give each its own <voice>; MuseScore 2 writes
//            voice 1, then <tick> back to the bar's start and <track> on
//            the chords of the next.
//   tuplets  3–4: a <Tuplet> before its notes and <endTuplet/> after; 2: a
//            <Tuplet id> the notes name.
//   ties     3–4: <Spanner type="Tie"> with a <next> on the first note; 2: a
//            <Tie> in it. Either way the next note of that pitch is joined on.
//   endings  3–4: <Spanner type="Volta"> saying how many bars it lasts;
//            2: <Volta id> closed by an <endSpanner id>.
// Left out, as for MusicXML: grace notes, jumps (D.C., D.S., Coda, Fine),
// ornaments, dynamics. Tablature and percussion staves are skipped.

export class MscxError extends Error {
  constructor(
    message: string,
    readonly kind: 'not-score' | 'unsupported' = 'not-score',
  ) {
    super(message)
    this.name = 'MscxError'
  }
}

/** Quarter notes in each note value. */
const VALUE: Record<string, number> = { long: 16, breve: 8, whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25, '32nd': 0.125, '64th': 0.0625, '128th': 0.03125, '256th': 0.015625 }
const GRACE = /^(appoggiatura|acciaccatura|grace\d+(after)?)$/

const num = (s: string | undefined, fallback = 0) => {
  const v = Number(s)
  return Number.isFinite(v) ? v : fallback
}
/** "3/4" as quarter notes: 3. */
const fraction = (s: string | undefined): number | null => {
  const m = s?.trim().match(/^(-?\d+)\/(\d+)$/)
  return m && Number(m[2]) ? (Number(m[1]) / Number(m[2])) * 4 : null
}
const endingsOf = (s: string) => s.split(/[\s,]+/).map(Number).filter((x) => x > 0)

function fingerOf(note: XmlElement): Finger | undefined {
  for (const f of childrenOf(note, 'Fingering')) {
    const d = (textOf(f, 'text') || f.text).match(/[1-5]/)
    if (d) return Number(d[0]) as Finger
  }
  return undefined
}

/** Does this note start a tie to the next? */
const tiesOn = (note: XmlElement) => !!child(note, 'Tie') || childrenOf(note, 'Spanner').some((s) => s.attrs.type === 'Tie' && !!child(s, 'next'))

interface VoltaMark {
  bar: number
  endings: number[]
  /** Bars it covers, when the file says (3–4). */
  length?: number
  /** MuseScore 2: the id its <endSpanner> will close. */
  id?: string
}

/** One staff read bar by bar: its notes and, for the first staff, the score's repeats and endings. */
function readStaff(staff: XmlElement, staffNumber: number, division: number): { bars: Bar[]; voltas: VoltaMark[] } {
  const bars: Bar[] = []
  const voltas: VoltaMark[] = []
  const openVoltas = new Map<string, VoltaMark>()
  let metre = 4
  let startQ = 0 // where this bar starts, for MuseScore 2's absolute <tick>
  let numbered = 0
  const tupletsById = new Map<string, number>()
  for (const measure of childrenOf(staff, 'Measure')) {
    const index = bars.length
    const irregular = child(measure, 'irregular')?.text.trim() === '1'
    for (const ts of measure.children.flatMap((c) => (c.name === 'voice' ? c.children : [c])).filter((c) => c.name === 'TimeSig')) {
      const n = num(textOf(ts, 'sigN'), 4)
      const d = num(textOf(ts, 'sigD'), 4)
      if (n > 0 && d > 0) metre = (n * 4) / d
    }
    const length = fraction(measure.attrs.len) ?? metre
    // Printed numbers skip an irregular bar (a pickup is bar 0); MuseScore 2 writes its own.
    const label = measure.attrs.number ?? String(irregular ? numbered : ++numbered)
    const endRepeat = child(measure, 'endRepeat')
    const bar: Bar = {
      label,
      notes: [],
      tempos: [],
      length: 0,
      metre: length,
      forward: !!child(measure, 'startRepeat'),
      backward: endRepeat ? { times: num(endRepeat.text.trim()) || null } : null,
      ending: null,
    }
    let sawContent = false
    const readVoice = (elements: XmlElement[], voice: string) => {
      let cursor = 0
      const tuplets: number[] = []
      for (const el of elements) {
        switch (el.name) {
          case 'Tempo': {
            const qps = num(textOf(el, 'tempo'))
            if (qps > 0) bar.tempos.push({ at: cursor, bpm: qps * 60 })
            break
          }
          case 'Tuplet': {
            const normal = num(textOf(el, 'normalNotes'))
            const actual = num(textOf(el, 'actualNotes'))
            if (!(normal > 0 && actual > 0)) break
            if (el.attrs.id !== undefined) tupletsById.set(el.attrs.id, normal / actual)
            else tuplets.push(normal / actual)
            break
          }
          case 'endTuplet':
            tuplets.pop()
            break
          case 'tick': // MuseScore 2: a jump to a point in the score, in ticks
            cursor = num(el.text) / division - startQ
            break
          case 'location': {
            const f = fraction(textOf(el, 'fractions'))
            if (f !== null) cursor += f
            break
          }
          case 'Spanner':
            if (el.attrs.type === 'Volta' && child(el, 'Volta')) {
              const measures = num(textOf(child(child(el, 'next'), 'location'), 'measures'), 1)
              voltas.push({ bar: index, endings: endingsOf(textOf(child(el, 'Volta'), 'endings')), length: Math.max(1, measures) })
            }
            break
          case 'Volta': // MuseScore 2
            if (el.attrs.id !== undefined) {
              const mark = { bar: index, endings: endingsOf(textOf(el, 'endings')), id: el.attrs.id }
              voltas.push(mark)
              openVoltas.set(el.attrs.id, mark)
            }
            break
          case 'endSpanner': {
            const mark = openVoltas.get(el.attrs.id ?? '')
            if (mark) {
              // Closed before this bar's notes: the ending was the bars before; after them: this bar too.
              mark.length = Math.max(1, (sawContent ? index + 1 : index) - mark.bar)
              openVoltas.delete(el.attrs.id ?? '')
            }
            break
          }
          case 'Chord':
          case 'Rest': {
            sawContent = true
            if (el.children.some((c) => GRACE.test(c.name))) break
            const type = textOf(el, 'durationType')
            let value: number
            if (type === 'measure') value = fraction(textOf(el, 'duration')) ?? fraction(`${child(el, 'duration')?.attrs.z}/${child(el, 'duration')?.attrs.n}`) ?? length
            else {
              const base = VALUE[type] ?? 1
              const dots = num(textOf(el, 'dots'))
              value = base * (2 - 1 / 2 ** dots)
              const ref = child(el, 'Tuplet')
              const ratio = ref && ref.children.length === 0 ? (tupletsById.get(ref.text.trim()) ?? 1) : 1
              value *= ratio * tuplets.reduce((a, b) => a * b, 1)
            }
            const track = textOf(el, 'track')
            const v = track ? String(num(track) % 4) : voice
            if (el.name === 'Chord') {
              for (const n of childrenOf(el, 'Note')) {
                const pitch = num(textOf(n, 'pitch'), -1)
                if (pitch < 0) continue
                const w: Written = { at: cursor, length: value, pitch, staff: staffNumber, voice: v, tieStart: tiesOn(n), tieStop: true, finger: fingerOf(n) }
                bar.notes.push(w)
              }
            }
            cursor += value
            bar.length = Math.max(bar.length, cursor)
            break
          }
        }
      }
    }
    const voices = childrenOf(measure, 'voice')
    if (voices.length) voices.forEach((v, i) => readVoice(v.children, String(i)))
    else readVoice(measure.children, '0')
    bars.push(bar)
    startQ += length
  }
  return { bars, voltas }
}

/** Read a MuseScore score (the .mscx text, as it is inside an .mscz). */
export function parseMscx(text: string): SmfFile {
  let root: XmlElement
  try {
    root = parseXml(text)
  } catch (e) {
    throw new MscxError(e instanceof XmlError ? e.message : 'Not XML')
  }
  if (root.name !== 'museScore') throw new MscxError(`Not a MuseScore file: <${root.name}>`)
  const version = num(root.attrs.version)
  if (version && version < 2) throw new MscxError(`MuseScore ${root.attrs.version} files aren’t read`, 'unsupported')
  const score = child(root, 'Score')
  if (!score) throw new MscxError('A MuseScore file without a score', 'unsupported')
  const division = num(textOf(score, 'Division'), 480) || 480

  const meta = (name: string) => childrenOf(score, 'metaTag').find((m) => m.attrs.name === name)?.text.trim() ?? ''
  const titleText = childrenOf(score, 'Staff')
    .flatMap((s) => childrenOf(s, 'VBox'))
    .flatMap((b) => childrenOf(b, 'Text'))
    .find((t) => /^title$/i.test(textOf(t, 'style')))
  const title = meta('workTitle') || meta('movementTitle') || (titleText ? textOf(titleText, 'text').replace(/<[^>]*>/g, '') : '')

  // Each instrument's staves, by id; tablature and percussion staves are left out.
  const staffById = new Map(childrenOf(score, 'Staff').map((s) => [s.attrs.id ?? '', s]))
  const instruments = childrenOf(score, 'Part')
    .map((part, i) => {
      const staves = childrenOf(part, 'Staff').filter((s) => (child(s, 'StaffType')?.attrs.group ?? 'pitched') === 'pitched')
      const name = textOf(part, 'trackName') || textOf(child(part, 'Instrument'), 'longName') || textOf(child(part, 'Instrument'), 'trackName') || `Part ${i + 1}`
      return { name, ids: staves.map((s) => s.attrs.id ?? '').filter((id) => staffById.has(id)) }
    })
    .filter((p) => p.ids.length > 0)
  if (instruments.length === 0) throw new MscxError('A score without staves to play', 'unsupported')

  // The score's repeats and endings are on its first staff.
  const read = instruments.map((p) => p.ids.map((id, k) => readStaff(staffById.get(id)!, k + 1, division)))
  const first = read[0][0]
  for (const v of first.voltas) {
    for (let b = v.bar; b < v.bar + (v.length ?? 1) && b < first.bars.length; b++) first.bars[b].ending = v.endings.length ? v.endings : [1]
  }

  // Each instrument as one part, its staves' notes together (the staff says which hand).
  const parts: ReadPart[] = instruments.map((p, i) => {
    const staves = read[i]
    const bars: Bar[] = staves[0].bars.map((b, m) => ({
      ...b,
      notes: staves.flatMap((s) => s.bars[m]?.notes ?? []),
      tempos: staves.flatMap((s) => s.bars[m]?.tempos ?? []),
      length: Math.max(...staves.map((s) => s.bars[m]?.length ?? 0)),
      ...(i === 0 ? {} : { forward: false, backward: null, ending: null }),
    }))
    const firstMetre = childrenOf(staffById.get(p.ids[0])!, 'Measure')
      .flatMap((m) => m.children.flatMap((c) => (c.name === 'voice' ? c.children : [c])))
      .find((c) => c.name === 'TimeSig')
    return { name: p.name, staves: p.ids.length, bars, beats: num(textOf(firstMetre, 'sigN'), 4) || 4, beatType: num(textOf(firstMetre, 'sigD'), 4) || 4 }
  })
  // The first part carries the score's repeats (fileFromParts reads them from there).
  parts[0] = { ...parts[0], bars: parts[0].bars.map((b, m) => ({ ...b, forward: first.bars[m].forward, backward: first.bars[m].backward, ending: first.bars[m].ending })) }
  return fileFromParts(parts, title)
}
