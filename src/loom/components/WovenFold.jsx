import { useState } from 'react'
import ThreadRow from './ThreadRow.jsx'
import { useLexicon } from '../lib/lexiconContext.jsx'
import styles from './WovenFold.module.css'

// A fold — not a hide — for a group's woven threads. Keeps a long day scannable
// by tucking the done work under one line you can open. The rows inside stay
// live (tap the knot to un-weave, ✂ to unravel) but aren't drag sources.
export default function WovenFold({ tasks, onToggle, onDelete, onEdit }) {
  const { t } = useLexicon()
  const [open, setOpen] = useState(false)
  if (!tasks.length) return null

  return (
    <div className={styles.fold}>
      <button
        type="button"
        className={styles.summary}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.caret} aria-hidden="true">{open ? '▾' : '▸'}</span>
        {tasks.length} {t('woven')}
      </button>
      {open && (
        <ul className={styles.list}>
          {tasks.map(thread => (
            <div key={thread.id} className={styles.slot}>
              <ThreadRow
                thread={thread}
                index={99}
                onToggle={done => onToggle(thread.id, done)}
                onDelete={() => onDelete(thread.id)}
                onEdit={title => onEdit(thread.id, title)}
              />
            </div>
          ))}
        </ul>
      )}
    </div>
  )
}
