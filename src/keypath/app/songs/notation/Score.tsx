import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { NoteResult, Practice, Song, SongNote } from '../../../engine'
import { BigScore, ScoreStrip, stepOf } from '../ScoreStrip'
import { barTimesOf, notationBars, type Clef, type NotationBar, type NotationEvent } from './model'
import styles from './score.module.css'

// The music, engraved (KEYPATH_TUTOR.md §9, "Release 5"): KeyPath's notes as a
// real score, drawn by VexFlow (loaded only when a score is on screen). Two to
// four bars a line, as many as the width allows at a readable size; the bar
// being played tinted, its number above it; the notes to play in a quiet
// accent; a playhead; a wrong key written in red where it would be. Where the
// engraver can't run (no canvas, as in the tests) the hand-drawn strip
// (ScoreStrip.tsx) stands in.

type VF = typeof import('vexflow')

export interface ScoreHandle {
  /** Move the playhead to this time of the song (song ms). Called every frame; never re-renders React. */
  setTime(songMs: number): void
}

export interface ScoreProps {
  song: Pick<Song, 'barTimes' | 'bpm' | 'beatsPerBar' | 'barLabels'>
  /** The song's own notes for the hands practised (whole song, its own times and ids). */
  notes: readonly SongNote[]
  practice: Practice
  /** The bar being played, or to start from. */
  bar: number
  /** The notes to play now (or sounding, while she listens), by id. */
  now: ReadonlySet<number>
  results: ReadonlyMap<number, NoteResult['outcome']>
  /** Keys just pressed that were wrong. */
  wrong?: ReadonlySet<number>
  /** The bars being played [from, to), when it's a part of the song: the rest is drawn quieter. */
  focus?: { from: number; to: number } | null
  /** `big`: the written view, the score is the screen. `strip`: a line above the falling notes. */
  size: 'big' | 'strip'
  /** At most this many bars a line (four, unless said). */
  barsPerLine?: number
  /** Keep the whole piece on one page when it can be read at all (a short tune, seen whole before it starts). */
  whole?: boolean
  /** The playhead follows the clock (`setTime`), or sits at the notes to play now. */
  follow?: 'time' | 'now'
  /** Ms a quarter lasts, for the hand-drawn stand-in. */
  beatMs: number
  ariaLabel: string
}

/** Whether VexFlow can measure and draw here: it needs a 2D canvas and web fonts. */
export function canEngrave(): boolean {
  if (typeof document === 'undefined' || !('fonts' in document)) return false
  try {
    return !!document.createElement('canvas').getContext('2d')
  } catch {
    return false
  }
}

let vexflow: Promise<VF> | null = null
/** The engraver and its music font, once, the first time a score is drawn. */
function loadVexFlow(): Promise<VF> {
  vexflow ??= import('vexflow/bravura').then(
    async (m) => {
      await document.fonts.load('30px Bravura').catch(() => undefined)
      return m as unknown as VF
    },
    (e: unknown) => {
      // Offline before it was ever fetched: the simple staff for now, and another try next time.
      vexflow = null
      throw e
    },
  )
  return vexflow
}

const NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
const keyOf = (pitch: number) => `${NAMES[((pitch % 12) + 12) % 12]}/${Math.floor(pitch / 12) - 1}`
/** VexFlow's duration and dots for each written length, in quarter notes. */
const DURATION: Record<number, [string, number]> = { 4: ['w', 0], 3: ['h', 1], 2: ['h', 0], 1.5: ['q', 1], 1: ['q', 0], 0.75: ['8', 1], 0.5: ['8', 0], 0.25: ['16', 0] }
const REST_KEY: Record<Clef, string> = { treble: 'b/4', bass: 'd/3' }
/** VexFlow's staff line for a pitch: 1 the bottom line, a half per step; middle C is 0 in the treble, 6 in the bass. */
const lineOf = (pitch: number, clef: Clef) => stepOf(pitch) / 2 + (clef === 'bass' ? 6 : 0)
/** A metre as written: 4/4, 3/8 or 6/16, from quarters in the bar. */
const timeSignature = (q: number) => (Number.isInteger(q) ? `${q}/4` : Number.isInteger(q * 2) ? `${q * 2}/8` : `${q * 4}/16`)

