import type { StaffNote } from './steps'
import styles from './journey.module.css'

// A small treble staff for the Journey's reading step: whole bars of quarter
// and half notes between middle C and G above the staff. Drawn by hand in
// SVG, no notation library — one step doesn't justify one (KEYPATH_TUTOR.md §7).

const SPACE = 10 // between two staff lines
const TOP = 30 // y of the top line (F5)
const BOTTOM = TOP + 4 * SPACE // y of the bottom line (E4)
const START_X = 56 // first note, after the clef and time signature
const BEAT_X = 27
/** Extra room after each bar line. */
const BAR_GAP = 14

/** Diatonic steps above middle C: C4 = 0, D4 = 1, E4 = 2 … (white keys only). */
const STEP_OF_PC: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 }
export function staffStep(pitch: number): number {
  const octave = Math.floor(pitch / 12) - 5
  const step = STEP_OF_PC[pitch % 12]
  if (step === undefined) throw new Error(`Staff draws white keys only, got ${pitch}`)
  return octave * 7 + step
}
/** E4 (step 2) sits on the bottom line; each step is half a space. */
const yOf = (pitch: number) => BOTTOM - ((staffStep(pitch) - 2) * SPACE) / 2

interface Props {
  notes: readonly StaffNote[]
  /** Index of the note to play now; -1 when none. */
  current: number
  /** Indexes already played. */
  played: ReadonlySet<number>
  /** Names under the notes (the practice), or none (the check). */
  label?: (pitch: number) => string
  beatsPerBar?: number
  /** What a screen reader hears: the names in a practice, a description in a check. */
  ariaLabel: string
  /** Just the clef and the notes: no time signature, no bar lines (the note race's single note). */
  bare?: boolean
  /** Finger numbers above the notes, as a beginner's score prints them (the practice only). */
  fingers?: readonly (number | undefined)[]
}

export function Staff({ notes, current, played, label, beatsPerBar = 4, ariaLabel, bare = false, fingers }: Props) {
  let beat = 0
  const placed = notes.map(([pitch, beats], i) => {
    const x = START_X + beat * BEAT_X + Math.floor(beat / beatsPerBar) * BAR_GAP
    beat += beats
    return { pitch, beats, x, y: yOf(pitch), i }
  })
  const bars = Math.ceil(beat / beatsPerBar)
  // Bar line k: halfway between the last beat of bar k-1 and the first of bar k.
  const barX = (k: number) => START_X + (k * beatsPerBar - 0.5) * BEAT_X + (k - 0.5) * BAR_GAP
  const width = bare ? START_X + beat * BEAT_X : barX(bars) + 10
  const lines = [0, 1, 2, 3, 4].map((k) => TOP + k * SPACE)

  return (
    <svg className={styles.staff} viewBox={`0 8 ${width} 96`} role="img" aria-label={ariaLabel}>
      {lines.map((y) => (
        <line key={y} x1={4} x2={width - 4} y1={y} y2={y} className={styles.staffLine} />
      ))}
      {/* Treble clef: a spiral round the G line, a tall stem, a hook below. */}
      <path
        className={styles.clef}
        d={`M 17 ${BOTTOM - 8} C 12 ${BOTTOM - 8} 11 ${BOTTOM - 14} 16 ${BOTTOM - 16} C 22 ${BOTTOM - 18} 25 ${BOTTOM - 10} 21 ${BOTTOM - 5}
            C 17 ${BOTTOM + 1} 7 ${BOTTOM} 7 ${BOTTOM - 8} C 7 ${BOTTOM - 17} 16 ${BOTTOM - 22} 20 ${BOTTOM - 29}
            C 24 ${BOTTOM - 36} 22 ${TOP - 18} 18 ${TOP - 18} C 14 ${TOP - 18} 12 ${TOP - 8} 14 ${TOP}
            L 19 ${BOTTOM + 12} C 20 ${BOTTOM + 18} 13 ${BOTTOM + 20} 11 ${BOTTOM + 15}`}
      />
      {!bare && (
        <>
          <text x={38} y={TOP + 2 * SPACE - 2} className={styles.timeSig}>
            {beatsPerBar}
          </text>
          <text x={38} y={BOTTOM - 2} className={styles.timeSig}>
            4
          </text>
        </>
      )}
      {!bare && Array.from({ length: bars }, (_, b) => b + 1).map((b) =>
        b === bars ? (
          <g key={b}>
            <line x1={width - 10} x2={width - 10} y1={TOP} y2={BOTTOM} className={styles.barLine} />
            <line x1={width - 5} x2={width - 5} y1={TOP} y2={BOTTOM} className={styles.finalBar} />
          </g>
        ) : (
          <line key={b} x1={barX(b)} x2={barX(b)} y1={TOP} y2={BOTTOM} className={styles.barLine} />
        ),
      )}
      {placed.map(({ pitch, beats, x, y, i }) => {
        const state = i === current ? styles.noteNow : played.has(i) ? styles.notePlayed : ''
        return (
          <g key={i} className={`${styles.staffNote} ${state}`} data-now={i === current || undefined}>
            {/* Middle C's own short line */}
            {staffStep(pitch) <= 0 && <line x1={x - 10} x2={x + 10} y1={BOTTOM + SPACE} y2={BOTTOM + SPACE} className={styles.staffLine} />}
            <ellipse cx={x} cy={y} rx={6.2} ry={4.4} transform={`rotate(-20 ${x} ${y})`} className={beats >= 2 ? styles.headOpen : styles.headFilled} />
            {/* From the middle line (B4) up, stems hang down on the left, as in print. */}
            {staffStep(pitch) >= 6 ? (
              <line x1={x - 5.6} x2={x - 5.6} y1={y + 1} y2={y + 30} className={styles.stem} />
            ) : (
              <line x1={x + 5.6} x2={x + 5.6} y1={y - 1} y2={y - 30} className={styles.stem} />
            )}
            {fingers?.[i] && (
              <text x={x} y={TOP - 13} className={styles.staffFinger}>
                {fingers[i]}
              </text>
            )}
            {label && (
              <text x={x} y={BOTTOM + 30} className={styles.noteName}>
                {label(pitch)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
