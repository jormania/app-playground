import { useState } from 'react'
import { formatHuman, expiryLabel, daysUntil } from './dates.js'
import { BackIcon, ExternalIcon, MapIcon, CheckCircleIcon, HourglassIcon, CalendarIcon, TicketIcon } from './icons.jsx'
import MetaChips from './MetaChips.jsx'
import Lightbox from './Lightbox.jsx'

// Single-item detail view: name, the deadline + event date, a photo (if any), Category/
// Place/Tags chips (tap to filter), the description, tickets (if any), and the primary
// triage actions — Mark attended and Edit — plus quick links to the event page and map.
export default function EntryView({ entry, onBack, onEdit, onChip, onToggleAttended, saving, today }) {
  const n = entry.dateExpiring ? daysUntil(entry.dateExpiring, today) : null
  const urgency = n == null ? '' : n < 0 ? 'expired' : n <= 3 ? 'soon' : n <= 14 ? 'near' : 'far'
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <article className="entry-view">
      <div className="detail-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back to the list" title="Back"><BackIcon /></button>
        <div className="detail-actions">
          {entry.attended
            ? <button className="btn done" onClick={() => onToggleAttended(entry)} disabled={saving} title="Tap to mark as not attended"><CheckCircleIcon /> Attended</button>
            : <button className="btn primary" onClick={() => onToggleAttended(entry)} disabled={saving}><CheckCircleIcon /> Mark attended</button>}
          <button className="btn" onClick={() => onEdit(entry)} title="Edit this item">Edit</button>
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

      {entry.photo && (
        <div className="entry-photo">
          <button type="button" className="photo-thumb" onClick={() => setLightboxOpen(true)} title="View full size">
            <img src={entry.photo.url} alt="" />
          </button>
        </div>
      )}
      {lightboxOpen && entry.photo && <Lightbox src={entry.photo.url} alt={entry.name} onClose={() => setLightboxOpen(false)} />}

      {entry.description && <div className="ev-body">{entry.description}</div>}

      <MetaChips category={entry.category} place={entry.place} tags={entry.tags} onChip={onChip} />

      {entry.tickets?.length > 0 && (
        <div className="ticket-section">
          <span className="field-label"><TicketIcon /> tickets</span>
          <ul className="ticket-list plain">
            {entry.tickets.map((t, i) => (
              <li key={i} className="ticket-row">
                <TicketIcon />
                <a href={t.url} target="_blank" rel="noopener">{t.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(entry.link || entry.placeUrl) && (
        <div className="ev-links">
          {entry.link && <a className="btn btn-sm" href={entry.link} target="_blank" rel="noopener"><ExternalIcon /> Open link</a>}
          {entry.placeUrl && <a className="btn btn-sm" href={entry.placeUrl} target="_blank" rel="noopener"><MapIcon /> Open in Maps</a>}
        </div>
      )}
    </article>
  )
}
