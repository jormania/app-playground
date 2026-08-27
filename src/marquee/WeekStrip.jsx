import { domIdForDay } from './programme.js'

/** "Mon", "Tue", … from a `YYYY-MM-DD` key. Deliberately NOT `format.js`'s own
 *  `formatDay` — that returns "Tonight"/"Tomorrow" for the first two days,
 *  which would slice down to "Ton"/"Tom" here instead of a real weekday
 *  abbreviation; this strip wants the same shape for all seven cells. */
function weekdayAbbrev(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short' })
}

/** Seven cells, today first — the app's own equivalent of Loom's heatmap
 *  ("how loaded is this week"): "am I free Thursday, and is anything on?"
 *  Density shading over the same productions the day list below shows (the
 *  current filters and search apply here too), so the strip and the list
 *  never disagree about what's on which night. Tapping a day with something
 *  on scrolls to it; an empty day is shown, not hidden — a genuinely quiet
 *  Tuesday is a real answer — but isn't interactive, since there is nowhere
 *  to jump to.
 *
 *  `density`'s counts are unbounded; the shading itself caps at 3 dots worth
 *  of visual weight — the strip's job is "busy or not", not an exact count. */
export default function WeekStrip({ density }) {
  if (!density || density.length === 0) return null

  return (
    <nav className="week-strip" aria-label="This week, at a glance">
      {density.map(({ date, count }) => {
        const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3
        return (
          <button
            key={date}
            type="button"
            className={`week-strip__day week-strip__day--${level}`}
            disabled={count === 0}
            onClick={() => document.getElementById(domIdForDay(date))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            title={count === 0 ? 'Nothing on' : `${count} production${count === 1 ? '' : 's'}`}
          >
            <span className="week-strip__dow">{weekdayAbbrev(date)}</span>
            <span className="week-strip__num">{Number(date.slice(8, 10))}</span>
            <span className="week-strip__dots" aria-hidden="true">
              {Array.from({ length: level }, (_, i) => <i key={i} />)}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
