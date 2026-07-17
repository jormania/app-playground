import { useMemo, useState } from 'react'
import { Modal } from '../../ds/components/Modal'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { orderForNew } from '../lib/model.js'
import { tap } from '../lib/haptics.js'
import styles from './RewarpRitual.module.css'

// The re-warp ritual — a guided, one-at-a-time pass over the threads still hanging
// from past weeks. For each: flick it forward onto a day of the new week (its own
// weekday is pre-lit), drop it back on the distaff, weave it done, or leave it.
// Batch escapes at the top handle "all of it the same way" in one tap.
export default function RewarpRitual({ open, carried, threads, days, actions, onClose }) {
  const { t } = useLexicon()
  // Freeze the queue when the ritual opens so acting on a thread doesn't reshuffle
  // the list under the finger.
  const queue = useMemo(() => carried, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0)

  const current = queue[i]
  const done = i >= queue.length

  function place(day) {
    const group = threads.filter(th => th.day === day)
    actions.patchThread(current.id, { day, order: orderForNew(group) })
    advance()
  }
  function toDistaff() {
    actions.patchThread(current.id, { day: null })
    advance()
  }
  function weave() {
    actions.toggleWoven(current.id, true)
    advance()
  }
  function leave() { advance() }
  function advance() { tap(8); setI(n => n + 1) }

  // Batch escapes over whatever's left in the queue from here on.
  function restToDistaff() {
    for (let k = i; k < queue.length; k++) actions.patchThread(queue[k].id, { day: null })
    setI(queue.length)
  }
  function restToWeekday() {
    for (let k = i; k < queue.length; k++) {
      const th = queue[k]
      const wd = weekdayFor(th.day)
      const day = days[wd].key
      const group = threads.filter(x => x.day === day)
      actions.patchThread(th.id, { day, order: orderForNew(group) })
    }
    setI(queue.length)
  }

  const suggestedWeekday = current ? weekdayFor(current.day) : 0

  return (
    <Modal open={open} onClose={onClose} title={t('rewarp')}>
      <div className={styles.body}>
        {queue.length === 0 ? (
          <p className={styles.empty}>{t('rewarpEmpty')}</p>
        ) : done ? (
          <div className={styles.summary}>
            <p className={styles.summaryLine}>{t('rewarpDone')}</p>
            <button type="button" className={styles.close} onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <p className={styles.lede}>{t('rewarpLede')}</p>
            <div className={styles.progress}>
              <span>{i + 1} / {queue.length}</span>
              <div className={styles.batch}>
                <button type="button" className={styles.batchBtn} onClick={restToWeekday}>All → their weekday</button>
                <button type="button" className={styles.batchBtn} onClick={restToDistaff}>All → {t('distaff')}</button>
              </div>
            </div>

            <div className={styles.card}>
              <p className={styles.cardTitle}>{current.title || <span className={styles.untitled}>untitled {t('thread')}</span>}</p>
              <p className={styles.cardMeta}>
                {current.skein && <span className={styles.skein}>{current.skein}</span>}
                <span className={styles.oldDate}>was {prettyDate(current.day)}</span>
              </p>
            </div>

            <div className={styles.warpRow}>
              {days.map((d, idx) => (
                <button
                  key={d.key}
                  type="button"
                  className={`${styles.dayDot} ${idx === suggestedWeekday ? styles.suggested : ''}`}
                  onClick={() => place(d.key)}
                  title={`${d.label} ${d.dayNum}`}
                >
                  <span className={styles.dotLabel}>{d.label[0]}</span>
                  <span className={styles.dotNum}>{d.dayNum}</span>
                </button>
              ))}
            </div>

            <div className={styles.choices}>
              <button type="button" className={styles.choice} onClick={toDistaff}>↓ {t('distaff')}</button>
              <button type="button" className={styles.choice} onClick={weave}>✧ {t('weave')} it done</button>
              <button type="button" className={`${styles.choice} ${styles.leave}`} onClick={leave}>Leave it</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )

  // 0 = Monday … 6 = Sunday for a day key, defaulting to Monday.
  function weekdayFor(key) {
    const [y, m, d] = String(key).split('-').map(Number)
    return (new Date(y, m - 1, d).getDay() + 6) % 7
  }
  function prettyDate(key) {
    const [y, m, d] = String(key).split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
}
