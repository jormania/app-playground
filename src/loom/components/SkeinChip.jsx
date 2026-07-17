import { useState } from 'react'
import InlinePopover from './InlinePopover.jsx'
import styles from './Assign.module.css'

// Reassign a thread's skein inline — pick an existing one or type a new name; a
// blank name loosens the thread (no skein). Used in List view so a thread can
// change skein without ever leaving the row. `skeins` are the existing names.
export default function SkeinChip({ thread, skeins, onSetSkein }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(thread.skein || '')

  function commit(name) {
    const next = (name ?? draft).trim()
    onSetSkein(next || null)
    setOpen(false)
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.chip} ${styles.skein}`}
        aria-label="Change skein"
        onClick={() => { setDraft(thread.skein || ''); setOpen(o => !o) }}
      >{thread.skein || '+ skein'}</button>
      {open && (
        <InlinePopover onClose={() => setOpen(false)}>
          <div className={styles.skeinPick}>
            <input
              className={styles.skeinInput}
              value={draft}
              autoFocus
              placeholder="skein name…"
              list="loom-skein-options"
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commit() }
              }}
            />
            <div className={styles.skeinList}>
              {skeins.filter(s => s !== thread.skein).map(s => (
                <button key={s} type="button" className={styles.skeinOption} onClick={() => commit(s)}>{s}</button>
              ))}
              {thread.skein && (
                <button type="button" className={`${styles.skeinOption} ${styles.loosen}`} onClick={() => commit('')}>
                  loosen (no skein)
                </button>
              )}
            </div>
          </div>
        </InlinePopover>
      )}
    </div>
  )
}
