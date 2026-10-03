import { memo } from 'react'
import { PORTRAIT_QUERY, useMedia } from './useWide'
import type { NoteResult, Practice, SongNote } from '../../engine'
import styles from './songs.module.css'

// The music written (KEYPATH_ROADMAP.md, "The music, written"): a strip over
// the falling notes with this bar and the next on the staff, so the notes she
// plays are also the notes she reads. Drawn by hand in SVG like the Journey's
// staff, and deliberately plain: heads open or filled by length, stems, ledger
// lines, a sharp before each black key, no beams, rests or key signature. A
// reading aid, not engraving.

const SPACE = 8
const TREBLE_BOTTOM = 50 // y of E4, the bottom line
const BASS_BOTTOM = 114 // y of G2, the bottom line
const LEFT = 34 // after the clef
const FULL_WIDTH = 320
/** One bar alone (a line of the written view in portrait): about the width each of two bars has. */
const SINGLE_WIDTH = 180
const RIGHT = 10

/** Diatonic steps above middle C: C4 = 0, D4 = 1 … A sharp is the natural below it. */
const BASE: Record<number, number> = { 0: 0, 1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6 }
const BLACK = new Set([1, 3, 6, 8, 10])
export const stepOf = (pitch: number) => (Math.floor(pitch / 12) - 5) * 7 + BASE[((pitch % 12) + 12) % 12]

const trebleY = (step: number) => TREBLE_BOTTOM - (step - 2) * (SPACE / 2)
const bassY = (step: number) => BASS_BOTTOM - (step + 10) * (SPACE / 2)

/** The steps that need a ledger line to reach this one, on each staff. */
export function ledgerSteps(step: number, clef: 'treble' | 'bass'): number[] {
  const out: number[] = []
  if (clef === 'treble') {
    for (let s = 0; s >= step; s -= 2) out.push(s)
    for (let s = 12; s <= step; s += 2) out.push(s)
  } else {
    for (let s = 0; s <= step; s += 2) out.push(s)
    for (let s = -12; s >= step; s -= 2) out.push(s)
  }
  return out
}

interface Props {
  /** The notes of the hands practised, for the whole song. */
  notes: readonly SongNote[]
  practice: Practice
  /** The bar to show first; the next is shown beside it. */
  bar: number
  /** Pitches to play now: drawn in the accent colour. */
  active: ReadonlySet<number>
  results: ReadonlyMap<number, NoteResult['outcome']>
  /** For the length of a note in beats: ms a beat lasts at the song's own tempo. */
  beatMs: number
  ariaLabel: string
  /** The written view: the staff takes the room the falling notes had. */
  big?: boolean
  /** Keys just pressed that were wrong: drawn in red beside the notes to play, where they would be written. */
  wrong?: ReadonlySet<number>
  /** Bars drawn: this one and the next (2), or this one alone (1). */
  span?: 1 | 2
}

