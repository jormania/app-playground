import { TRIAGE, domIdFor } from './programme.js'
import { formatDay, formatRun, formatPrice } from './format.js'

/** One production: a title at a venue, with its dates nested.
 *
 *  The card is the production and not the showing because that is the unit you
 *  decide about — "do I want to see this" comes long before "which night". A film
 *  listed six times is one card with six dates, not six cards. */
function ProductionCard({ production, triage, onKeep, onIgnore }) {
  const ignored = triage[production.id] === TRIAGE.IGNORED
  const soldOut = production.allSoldOut
  const price = formatPrice(production.price)
  const savedDates = production.savedDates ?? new Set()

  // How much of the run is already in Wanderlist. Saying "1 of 3 dates" beats a
  // flat "in Wanderlist" that implies the whole run was kept when one night was.
  const savedLabel = !production.saved
    ? null
    : production.savedAll || production.showings.length === 1
      ? 'in Wanderlist'
      : savedDates.size > 0
        ? `${savedDates.size} of ${production.showings.length} dates kept`
        : 'kept (another date)'

  return (
    <article
      id={domIdFor(production.id)}
      className={`prod ${production.saved ? 'prod--saved' : ''} ${ignored ? 'prod--ignored' : ''}`}
    >
      <div className="prod__main">
        <h3 className="prod__title">
          {production.link ? (
            <a href={production.link} target="_blank" rel="noreferrer noopener">{production.title}</a>
          ) : production.title}
        </h3>
        <p className="prod__meta">
          {production.venue}
          {production.hall ? ` · ${production.hall}` : ''}
        </p>
        <p className="prod__run">{formatRun(production)}</p>

        <div className="prod__chips">
          {soldOut && <span className="chip chip--soldout">sold out</span>}
          {!soldOut && production.anyOpen && <span className="chip chip--tickets">tickets</span>}
          {price && <span className="chip">{price}</span>}
          {savedLabel && <span className="chip chip--saved">{savedLabel}</span>}
        </div>

        {production.showings.length > 1 && (
          <ul className="prod__dates">
            {production.showings.map((showing) => (
              <li key={showing.key}>
                <button
                  type="button"
                  className={`date ${showing.ticketState === 'sold-out' ? 'date--soldout' : ''} ${savedDates.has(showing.date) ? 'date--saved' : ''}`}
                  onClick={() => onKeep(showing, production)}
                  title={savedDates.has(showing.date)
                    ? 'Already in Wanderlist'
                    : showing.ticketState === 'sold-out' ? 'Sold out — keep it anyway?' : 'Keep this date'}
                >
                  {savedDates.has(showing.date) ? '✓ ' : ''}
                  {formatDay(showing.date)}
                  {showing.time ? ` ${showing.time}` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="prod__actions">
        <button type="button" className="linkbtn" onClick={() => onKeep(production.showings[0], production)}>
          Keep
        </button>
        <button type="button" className="linkbtn" onClick={() => onIgnore(production)}>
          {ignored ? 'Un-ignore' : 'Ignore'}
        </button>
      </div>
    </article>
  )
}

/** Venues that could not be read. Never silent, never mixed in with the
 *  programme — a venue whose parser broke must not look like a venue with
 *  nothing on (MARQUEE.md §6). */
function Trouble({ venues, checkedAt }) {
  const trouble = venues.filter((v) => v.status !== 'ok' && v.status !== 'empty')
  if (trouble.length === 0) return null
  return (
    <section className="trouble" aria-label="Venues that could not be read">
      {trouble.map((v) => (
        <p key={v.venue} className={`trouble__row trouble__row--${v.status}`}>
          <strong>{v.venue}</strong> — {v.detail}
          {/* Dated, because this is a record of the last check rather than a
              live status. Without the date, a failure that has since been fixed
              reads as one that is still happening. */}
          {checkedAt && <span className="trouble__when"> (as of the check {checkedAt})</span>}
        </p>
      ))}
    </section>
  )
}

/** "Nothing upcoming" is a claim, and it is only true for a venue that answered.
 *  Filtering to a venue whose scan was throttled or broken must say THAT, not
 *  imply the venue has an empty programme. */
function emptyMessage(venueFilter, scanned) {
  if (!venueFilter) return 'Nothing upcoming at any of your venues right now.'
  const result = scanned.find((v) => v.venue === venueFilter)
  if (result && result.status !== 'ok' && result.status !== 'empty') {
    return `${venueFilter} could not be read on the last check, so there is nothing to show — not the same as nothing being on.`
  }
  return `Nothing upcoming at ${venueFilter}.`
}

export default function Programme({ scan, days, triage, onKeep, onIgnore, venueFilter, onVenueFilter, venues, stale = false, scanning = false }) {
  if (!scan) {
    return (
      <p className="empty">
        Nothing checked yet. Hit <strong>Check venues</strong> to read every active venue’s
        programme.
      </p>
    )
  }

  const scanned = scan.venues ?? []

  return (
    <>
      {stale && !scanning && (
        <p className="banner banner--stale">
          You’ve changed your venues since this check ran, so what’s below — including any
          problems reported — is out of date. Press <strong>Check venues</strong> to refresh it.
        </p>
      )}

      <Trouble venues={scanned} checkedAt={scan.scannedAt ? formatDay(scan.scannedAt.slice(0, 10), { relative: true }) : null} />

      {venues.length > 1 && (
        <div className="filters">
          <button
            type="button"
            className={`filter ${!venueFilter ? 'filter--on' : ''}`}
            onClick={() => onVenueFilter(null)}
          >
            All
          </button>
          {venues.map((v) => (
            <button
              key={v.id ?? v.name}
              type="button"
              className={`filter ${venueFilter === v.name ? 'filter--on' : ''}`}
              onClick={() => onVenueFilter(venueFilter === v.name ? null : v.name)}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {days.length === 0 ? (
        <p className="empty">{emptyMessage(venueFilter, scanned)}</p>
      ) : (
        days.map((day) => (
          <section key={day.date} className="day">
            <h2 className="day__head">{formatDay(day.date)}</h2>
            {day.productions.map((production) => (
              <ProductionCard
                key={production.id}
                production={production}
                triage={triage}
                onKeep={onKeep}
                onIgnore={onIgnore}
              />
            ))}
          </section>
        ))
      )}
    </>
  )
}
