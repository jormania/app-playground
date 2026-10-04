import { forwardRef, memo, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { NoteResult, SongNote } from '../../engine'
import { blackCover, type KeyBox } from './keyGeometry'
import { KeyName } from './PlayKeyboard'
import styles from './songs.module.css'

/**
 * Song milliseconds to pixels, at most: one second of music is 180 px of fall,
 * where there's room. A phone held upright has it, and spends it on taller
 * notes rather than on more seconds of song above the keys.
 */
export const PX_PER_MS = 0.18
/**
 * However short the fall (a phone on its side, the setup panel open), this
 * much of the song stays in view above the keys: the notes pack closer rather
 * than arrive unseen. Never tighter than MIN_PX_PER_MS, so a note stays a note.
 */
export const LOOK_AHEAD_MS = 2200
const MIN_PX_PER_MS = 0.045
export const pxPerMsFor = (fallPx: number) => Math.min(PX_PER_MS, Math.max(MIN_PX_PER_MS, fallPx / LOOK_AHEAD_MS))
/**
 * A note shorter than this (px) can't stack its finger over its name. It grows
 * to this, where its key is free above it (the bottom, where it is played,
 * never moves); where the next note on the key is too close, the two go side by side.
 */
const ROOM_FOR_BOTH = 48
/** Space kept between a note grown taller and the next note on its key (px). */
const KEY_GAP = 3

export interface FallingNotesHandle {
  /** Move the notes to this song time. Called every frame; never re-renders React. */
  setTime(songMs: number): void
}

interface Props {
  notes: readonly SongNote[]
  boxes: KeyBox[]
  results: ReadonlyMap<number, NoteResult['outcome']>
  label: (pitch: number) => string
  /** Show each note's finger number, where the song has one. */
  fingers?: boolean
  /** The numbers are suggestions, worked out for a song whose file had none: drawn dashed. */
  suggested?: boolean
}

/**
 * Notes fall towards the keyboard and reach it at the moment they should be
 * played. Positions are percentages from keyGeometry, so each note lands on
 * its own key. The whole layer moves with one transform per frame.
 */
export const FallingNotes = memo(
  forwardRef<FallingNotesHandle, Props>(function FallingNotes({ notes, boxes, results, label, fingers = false, suggested = false }, ref) {
    const layer = useRef<HTMLDivElement>(null)
    const box = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(PX_PER_MS)
    const scaleRef = useRef(scale)
    const time = useRef(0)
    const move = () => {
      if (layer.current) layer.current.style.transform = `translate3d(0, ${time.current * scaleRef.current}px, 0)`
    }
    useImperativeHandle(ref, () => ({
      setTime(songMs) {
        time.current = songMs
        move()
      },
    }))
    // The scale follows the fall's height: measured now, and again whenever it changes size.
    useLayoutEffect(() => {
      const el = box.current
      if (!el) return
      const measure = () => {
        const next = el.clientHeight > 0 ? pxPerMsFor(el.clientHeight) : PX_PER_MS
        if (Math.abs(next - scaleRef.current) < 0.001) return
        scaleRef.current = next
        setScale(next)
        move()
      }
      measure()
      if (typeof ResizeObserver === 'undefined') return
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])
    const byPitch = new Map(boxes.map((b) => [b.pitch, b]))
    const cover = useMemo(() => blackCover(boxes), [boxes])
    // When the next note on each note's key starts (ms): how far a short note may grow.
    const nextOnKey = useMemo(() => {
      const next = new Map<number, number>()
      const last = new Map<number, number>()
      for (const n of [...notes].sort((a, b) => b.startMs - a.startMs)) {
        const after = last.get(n.pitch)
        if (after !== undefined) next.set(n.id, after)
        last.set(n.pitch, n.startMs)
      }
      return next
    }, [notes])
    // Each note's place and height; then, where a black key's note falls over part of a white key's
    // note at the same time (a trill on E and D♯), the white one's finger and name move clear of it.
    const placed = notes.flatMap((n) => {
      const box = byPitch.get(n.pitch)
      if (!box) return []
      const finger = fingers ? n.finger : undefined
      const after = nextOnKey.get(n.id)
      const room = after === undefined ? Infinity : (after - n.startMs) * scale - KEY_GAP
      const height = Math.max(18, n.durationMs * scale, finger ? Math.min(ROOM_FOR_BOTH, room) : 0)
      return [{ n, box, height, finger, squeezed: !!finger && height < ROOM_FOR_BOTH, pad: null as { left: number; right: number } | null }]
    })
    const spans = new Map<number, [number, number][]>()
    for (const p of placed) if (p.box.black) spans.set(p.n.pitch, [...(spans.get(p.n.pitch) ?? []), [p.n.startMs * scale, p.n.startMs * scale + p.height]])
    for (const p of placed) {
      if (p.box.black || spans.size === 0) continue
      const lo = p.n.startMs * scale
      const hi = lo + p.height
      const meets = (pitch: number) => (spans.get(pitch) ?? []).some(([a, b]) => a < hi && b > lo)
      const c = cover.get(p.n.pitch)
      if (!c) continue
      const left = meets(p.n.pitch - 1) ? c.left : 0
      const right = meets(p.n.pitch + 1) ? c.right : 0
      if (left || right) p.pad = { left, right }
    }
    return (
      <div ref={box} className={styles.fall}>
        <div ref={layer} className={styles.fallLayer}>
          {placed.map(({ n, box, height, finger, squeezed, pad }) => {
            const outcome = results.get(n.id)
            const row = squeezed && !box.black
            return (
              <div
                key={n.id}
                className={`${styles.note} ${row ? styles.noteRow : ''} ${box.black ? styles.noteBlack : ''} ${n.hand === 'left' ? styles.noteLeft : styles.noteRight} ${outcome === 'hit' ? styles.noteHit : outcome === 'missed' ? styles.noteMissed : ''}`}
                style={{
                  left: `${box.left}%`,
                  width: `${box.width}%`,
                  bottom: `${n.startMs * scale}px`,
                  height: `${height}px`,
                  ...(pad ? { paddingLeft: `${pad.left}%`, paddingRight: `${pad.right}%` } : {}),
                }}
              >
                {finger && (
                  <span className={styles.noteFinger} data-finger={finger} data-suggested={suggested || undefined}>
                    {finger}
                  </span>
                )}
                {/* A black key's note is narrow: its name never goes beside the finger, and is left off when the next note is too close to put it under. */}
                {!(squeezed && box.black) && <KeyName className={styles.noteLabel} name={label(n.pitch)} />}
              </div>
            )
          })}
        </div>
        <div className={styles.hitLine} />
      </div>
    )
  }),
)
