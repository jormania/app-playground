import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SimpleSynth } from '../../probe/synth'
import { nameLines, type KeyBox } from './keyGeometry'
import styles from './songs.module.css'

export interface PlayKeyboardProps {
  boxes: KeyBox[]
  /** Keys down right now. */
  held: ReadonlySet<number>
  /** Keys to play next. */
  targets: ReadonlySet<number>
  /** Keys to flash as a mistake (only in modes that show mistakes). */
  wrong: ReadonlySet<number>
  /** Keys to flash as right: the key asked for, just played. */
  right?: ReadonlySet<number>
  /** A key marked with a dot — middle C before the start. */
  marker?: number
  /** Words for the marked key, shown on it ("Middle C"). */
  markerLabel?: string
  /** Keys marked with the finger that goes there, by hand: where the hands sit before the start. */
  badges?: ReadonlyMap<number, { text: string; hand: 'right' | 'left' }>
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
export const PlayKeyboard = memo(function PlayKeyboard({ boxes, held, targets, wrong, right, marker, markerLabel, badges, label, names = true, onPress, onRelease, sound = false }: PlayKeyboardProps) {
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
  const raised = useRaised(boxes)
  return (
    <div ref={raised.ref} className={styles.keys} data-raised={raised.on || undefined} onContextMenu={(e) => e.preventDefault()}>
      {ordered.map((b) => {
        // Three things a key can say: play me (a quiet, steady wash), yes (a brief green), not that one (red).
        // A key held down sinks, whatever it says.
        const state = wrong.has(b.pitch) ? styles.keyWrong : right?.has(b.pitch) ? styles.keyRight : targets.has(b.pitch) ? styles.keyTarget : held.has(b.pitch) ? styles.keyDown : ''
        return (
          <div
            key={b.pitch}
            role="button"
            aria-label={label(b.pitch)}
            aria-pressed={held.has(b.pitch)}
            data-pitch={b.pitch}
            data-target={targets.has(b.pitch) || undefined}
            data-held={held.has(b.pitch) || undefined}
            className={`${b.black ? styles.blackKey : styles.whiteKey} ${state}`}
            style={{ left: `${b.left}%`, width: `${b.width}%` }}
            onPointerDown={down(b.pitch)}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
          >
            {marker === b.pitch && <span className={styles.marker} aria-hidden />}
            {names && !b.black && <KeyName className={styles.keyLabel} name={label(b.pitch)} />}
          </div>
        )
      })}
      {/* The marked key's words, over the black keys so they are never cut off. */}
      {markerLabel &&
        boxes
          .filter((b) => b.pitch === marker)
          .map((b) => (
            // Centred on its key, unless that would run it off the keyboard: then held to the edge.
            <span
              key="marker-label"
              className={styles.markerLabel}
              data-edge={b.left < 8 ? 'start' : b.left + b.width > 92 ? 'end' : undefined}
              style={b.left < 8 ? { left: '0.25rem' } : b.left + b.width > 92 ? { right: '0.25rem' } : { left: `${b.left + b.width / 2}%` }}
            >
              {markerLabel}
            </span>
          ))}
      {/* Over the black keys, so a badge on a white key is seen whichever way they fall. */}
      {badges &&
        boxes
          .filter((b) => badges.has(b.pitch))
          .map((b) => (
            <span key={`badge-${b.pitch}`} className={styles.keyBadge} data-hand={badges.get(b.pitch)!.hand} style={{ left: `${b.left + b.width / 2}%` }} aria-hidden>
              {badges.get(b.pitch)!.text}
            </span>
          ))}
    </div>
  )
})

/** A black key at least this wide (px) has room to stand above the white keys, with its front edge and shadow. */
const RAISED_MIN_BLACK_PX = 18
/** And the keyboard at least this tall (px): on a short one the front edge would eat the key. */
const RAISED_MIN_HEIGHT_PX = 72

/**
 * Whether the black keys are drawn standing above the white ones. Only where
 * there is room: two octaves on a phone held upright leave a black key about
 * 15 px wide, and there it keeps its plain, flatter look.
 */
function useRaised(boxes: readonly KeyBox[]) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  const black = boxes.find((b) => b.black)?.width ?? 0
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setOn(el.clientHeight >= RAISED_MIN_HEIGHT_PX && (el.clientWidth * black) / 100 >= RAISED_MIN_BLACK_PX)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [black])
  return { ref, on }
}

/** A key's name, sized by its length; both names one above the other. */
export function KeyName({ className, name }: { className: string; name: string }) {
  const { lines, len } = nameLines(name)
  return (
    <span className={className} data-len={len}>
      {lines.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </span>
  )
}
