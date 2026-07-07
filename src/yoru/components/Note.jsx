import { useEffect, useRef, useState } from 'react'
import styles from './Note.module.css'

// The note exists to OFFLOAD, not to record. Its whole job is the moment you
// write a thing down and agree it's safe to stop turning it over. So it must not
// linger on screen: you write it, you set it down, and it leaves your sight.
//
//   prompt  → a faint invitation, easy to ignore
//   writing → the textarea, legible while you type
//   held    → gone from view; one faint way to glance back if it returns to you
//
// At session's end it's discarded entirely (App clears the session). It resumes
// only within the same night — reopening returns it to `held`, out of sight.
export default function Note({ value, onChange }) {
  const [mode, setMode] = useState(value ? 'held' : 'prompt')
  const [peeking, setPeeking] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const areaRef = useRef(null)

  useEffect(() => {
    if (mode === 'writing') areaRef.current?.focus()
  }, [mode])

  const setDown = () => {
    onChange(draft.trim())
    setMode(draft.trim() ? 'held' : 'prompt')
  }

  if (mode === 'prompt') {
    return (
      <button type="button" className={styles.prompt} onClick={() => setMode('writing')}>
        <span className={styles.promptLead}>Is something following you into tomorrow?</span>
        <span className={styles.promptWhy}>
          A worry, a to-do, a thought that keeps circling. Leave it here for the night — once it's
          written down, your mind can stop holding it, and sleep comes more easily.
        </span>
      </button>
    )
  }

  if (mode === 'writing') {
    return (
      <div className={styles.writing}>
        <textarea
          ref={areaRef}
          className={styles.area}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="write it down, and leave it here till morning…"
          rows={3}
        />
        <button type="button" className={styles.setDown} onClick={setDown}>
          set it down
        </button>
      </div>
    )
  }

  // held — out of sight, with one quiet way back to it.
  return (
    <div className={styles.held}>
      {peeking ? (
        <button
          type="button"
          className={styles.peek}
          onClick={() => setPeeking(false)}
          aria-label="Set it back down"
        >
          {value}
        </button>
      ) : (
        <button type="button" className={styles.glance} onClick={() => setPeeking(true)}>
          · set down for the night ·
        </button>
      )}
    </div>
  )
}
