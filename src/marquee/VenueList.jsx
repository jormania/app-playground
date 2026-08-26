import { getAdapter } from './adapters.js'
import { isActive } from './venues.js'

/** One venue, as a row you can pause, edit or remove.
 *
 *  A paused venue is dimmed but never hidden or moved out of reach — pausing is
 *  meant to be as easy to undo as it was to do. */
function VenueRow({ venue, busy, onTogglePause, onEdit, onRemove }) {
  const active = isActive(venue)
  const adapter = getAdapter(venue.adapter)
  const host = (() => {
    try { return new URL(venue.url).hostname.replace(/^www\./, '') } catch { return venue.url }
  })()

  return (
    <li className={`venue ${active ? '' : 'venue--paused'}`}>
      <div className="venue__main">
        <div className="venue__head">
          <h3 className="venue__name">{venue.name || 'Untitled venue'}</h3>
          {!active && <span className="chip chip--paused">paused</span>}
          {venue.adapter === 'jsonld' && (
            <span className="chip chip--warn" title="Read with the generic schema.org reader — may find nothing on this site.">
              generic reader
            </span>
          )}
        </div>
        <a className="venue__url" href={venue.url} target="_blank" rel="noreferrer noopener">
          {host}
        </a>
        <p className="venue__meta">
          {adapter ? adapter.label : 'no reader'}
          {venue.config ? ` · ${venue.config}` : ''}
          {venue.category ? ` · saves as ${venue.category}` : ''}
        </p>
        <p className="venue__scan">
          {venue.lastChecked
            ? `Last checked ${venue.lastChecked}${venue.lastResult ? ` · ${venue.lastResult}` : ''}`
            : 'Never checked'}
        </p>
        {venue.notes && <p className="venue__notes">{venue.notes}</p>}
      </div>
      <div className="venue__actions">
        <button type="button" className="linkbtn" disabled={busy} onClick={() => onTogglePause(venue)}>
          {active ? 'Pause' : 'Resume'}
        </button>
        <button type="button" className="linkbtn" disabled={busy} onClick={() => onEdit(venue)}>
          Edit
        </button>
        <button type="button" className="linkbtn linkbtn--danger" disabled={busy} onClick={() => onRemove(venue)}>
          Remove
        </button>
      </div>
    </li>
  )
}

export default function VenueList({ venues, busyId, onTogglePause, onEdit, onRemove }) {
  if (!venues.length) {
    return (
      <p className="empty">
        No venues yet. Add the programme page of a place you actually go to — a theatre, a cinema, a
        concert hall — and Marquee will watch it for new shows and tickets.
      </p>
    )
  }
  const paused = venues.filter((v) => !isActive(v)).length
  return (
    <>
      <p className="listcount">
        {venues.length} {venues.length === 1 ? 'venue' : 'venues'}
        {paused ? ` · ${paused} paused` : ''}
      </p>
      <ul className="venues">
        {venues.map((venue) => (
          <VenueRow
            key={venue.id ?? venue.url}
            venue={venue}
            busy={busyId === venue.id}
            onTogglePause={onTogglePause}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </>
  )
}
