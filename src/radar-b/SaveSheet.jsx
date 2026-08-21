import { useState } from 'react'
import { Modal, Button } from '../ds'
import { toDraft, FINDINGS_CATEGORIES } from './wanderlist.js'

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
  const [draft, setDraft] = useState(() => toDraft(event, now))
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <Modal open onClose={onCancel} title="Salvează în Wanderlist">
      <label className="field">
        <span>Nume</span>
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <label className="field">
        <span>Descriere</span>
        <textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} />
      </label>

      <label className="field">
        <span>Categorie</span>
        <select value={draft.category} onChange={(e) => set({ category: e.target.value })}>
          {FINDINGS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <label className="field">
        <span>Loc</span>
        <input value={draft.place} onChange={(e) => set({ place: e.target.value })} placeholder="Nume, stradă, București" />
        <span className="hint">Adresa completă — Wanderlist pune pinul pe hartă din acest text.</span>
      </label>

      <label className="field">
        <span>Link</span>
        <input value={draft.link} onChange={(e) => set({ link: e.target.value })} />
      </label>

      <label className="field">
        <span>Expiră</span>
        <input type="date" value={draft.dateExpiring ?? ''} onChange={(e) => set({ dateExpiring: e.target.value || null })} />
        <span className="hint">Termenul până la care poți acționa. Gol dacă nu există unul real.</span>
      </label>

      {/* Attended and Going are deliberately absent: a new row is never either,
          even with a date set — a known date is not a commitment. */}
      <p className="provenanceNote">
        Se creează un rând nou în Findings, cu <code>Going</code> și <code>Attended</code> nebifate.
        Restul (dată planificată, bilete, poză) se editează în Wanderlist.
      </p>

      {error && <p className="notice warn">{error}</p>}

      <div className="actions">
        <Button variant="ghost" onClick={onCancel}>Renunță</Button>
        <Button onClick={() => onConfirm(draft)} disabled={busy || !draft.name.trim()}>
          {busy ? 'Se salvează…' : 'Salvează'}
        </Button>
      </div>
    </Modal>
  )
}