/** Units of the drawing: VexFlow's own, a staff space being 10. */
const STAFF_GAP = 62 // from the treble's bottom line to the bass's top line
const TOP = 34 // room above the first staff for ledger lines and the bar numbers
const BOTTOM = 34
const LEFT = 8
/** The most a bar is stretched past its natural width, so a short line isn't pulled across the page. */
const MAX_STRETCH = 1.7

interface Drawn {
  /** Each note or rest drawn, with its time, for the playhead: [song ms, x]. */
  anchors: [number, number][]
  /** Each event's element, by the ids of its keys. */
  byId: Map<number, SVGElement>
  /** Each event's x, and where a pitch sits on each staff of its bar, by the ids of its keys: for writing a wrong key beside it. */
  where: Map<number, { x: number; yOf: Partial<Record<Clef, (pitch: number) => number>> }>
  playhead: SVGLineElement
  overlay: SVGGElement
  svg: SVGSVGElement
  scale: number
}

export const Score = memo(
  forwardRef<ScoreHandle, ScoreProps>(function Score(props, ref) {
    const { song, notes, practice, bar, now, results, wrong, focus, size, barsPerLine, whole = false, follow = 'now', ariaLabel } = props
    const [engrave] = useState(canEngrave)
    const [vf, setVf] = useState<VF | null>(null)
    const [failed, setFailed] = useState(false)
    useEffect(() => {
      if (!engrave) return
      let live = true
      loadVexFlow().then(
        (m) => live && setVf(m),
        () => live && setFailed(true),
      )
      return () => {
        live = false
      }
    }, [engrave])

    const box = useRef<HTMLDivElement>(null)
    const [area, setArea] = useState<{ w: number; h: number } | null>(null)
    useLayoutEffect(() => {
      const el = box.current
      if (!el) return
      const measure = () => setArea((a) => (a && Math.abs(a.w - el.clientWidth) < 2 && Math.abs(a.h - el.clientHeight) < 2 ? a : { w: el.clientWidth, h: el.clientHeight }))
      measure()
      if (typeof ResizeObserver === 'undefined') return
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }, [engrave, failed])

    const clefs = useMemo<Clef[]>(() => (practice === 'both' ? ['treble', 'bass'] : practice === 'left' ? ['bass'] : ['treble']), [practice])
    const model = useMemo(() => notationBars(song, notes, clefs), [song, notes, clefs])
    const times = useMemo(() => barTimesOf(song, notes), [song, notes])
    const drawn = useRef<Drawn | null>(null)

    // Draw: when the music, the room or the page changes.
    const [page, setPage] = useState<{ first: number; end: number } | null>(null)
    useLayoutEffect(() => {
      const el = box.current
      if (!vf || !el || !area || area.w < 40 || model.length === 0) return
      try {
        const result = draw(vf, el, model, times, clefs, area, bar, size, barsPerLine, whole, song.barLabels, focus ?? null)
        drawn.current = result.drawn
        setPage(result.page)
      } catch (e) {
        console.warn('KeyPath: the score could not be engraved', e)
        setFailed(true)
      }
    }, [vf, area, model, times, clefs, size, barsPerLine, whole, song.barLabels, focus, page && bar >= page.first && bar < page.end ? page.first : bar]) // eslint-disable-line react-hooks/exhaustive-deps

    // The states of the notes: cheap, so on every step.
    useEffect(() => {
      const d = drawn.current
      if (!d) return
      for (const [id, el] of d.byId) {
        const r = results.get(id)
        el.classList.toggle(styles.now, now.has(id) && !r)
        el.classList.toggle(styles.hit, r === 'hit')
        el.classList.toggle(styles.missed, r === 'missed')
      }
      // The bar being played: its tint.
      for (const rect of d.svg.querySelectorAll<SVGRectElement>('rect[data-bar]')) rect.classList.toggle(styles.barNow, Number(rect.getAttribute('data-bar')) === bar)
      // A wrong key, written in red just after the note to play.
      d.overlay.querySelectorAll('[data-wrong]').forEach((g) => g.remove())
      const at = [...now].map((id) => d.where.get(id)).find(Boolean)
      if (at && wrong?.size) {
        const NS = 'http://www.w3.org/2000/svg'
        for (const pitch of wrong) {
          // On the staff the key belongs to: from middle C up the treble, below it the bass, when both are drawn.
          const yOf = at.yOf[pitch >= 60 ? 'treble' : 'bass'] ?? at.yOf.treble ?? at.yOf.bass
          if (!yOf) continue
          const y = yOf(pitch)
          const x = at.x + 18
          const g = document.createElementNS(NS, 'g')
          g.setAttribute('data-wrong', String(pitch))
          g.setAttribute('class', styles.wrong)
          const head = document.createElementNS(NS, 'ellipse')
          head.setAttribute('cx', String(x))
          head.setAttribute('cy', String(y))
          head.setAttribute('rx', '6')
          head.setAttribute('ry', '4.3')
          head.setAttribute('transform', `rotate(-20 ${x} ${y})`)
          g.appendChild(head)
          if ([1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12)) {
            const sharp = document.createElementNS(NS, 'text')
            sharp.setAttribute('x', String(x - 15))
            sharp.setAttribute('y', String(y + 4.5))
            sharp.textContent = '♯'
            g.appendChild(sharp)
          }
          d.overlay.appendChild(g)
        }
      }
      // Waiting for notes, the playhead sits at them.
      if (follow === 'now') {
        const xs = [...now].map((id) => d.where.get(id)?.x).filter((x): x is number => x !== undefined)
        placePlayhead(d, xs.length ? Math.min(...xs) : null)
      }
    }, [now, results, wrong, bar, follow, page])

    useImperativeHandle(ref, () => ({
      setTime(songMs) {
        const d = drawn.current
        if (!d || follow !== 'time') return
        const a = d.anchors
        if (a.length === 0 || songMs < a[0][0] - 1 || songMs > a[a.length - 1][0] + 1) return placePlayhead(d, null)
        let i = 0
        while (i < a.length - 2 && a[i + 1][0] <= songMs) i++
        const [t0, x0] = a[i]
        const [t1, x1] = a[i + 1] ?? a[i]
        placePlayhead(d, t1 > t0 ? x0 + ((songMs - t0) / (t1 - t0)) * (x1 - x0) : x0)
      },
    }))

    if (!engrave || failed) {
      const fallback = { notes, practice, bar, now, results, beatMs: props.beatMs, ariaLabel }
      return size === 'big' ? <BigScore {...fallback} wrong={wrong} /> : <ScoreStrip {...fallback} />
    }
    return <div ref={box} className={styles.score} data-size={size} role="img" aria-label={ariaLabel} />
  }),
)

