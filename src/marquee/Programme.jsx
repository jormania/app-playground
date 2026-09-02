import { useSwipeAction } from '../shared/useSwipeAction'
import PosterGrid from './PosterGrid.jsx'
import { Poster } from './Poster.jsx'
import { TRIAGE, domIdFor, primaryChangeKind, domIdForDay } from './programme.js'
import { CHANGE, CHANGE_LABEL, CHANGE_CHIP_LABEL } from './changes.js'
import { formatDay, formatRun, formatPrice } from './format.js'

/** One production: a title at a venue, with its dates nested.
 *
 *  The card is the production and not the showing because that is the unit you
 *  decide about — "do I want to see this" comes long before "which night". A film
 *  listed six times is one card with six dates, not six cards. */
function ProductionCard({ production, triage, changedKeys = new Map(), onKeep, onIgnore, onWatch, watching = false, swipeEnabled = true }) {
  const ignored = triage[production.id] === TRIAGE.IGNORED
  const soldOut = production.allSoldOut
  const price = formatPrice(production.price)
  const savedDates = production.savedDates ?? new Set()
  const changeKind = primaryChangeKind(production, changedKeys)

  // How much of the run is already in Wanderlist. Saying "1 of 3 dates" beats a
  // flat "in Wanderlist" that implies the whole run was kept when one night was.
  const savedLabel = !production.saved
    ? null
    : production.savedAll || production.showings.length === 1
      ? 'in Wanderlist'
      : savedDates.size > 0
        ? `${savedDates.size} of ${production.dateCount ?? production.showings.length} dates kept`
        : 'kept (another date)'

  // Promoted out of Loom's ThreadRow (swipe right to weave, left to unravel)
  // via `src/shared/useSwipeAction` — same axis-lock and elastic-past-threshold
  // feel, both directions here mirroring the card's own two buttons: swipe
  // right opens Keep (the first showing, same as tapping the Keep button —
  // which date is genuinely ambiguous mid-swipe for a multi-date run, and the
  // sheet itself lets you change it), swipe left Ignores. `data-noswipe` marks
  // the same "taps, not drags" exemption Loom's `[data-loom-controls]` does —
  // a swipe starting on the title link or a date button must not fire either
  // action on the way to its own tap target.
  const { dx, revealing, bind } = useSwipeAction({
    disabled: !swipeEnabled,
    onSwipeLeft: () => onIgnore(production),
    onSwipeRight: () => onKeep(production.showings[0], production),
  })

  return (
    <article
      id={domIdFor(production.id)}
      className={`prod ${production.saved ? 'prod--saved' : ''} ${ignored ? 'prod--ignored' : ''} ${changeKind ? `prod--changed-${changeKind}` : ''}`}
    >
      <div
        className={`prod__behind ${revealing ? `prod__behind--${revealing}` : ''}`}
        aria-hidden="true"
      >
        <span className="prod__behindKeep">✓ Keep</span>
        <span className="prod__behindIgnore">{ignored ? 'Un-ignore' : 'Ignore'} ✕</span>
      </div>

      <div
        className="prod__body"
        style={{
          // Only claimed while the gesture is actually on: `pan-y` tells the
          // browser this element handles horizontal movement itself, which is
          // exactly what someone turning the gesture off is asking it not to do.
          touchAction: swipeEnabled ? 'pan-y' : undefined,
          transform: dx ? `translateX(${dx}px)` : undefined,
        }}
        onPointerDown={(e) => { if (!e.target.closest('a, button, [data-noswipe]')) bind.onPointerDown(e) }}
        onPointerMove={bind.onPointerMove}
        onPointerUp={bind.onPointerUp}
        onPointerCancel={bind.onPointerCancel}
      >
        <Poster src={production.image} />

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
            {changeKind && (
              <span className={`chip chip--changed-${changeKind}`} title={CHANGE_LABEL[changeKind]}>
                {CHANGE_CHIP_LABEL[changeKind]}
              </span>
            )}
            {soldOut && <span className="chip chip--soldout">sold out</span>}
            {/* Suppressed when changeKind is already 'tickets-opened': that chip
                says the same thing ("tickets on sale") about the same change,
                and showing both doubles up one fact rather than adding a second. */}
            {!soldOut && production.anyOpen && changeKind !== CHANGE.TICKETS_OPENED && (
              <span className="chip chip--tickets">tickets</span>
            )}
            {/* Neither on sale nor sold out. Until now this state rendered
                NOTHING, so "the venue hasn't put tickets up" looked identical
                to "we haven't checked" — and it is the state a show sits in
                both before a release and while quietly going stale.
                Deliberately says only what was seen, never why: every venue
                words it differently ("Momentan nu sunt bilete disponibile",
                a missing button, an empty price list), and each adapter has
                already normalised its own wording into `ticketState`, so
                nothing here has to match anyone's phrasing. */}
            {!soldOut && !production.anyOpen && (
              <span className="chip chip--quiet" title="The venue lists no tickets for this — it may not be on sale yet">
                no tickets listed
              </span>
            )}
            {price && <span className="chip">{price}</span>}
            {savedLabel && <span className="chip chip--saved">{savedLabel}</span>}
          </div>

          {production.showings.length > 1 && (
            <ul className="prod__dates">
              {production.showings.map((showing) => {
                const kind = changedKeys.get(showing.key)
                return (
                  <li key={showing.key}>
                    <button
                      type="button"
                      className={`date ${showing.ticketState === 'sold-out' ? 'date--soldout' : ''} ${savedDates.has(showing.date) ? 'date--saved' : ''} ${kind ? `date--changed-${kind}` : ''}`}
                      disabled={showing.ticketState === 'sold-out'}
                      onClick={() => onKeep(showing, production)}
                      title={showing.ticketState === 'sold-out'
                        ? 'Sold out — nothing left to keep'
                        : savedDates.has(showing.date)
                          ? 'Already in Wanderlist'
                          : kind ? CHANGE_LABEL[kind]
                            : 'Keep this date'}
                    >
                      {savedDates.has(showing.date) ? '✓ ' : ''}
                      {formatDay(showing.date, { time: showing.time })}
                      {showing.time ? ` ${showing.time}` : ''}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="prod__actions" data-noswipe>
          {/* A run with nothing left to buy has nothing to Keep — but that
              left the one card state where you most want to act offering
              nothing at all, a disabled button and a shrug. It offers Watch
              instead (§9.63): tell me if this comes back. The watch is held on
              the PRODUCTION, so it outlives the night that sold out and
              catches a new date months later, which is the shape a return
              usually takes. */}
          {soldOut ? (
            <button
              type="button"
              className={`action-keep ${watching ? 'action-keep--watching' : ''}`}
              aria-pressed={watching}
              title={watching
                ? 'Watching — you’ll see it here if this comes back'
                : 'Sold out. Watch it, and a new date or a return goes to the top of What changed'}
              onClick={() => onWatch?.(production)}
            >
              {watching ? '👁 Watching' : 'Watch'}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="action-keep"
                onClick={() => onKeep(production.showings[0], production)}
              >
                Keep
              </button>
              {/* The watch outlives the sell-out that started it, so a show
                  that came back renders here, in the Keep branch — and used
                  to render no way to call the watch off: it is listed, so it
                  never appears in the "nothing listed yet" group either, and
                  the mark was stuck for good. */}
              {watching && (
                <button
                  type="button"
                  className="action-watch"
                  aria-pressed="true"
                  title="Back on — you were watching this. Press to stop watching."
                  onClick={() => onWatch?.(production)}
                >
                  👁 Watching
                </button>
              )}
            </>
          )}
          <button type="button" className="action-ignore" onClick={() => onIgnore(production)}>
            {ignored ? 'Un-ignore' : 'Ignore'}
          </button>
        </div>
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
function emptyMessage(venueFilter, scanned, search, statusFilter = null) {
  // The status facet answers first: with it on, "nothing upcoming at any of
  // your venues" is simply false — there is plenty on, none of it sold out (or
  // none of it watched). Saying the wrong one of those sends you looking for a
  // scan that failed instead of at the filter you pressed.
  if (statusFilter === 'sold-out') return 'Nothing here is sold out.'
  if (statusFilter === 'watching') return 'Nothing you’re watching is on right now.'
  // A search with no matches is its own answer — distinct from a venue filter
  // or the programme genuinely being empty, and worth naming as such rather
  // than the same generic "nothing upcoming" either of those already use.
  if (search) return `Nothing matches “${search}”.`
  if (!venueFilter) return 'Nothing upcoming at any of your venues right now.'
  const result = scanned.find((v) => v.venue === venueFilter)
  if (result && result.status !== 'ok' && result.status !== 'empty') {
    return `${venueFilter} could not be read on the last check, so there is nothing to show — not the same as nothing being on.`
  }
  return `Nothing upcoming at ${venueFilter}.`
}

/** The watched productions with nothing currently listed anywhere.
 *
 *  This is the half of a watchlist a programme filter can never show, and the
 *  reason Watching is not simply another chip: the night you missed has
 *  PASSED, so the production is in no scan, no snapshot and no day list — the
 *  waiting is the whole state. Rendered from the watchlist's own stored title
 *  and venue rather than from a production that isn't there. */
function Awaited({ entries, onForget }) {
  if (entries.length === 0) return null
  return (
    <section className="awaited" aria-label="Watching, nothing listed yet">
      <h2 className="awaited__head">
        Watching · nothing listed yet
        <span className="awaited__count">{entries.length}</span>
      </h2>
      <ul className="awaited__list">
        {entries.map((entry) => (
          <li key={entry.id} className="awaited__row">
            <div className="awaited__what">
              <strong>{entry.title}</strong>
              <span className="awaited__where">
                {entry.venue}
                {entry.missedDate ? ` · sold out for ${formatDay(entry.missedDate)}` : ''}
              </span>
            </div>
            <button type="button" className="linkbtn" onClick={() => onForget?.(entry.id)}>
              Stop watching
            </button>
          </li>
        ))}
      </ul>
      <p className="footnote">
        A new date, or tickets coming back, puts these at the top of What changed.
      </p>
    </section>
  )
}

export default function Programme({
  scan, days, triage, changedKeys = new Map(), onKeep, onIgnore,
  search = '', stale = false, scanning = false,
  venueFilter = null,
  viewMode = 'list', swipeEnabled = true,
  watchlist = {}, onWatch, awaited = [], statusFilter = null,
}) {
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

      {/* All three filter tiers (category, venue, hall) render up in App.jsx
          now, stuck directly together right under the week strip (§9.50) —
          they belong beside the navigation they narrow, not buried below a
          "stale" banner and a Trouble list that may not even be there. */}

      {/* One venue selected = one small, already-curated list, not a calendar
          to browse — day headings exist to orient you across a whole
          programme's worth of venues, and add nothing once you're already
          looking at just one. "Multidisciplinary" and "more than one hall"
          don't change this: category and hall are filters within this view,
          not reasons to split it into sections — everything for this venue,
          in one straight chronological line. `days` is already sorted
          date-then-showtime (byDate), so flattening it preserves that order
          exactly; nothing here re-sorts. */}
      <Awaited entries={awaited} onForget={(id) => onWatch?.({ id }, { forget: true })} />

      {days.length === 0 ? (
        // Not an empty programme when you are simply waiting on something:
        // the Awaited list above IS the answer in that case.
        awaited.length > 0 ? null : <p className="empty">{emptyMessage(venueFilter, scanned, search, statusFilter)}</p>
      ) : viewMode === 'posters' ? (
        <PosterGrid
          days={venueFilter ? [{ date: null, productions: days.flatMap((d) => d.productions) }] : days}
          flat={Boolean(venueFilter)}
          triage={triage}
          changedKeys={changedKeys}
          onKeep={onKeep}
          onIgnore={onIgnore}
        />
      ) : venueFilter ? (
        <section className="day">
          {days.flatMap((d) => d.productions).map((production) => (
            <ProductionCard
              key={production.id}
              production={production}
              triage={triage}
              changedKeys={changedKeys}
              onKeep={onKeep}
              onIgnore={onIgnore}
              onWatch={onWatch}
              watching={Boolean(watchlist[production.id])}
              swipeEnabled={swipeEnabled}
            />
          ))}
        </section>
      ) : (
        days.map((day) => (
          <section key={day.date} id={domIdForDay(day.date)} className="day">
            <h2 className="day__head">{formatDay(day.date)}</h2>
            {day.productions.map((production) => (
              <ProductionCard
                key={production.id}
                production={production}
                triage={triage}
                changedKeys={changedKeys}
                onKeep={onKeep}
                onIgnore={onIgnore}
                onWatch={onWatch}
                watching={Boolean(watchlist[production.id])}
                swipeEnabled={swipeEnabled}
              />
            ))}
          </section>
        ))
      )}
    </>
  )
}
