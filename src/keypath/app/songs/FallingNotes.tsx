import { forwardRef, memo, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { NoteResult, SongNote } from '../../engine'
import type { KeyBox } from './keyGeometry'
import styles from './songs.module.css'

/** Song milliseconds to pixels: one second of music is 110 px of fall, where there's room. */
export const PX_PER_MS = 0.11
/**
 * However short the fall (a phone on its side, the setup panel open), this
 * much of the song stays in view above the keys: the notes pack closer rather
 * than arrive unseen. Never tighter than MIN_PX_PER_MS, so a note stays a note.
 */
export const LOOK_AHEAD_MS = 2200
const MIN_PX_PER_MS = 0.045
export const pxPerMsFor = (fallPx: number) => Math.min(PX_PER_MS, Math.max(MIN_PX_PER_MS, fallPx / LOOK_AHEAD_MS))
/** A note shorter than this (px) has room for its finger or its name, not both: the finger wins. */
const ROOM_FOR_BOTH = 28

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
}

/**
 * Notes fall towards the keyboard and reach it at the moment they should be
 * played. Positions are percentages from keyGeometry, so each note lands on
 * its own key. The whole layer moves with one transform per frame.
 */
export const FallingNotes = memo(
  forwardRef<FallingNotesHandle, Props>(function FallingNotes({ notes, boxes, results, label, fingers = false }, ref) {
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
    return (
      <div ref={box} className={styles.fall}>
        <div ref={layer} className={styles.fallLayer}>
          {notes.map((n) => {
            const box = byPitch.get(n.pitch)
            if (!box) return null
            const outcome = results.get(n.id)
            const height = Math.max(14, n.durationMs * scale)
            const finger = fingers ? n.finger : undefined
            return (
              <div
                key={n.id}
                className={`${styles.note} ${n.hand === 'left' ? styles.noteLeft : styles.noteRight} ${outcome === 'hit' ? styles.noteHit : outcome === 'missed' ? styles.noteMissed : ''}`}
                style={{
                  left: `${box.left}%`,
                  width: `${box.width}%`,
                  bottom: `${n.startMs * scale}px`,
                  height: `${height}px`,
                }}
              >
                {finger && (
                  <span className={styles.noteFinger} data-finger={finger}>
                    {finger}
                  </span>
                )}
                {(!finger || height >= ROOM_FOR_BOTH) && <span className={styles.noteLabel}>{label(n.pitch)}</span>}
              </div>
            )
          })}
        </div>
        <div className={styles.hitLine} />
      </div>
    )
  }),
)
