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
function PosterTile({ production, triage, changedKeys, onKeep, onIgnore }) {
  const ignored = triage[production.id] === TRIAGE.IGNORED
  const soldOut = production.allSoldOut
  const changeKind = primaryChangeKind(production, changedKeys)

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

      <button
        type="button"
        className="poster-tile__frame"
        onClick={() => onKeep(production.showings[0], production)}
        title={`Keep ${production.title}`}
      >
        <Poster src={production.image} className="poster-tile__poster" />
        {/* A box-office sold-out treatment — a diagonal band across the
            corner, not another chip lost among the others. */}
        {soldOut && <span className="poster-tile__soldout">Sold out</span>}
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
 *  covers grouped under a date heading instead of a column of rows. */
export default function PosterGrid({ days, triage, changedKeys, onKeep, onIgnore }) {
  return (
    <>
      {days.map((day) => (
        <section key={day.date} id={domIdForDay(day.date)} className="day">
          <h2 className="day__head">{formatDay(day.date)}</h2>
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
