import { Poster } from './Poster.jsx'
import { TRIAGE, domIdFor, primaryChangeKind, domIdForDay } from './programme.js'
import { CHANGE_LABEL } from './changes.js'
import { formatDay, formatRun } from './format.js'

/** One production as a cover, not a row.
 *
 *  The list view (`ProductionCard` in Programme.jsx) is built to be read; this is
 *  built to be recognised — a theatre lobby's actual look, per marquee.css's own
 *  header ("a theatre lobby at dusk"), and the poster this app already fetches
 *  for every reader that has one (§9.12) spent on a 56×80 thumbnail. Same data,
 *  same Keep/Ignore actions as the list — a second layout over the same
 *  productions, not a second feature. */
function PosterTile({ production, triage, changedKeys = new Map(), onKeep, onIgnore }) {
  const ignored = triage[production.id] === TRIAGE.IGNORED
  const soldOut = production.allSoldOut
  const changeKind = primaryChangeKind(production, changedKeys)
  const savedDates = production.savedDates ?? new Set()

  // The same two signals the list card carries, and for the same reason: a
  // run you can still buy into is the whole point of checking (MARQUEE.md §7),
  // and one already in Wanderlist is one you don't need to decide about again.
  // The first pass at this view rendered only the sold-out band, so the poster
  // wall could tell you what you'd MISSED and nothing about what you could
  // still get — and silently hid kept runs under `hideKept` with no way to see
  // why. Kept as a compact tick + dot rather than the list's full chip row:
  // this layout's job is recognition, not the whole record.
  const kept = production.saved
  const keptLabel = production.savedAll || savedDates.size === (production.dateCount ?? production.showings.length)
    ? 'All dates in Wanderlist'
    : savedDates.size > 0
      ? `${savedDates.size} of ${production.dateCount ?? production.showings.length} dates in Wanderlist`
      : 'In Wanderlist'

  return (
    <li
      id={domIdFor(production.id)}
      className={`poster-tile ${ignored ? 'poster-tile--ignored' : ''} ${changeKind ? `poster-tile--changed-${changeKind}` : ''}`}
    >
      <button
        type="button"
        className="poster-tile__ignore"
        aria-label={ignored ? `Un-ignore ${production.title}` : `Ignore ${production.title}`}
        onClick={() => onIgnore(production)}
      >
        ×
      </button>

      {/* Same rule as the list card: a fully sold-out run has nothing left to
          keep, so the tile stops being a Keep button. It stays a tile — the
          poster, the sold-out band and the title all still read. */}
      <button
        type="button"
        className="poster-tile__frame"
        disabled={soldOut}
        onClick={() => onKeep(production.showings[0], production)}
        title={soldOut ? `${production.title} — sold out` : `Keep ${production.title}`}
      >
        <Poster src={production.image} className="poster-tile__poster" />
        {/* A box-office sold-out treatment — a diagonal band across the
            corner, not another chip lost among the others. */}
        {soldOut && <span className="poster-tile__soldout">Sold out</span>}
        {!soldOut && production.anyOpen && (
          <span className="poster-tile__tickets" title="Tickets on sale">Tickets</span>
        )}
        {kept && <span className="poster-tile__kept" title={keptLabel} aria-label={keptLabel}>✓</span>}
        {changeKind && (
          <span className={`poster-tile__badge chip chip--changed-${changeKind}`}>{CHANGE_LABEL[changeKind]}</span>
        )}
      </button>

      <div className="poster-tile__info">
        <p className="poster-tile__title">{production.title}</p>
        <p className="poster-tile__meta">{production.venue}</p>
        <p className="poster-tile__run">{formatRun(production)}</p>
      </div>
    </li>
  )
}

/** The same `days` (`byDate`'s output) the list view renders, as a wall of
 *  covers grouped under a date heading instead of a column of rows.
 *
 *  `flat` (Programme.jsx passes it once a specific venue is selected) drops
 *  the date heading and section id — `days` is then already the single
 *  flattened group Programme.jsx built, kept in the same `[{date,
 *  productions}]` shape purely so this component doesn't need a second prop
 *  shape to handle. */
export default function PosterGrid({ days, triage, changedKeys = new Map(), onKeep, onIgnore, flat = false }) {
  return (
    <>
      {days.map((day) => (
        <section key={day.date ?? 'flat'} id={flat ? undefined : domIdForDay(day.date)} className="day">
          {!flat && <h2 className="day__head">{formatDay(day.date)}</h2>}
          <ul className="poster-grid">
            {day.productions.map((production) => (
              <PosterTile
                key={production.id}
                production={production}
                triage={triage}
                changedKeys={changedKeys}
                onKeep={onKeep}
                onIgnore={onIgnore}
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
