import { useState } from 'react'
import { expiryLabel, daysUntil, formatMedium, formatTime, isPastExpired, isPlannedPast } from './dates.js'
import { CheckIcon, CheckCircleIcon, ExternalIcon, HourglassIcon, CalendarIcon, TicketIcon } from './icons.jsx'
import MetaChips from './MetaChips.jsx'
import Lightbox from './Lightbox.jsx'
import TicketsModal from './TicketsModal.jsx'
import { openTickets } from './links.js'
import { haptic } from './haptics.js'

// Primary read view: the triaged, sorted backlog as cards. Expiring-soon items carry a
// warm pill and (via App's sort) float up; attended items dim and sink. The row is a
// focusable div so the tappable filter chips + quick actions can nest inside it.
function ExpiryPill({ dateKey, today }) {
  const n = daysUntil(dateKey, today)
  if (n == null) return null
  const urgency = n < 0 ? 'expired' : n <= 3 ? 'soon' : n <= 14 ? 'near' : 'far'
  return <span className={`expiry-pill ${urgency}`}><HourglassIcon /> {expiryLabel(dateKey, today)}</span>
}

export default function ListView({ entries, total, onOpen, onChip, onToggleAttended, onToggleGoing, emptyMessage, today, sort }) {
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [ticketsFor, setTicketsFor] = useState(null)

  if (!entries.length) {
    return (
      <div className="empty">
        <p>{emptyMessage || 'Nothing here yet. Add the first thing you mean to go and see.'}</p>
      </div>
    )
  }

  const shown = entries.length
  // "Curiosities threading through your city" over a bare count of "things" — the same
  // register as the masthead's "a city worth wandering", not a plain tally.
  const noun = shown === 1 ? 'curiosity' : 'curiosities'
  const prefix = (total != null && shown !== total) ? `${shown} of ${total}` : `${shown}`
  const countText = `${prefix} ${noun} threading through your city`

  return (
    <div className="list">
      <div className="list-count">{countText}</div>
      {entries.map((e, i) => {
        const sunk = sort === 'expiring' && isPastExpired(e, today)
        const divider = sunk && !(i > 0 && sort === 'expiring' && isPastExpired(entries[i - 1], today))
        return (
        <div key={e.id}>
          {divider && <div className="past-divider"><span>past</span></div>}
          <div
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
                {e.plannedDate && (
                  <span className={`when-pill${isPlannedPast(e, today) ? ' slipped' : ''}${e.going ? ' going' : ''}`}>
                    <CalendarIcon /> {isPlannedPast(e, today) ? 'was planned' : e.going ? 'going' : 'planned'} {formatMedium(e.plannedDate)}
                    {e.plannedTime ? `, ${formatTime(e.plannedTime)}` : ''}
                  </span>
                )}
              </div>
              {e.description && <div className="row-excerpt">{e.description}</div>}
              <MetaChips category={e.category} place={e.place} placeUrl={e.placeUrl} tags={e.tags} onChip={onChip} />
            </div>
            {/* A quick-check rail: Attended shows always, on or off, so it's a stable
                landmark; Photo/Link/Paid are situational shortcuts to that thing (photo,
                link, ticket); Going is a second toggle, situational (only once there's a
                Planned Date to be going TO), distinct from the same field's checkbox in
                the editor — this is the fast in-list path, that one's the deliberate-edit
                path. Each toggle/status gets its own colour (green=Attended, blue=Going,
                gold=Paid), matched everywhere else that colour appears (pills, calendar). */}
            <div className="row-side">
              {e.photo && (
                <button
                  type="button"
                  className="photo-thumb photo-thumb-sm"
                  title="Has a photo — tap to view"
                  aria-label="Open photo"
                  onClick={ev => { ev.stopPropagation(); haptic(); setLightboxSrc(e.photo.url) }}
                ><img src={e.photo.url} alt="" loading="lazy" /></button>
              )}
              {e.link && (
                <a className="row-link" href={e.link} target="_blank" rel="noopener" title="Open link"
                   onClick={ev => { ev.stopPropagation(); haptic() }}><ExternalIcon /></a>
              )}
              {e.tickets?.length > 0 && (
                <button
                  type="button"
                  className="row-paid"
                  title={`Paid — ${e.tickets.length} ticket${e.tickets.length === 1 ? '' : 's'} on file — tap to open`}
                  aria-label="Open tickets"
                  onClick={ev => {
                    ev.stopPropagation()
                    haptic()
                    // Exactly one ticket has an obvious target — open it directly. More
                    // than one has no single "the" ticket, so list them instead of
                    // jumping straight to the full entry.
                    if (e.tickets.length > 1) setTicketsFor(e)
                    else openTickets(e, onOpen)
                  }}
                >
                  <TicketIcon />
                </button>
              )}
              {e.plannedDate && (
                <button
                  type="button"
                  className={`row-going${e.going ? ' on' : ''}`}
                  title={e.going ? 'Going — tap to mark still deciding' : 'Still deciding — tap to mark going'}
                  aria-label={e.going ? 'Mark as still deciding' : 'Mark as going'}
                  aria-pressed={e.going}
                  onClick={ev => { ev.stopPropagation(); haptic(); onToggleGoing(e) }}
                >
                  <CalendarIcon />
                </button>
              )}
              <button
                className={`row-check${e.attended ? ' on' : ''}`}
                title={e.attended ? 'Mark as not attended' : 'Mark attended'}
                aria-label={e.attended ? 'Mark as not attended' : 'Mark attended'}
                aria-pressed={e.attended}
                onClick={ev => { ev.stopPropagation(); haptic(); onToggleAttended(e) }}
              >
                <CheckIcon />
              </button>
            </div>
          </div>
        </div>
        )
      })}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {ticketsFor && <TicketsModal entry={ticketsFor} onClose={() => setTicketsFor(null)} />}
    </div>
  )
}