function placePlayhead(d: Drawn, x: number | null) {
  if (x === null) return d.playhead.setAttribute('visibility', 'hidden')
  d.playhead.setAttribute('visibility', 'visible')
  d.playhead.setAttribute('x1', String(x))
  d.playhead.setAttribute('x2', String(x))
}

/** One line's bars: their staves, voices and natural widths. */
interface Measure {
  bar: NotationBar
  staves: { clef: Clef; events: NotationEvent[]; notes: InstanceType<VF['StaveNote']>[]; voice: InstanceType<VF['Voice']> }[]
  /** Its natural width: the clef and metre at the start of a line (`lead`), then the notes. */
  minWidth: number
  /** The part of `minWidth` before the notes, which is never stretched. */
  lead: number
}

/** The metre the music is written in: its commonest bar, so a pickup (a short first bar) doesn't set it. */
export function metreOf(bars: readonly Pick<NotationBar, 'quarters'>[]): number {
  const count = new Map<number, number>()
  for (const b of bars) count.set(b.quarters, (count.get(b.quarters) ?? 0) + 1)
  let best = bars[0]?.quarters ?? 4
  for (const [q, n] of count) if (n > (count.get(best) ?? 0)) best = q
  return best
}

/**
 * Lay the music out and draw it. Returns what the states, the wrong keys and
 * the playhead need, and which bars are on screen.
 */