export const ScoreStrip = memo(function ScoreStrip({ notes, practice, bar, active, results, beatMs, ariaLabel, big = false, wrong, span = 2 }: Props) {
  const treble = practice !== 'left'
  const bass = practice !== 'right'
  const bars = span === 2 ? [bar, bar + 1] : [bar]
  const width = span === 2 ? FULL_WIDTH : SINGLE_WIDTH
  // The notes to play now: of those asked for and not yet played, the earliest. A later note on the same key waits its turn.
  const pending = notes.filter((n) => active.has(n.pitch) && !results.has(n.id))
  const nowStart = pending.length ? Math.min(...pending.map((n) => n.startMs)) : null
  const isNow = (n: SongNote) => nowStart !== null && active.has(n.pitch) && !results.has(n.id) && n.startMs - nowStart < 40
  // Each bar's notes, placed across its width by when they start within it.
  const byBar = bars.map((b) => notes.filter((n) => n.bar === b))
  const startOf = (b: number) => Math.min(...notes.filter((n) => n.bar === b).map((n) => n.startMs))
  const barWidth = (width - LEFT - RIGHT) / span
  const placed = bars.flatMap((b, k) => {
    const mine = byBar[k]
    if (mine.length === 0) return []
    const from = startOf(b)
    const next = notes.some((n) => n.bar === b + 1) ? startOf(b + 1) : Math.max(...mine.map((n) => n.startMs + n.durationMs))
    const span = Math.max(1, next - from)
    return mine.map((n) => ({ n, x: LEFT + k * barWidth + 10 + ((n.startMs - from) / span) * (barWidth - 20) }))
  })
  // Room for ledger lines and stems above and below the staff or staves shown.
  const top = treble ? -6 : 52
  const bottom = bass ? 132 : 82
  const line = (bottomY: number) => [0, 1, 2, 3, 4].map((i) => bottomY - i * SPACE)
  const staffLines = [...(treble ? line(TREBLE_BOTTOM) : []), ...(bass ? line(BASS_BOTTOM) : [])]
  const barXs = span === 2 ? [LEFT, LEFT + barWidth, width - RIGHT] : [LEFT, width - RIGHT]
  const systemTop = treble ? TREBLE_BOTTOM - 4 * SPACE : BASS_BOTTOM - 4 * SPACE
  const systemBottom = bass ? BASS_BOTTOM : TREBLE_BOTTOM
  // Where she is: the notes to play now. A wrong key is written just after them, in red.
  const nowXs = placed.filter(({ n }) => isNow(n)).map(({ x }) => x)
  const wrongX = nowXs.length ? Math.min(...nowXs) + 14 : null
  const clefFor = (pitch: number): 'treble' | 'bass' => (treble && bass ? (pitch >= 60 ? 'treble' : 'bass') : treble ? 'treble' : 'bass')

  return (
    <svg className={styles.scoreStrip} data-big={big || undefined} viewBox={`0 ${top} ${width} ${bottom - top}`} role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel || undefined} aria-hidden={ariaLabel ? undefined : true}>
      {staffLines.map((y) => (
        <line key={y} x1={4} x2={width - RIGHT} y1={y} y2={y} className={styles.scoreLine} />
      ))}
      {barXs.map((x) => (
        <line key={x} x1={x} x2={x} y1={systemTop} y2={systemBottom} className={styles.scoreLine} />
      ))}
      {treble && (
        <path
          className={styles.scoreClef}
          d={`M 17 ${TREBLE_BOTTOM - 8} C 12 ${TREBLE_BOTTOM - 8} 11 ${TREBLE_BOTTOM - 14} 16 ${TREBLE_BOTTOM - 16} C 22 ${TREBLE_BOTTOM - 18} 25 ${TREBLE_BOTTOM - 10} 21 ${TREBLE_BOTTOM - 5}
            C 17 ${TREBLE_BOTTOM + 1} 7 ${TREBLE_BOTTOM} 7 ${TREBLE_BOTTOM - 8} C 7 ${TREBLE_BOTTOM - 17} 16 ${TREBLE_BOTTOM - 22} 20 ${TREBLE_BOTTOM - 29}
            C 24 ${TREBLE_BOTTOM - 36} 22 ${TREBLE_BOTTOM - 4 * SPACE - 6} 18 ${TREBLE_BOTTOM - 4 * SPACE - 6} C 14 ${TREBLE_BOTTOM - 4 * SPACE - 6} 12 ${TREBLE_BOTTOM - 4 * SPACE + 4} 14 ${TREBLE_BOTTOM - 4 * SPACE + 12}
            L 19 ${TREBLE_BOTTOM + 12} C 20 ${TREBLE_BOTTOM + 18} 13 ${TREBLE_BOTTOM + 20} 11 ${TREBLE_BOTTOM + 15}`}
        />
      )}
      {bass && (
        <g className={styles.scoreClef}>
          {/* A dot on the F line, a curve sweeping down from it, and two dots either side of the line. */}
          <circle cx={11} cy={BASS_BOTTOM - 3 * SPACE} r={3.2} className={styles.scoreDot} />
          <path d={`M 9 ${BASS_BOTTOM - 3 * SPACE - 2} C 9 ${BASS_BOTTOM - 4 * SPACE - 4} 25 ${BASS_BOTTOM - 4 * SPACE - 3} 25 ${BASS_BOTTOM - 3 * SPACE + 2} C 25 ${BASS_BOTTOM - 3 * SPACE + 12} 15 ${BASS_BOTTOM - SPACE + 6} 6 ${BASS_BOTTOM + 0}`} />
          <circle cx={29} cy={BASS_BOTTOM - 3 * SPACE - 4} r={1.6} className={styles.scoreDot} />
          <circle cx={29} cy={BASS_BOTTOM - 3 * SPACE + 4} r={1.6} className={styles.scoreDot} />
        </g>
      )}
      {placed.map(({ n, x }) => {
        const clef = n.hand === 'left' ? 'bass' : 'treble'
        if ((clef === 'treble' && !treble) || (clef === 'bass' && !bass)) return null
        const step = stepOf(n.pitch)
        const y = clef === 'treble' ? trebleY(step) : bassY(step)
        const middle = clef === 'treble' ? trebleY(6) : bassY(-6) // B4 / D3, the middle line
        const stemUp = y >= middle
        const beats = n.durationMs / beatMs
        const open = beats >= 1.7
        const state = results.get(n.id) === 'hit' ? styles.scoreHit : results.get(n.id) === 'missed' ? styles.scoreMissed : isNow(n) ? styles.scoreNow : ''
        return (
          <g key={n.id} className={`${styles.scoreNote} ${state}`}>
            {ledgerSteps(step, clef).map((s) => {
              const ly = clef === 'treble' ? trebleY(s) : bassY(s)
              return <line key={s} x1={x - 8} x2={x + 8} y1={ly} y2={ly} className={styles.scoreLine} />
            })}
            {BLACK.has(((n.pitch % 12) + 12) % 12) && (
              <text x={x - 15} y={y + 4} className={styles.scoreSharp}>
                ♯
              </text>
            )}
            <ellipse cx={x} cy={y} rx={5.4} ry={3.8} transform={`rotate(-20 ${x} ${y})`} className={open ? styles.scoreOpen : styles.scoreFilled} />
            {beats < 3.5 && <line x1={stemUp ? x + 5 : x - 5} x2={stemUp ? x + 5 : x - 5} y1={y} y2={stemUp ? y - 24 : y + 24} className={styles.scoreStem} />}
            {beats < 0.75 && <path d={stemUp ? `M ${x + 5} ${y - 24} q 6 5 4 12` : `M ${x - 5} ${y + 24} q 6 -5 4 -12`} className={styles.scoreFlag} />}
          </g>
        )
      })}
      {wrongX !== null &&
        [...(wrong ?? [])].map((pitch) => {
          const clef = clefFor(pitch)
          const step = stepOf(pitch)
          const y = clef === 'treble' ? trebleY(step) : bassY(step)
          return (
            <g key={`wrong-${pitch}`} className={styles.scoreWrong} data-wrong={pitch}>
              {ledgerSteps(step, clef).map((s) => {
                const ly = clef === 'treble' ? trebleY(s) : bassY(s)
                return <line key={s} x1={wrongX - 8} x2={wrongX + 8} y1={ly} y2={ly} className={styles.scoreLine} />
              })}
              {BLACK.has(((pitch % 12) + 12) % 12) && (
                <text x={wrongX - 15} y={y + 4} className={styles.scoreSharp}>
                  ♯
                </text>
              )}
              <ellipse cx={wrongX} cy={y} rx={5.4} ry={3.8} transform={`rotate(-20 ${wrongX} ${y})`} />
            </g>
          )
        })}
    </svg>
  )
})

/**
 * The written view's staff, as large as the room allows: this bar and the next
 * side by side, or, on a phone held upright, one above the other, each twice
 * the size it would be squeezed into one line. A wrong key is written in the
 * line she is playing.
 */
export function BigScore(props: Omit<Props, 'big' | 'span'>) {
  const portrait = useMedia(PORTRAIT_QUERY)
  if (!portrait) return <ScoreStrip {...props} big />
  return (
    <div className={styles.scoreStack}>
      <ScoreStrip {...props} big span={1} />
      <ScoreStrip {...props} bar={props.bar + 1} wrong={undefined} big span={1} ariaLabel="" />
    </div>
  )
}
