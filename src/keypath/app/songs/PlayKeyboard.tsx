import { memo, useEffect, useRef } from 'react'
import { SimpleSynth } from '../../probe/synth'
import type { KeyBox } from './keyGeometry'
import styles from './songs.module.css'

export interface PlayKeyboardProps {
  boxes: KeyBox[]
  /** Keys down right now. */
  held: ReadonlySet<number>
  /** Keys to play next. */
  targets: ReadonlySet<number>
  /** Keys to flash as a mistake (only in modes that show mistakes). */
  wrong: ReadonlySet<number>
  /** A key marked with a dot — middle C before the start. */
  marker?: number
  label: (pitch: number) => string
  /** Print names on the keys (the player's "Names on the keys" setting). Screen readers get them either way. */
  names?: boolean
  onPress: (pitch: number) => void
  onRelease: (pitch: number) => void
  /**
   * The phone sounds the keys tapped on screen. Screens pass true while no
   * keyboard is connected, so a first try without the Yamaha isn't silent; with
   * it connected she plays the real keys, and the Yamaha makes the sound.
   */
  sound?: boolean
}

/**
 * The keyboard under the falling notes. It fills the width (no scrolling), so
 * it lines up with the notes above it. Always playable by touch, so a song can
 * be tried without the Yamaha.
 */
export const PlayKeyboard = memo(function PlayKeyboard({ boxes, held, targets, wrong, marker, label, names = true, onPress, onRelease, sound = false }: PlayKeyboardProps) {
  const pointers = useRef(new Map<number, number>())
  // The probe's synth, created on the first tap (browsers start audio only from a gesture).
  const synth = useRef<SimpleSynth | null>(null)
  useEffect(() => {
    if (!sound) synth.current?.allOff()
  }, [sound])
  useEffect(() => () => synth.current?.allOff(), [])
  const down = (pitch: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, pitch)
    if (sound) void (synth.current ??= new SimpleSynth()).noteOn(pitch, 90).catch(() => {})
    onPress(pitch)
  }
  const up = (e: React.PointerEvent) => {
    const pitch = pointers.current.get(e.pointerId)
    if (pitch === undefined) return
    pointers.current.delete(e.pointerId)
    synth.current?.noteOff(pitch)
    onRelease(pitch)
  }
  const ordered = [...boxes.filter((b) => !b.black), ...boxes.filter((b) => b.black)]
  return (
    <div className={styles.keys} onContextMenu={(e) => e.preventDefault()}>
      {ordered.map((b) => {
        const state = wrong.has(b.pitch) ? styles.keyWrong : held.has(b.pitch) ? styles.keyDown : targets.has(b.pitch) ? styles.keyTarget : ''
        return (
          <div
            key={b.pitch}
            role="button"
            aria-label={label(b.pitch)}
            aria-pressed={held.has(b.pitch)}
            data-target={targets.has(b.pitch) || undefined}
            className={`${b.black ? styles.blackKey : styles.whiteKey} ${state}`}
            style={{ left: `${b.left}%`, width: `${b.width}%` }}
            onPointerDown={down(b.pitch)}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
          >
            {marker === b.pitch && <span className={styles.marker} aria-hidden />}
            {names && !b.black && <span className={styles.keyLabel}>{label(b.pitch)}</span>}
          </div>
        )
      })}
    </div>
  )
})
