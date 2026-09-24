import { forwardRef, memo, useImperativeHandle, useRef } from 'react'
import type { NoteResult, SongNote } from '../../engine'
import type { KeyBox } from './keyGeometry'
import styles from './songs.module.css'

/** Song milliseconds to pixels: one second of music is 110 px of fall. */
export const PX_PER_MS = 0.11

export interface FallingNotesHandle {
  /** Move the notes to this song time. Called every frame; never re-renders React. */
  setTime(songMs: number): void
}

interface Props {
  notes: readonly SongNote[]
  boxes: KeyBox[]
  results: ReadonlyMap<number, NoteResult['outcome']>
  label: (pitch: number) => string
}

/**
 * Notes fall towards the keyboard and reach it at the moment they should be
 * played. Positions are percentages from keyGeometry, so each note lands on
 * its own key. The whole layer moves with one transform per frame.
 */
export const FallingNotes = memo(
  forwardRef<FallingNotesHandle, Props>(function FallingNotes({ notes, boxes, results, label }, ref) {
    const layer = useRef<HTMLDivElement>(null)
    useImperativeHandle(ref, () => ({
      setTime(songMs) {
        if (layer.current) layer.current.style.transform = `translate3d(0, ${songMs * PX_PER_MS}px, 0)`
      },
    }))
    const byPitch = new Map(boxes.map((b) => [b.pitch, b]))
    return (
      <div className={styles.fall}>
        <div ref={layer} className={styles.fallLayer}>
          {notes.map((n) => {
            const box = byPitch.get(n.pitch)
            if (!box) return null
            const outcome = results.get(n.id)
            return (
              <div
                key={n.id}
                className={`${styles.note} ${n.hand === 'left' ? styles.noteLeft : styles.noteRight} ${outcome === 'hit' ? styles.noteHit : outcome === 'missed' ? styles.noteMissed : ''}`}
                style={{
                  left: `${box.left}%`,
                  width: `${box.width}%`,
                  bottom: `${n.startMs * PX_PER_MS}px`,
                  height: `${Math.max(14, n.durationMs * PX_PER_MS)}px`,
                }}
              >
                <span className={styles.noteLabel}>{label(n.pitch)}</span>
              </div>
            )
          })}
        </div>
        <div className={styles.hitLine} />
      </div>
    )
  }),
)
