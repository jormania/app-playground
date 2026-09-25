import type { ScoreInfo, SmfFile, SmfNote, TempoChange } from './smf'
import type { Finger } from './song'
import { child, childrenOf, parseXml, textOf, XmlError, type XmlElement } from './xml'

// A MusicXML reader (KEYPATH_TUTOR.md §9, "Songs from a score"): the score
// MuseScore exports, read into the same shape as a MIDI file, so an added
// score goes through the same steps (which part, split, fit, level). What a
// score says that MIDI can't comes along: the staves (a piano's two are the
// two hands), the printed finger numbers, and the bars as printed.
//
// Read: partwise scores; notes, chords, rests, backup/forward, voices, ties,
// grace notes (left out: too quick to wait for), cue notes (not played),
// tempo marks, time signatures, transposing instruments, repeats and first
// and second endings (written out in playing order). Not read: D.C., D.S.,
// Coda and Fine jumps (the bars play once, in order), ornaments, and
// dynamics (loud or soft isn't judged).

export class MusicXmlError extends Error {
  constructor(
    message: string,
    /** 'not-score': not MusicXML at all; 'unsupported': MusicXML this can't read. */
    readonly kind: 'not-score' | 'unsupported' = 'not-score',
  ) {
    super(message)
    this.name = 'MusicXmlError'
  }
}

/** Starts, after any byte-order mark and whitespace, like XML. */
export const looksLikeXml = (text: string) => /^\uFEFF?\s*</.test(text)

const TICKS_PER_QUARTER = 960
const DEFAULT_BPM = 120 // what MuseScore plays when a score has no tempo mark
/** Notes sound for 90% of their value, as in the starter pack, so repeated notes read as separate falling notes. */
const SOUNDING = 0.9
const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const EPS = 1e-6

/** A note as written in its bar, before the repeats are laid out. */
export interface Written {
  /** From the start of the bar, in quarter notes. */
  at: number
  length: number
  pitch: number
  staff: number
  voice: string
  tieStart: boolean
  tieStop: boolean
  finger?: Finger
}

export interface Bar {
  label: string
  notes: Written[]
  tempos: { at: number; bpm: number }[]
  /** How far the bar's content reaches, in quarter notes. */
  length: number
  /** The length its time signature gives it. */
  metre: number
  forward: boolean
  /** A backward repeat at its end: how many times the section is played, if the score says. */
  backward: { times: number | null } | null
  /** The ending this bar belongs to: which passes play it. */
  ending: number[] | null
}

export interface ReadPart {
  name: string
  staves: number
  bars: Bar[]
  /** The first time signature. */
  beats: number
  beatType: number
}

const num = (s: string, fallback = 0) => {
  const v = Number(s)
  return Number.isFinite(v) ? v : fallback
}

function fingerOf(note: XmlElement): Finger | undefined {
  for (const notations of childrenOf(note, 'notations')) {
    for (const technical of childrenOf(notations, 'technical')) {
      for (const f of childrenOf(technical, 'fingering')) {
        if (f.attrs.substitution === 'yes' || f.attrs.alternate === 'yes') continue
        const d = f.text.trim().match(/[1-5]/)
        if (d) return Number(d[0]) as Finger
      }
    }
  }
  return undefined
}

