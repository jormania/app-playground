import { CHANGE, CHANGE_LABEL } from './changes.js'
import { formatDay } from './format.js'

/** What changed since you last looked — the strip at the top that is the diff's
 *  output and nothing else.
 *
 *  Its empty state matters as much as its full one: "nothing new since Tuesday" is
 *  a real answer, and the commonest one. The app should be checkable in ten
 *  seconds and closed. */
export default function Changes({ scan, onOpen }) {
  if (!scan) return null

  if (!scan.hadSnapshot) {
    return (
      <section className="changes changes--baseline">
        <p className="changes__empty">
          First look — this scan is the baseline. From the next one on, this strip shows only
          what changed.
        </p>
      </section>
    )
  }

  if (scan.changes.length === 0) {
    return (
      <section className="changes">
        <p className="changes__empty">
          Nothing new since {formatDay(scan.previousScanAt ?? scan.scannedAt, { relative: true })}.
        </p>
      </section>
    )
  }

  return (
    <section className="changes" aria-label="What changed">
      <h2 className="changes__title">What changed</h2>
      <ul className="changes__list">
        {scan.changes.map((change) => (
          <li key={`${change.kind}:${change.key}`}>
            <button type="button" className={`change change--${change.kind}`} onClick={() => onOpen?.(change)}>
              <span className="change__kind">{CHANGE_LABEL[change.kind]}</span>
              <span className="change__title">{change.title}</span>
              <span className="change__meta">
                {change.venue}
                {change.date ? ` · ${formatDay(change.date)}` : ''}
                {change.time ? ` · ${change.time}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {scan.changes.some((c) => c.kind === CHANGE.CANCELLED) && (
        <p className="changes__note">
          “Gone from the programme” means the venue stopped listing it — usually a cancellation,
          occasionally a page being reorganised.
        </p>
      )}
    </section>
  )
}
