import { useState } from 'react'
import { formatHuman, formatTime, expiryLabel, daysUntil, isPlannedPast } from './dates.js'
import { BackIcon, ExternalIcon, MapIcon, CheckCircleIcon, HourglassIcon, CalendarIcon, CalendarPlusIcon, TicketIcon, ShareIcon } from './icons.jsx'
import MetaChips from './MetaChips.jsx'
import Lightbox from './Lightbox.jsx'
import { shareNative } from './share.js'
import { googleCalendarUrl } from './calendar.js'

// Single-item detail view. Header grammar: Back + Edit sit together on the left as one
// secondary-button pair; the one decision that changes the item's state — Mark attended —
// hugs the right. Below: badges, photo, description, chips, tickets, and one links row
// (Open link / Open in Maps / Share…) — Share opens the OS sheet (WhatsApp, Email, and
// everything else the device offers), text-only, no attachments.
export default function EntryView({ entry, onBack, onEdit, onChip, onToggleAttended, saving, today }) {
  const n = entry.dateExpiring ? daysUntil(entry.dateExpiring, today) : null
  const urgency = n == null ? '' : n < 0 ? 'expired' : n <= 3 ? 'soon' : n <= 14 ? 'near' : 'far'
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [shareStatus, setShareStatus] = useState(null) // null | 'copied' | 'error'

  async function handleShare() {
    const r = await shareNative(entry)
    if (r.copied) setShareStatus('copied')
    else if (!r.ok) setShareStatus('error')
    else return
    window.setTimeout(() => setShareStatus(null), 3000)
  }

  return (
    <article className="entry-view">
      <div className="detail-head">
        <div className="detail-nav">
          <button className="btn" onClick={onBack}><BackIcon /> Back</button>
          <button className="btn" onClick={() => onEdit(entry)} title="Edit this item">Edit</button>
        </div>
        {entry.attended
          ? <button className="btn done" onClick={() => onToggleAttended(entry)} disabled={saving} title="Tap to mark as not attended"><CheckCircleIcon /> Attended</button>
          : <button className="btn primary" onClick={() => onToggleAttended(entry)} disabled={saving}><CheckCircleIcon /> Mark attended</button>}
      </div>

      <div className="ev-badges">
        {entry.attended && <span className="attended-pill"><CheckCircleIcon /> attended</span>}
        {/* Once attended, the deadline no longer matters (same rule as the list and the
            sort) — so no urgency-coloured "expired N days ago" on a thing already done. */}
        {!entry.attended && entry.dateExpiring && (
          <span className={`expiry-pill ${urgency}`}><HourglassIcon /> {expiryLabel(entry.dateExpiring, today)} · {formatHuman(entry.dateExpiring)}</span>
        )}
        {entry.plannedDate && (
          <span className={`when-pill${isPlannedPast(entry, today) ? ' slipped' : ''}${entry.going ? ' going' : ''}`}>
            <CalendarIcon /> {isPlannedPast(entry, today) ? 'was planned' : entry.going ? 'going' : 'planned'} · {formatHuman(entry.plannedDate)}
            {entry.plannedTime ? ` · ${formatTime(entry.plannedTime)}` : ''}
          </span>
        )}
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

      <MetaChips category={entry.category} place={entry.place} placeUrl={entry.placeUrl} tags={entry.tags} cost={entry.cost} onChip={onChip} />

      {entry.tickets?.length > 0 && (
        <div className="ticket-section">
          <span className="field-label"><TicketIcon /> tickets · paid</span>
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

      <div className="ev-links">
        {entry.link && <a className="btn btn-sm" href={entry.link} target="_blank" rel="noopener"><ExternalIcon /> Open link</a>}
        {/* Add to Calendar — opens Google Calendar's create-event editor, prefilled. A
            planned date + time (and going) arrive as a timed block one tap from saved; a
            vaguer entry opens with the date left for you to set. See calendar.js. */}
        <a className="btn btn-sm" href={googleCalendarUrl(entry)} target="_blank" rel="noopener"><CalendarPlusIcon /> Add to Calendar</a>
        {entry.placeUrl && <a className="btn btn-sm" href={entry.placeUrl} target="_blank" rel="noopener"><MapIcon /> Open in Maps</a>}
        <button type="button" className="btn btn-sm" onClick={handleShare}><ShareIcon /> Share…</button>
        {shareStatus === 'copied' && <span className="share-status">Copied to clipboard</span>}
        {shareStatus === 'error' && <span className="share-status err">Couldn’t share</span>}
      </div>
    </article>
  )
}
