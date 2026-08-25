import { useState } from 'react'
import { Modal, Button } from '../ds'
import { toDraft, FINDINGS_CATEGORIES } from './wanderlist.js'
import { useT } from './i18n.js'

/**
 * The save handoff, as an editable draft.
 *
 * Radar-B never writes silently. "Never write on the first pass — always show a
 * draft and wait for go-ahead" is the wanderlist skill's own intake rule, and it
 * belongs here for the same reason it belongs there: the row you are about to
 * create is one you will read months later, and a wrong Category or a missing
 * address is expensive then and free to fix now.
 */
export function SaveSheet({ event, now, onCancel, onConfirm, busy, error }) {
  const t = useT()
  const [draft, setDraft] = useState(() => toDraft(event, now))
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <Modal open onClose={onCancel} title={t('save.title')}>
      <label className="field">
        <span>{t('save.name')}</span>
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <label className="field">
        <span>{t('save.description')}</span>
        <textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} />
      </label>

      <label className="field">
        <span>{t('save.category')}</span>
        <select value={draft.category} onChange={(e) => set({ category: e.target.value })}>
          {FINDINGS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <label className="field">
        <span>{t('save.place')}</span>
        <input value={draft.place} onChange={(e) => set({ place: e.target.value })} placeholder={t('save.placePlaceholder')} />
        <span className="hint">{t('save.placeHint')}</span>
      </label>

      <label className="field">
        <span>{t('save.link')}</span>
        <input value={draft.link} onChange={(e) => set({ link: e.target.value })} />
      </label>

      <label className="field">
        <span>{t('save.expires')}</span>
        <input type="date" value={draft.dateExpiring ?? ''} onChange={(e) => set({ dateExpiring: e.target.value || null })} />
        <span className="hint">{t('save.expiresHint')}</span>
      </label>

      {/* Attended and Going are deliberately absent: a new row is never either,
          even with a date set — a known date is not a commitment. */}
      <p className="provenanceNote">
        {t('save.note')}
      </p>

      {error && <p className="notice warn">{error}</p>}

      <div className="actions">
        <Button variant="ghost" onClick={onCancel}>{t('save.cancel')}</Button>
        <Button onClick={() => onConfirm(draft)} disabled={busy || !draft.name.trim()}>
          {busy ? t('detail.saving') : t('save.confirm')}
        </Button>
      </div>
    </Modal>
  )
}
