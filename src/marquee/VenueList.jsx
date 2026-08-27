import { getAdapter } from './adapters.js'
import { isActive } from './venues.js'
import { formatDay } from './format.js'

/** One venue, as a row you can pause, edit or remove.
 *
 *  A paused venue is dimmed but never hidden or moved out of reach — pausing is
 *  meant to be as easy to undo as it was to do. */
function VenueRow({ venue, busy, trouble, onTogglePause, onEdit, onRemove }) {
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
          {/* Whether the venue is OKAY was the one question Settings' old
              "Venue health" list existed to answer, and neither screen
              actually answered it: a failure reason landed in `Last result`
              as the same grey text as "24 events". Taken from the last
              scan's own per-venue status rather than by reading that text,
              so it says exactly what the check said — and only for venues
              that check actually covered. */}
          {trouble && (
            <span className={`chip chip--${trouble.status === 'throttled' ? 'warn' : 'stop'}`} title={trouble.detail ?? ''}>
              {trouble.status === 'throttled' ? 'rate-limited' : 'not readable'}
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
        <p className={`venue__scan ${trouble ? 'venue__scan--trouble' : ''}`}>
          {venue.lastChecked
            ? `Last checked ${formatDay(venue.lastChecked, { relative: true })}${venue.lastResult ? ` · ${venue.lastResult}` : ''}`
            : 'Never checked'}
        </p>
        {/* Address and Area were editable and then invisible — you could set
            them and never see them again outside Notion. The address is what
            makes a saved Wanderlist finding drop its map pin first try
            (`placeFor` in wanderlist.js), so a venue missing one is worth
            being able to notice. */}
        {(venue.address || venue.area) && (
          <p className="venue__where">
            {venue.address}
            {venue.address && venue.area ? ' · ' : ''}
            {venue.area}
          </p>
        )}
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

export default function VenueList({ venues, search = '', busyId, troubleByVenue = new Map(), onTogglePause, onEdit, onRemove }) {
  if (!venues.length) {
    // A search that matches nothing is its own answer, and a different one
    // from having no venues at all — the same distinction Programme's
    // `emptyMessage` already draws, worded the same way.
    return (
      <p className="empty">
        {search
          ? `Nothing matches “${search}”.`
          : 'No venues yet. Add the programme page of a place you actually go to — a theatre, a cinema, a concert hall — and Marquee will watch it for new shows and tickets.'}
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
            trouble={troubleByVenue.get(venue.name) ?? null}
            onTogglePause={onTogglePause}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </>
  )
}
