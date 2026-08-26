import { useEffect, useState } from 'react'
import { Button, Field, Modal, TextAreaField } from '../ds'
import { SelectField } from '../ds/components/SelectField'
import { toDraft, FINDINGS_CATEGORIES } from './wanderlist.js'
import { savedShowing, savedForProduction } from './findings.js'
import { formatDay } from './format.js'

/** Keep a showing → a Wanderlist Findings row.
 *
 *  The draft is editable before it is written, because the thing Marquee knows
 *  (title, venue, date, ticket link) is not always the thing worth remembering.
 *  What it will not do is decide for you: `Going` is never set here, so nothing
 *  arrives in Wanderlist claiming you have committed to it.
 */
export default function KeepSheet({ open, showing, production, venue, demo, findings, onSave, onClose }) {
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState(null)
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false)

  useEffect(() => {
    if (!open || !showing) return
    setDraft(toDraft(showing, { venue, production }))
    setFailure(null)
    setConfirmedDuplicate(false)
  }, [open, showing, production, venue])

  // `showing` is cleared the instant the sheet closes, one render BEFORE `draft`
  // would be. Guarding on `draft` alone left the JSX below reading `showing.venue`
  // on that render — which crashed the whole app to a white screen immediately
  // after a successful save, the worst possible moment to do it.
  if (!draft || !showing) return null

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  // Already in Wanderlist? Two different answers, because they deserve different
  // warnings: this exact night, or some other date of the same run.
  const duplicate = savedShowing(findings, showing)
  const siblings = duplicate ? [] : savedForProduction(findings, production ?? { title: showing.title, venue: showing.venue, showings: [] })
  const blocked = Boolean(duplicate) && !confirmedDuplicate

  async function submit(event) {
    event.preventDefault()
    if (saving || blocked) return
    setSaving(true)
    setFailure(null)
    try {
      await onSave(draft, showing, production)
      onClose()
    } catch (err) {
      setFailure(err?.message || 'Could not save to Wanderlist.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Keep in Wanderlist" onClose={onClose}>
      <form className="vform" onSubmit={submit}>
        <p className="sheet__context">
          {showing.venue}
          {showing.hall ? ` · ${showing.hall}` : ''}
          {showing.date ? ` · ${formatDay(showing.date)}` : ''}
          {showing.time ? ` ${showing.time}` : ''}
          {showing.ticketState === 'sold-out' ? ' · listed as sold out' : ''}
        </p>

        <Field label="Name" required value={draft.name} onChange={(e) => set({ name: e.target.value })} />

        <TextAreaField
          label="Description"
          rows={2}
          value={draft.description ?? ''}
          onChange={(e) => set({ description: e.target.value })}
        />

        <SelectField
          label="Category"
          value={draft.category}
          onChange={(e) => set({ category: e.target.value })}
          hint="From the venue’s default. Wanderlist’s vocabulary is closed — nothing else can be written."
        >
          {FINDINGS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectField>

        <Field
          label="Place"
          value={draft.place ?? ''}
          onChange={(e) => set({ place: e.target.value })}
          hint="Venue plus street and city, or Wanderlist can’t drop a map pin."
        />

        <Field label="Link" type="url" value={draft.link ?? ''} onChange={(e) => set({ link: e.target.value })} />

        <div className="vform__row">
          <Field
            label="Planned date"
            type="date"
            value={draft.plannedDate ?? ''}
            onChange={(e) => set({ plannedDate: e.target.value })}
          />
          <Field
            label="Time"
            type="time"
            value={draft.plannedTime ?? ''}
            onChange={(e) => set({ plannedTime: e.target.value })}
          />
        </div>

        <Field
          label="Cost (lei)"
          type="number"
          inputMode="numeric"
          value={draft.cost ?? ''}
          onChange={(e) => set({ cost: e.target.value === '' ? null : Number(e.target.value) })}
          hint="Left blank unless the venue published a price. Never guessed."
        />

        <p className="warn">
          Saved without <strong>Going</strong> — Marquee never marks you as committed. Set that in
          Wanderlist when you decide.
        </p>
        {duplicate && (
          <p className="warn warn--stop" role="alert">
            <strong>This night is already in Wanderlist</strong>
            {duplicate.going ? ', marked as going' : ''}
            {duplicate.attended ? ', already attended' : ''}. Keeping it again writes a second row.
          </p>
        )}
        {!duplicate && siblings.length > 0 && (
          <p className="warn">
            Another date of {showing.title} is already in Wanderlist. This is a different night, so
            it will be a separate row.
          </p>
        )}
        {demo && <p className="warn">Demo mode: this won’t actually reach Notion.</p>}
        {failure && <p className="warn warn--stop" role="alert">{failure}</p>}

        <div className="vform__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          {blocked ? (
            <Button type="button" variant="danger" onClick={() => setConfirmedDuplicate(true)}>
              Keep a second copy
            </Button>
          ) : (
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Keep it'}</Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
