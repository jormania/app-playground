import { useSwipeAction } from '../shared/useSwipeAction'
import PosterGrid from './PosterGrid.jsx'
import { Poster } from './Poster.jsx'
import { TRIAGE, domIdFor, primaryChangeKind, domIdForDay, CATEGORY_LABEL } from './programme.js'
import { CHANGE_LABEL } from './changes.js'
import { formatDay, formatRun, formatPrice } from './format.js'

/** One production: a title at a venue, with its dates nested.
 *
 *  The card is the production and not the showing because that is the unit you
 *  decide about — "do I want to see this" comes long before "which night". A film
 *  listed six times is one card with six dates, not six cards. */
function ProductionCard({ production, triage, changedKeys = new Map(), onKeep, onIgnore, swipeEnabled = true }) {
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
            {changeKind && <span className={`chip chip--changed-${changeKind}`}>{CHANGE_LABEL[changeKind]}</span>}
            {soldOut && <span className="chip chip--soldout">sold out</span>}
            {!soldOut && production.anyOpen && <span className="chip chip--tickets">tickets</span>}
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
          {/* A run with nothing left to buy is nothing left to decide about.
              This reverses an earlier call — a sold-out night used to stay
              keepable "in case a return shows up" — because in practice the
              button offered an action that led nowhere, on the one card state
              where the answer is already settled. Individual dates below
              follow the same rule; a run with ONE night gone keeps its button,
              since `allSoldOut` only means every date. */}
          <button
            type="button"
            className="action-keep"
            disabled={soldOut}
            title={soldOut ? 'Sold out — nothing left to keep' : undefined}
            onClick={() => onKeep(production.showings[0], production)}
          >
            Keep
          </button>
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
function emptyMessage(venueFilter, scanned, search) {
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

/** One filter tier: an "All" chip that clears the value, plus one chip per
 *  option. Category, venue and hall all render through this — the same
 *  toggle-a-second-click-to-clear behaviour at every tier. */
function FilterRow({ value, onChange, options, label = (o) => o, keyOf = (o) => o }) {
  return (
    <div className="filters">
      <button type="button" className={`filter ${!value ? 'filter--on' : ''}`} onClick={() => onChange(null)}>
        All
      </button>
      {options.map((option) => {
        const key = keyOf(option)
        return (
          <button
            key={key}
            type="button"
            className={`filter ${value === key ? 'filter--on' : ''}`}
            onClick={() => onChange(value === key ? null : key)}
          >
            {label(option)}
          </button>
        )
      })}
    </div>
  )
}

export default function Programme({
  scan, days, triage, changedKeys = new Map(), onKeep, onIgnore,
  venues, search = '', stale = false, scanning = false,
  categories = [], categoryFilter = null, onCategoryFilter,
  venuesInCategory = [], venueFilter = null, onVenueFilter,
  hallOptions = [], hallFilter = null, onHallFilter,
  viewMode = 'list', swipeEnabled = true,
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
  // More than one category actually in use is what turns this into a two-tier
  // filter — a single-category setup (or the early days of this app, with a
  // handful of venues and nothing to group) falls straight back to one flat
  // venue row, exactly as before. This is also what keeps the resting UI a
  // constant ~5-6 chips wide as venues are added, rather than growing by one
  // chip per venue forever (MARQUEE.md §9.20).
  const categoryMode = categories.length > 1
  const venueOptions = categoryMode ? venuesInCategory : venues

  return (
    <>
      {stale && !scanning && (
        <p className="banner banner--stale">
          You’ve changed your venues since this check ran, so what’s below — including any
          problems reported — is out of date. Press <strong>Check venues</strong> to refresh it.
        </p>
      )}

      <Trouble venues={scanned} checkedAt={scan.scannedAt ? formatDay(scan.scannedAt.slice(0, 10), { relative: true }) : null} />

      {/* Each tier gates on its OWN condition, not a shared "more than one venue
          total" guard — a single active venue that happens to have several
          halls (a first-time TNB-only setup, say) must still get its hall row,
          which a shared guard would otherwise hide. */}
      {categoryMode && (
        <FilterRow
          value={categoryFilter}
          onChange={onCategoryFilter}
          options={categories}
          label={(c) => CATEGORY_LABEL[c] ?? c}
        />
      )}

      {/* In category mode, venue chips only exist once a category narrows the
          list down to a handful — never the full flat list. Outside category
          mode (one category, or too few venues to group), this is exactly the
          old always-visible venue row. */}
      {(categoryMode ? Boolean(categoryFilter) : venueOptions.length > 1) && (
        <FilterRow
          value={venueFilter}
          onChange={onVenueFilter}
          options={venueOptions}
          keyOf={(v) => v.name}
          label={(v) => v.name}
        />
      )}

      {/* Only ever appears for a single selected venue with more than one hall
          (hallsInUse in programme.js) — Teatrul Național today, any future
          multi-hall venue the same way, nothing to configure. */}
      {hallOptions.length > 0 && (
        <FilterRow value={hallFilter} onChange={onHallFilter} options={hallOptions} />
      )}

      {days.length === 0 ? (
        <p className="empty">{emptyMessage(venueFilter, scanned, search)}</p>
      ) : viewMode === 'posters' ? (
        <PosterGrid days={days} triage={triage} changedKeys={changedKeys} onKeep={onKeep} onIgnore={onIgnore} />
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
                swipeEnabled={swipeEnabled}
              />
            ))}
          </section>
        ))
      )}
    </>
  )
}
