import { useRef, useState } from 'react'
import InlinePopover from './InlinePopover.jsx'
import { useLexicon } from '../lib/lexiconContext.jsx'
import styles from './Assign.module.css'

// Move a thread along the warp — reassign it to another day of the week, or to
// the backlog. No modal: tap the day, pick a new one. `days` is weekDays().
export default function DayMover({ thread, days, onMove }) {
  const { t } = useLexicon()
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const current = days.find(d => d.key === thread.day)
  const label = current ? current.label[0] : '·'

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.chip}
        ref={btnRef}
        aria-label="Move to another day"
        onClick={() => setOpen(o => !o)}
      >{label}</button>
      {open && (
        <InlinePopover anchorRef={btnRef} onClose={() => setOpen(false)}>
          <div className={styles.warp}>
            {days.map(d => (
              <button
                key={d.key}
                type="button"
                className={`${styles.warpDot} ${d.key === thread.day ? styles.here : ''}`}
                onClick={() => { onMove(d.key); setOpen(false) }}
                title={`${d.label} ${d.dayNum}`}
              >{d.label[0]}</button>
            ))}
            <button
              type="button"
              className={`${styles.warpDot} ${styles.backlog} ${!thread.day ? styles.here : ''}`}
              onClick={() => { onMove(null); setOpen(false) }}
              title={t('Distaff')}
            >⌂</button>
          </div>
        </InlinePopover>
      )}
    </div>
  )
}
