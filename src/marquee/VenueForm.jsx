import { useEffect, useState } from 'react'
import { Button, Field, Modal, TextAreaField } from '../ds'
import { SelectField } from '../ds/components/SelectField'
import { validateVenue, suggestName, normalizeVenue, CATEGORIES, AREAS } from './venues.js'
import { getAdapter } from './adapters.js'

const BLANK = { name: '', url: '', category: 'event', area: '', address: '', notes: '' }

/** Add or edit one venue.
 *
 *  The URL leads: paste it first and the adapter resolves from it, the name
 *  fills itself in, and the form says up front whether Marquee can actually read
 *  this site — rather than accepting anything and failing silently at scan time.
 */
export default function VenueForm({ open, venue, existing, onSave, onClose }) {
  const [draft, setDraft] = useState(BLANK)
  const [touchedName, setTouchedName] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState(null)

  const editing = Boolean(venue?.id)

  useEffect(() => {
    if (!open) return
    setDraft(venue ? { ...BLANK, ...normalizeVenue(venue) } : BLANK)
    setTouchedName(Boolean(venue?.name))
    setSubmitted(false)
    setFailure(null)
  }, [open, venue])

  const check = validateVenue(draft, existing)
  const reader = getAdapter(check.venue.adapter)

  function setUrl(url) {
    setDraft((d) => ({
      ...d,
      url,
      // Only autofill a name the user hasn't written themselves.
      name: touchedName ? d.name : suggestName(url),
    }))
  }

  async function submit(event) {
    event.preventDefault()
    setSubmitted(true)
    if (!check.ok || saving) return
    setSaving(true)
    setFailure(null)
    try {
      await onSave(check.venue)
      onClose()
    } catch (err) {
      setFailure(err?.message || 'Could not save that venue.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title={editing ? 'Edit venue' : 'Add a venue'} onClose={onClose}>
      <form onSubmit={submit} className="vform">
        <Field
          label="Programme page URL"
          required
          type="url"
          inputMode="url"
          placeholder="https://teatrul-excelsior.ro/program/"
          value={draft.url}
          onChange={(e) => setUrl(e.target.value)}
          hint="The listing page, not the venue’s homepage."
          error={submitted ? check.problemFor('url') : undefined}
        />

        {draft.url && (
          <p className={`reader ${check.matched ? 'reader--ok' : 'reader--warn'}`}>
            {check.matched
              ? `Read by the ${reader?.label} reader${check.venue.config ? ` (${check.venue.config})` : ''}.`
              : 'No built-in reader for this site.'}
            {reader?.note && check.matched ? ` ${reader.note}` : ''}
          </p>
        )}

        <Field
          label="Venue name"
          required
          value={draft.name}
          onChange={(e) => { setTouchedName(true); setDraft((d) => ({ ...d, name: e.target.value })) }}
          hint="How it should read on a saved Wanderlist finding."
          error={submitted ? check.problemFor('name') : undefined}
        />

        <SelectField
          label="Saves as"
          value={draft.category ?? 'event'}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          hint="Wanderlist Category applied when you keep an event from here."
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectField>

        <SelectField
          label="Area"
          value={draft.area ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, area: e.target.value }))}
        >
          <option value="">—</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </SelectField>

        <Field
          label="Address"
          value={draft.address ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
          hint="Optional — but it makes a saved finding drop its map pin first try."
        />

        <TextAreaField
          label="Notes"
          rows={2}
          value={draft.notes ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
        />

        {check.warnings.map((w) => <p key={w} className="warn">{w}</p>)}
        {submitted && check.problems.filter((p) => p.field === 'form').map((p) => (
          <p key={p.message} className="warn warn--stop" role="alert">{p.message}</p>
        ))}
        {failure && <p className="warn warn--stop" role="alert">{failure}</p>}

        <div className="vform__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add venue'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
