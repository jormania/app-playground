import { useEffect, useState } from 'react'
import { Modal } from '../../ds/components/Modal'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { draftItemsFromWeek } from '../lib/model.js'
import { loadDrafts, addDraft, updateDraft, removeDraft } from '../lib/drafts.js'
import { tap } from '../lib/haptics.js'
import styles from './DraftsModal.module.css'

// Drafts — recurring weaves. Save this week's open threads as a named set, then
// weave any draft onto the shown week in one tap. Flag a draft to re-weave every
// week and the week view will offer it on each fresh Monday. All device-local.
export default function DraftsModal({ open, onClose, threads, days, weekStartDate, weekLabel, actions }) {
  const { t } = useLexicon()
  const [drafts, setDrafts] = useState([])
  const [name, setName] = useState('')
  const refresh = () => setDrafts(loadDrafts())

  useEffect(() => { if (open) { refresh(); setName('') } }, [open])

  const snapshot = draftItemsFromWeek(threads, days)

  function save() {
    const items = draftItemsFromWeek(threads, days)
    if (items.length === 0) return
    addDraft({ name: name.trim() || 'Untitled week', items })
    setName('')
    refresh()
    tap(10)
  }
  function cast(draft) {
    actions.castDraft(draft, weekStartDate)
    tap(10)
    onClose()
  }
  function toggleRepeat(draft) {
    updateDraft(draft.id, { repeat: !draft.repeat })
    refresh()
  }
  function remove(draft) {
    removeDraft(draft.id)
    refresh()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('Drafts')}>
      <div className={styles.body}>
        <p className={styles.lede}>{t('draftsLede')}</p>

        <div className={styles.saveRow}>
          <input
            className={styles.name}
            value={name}
            placeholder={`Name this week (${weekLabel})…`}
            aria-label="Name for the new draft"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
          />
          <button
            type="button"
            className={styles.save}
            onClick={save}
            disabled={snapshot.length === 0}
            title={snapshot.length === 0 ? 'Nothing open on this week to save' : t('saveDraft')}
          >{t('saveDraft')}</button>
        </div>
        <p className={styles.hint}>
          {snapshot.length > 0
            ? `Saves the ${snapshot.length} open ${snapshot.length === 1 ? t('thread') : t('threads')} on this week, each on its weekday.`
            : `No open ${t('threads')} on this week yet.`}
        </p>

        {drafts.length === 0 ? (
          <p className={styles.empty}>No {t('drafts')} yet — save a week above to make your first.</p>
        ) : (
          <ul className={styles.list}>
            {drafts.map(d => (
              <li key={d.id} className={styles.draft}>
                <div className={styles.draftMain}>
                  <span className={styles.draftName}>{d.name}</span>
                  <span className={styles.draftCount}>{(d.items || []).length} {(d.items || []).length === 1 ? t('thread') : t('threads')}</span>
                </div>
                <div className={styles.draftActions}>
                  <button
                    type="button"
                    className={`${styles.repeat} ${d.repeat ? styles.repeatOn : ''}`}
                    aria-pressed={!!d.repeat}
                    onClick={() => toggleRepeat(d)}
                    title={t('repeatWeekly')}
                  >⟳</button>
                  <button type="button" className={styles.cast} onClick={() => cast(d)}>{t('castDraft')}</button>
                  <button type="button" className={styles.del} aria-label={`Delete ${d.name}`} onClick={() => remove(d)}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
