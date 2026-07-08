import { formatHuman, expiryLabel, daysUntil } from './dates.js'
import { BackIcon, ExternalIcon, MapIcon, CheckCircleIcon, HourglassIcon, CalendarIcon } from './icons.jsx'
import MetaChips from './MetaChips.jsx'

// Single-item detail view: name, the deadline + event date, Category/Place/Tags chips
// (tap to filter), the description, and the primary triage actions — Mark attended and
// Edit — plus quick links to the event page and the map pin.
export default function EntryView({ entry, onBack, onEdit, onChip, onToggleAttended, saving, today }) {
  const n = entry.dateExpiring ? daysUntil(entry.dateExpiring, today) : null
  const urgency = n == null ? '' : n < 0 ? 'expired' : n <= 3 ? 'soon' : n <= 14 ? 'near' : 'far'

  return (
    <article className="entry-view">
      <div className="editor-head">
        <button className="btn-ghost" onClick={onBack}><BackIcon /> back</button>
        <div className="ev-actions">
          <button className={`btn${entry.attended ? '' : ' primary'}`} onClick={() => onToggleAttended(entry)} disabled={saving}>
            <CheckCircleIcon /> {entry.attended ? 'Attended ✓ — undo' : 'Mark attended'}
          </button>
          <button className="btn btn-sm" onClick={() => onEdit(entry)}>Edit</button>
        </div>
      </div>

      <div className="ev-badges">
        {entry.attended && <span className="attended-pill"><CheckCircleIcon /> attended</span>}
        {entry.dateExpiring && (
          <span className={`expiry-pill ${urgency}`}><HourglassIcon /> {expiryLabel(entry.dateExpiring, today)} · {formatHuman(entry.dateExpiring)}</span>
        )}
        {entry.plannedDate && <span className="when-pill"><CalendarIcon /> planned · {formatHuman(entry.plannedDate)}</span>}
        {entry.pending && <span className="pending-pill" title="Saved on this device — will sync to Notion when you’re online">unsynced</span>}
      </div>

      <h1>{entry.name || 'Untitled'}</h1>

      {entry.description && <div className="ev-body">{entry.description}</div>}

      <MetaChips category={entry.category} place={entry.place} tags={entry.tags} onChip={onChip} />

      {(entry.link || entry.placeUrl) && (
        <div className="ev-links">
          {entry.link && <a className="btn btn-sm" href={entry.link} target="_blank" rel="noopener"><ExternalIcon /> Open link</a>}
          {entry.placeUrl && <a className="btn btn-sm" href={entry.placeUrl} target="_blank" rel="noopener"><MapIcon /> Open in Maps</a>}
        </div>
      )}
    </article>
  )
}
