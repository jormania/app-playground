import { domIdForDay } from './programme.js'

/** "Mon", "Tue", … from a `YYYY-MM-DD` key. Deliberately NOT `format.js`'s own
 *  `formatDay` — that returns "Tonight"/"Tomorrow" for the first two days,
 *  which would slice down to "Ton"/"Tom" here instead of a real weekday
 *  abbreviation; this strip wants the same shape for all seven cells. */
function weekdayAbbrev(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short' })
}

/** Below 70% of the week's median reads quiet; above 130% reads busy. Wide
 *  enough that an ordinary Tuesday-to-Thursday wobble stays one level. */
const QUIET_BELOW = 0.7
const BUSY_ABOVE = 1.3

/** A week whose busiest night is within a quarter of its quietest is a flat
 *  week, and gets one level throughout. */
const FLAT_WEEK_RATIO = 1.25

/**
 * How many dots each day earns — measured against the week in view, not
 * against a fixed number.
 *
 * The scale this replaces was `count <= 3 ? 2 : 3`: four productions maxed it
 * out. Watching a dozen venues that is every night of every week, so the strip
 * showed three dots everywhere and answered nothing. Raising the constant
 * doesn't fix it either, because the same strip has to work at ~35 productions
 * a night with every venue showing AND at a handful once the Theatre filter is
 * on. Any constant is right for one of those and wrong for the other.
 *
 * The question the strip actually answers is comparative — "which nights this
 * week are the busy ones?" — so the scale is comparative too. Each day is
 * measured against the MEDIAN of the week's non-empty days. Median rather than
 * mean so that one enormous Saturday can't drag the baseline up and flatten the
 * other six into "quiet".
 *
 * With one exception that matters more than the bands do: a week whose nights
 * are genuinely alike gets the SAME level on all of them. "Every night this week
 * is equally busy" is a true and useful answer, and splitting the gap between 34
 * and 37 productions into a 1 and a 3 would invent a distinction the reader
 * would then plan around.
 *
 * An empty day stays 0 and stays uninteractive, exactly as before.
 */
export function dotLevels(density) {
  const counts = (density ?? []).map((d) => d.count ?? 0)
  const live = counts.filter((c) => c > 0).sort((a, b) => a - b)
  if (live.length === 0) return counts.map(() => 0)

  const mid = live.length / 2
  const median = live.length % 2 ? live[Math.floor(mid)] : (live[mid - 1] + live[mid]) / 2
  const flat = live[live.length - 1] <= live[0] * FLAT_WEEK_RATIO

  return counts.map((count) => {
    if (count === 0) return 0
    if (flat) return 2
    if (count < median * QUIET_BELOW) return 1
    if (count > median * BUSY_ABOVE) return 3
    return 2
  })
}

/** What the dots mean, in words, on the cell's own tooltip. Worth saying now
 *  that the scale is relative: "3 dots" is a claim about this week rather than
 *  an absolute, and the count alone no longer explains the shading. */
const LEVEL_LABEL = {
  1: 'quieter than most of this week',
  2: 'a typical night this week',
  3: 'one of the week’s busiest',
}

/** Seven cells, today first — the app's own equivalent of Loom's heatmap
 *  ("how loaded is this week"): "am I free Thursday, and is anything on?"
 *  Density shading over the same productions the day list below shows (the
 *  current filters and search apply here too), so the strip and the list
 *  never disagree about what's on which night — and so the shading re-scales
 *  when a filter narrows the week. Tapping a day with something on scrolls to
 *  it; an empty day is shown, not hidden — a genuinely quiet Tuesday is a real
 *  answer — but isn't interactive, since there is nowhere to jump to. */
export default function WeekStrip({ density }) {
  if (!density || density.length === 0) return null

  const levels = dotLevels(density)

  return (
    <nav className="week-strip" aria-label="This week, at a glance">
      {density.map(({ date, count }, i) => {
        const level = levels[i]
        return (
          <button
            key={date}
            type="button"
            className={`week-strip__day week-strip__day--${level}`}
            disabled={count === 0}
            onClick={() => document.getElementById(domIdForDay(date))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            title={count === 0
              ? 'Nothing on'
              : `${count} production${count === 1 ? '' : 's'} · ${LEVEL_LABEL[level]}`}
          >
            <span className="week-strip__dow">{weekdayAbbrev(date)}</span>
            <span className="week-strip__num">{Number(date.slice(8, 10))}</span>
            <span className="week-strip__dots" aria-hidden="true">
              {Array.from({ length: level }, (_, n) => <i key={n} />)}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
