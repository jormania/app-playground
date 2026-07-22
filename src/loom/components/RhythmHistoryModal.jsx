import { useMemo } from 'react'
import { Modal } from '../../ds/components/Modal'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { rhythmLast7Days } from '../lib/model.js'
import { RhythmIcon } from './icons.jsx'
import styles from './RhythmHistoryModal.module.css'

const STATUS_LABEL_KEY = { done: 'woven', open: 'onLoom', none: 'rhythmDayNone', off: 'rhythmDayOff' }

// The last 7 days (today inclusive), per rhythm thread — a HabitNow-style streak
// strip, but read the Tapestry's own descriptive way: no percentages, no streak
// counts, no calendar. Just what happened each of the last seven days, grouped
// by rhythm skein in the order they're set (Settings → rhythms). Pure read —
// this view has no actions of its own; edit the templates from the Skeins view.
export default function RhythmHistoryModal({ open, onClose, threads, rhythms }) {
  const { t } = useLexicon()
  const rows = useMemo(() => (open ? rhythmLast7Days(threads, rhythms) : []), [open, threads, rhythms])

  return (
    <Modal open={open} onClose={onClose} title={t('rhythmHistory')}>
      <div className={styles.body}>
        <p className={styles.lede}>{t('rhythmHistoryLede')}</p>

        {rows.length === 0 && <p className={styles.empty}>{t('rhythmHistoryEmpty')}</p>}

        {(rhythms || []).map(({ skeinName }) => {
          const templates = rows.filter(r => r.skeinName === skeinName)
          if (templates.length === 0) return null
          return (
            <section key={skeinName} className={styles.skeinSection}>
              <h3 className={styles.skeinTitle}><RhythmIcon /> {skeinName}</h3>
              <ul className={styles.templateList}>
                {templates.map(tpl => (
                  <li key={tpl.title} className={styles.templateRow}>
                    <p className={styles.templateTitle}>{tpl.title}</p>
                    <div className={styles.strip}>
                      {tpl.cells.map(cell => (
                        <span
                          key={cell.key}
                          className={`${styles.cell} ${styles[`is${cell.status}`]}`}
                          title={`${cell.label} ${cell.dayNum} — ${t(STATUS_LABEL_KEY[cell.status])}`}
                        >
                          <span className={styles.cellLabel}>{cell.label[0]}</span>
                          <span className={styles.cellNum}>{cell.dayNum}</span>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Modal>
  )
}