function readPart(part: XmlElement, name: string): ReadPart {
  let divisions = 1
  let staves = 1
  let transpose = 0
  let beats = 4
  let beatType = 4
  let first: { beats: number; beatType: number } | null = null
  let ending: number[] | null = null
  const bars: Bar[] = []
  for (const measure of childrenOf(part, 'measure')) {
    const bar: Bar = { label: measure.attrs.number ?? String(bars.length + 1), notes: [], tempos: [], length: 0, metre: 0, forward: false, backward: null, ending }
    let cursor = 0
    let lastStart = 0
    const reach = () => (bar.length = Math.max(bar.length, cursor))
    for (const el of measure.children) {
      switch (el.name) {
        case 'attributes': {
          const d = num(textOf(el, 'divisions'))
          if (d > 0) divisions = d
          const s = num(textOf(el, 'staves'))
          if (s > 0) staves = s
          const time = child(el, 'time')
          if (time && textOf(time, 'beats')) {
            // "3+2" beats add up.
            beats = textOf(time, 'beats').split('+').reduce((sum, b) => sum + num(b), 0) || 4
            beatType = num(textOf(time, 'beat-type'), 4) || 4
            first ??= { beats, beatType }
          }
          const tr = child(el, 'transpose')
          if (tr) transpose = num(textOf(tr, 'chromatic')) + 12 * num(textOf(tr, 'octave-change'))
          break
        }
        case 'note': {
          const grace = child(el, 'grace')
          const length = num(textOf(el, 'duration')) / divisions
          if (grace) break
          const isChord = !!child(el, 'chord')
          const at = isChord ? lastStart : cursor
          if (!isChord) {
            lastStart = cursor
            cursor += length
            reach()
          }
          const pitch = child(el, 'pitch')
          if (!pitch || child(el, 'cue') || length <= 0) break
          const step = STEP[textOf(pitch, 'step').toUpperCase()]
          if (step === undefined) break
          const midi = (num(textOf(pitch, 'octave'), 4) + 1) * 12 + step + Math.round(num(textOf(pitch, 'alter'))) + transpose
          const ties = childrenOf(el, 'tie').map((t) => t.attrs.type)
          bar.notes.push({
            at,
            length,
            pitch: midi,
            staff: Math.max(1, num(textOf(el, 'staff'), 1)),
            voice: textOf(el, 'voice') || '1',
            tieStart: ties.includes('start'),
            tieStop: ties.includes('stop'),
            finger: fingerOf(el),
          })
          break
        }
        case 'backup':
          cursor = Math.max(0, cursor - num(textOf(el, 'duration')) / divisions)
          break
        case 'forward':
          cursor += num(textOf(el, 'duration')) / divisions
          reach()
          break
        case 'direction':
        case 'sound': {
          const sound = el.name === 'sound' ? el : child(el, 'sound')
          const bpm = num(sound?.attrs.tempo ?? '')
          if (bpm > 0) bar.tempos.push({ at: cursor, bpm })
          break
        }
        case 'barline': {
          const repeat = child(el, 'repeat')
          if (repeat?.attrs.direction === 'forward') bar.forward = true
          if (repeat?.attrs.direction === 'backward') bar.backward = { times: repeat.attrs.times ? num(repeat.attrs.times) || null : null }
          const e = child(el, 'ending')
          if (e) {
            const numbers = (e.attrs.number ?? '').split(/[\s,]+/).map(Number).filter((x) => x > 0)
            if (e.attrs.type === 'start') {
              ending = numbers.length ? numbers : [1]
              bar.ending = ending
            } else ending = null // stop or discontinue: the ending closes with this bar
          }
          break
        }
      }
    }
    bar.metre = (beats * 4) / beatType
    bars.push(bar)
  }
  return { name, staves, bars, beats: first?.beats ?? beats, beatType: first?.beatType ?? beatType }
}

/**
 * The bars in playing order: repeats taken, each ending on its own pass. A
 * backward repeat plays its section `times` times (twice, or once more than
 * its highest ending when it's inside one).
 */
export function playingOrder(bars: readonly Pick<Bar, 'forward' | 'backward' | 'ending'>[]): number[] {
  const order: number[] = []
  const played = new Map<number, number>()
  let start = 0
  let pass = 1
  let wasEnding = false
  for (let i = 0; i < bars.length && order.length < bars.length * 16; ) {
    const b = bars[i]
    // Past the endings, a new section begins: its repeat goes back to here.
    if (wasEnding && !b.ending) {
      start = i
      pass = 1
    }
    wasEnding = !!b.ending
    if (b.forward && i !== start) {
      start = i
      pass = 1
    }
    if (b.ending && !b.ending.includes(pass)) {
      i++
      continue
    }
    order.push(i)
    if (b.backward) {
      const times = b.backward.times ?? (b.ending ? Math.max(...b.ending) + 1 : 2)
      const done = played.get(i) ?? 1
      if (done < times) {
        played.set(i, done + 1)
        pass = done + 1
        i = start
        wasEnding = false
        continue
      }
      pass = 1
      start = i + 1
      wasEnding = false
    }
    i++
  }
  return order
}

/** Read a MusicXML score (the text of a .musicxml file, or what an .mxl holds). */
export function parseMusicXml(text: string): SmfFile {
  let root: XmlElement
  try {
    root = parseXml(text)
  } catch (e) {
    throw new MusicXmlError(e instanceof XmlError ? e.message : 'Not XML')
  }
  if (root.name === 'score-timewise') throw new MusicXmlError('Timewise scores aren’t read', 'unsupported')
  if (root.name !== 'score-partwise') throw new MusicXmlError(`Not a score: <${root.name}>`)

  const names = new Map<string, string>()
  for (const sp of childrenOf(child(root, 'part-list'), 'score-part')) names.set(sp.attrs.id ?? '', textOf(sp, 'part-name'))
  const parts = childrenOf(root, 'part').map((p, i) => readPart(p, names.get(p.attrs.id ?? '') || `Part ${i + 1}`))
  if (parts.length === 0) throw new MusicXmlError('A score without parts', 'unsupported')
  return fileFromParts(parts, textOf(root, 'movement-title') || textOf(child(root, 'work'), 'work-title'))
}

