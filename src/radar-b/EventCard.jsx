import { formatWhen } from './dates.js'
import { cardBadges, signalLabel } from './signals.js'
import { areaLabel } from './EventDetail.jsx'
import { useT } from './i18n.js'

/** One event in the stream. Deliberately dense but quiet: when, name, where, two
 *  lines of why, and at most two badges. Everything else waits for the detail. */
export function EventCard({ event, now, onOpen }) {
  const t = useT()
  const badges = cardBadges(event)
  const recommended = badges.includes('recommended')
  const sourceCount = event.sources.length
  const free = badges.includes('free') || event.cost === 0
  // `altundeva` is Area's "none of the above" — a filter value, not a place.
  const area = areaLabel(event.area)

  return (
    <button
      type="button"
      className={`card${recommended ? ' recommended' : ''}${event.confidence === 'uncertain' ? ' uncertain' : ''}`}
      onClick={() => onOpen(event)}
    >
      <div className="cardWhen">{formatWhen(event, now, t)}</div>
      <h3 className="cardName">{event.name}</h3>
      {(event.venue || area) && (
        <div className="cardWhere">
          {event.venue && <span>{event.venue}</span>}
          {area && <span className="area">{area}</span>}
        </div>
      )}
      {event.summary && <p className="cardSummary">{event.summary}</p>}
      <div className="cardFoot">
        {event.saved && <span className="badge saved">{t('card.inWanderlist')}</span>}
        {badges.map((s) => (
          <span key={s} className={`badge ${s}`}>{signalLabel(s, t)}</span>
        ))}
        {/* Multiple independent mentions is itself a signal of confidence — the
            brief's "increase confidence and usefulness rather than create noise". */}
        {sourceCount > 1 && <span className="sourceCount">{t('card.sources', { n: sourceCount })}</span>}
        {!free && typeof event.cost === 'number' && <span className="price">{t('card.lei', { n: event.cost })}</span>}
      </div>
    </button>
  )
}
