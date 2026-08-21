import { formatWhen } from './dates.js'
import { cardBadges } from './signals.js'
import { SIGNAL_LABELS } from './signals.js'

/** One event in the stream. Deliberately dense but quiet: when, name, where, two
 *  lines of why, and at most two badges. Everything else waits for the detail. */
export function EventCard({ event, now, onOpen }) {
  const badges = cardBadges(event)
  const recommended = badges.includes('recommended')
  const sourceCount = event.sources.length
  const free = badges.includes('free') || event.cost === 0

  return (
    <button
      type="button"
      className={`card${recommended ? ' recommended' : ''}${event.confidence === 'uncertain' ? ' uncertain' : ''}`}
      onClick={() => onOpen(event)}
    >
      <div className="cardWhen">{formatWhen(event, now)}</div>
      <h3 className="cardName">{event.name}</h3>
      {(event.venue || event.area) && (
        <div className="cardWhere">
          {event.venue && <span>{event.venue}</span>}
          {event.area && <span className="area">{event.area}</span>}
        </div>
      )}
      {event.summary && <p className="cardSummary">{event.summary}</p>}
      <div className="cardFoot">
        {event.saved && <span className="badge saved">în wanderlist</span>}
        {badges.map((s) => (
          <span key={s} className={`badge ${s}`}>{SIGNAL_LABELS[s] ?? s}</span>
        ))}
        {/* Multiple independent mentions is itself a signal of confidence — the
            brief's "increase confidence and usefulness rather than create noise". */}
        {sourceCount > 1 && <span className="sourceCount">{sourceCount} surse</span>}
        {!free && typeof event.cost === 'number' && <span className="price">{event.cost} lei</span>}
      </div>
    </button>
  )
}
