import { useLayoutEffect, useRef } from 'react'
import { isBlackKey, noteName } from '../midi/noteNames'
import styles from './PianoKeyboard.module.css'

export interface PianoKeyboardProps {
  low: number
  high: number
  /** note → velocity, for every key currently down. */
  held: ReadonlyMap<number, number>
  /** When set, the keys are playable (simulator mode); multi-touch plays chords. */
  onPress?: (note: number) => void
  onRelease?: (note: number) => void
}

/**
 * A plain on-screen keyboard. It only draws what it's told — which keys are
 * down comes from the MIDI layer, never from this component's own state, so
 * the picture can't disagree with what was actually received.
 */
export function PianoKeyboard({ low, high, held, onPress, onRelease }: PianoKeyboardProps) {
  // pointerId → note, so each finger releases the key it pressed even if it slid off.
  const pointers = useRef(new Map<number, number>())
  const scroller = useRef<HTMLDivElement>(null)
  const playable = Boolean(onPress && onRelease)

  // A phone held upright can't fit 61 keys, so open centred on middle C —
  // where every test happens — rather than on the bottom octave.
  useLayoutEffect(() => {
    const el = scroller.current
    const c4 = el?.querySelector<HTMLElement>('[aria-label="C4"]')
    if (el && c4 && el.scrollWidth > el.clientWidth) el.scrollLeft = c4.offsetLeft - el.clientWidth / 2 + c4.offsetWidth
  }, [low, high])

  const whites: number[] = []
  for (let n = low; n <= high; n++) if (!isBlackKey(n)) whites.push(n)
  const whiteIndex = new Map(whites.map((n, i) => [n, i]))

  const down = (note: number) => (e: React.PointerEvent) => {
    if (!playable) return
    e.preventDefault()
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, note)
    onPress!(note)
  }
  const up = (e: React.PointerEvent) => {
    const note = pointers.current.get(e.pointerId)
    if (note === undefined) return
    pointers.current.delete(e.pointerId)
    onRelease!(note)
  }

  const key = (note: number) => {
    const black = isBlackKey(note)
    const velocity = held.get(note)
    const left = black ? (whiteIndex.get(note - 1)! + 1) / whites.length : whiteIndex.get(note)! / whites.length
    return (
      <div
        key={note}
        role={playable ? 'button' : undefined}
        aria-label={noteName(note)}
        aria-pressed={velocity !== undefined}
        className={`${black ? styles.black : styles.white} ${velocity !== undefined ? styles.down : ''}`}
        style={{
          left: `calc(${left * 100}% ${black ? '- var(--black-w) / 2' : ''})`,
          // Brighter for harder: velocity made visible, so a fixed-velocity keyboard is obvious at a glance.
          ['--vel' as string]: velocity === undefined ? 0 : 0.35 + (velocity / 127) * 0.65,
        }}
        onPointerDown={down(note)}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
      >
        {!black && note % 12 === 0 && <span className={styles.label}>{noteName(note)}</span>}
      </div>
    )
  }

  const notes: number[] = []
  for (let n = low; n <= high; n++) notes.push(n)

  return (
    <div className={styles.scroller} ref={scroller}>
      <div
        className={styles.keys}
        style={{ ['--whites' as string]: whites.length }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {notes.filter((n) => !isBlackKey(n)).map(key)}
        {notes.filter(isBlackKey).map(key)}
      </div>
    </div>
  )
}