function draw(
  vf: VF,
  el: HTMLDivElement,
  model: NotationBar[],
  times: { startMs: number; endMs: number; quarters: number }[],
  clefs: Clef[],
  area: { w: number; h: number },
  bar: number,
  size: 'big' | 'strip',
  barsPerLine: number | undefined,
  whole: boolean,
  barLabels: string[] | undefined,
  focus: { from: number; to: number } | null,
): { drawn: Drawn; page: { first: number; end: number } } {
  const { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Accidental, Dot, StaveTie, StaveConnector } = vf
  const lineHeight = TOP + 40 + (clefs.length === 2 ? STAFF_GAP + 40 : 0) + BOTTOM
  // A staff space of 7–12 px written out (about a printed page's on a phone), 5–8.5 px as a strip;
  // never larger on a big screen, and smaller only when nothing else would fit.
  const [minSpace, maxSpace] = size === 'big' ? [7, 12] : [6.2, 8.5]
  const margin = LEFT + (clefs.length === 2 ? 18 : 0) // room for the brace
  const metre = metreOf(model)

  // Each bar as voices, with its natural width; `first` adds the clef (and the metre, on the first bar).
  const measureOf = (b: number, first: boolean): Measure => {
    const nb = model[b]
    const staves = clefs.map((clef) => {
      const events = nb.staves[clef] ?? []
      const notes = events.map((e) => {
        const [dur, dots] = e.wholeBar ? ['w', 0] : DURATION[e.length] ?? ['q', 0]
        const n = new StaveNote({
          keys: e.keys.length ? e.keys.map((k) => keyOf(k.pitch)) : [REST_KEY[clef]],
          duration: e.keys.length ? dur : `${dur}r`,
          clef,
          autoStem: true,
          ...(e.wholeBar ? { alignCenter: true } : {}),
        })
        if (dots) Dot.buildAndAttach([n], { all: true })
        return n
      })
      const voice = new Voice({ numBeats: Math.max(1, Math.round(nb.quarters * 4)), beatValue: 16 }).setMode(Voice.Mode.SOFT).addTickables(notes)
      Accidental.applyAccidentals([voice], 'C')
      return { clef, events, notes, voice }
    })
    const f = new Formatter()
    for (const s of staves) f.joinVoices([s.voice])
    const lead = first ? 46 + (b === 0 ? 26 : 0) : 14
    // A short bar (a pickup) is given the room its notes need and no more, as printed: a whole bar's breathing space would make it look like one.
    const short = nb.quarters < metre - 1e-9
    const notes = f.preCalculateMinTotalWidth(staves.map((s) => s.voice))
    const width = short ? Math.max(36, notes * 1.05 + 14) : Math.max(70, notes * 1.25 + 28)
    return { bar: nb, staves, lead, minWidth: width + lead }
  }
  const natural = new Map<string, number>()
  const widthOf = (b: number, first: boolean) => {
    const key = `${b}:${first}`
    if (!natural.has(key)) natural.set(key, measureOf(b, first).minWidth)
    return natural.get(key)!
  }

  // Lines broken as an engraver breaks them, by width: as many bars as fit (up to four, at least
  // one), so a bar of quick notes takes more room than a bar of long ones. One size for the whole
  // song, so the music doesn't grow and shrink from page to page; then as many lines a page as the
  // height holds (four at most on a big score, one on the strip). The page holds the bar played.
  const at = Math.max(0, Math.min(bar, model.length - 1))
  const most = barsPerLine ?? 4
  const maxLines = size === 'big' ? 4 : 1
  const linesAt = (scale: number): number[][] => {
    const room = area.w / scale - margin * 2
    const out: number[][] = []
    let row: number[] = []
    let used = 0
    for (let b = 0; b < model.length; b++) {
      if (row.length) {
        const w = widthOf(b, false)
        if (row.length < most && used + w <= room) {
          row.push(b)
          used += w
          continue
        }
        out.push(row)
      }
      row = [b]
      used = widthOf(b, true)
    }
    if (row.length) out.push(row)
    return out
  }
  const fits = (scale: number) => lineHeight * scale <= area.h && model.every((_, b) => widthOf(b, true) + margin * 2 <= area.w / scale)
  const perPage = (scale: number) => Math.max(1, Math.min(maxLines, Math.floor(area.h / (lineHeight * scale))))
  // The size: of those readable here, the one showing the most music a page, each bar counted by its
  // size cubed (size first, for a child reading off a phone, then as much music as keeps it).
  let scale = 0
  let best = 0
  for (let space = maxSpace; space >= minSpace - 1e-9; space -= 0.25) {
    const s = space / 10
    if (!fits(s)) continue
    const pages = Math.ceil(linesAt(s).length / perPage(s))
    // Asked to keep the piece whole: the largest size at which it fits one page.
    const value = whole ? (pages === 1 ? s : 0) : (model.length / pages) * s ** 3
    if (value > best * 1.02) {
      best = value
      scale = s
    }
  }
  // Too small a space for a readable size: as large as the widest bar and one line allow.
  if (!scale) scale = Math.min(area.h / lineHeight, ...model.map((_, b) => area.w / (widthOf(b, true) + margin * 2)))
  const lines = linesAt(scale)
  const per = perPage(scale)
  const pageAt = Math.floor(Math.max(0, lines.findIndex((r) => r.includes(at))) / per)
  const rows = lines.slice(pageAt * per, pageAt * per + per)
  const first = rows[0][0]
  const end = rows[rows.length - 1][rows[rows.length - 1].length - 1] + 1
  const measures: Measure[][] = rows.map((r) => r.map((b, k) => measureOf(b, k === 0)))
  const width = area.w / scale

  el.innerHTML = ''
  const renderer = new Renderer(el, Renderer.Backends.SVG)
  const height = measures.length * lineHeight
  renderer.resize(area.w, Math.min(area.h, height * scale))
  const ctx = renderer.getContext()
  ctx.scale(scale, scale)
  const svg = el.querySelector('svg')!
  svg.setAttribute('class', styles.svg)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  // Behind the music: each bar's tint, and the playhead.
  const NS = 'http://www.w3.org/2000/svg'
  const under = document.createElementNS(NS, 'g')
  svg.insertBefore(under, svg.firstChild)
  const overlay = document.createElementNS(NS, 'g')
  const playhead = document.createElementNS(NS, 'line')
  playhead.setAttribute('class', styles.playhead)
  playhead.setAttribute('visibility', 'hidden')

  const anchors: [number, number][] = []
  const byId = new Map<number, SVGElement>()
  const where: Drawn['where'] = new Map()
  /** The last note drawn on each staff, for ties into it. */
  const tied: Partial<Record<Clef, { note: InstanceType<VF['StaveNote']>; count: number }>> = {}

  // One stretch for every line, so bars keep their proportions from line to line; a short line isn't pulled across the page.
  // Only the notes stretch: a clef and a metre are the same width however wide the bar.
  const leadOf = (line: Measure[]) => line.reduce((w, m) => w + m.lead, 0)
  const notesOf = (line: Measure[]) => line.reduce((w, m) => w + m.minWidth - m.lead, 0)
  const fill = (line: Measure[], most: number) => Math.min(most, (width - margin * 2 - leadOf(line)) / notesOf(line))
  const stretch = Math.min(...measures.map((line) => fill(line, MAX_STRETCH)))
  // Every line but the song's last is justified to the margins, as printed (a line of plain quarters
  // takes more pulling than one of eighths); the last keeps the common spacing.
  // A line that would have to be pulled to well over twice its width to fill (a pickup alone) isn't.
  const stretchOf = (line: Measure[]) => {
    const full = fill(line, Infinity)
    return line[line.length - 1].bar.index < model.length - 1 && full <= MAX_STRETCH * 1.5 ? full : stretch
  }
  const longest = Math.max(...measures.map((line) => leadOf(line) + notesOf(line) * stretchOf(line)))
  measures.forEach((line, l) => {
    const lineStretch = stretchOf(line)
    let x = margin + Math.max(0, (width - margin * 2 - longest) / 2)
    const top = l * lineHeight + TOP
    let systemTop = 0
    let systemBottom = 0
    line.forEach((m, k) => {
      const w = m.lead + (m.minWidth - m.lead) * lineStretch
      const staves = m.staves.map((s, i) => {
        const y = top + (i === 0 ? 0 : 40 + STAFF_GAP) - 40 // a stave's first line is 40 below its y
        const stave = new Stave(x, y, w)
        if (k === 0) stave.addClef(s.clef)
        if (k === 0 && m.bar.index === 0) stave.addTimeSignature(timeSignature(metre))
        return stave
      })
      // Notes start together on both staves.
      const startX = Math.max(...staves.map((s) => s.getNoteStartX()))
      staves.forEach((s) => s.setNoteStartX(startX))
      systemTop = staves[0].getYForLine(0)
      systemBottom = staves[staves.length - 1].getYForLine(4)
      // The bar's tint, behind it, and its number above.
      const tint = document.createElementNS(NS, 'rect')
      const tx = k === 0 ? startX - 8 : x
      tint.setAttribute('x', String(tx))
      tint.setAttribute('y', String(systemTop - 16))
      tint.setAttribute('width', String(x + w - tx))
      tint.setAttribute('height', String(systemBottom - systemTop + 32))
      tint.setAttribute('rx', '6')
      tint.setAttribute('data-bar', String(m.bar.index))
      tint.setAttribute('class', `${styles.barTint}${m.bar.index === bar ? ` ${styles.barNow}` : ''}`)
      under.appendChild(tint)
      const number = document.createElementNS(NS, 'text')
      number.setAttribute('x', String(k === 0 ? startX - 4 : x + 4))
      number.setAttribute('y', String(systemTop - 20))
      number.setAttribute('class', styles.barNumber)
      number.textContent = barLabels?.[m.bar.index] || String(m.bar.index + 1)
      overlay.appendChild(number)

      const voices = m.staves.map((s) => s.voice)
      const f = new Formatter()
      for (const v of voices) f.joinVoices([v])
      f.format(voices, x + w - startX - 12)
      const beams = m.staves.flatMap((s) => Beam.generateBeams(s.notes.filter((_, i) => s.events[i].keys.length > 0) as never, { maintainStemDirections: false }))
      staves.forEach((stave) => stave.setContext(ctx).draw())
      m.staves.forEach((s, i) => s.voice.draw(ctx, staves[i]))
      beams.forEach((b) => b.setContext(ctx).draw())
      if (staves.length === 2) {
        new StaveConnector(staves[0], staves[1]).setType('singleRight').setContext(ctx).draw()
        if (k === 0) {
          new StaveConnector(staves[0], staves[1]).setType('brace').setContext(ctx).draw()
          new StaveConnector(staves[0], staves[1]).setType('singleLeft').setContext(ctx).draw()
        }
      }

      // Ids, states, ties, and where each note sits.
      const quieter = focus && (m.bar.index < focus.from || m.bar.index >= focus.to)
      const yOfBar: Partial<Record<Clef, (pitch: number) => number>> = Object.fromEntries(m.staves.map((s, i) => [s.clef, (pitch: number) => staves[i].getYForNote(lineOf(pitch, s.clef))]))
      const t = times[m.bar.index]
      const qMs = t ? (t.endMs - t.startMs) / m.bar.quarters : 0
      m.staves.forEach((s, i) => {
        s.events.forEach((e, j) => {
          const n = s.notes[j]
          const g = n.getSVGElement()
          if (g) {
            if (quieter) g.classList.add(styles.quiet)
            for (const key of e.keys) {
              byId.set(key.id, g)
              where.set(key.id, { x: n.getAbsoluteX() + 6, yOf: yOfBar })
            }
          }
          if (i === 0 && t) anchors.push([t.startMs + e.at * qMs, n.getAbsoluteX() + 6])
          // A tie from the note before on this staff into this one.
          const prev = tied[s.clef]
          if (prev && e.keys.length) {
            const idx = [...Array(Math.min(prev.count, e.keys.length)).keys()]
            new StaveTie({ firstNote: prev.note, lastNote: n, firstIndexes: idx, lastIndexes: idx }).setContext(ctx).draw()
          }
          tied[s.clef] = e.tie && e.keys.length ? { note: n, count: e.keys.length } : undefined
        })
      })
      if (t) anchors.push([t.endMs, x + w - 4])
      x += w
    })
    // A tie running off the end of a line goes to the line's edge.
    for (const clef of clefs) {
      const prev = tied[clef]
      if (prev) {
        const idx = [...Array(prev.count).keys()]
        new StaveTie({ firstNote: prev.note, lastNote: null, firstIndexes: idx, lastIndexes: idx }).setContext(ctx).draw()
        tied[clef] = undefined
      }
    }
    if (l === 0) {
      playhead.setAttribute('y1', String(systemTop - 12))
      playhead.setAttribute('y2', String(systemBottom + 12))
    }
  })
  under.appendChild(playhead)
  svg.appendChild(overlay)
  anchors.sort((a, b) => a[0] - b[0])
  return { drawn: { anchors, byId, where, playhead, overlay, svg, scale }, page: { first, end } }
}
