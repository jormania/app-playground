import { expiryLabel, daysUntil, formatMedium } from './dates.js'
import { CheckIcon, CheckCircleIcon, ExternalIcon, HourglassIcon, CalendarIcon, TicketIcon } from './icons.jsx'
import MetaChips from './MetaChips.jsx'

// Primary read view: the triaged, sorted backlog as cards. Expiring-soon items carry a
// warm pill and (via App's sort) float up; attended items dim and sink. The row is a
// focusable div so the tappable filter chips + quick actions can nest inside it.
function ExpiryPill({ dateKey, today }) {
  const n = daysUntil(dateKey, today)
  if (n == null) return null
  const urgency = n < 0 ? 'expired' : n <= 3 ? 'soon' : n <= 14 ? 'near' : 'far'
  return <span className={`expiry-pill ${urgency}`}><HourglassIcon /> {expiryLabel(dateKey, today)}</span>
}

export default function ListView({ entries, total, onOpen, onChip, onToggleAttended, emptyMessage, today }) {
  if (!entries.length) {
    return (
      <div className="empty">
        <p>{emptyMessage || 'Nothing here yet. Add the first thing you mean to go and see.'}</p>
      </div>
    )
  }

  const shown = entries.length
  const countText = (total != null && shown !== total)
    ? `${shown} of ${total}`
    : `${shown} ${shown === 1 ? 'thing' : 'things'}`

  return (
    <div className="list">
      <div className="list-count">{countText}</div>
      {entries.map(e => (
        <div
          key={e.id}
          className={`entry-row${e.attended ? ' attended' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(e)}
          onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen(e) } }}
        >
          <div className="row-main">
            <div className="row-top">
              <span className="row-name">{e.name || 'Untitled'}</span>
              {e.pending && <span className="pending-pill" title="Saved on this device — will sync to Notion when you’re online">unsynced</span>}
            </div>
            <div className="row-badges">
              {e.attended && <span className="attended-pill"><CheckCircleIcon /> attended</span>}
              {!e.attended && e.dateExpiring && <ExpiryPill dateKey={e.dateExpiring} today={today} />}
              {e.plannedDate && <span className="when-pill"><CalendarIcon /> planned {formatMedium(e.plannedDate)}</span>}
              {e.tickets?.length > 0 && <span className="ticket-badge" title={`${e.tickets.length} ticket${e.tickets.length === 1 ? '' : 's'}`}><TicketIcon /> {e.tickets.length}</span>}
            </div>
            {e.description && <div className="row-excerpt">{e.description}</div>}
            <MetaChips category={e.category} place={e.place} tags={e.tags} onChip={onChip} />
          </div>
          <div className="row-side">
            {e.photo && (
              <div className="photo-thumb photo-thumb-sm" title="Has a photo">
                <img src={e.photo.url} alt="" loading="lazy" />
              </div>
            )}
            {e.link && (
              <a className="row-link" href={e.link} target="_blank" rel="noopener" title="Open link"
                 onClick={ev => ev.stopPropagation()}><ExternalIcon /></a>
            )}
            <button
              className={`row-check${e.attended ? ' on' : ''}`}
              title={e.attended ? 'Mark as not attended' : 'Mark attended'}
              aria-label={e.attended ? 'Mark as not attended' : 'Mark attended'}
              aria-pressed={e.attended}
              onClick={ev => { ev.stopPropagation(); onToggleAttended(e) }}
            >
              <CheckIcon />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