/**
 * A score's parts, read bar by bar (from MusicXML here, or MuseScore's own
 * format in engine/mscx.ts), laid out in time: repeats in playing order, the
 * tempo map, tied notes joined, each note's printed bar and finger kept.
 */
export function fileFromParts(parts: readonly ReadPart[], title: string): SmfFile {
  // The repeats are the score's, written alike in every part: read from the first.
  const lead = parts[0].bars
  const order = playingOrder(lead)
  // A bar lasts as long as its longest part (a pickup is short in all of them).
  const barLength = lead.map((b, i) => {
    const content = Math.max(...parts.map((p) => p.bars[i]?.length ?? 0))
    return content > EPS ? content : b.metre
  })
  const barStart: number[] = []
  let q = 0
  for (const i of order) {
    barStart.push(q)
    q += barLength[i]
  }

  // The tempo map, in quarter notes: every tempo mark, in playing order.
  const marks: { q: number; bpm: number }[] = []
  order.forEach((i, k) => {
    for (const p of parts) for (const t of p.bars[i]?.tempos ?? []) marks.push({ q: barStart[k] + t.at, bpm: t.bpm })
  })
  marks.sort((a, b) => a.q - b.q)
  const tempo: { q: number; bpm: number; ms: number }[] = [{ q: 0, bpm: marks[0] && marks[0].q < EPS ? marks[0].bpm : DEFAULT_BPM, ms: 0 }]
  for (const m of marks) {
    const last = tempo[tempo.length - 1]
    if (Math.abs(m.bpm - last.bpm) < EPS) continue
    if (m.q - last.q < EPS) {
      last.bpm = m.bpm
      continue
    }
    tempo.push({ q: m.q, bpm: m.bpm, ms: last.ms + ((m.q - last.q) * 60000) / last.bpm })
  }
  const msAt = (at: number) => {
    let seg = tempo[0]
    for (const t of tempo) if (t.q <= at + EPS) seg = t
    return seg.ms + ((at - seg.q) * 60000) / seg.bpm
  }

  // The notes, part by part in playing order, tied notes joined into one.
  const notes: SmfNote[] = []
  const scoreParts: ScoreInfo['parts'] = {}
  parts.forEach((p, track) => {
    const made: { note: SmfNote; startQ: number; endQ: number }[] = []
    const open = new Map<string, (typeof made)[number]>()
    order.forEach((i, k) => {
      const bar = p.bars[i]
      if (!bar) return
      for (const w of [...bar.notes].sort((a, b) => a.at - b.at)) {
        const startQ = barStart[k] + w.at
        const endQ = startQ + w.length
        const tieKey = `${w.staff}:${w.voice}:${w.pitch}`
        const tied = w.tieStop ? open.get(tieKey) : undefined
        if (tied && Math.abs(tied.endQ - startQ) < EPS) {
          tied.endQ = endQ
          if (!w.tieStart) open.delete(tieKey)
          continue
        }
        const note: SmfNote = {
          track,
          channel: w.staff,
          pitch: w.pitch,
          velocity: 80,
          startTick: 0,
          endTick: 0,
          startMs: 0,
          endMs: 0,
          bar: k,
          ...(w.finger ? { finger: w.finger } : {}),
        }
        const entry = { note, startQ, endQ }
        made.push(entry)
        if (w.tieStart) open.set(tieKey, entry)
        else open.delete(tieKey)
      }
    })
    for (const { note, startQ, endQ } of made) {
      if (note.pitch < 0 || note.pitch > 127) continue
      note.startTick = Math.round(startQ * TICKS_PER_QUARTER)
      note.endTick = Math.round(endQ * TICKS_PER_QUARTER)
      note.startMs = msAt(startQ)
      note.endMs = note.startMs + (msAt(endQ) - note.startMs) * SOUNDING
      notes.push(note)
      scoreParts[`${track}:${note.channel}`] ??= { name: p.name, staff: note.channel, staves: p.staves }
    }
  })
  notes.sort((a, b) => a.startMs - b.startMs || a.pitch - b.pitch)

  const tempos: TempoChange[] = tempo.map((t) => ({ tick: Math.round(t.q * TICKS_PER_QUARTER), usPerQuarter: Math.round(60_000_000 / t.bpm) }))
  return {
    format: 1,
    ticksPerQuarter: TICKS_PER_QUARTER,
    tracks: parts.map((p, index) => ({ index, name: p.name })),
    notes,
    tempos,
    timeSignatures: [{ tick: 0, numerator: parts[0].beats, denominator: parts[0].beatType }],
    score: {
      title,
      barLabels: order.map((i) => lead[i].label),
      parts: scoreParts,
    },
  }
}
