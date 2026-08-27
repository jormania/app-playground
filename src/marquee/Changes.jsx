import { CHANGE, CHANGE_LABEL } from './changes.js'
import { formatDay } from './format.js'

/** What changed since you last looked — the strip at the top that is the diff's
 *  output and nothing else.
 *
 *  Its empty state matters as much as its full one: "nothing new since Tuesday" is
 *  a real answer, and the commonest one. The app should be checkable in ten
 *  seconds and closed.
 *
 *  Dismissing hides it until the NEXT check — there is deliberately no way to
 *  bring it back for the current one. Once you've read it, re-showing the same
 *  list would just be clutter; a fresh check produces a fresh (and un-dismissed)
 *  one on its own. */
export default function Changes({ scan, dismissed = false, onDismiss, onOpen }) {
  if (!scan || dismissed) return null

  let body
  if (!scan.hadSnapshot) {
    body = (
      <p className="changes__empty">
        First look — this scan is the baseline. From the next one on, this strip shows only
        what changed.
      </p>
    )
  } else if (scan.changes.length === 0) {
    body = (
      <p className="changes__empty">
        Nothing new since {formatDay(scan.previousScanAt ?? scan.scannedAt, { relative: true })}.
      </p>
    )
  } else {
    body = (
      <>
        <ul className="changes__list">
          {scan.changes.map((change) => (
            <li key={`${change.kind}:${change.key}`}>
              <button type="button" className={`change change--${change.kind}`} onClick={() => onOpen?.(change)}>
                <span className="change__kind">{CHANGE_LABEL[change.kind]}</span>
                <span className="change__title">{change.title}</span>
                <span className="change__meta">
                  {change.venue}
                  {change.date ? ` · ${formatDay(change.date, { time: change.time })}` : ''}
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
      </>
    )
  }

  // Dismissal records the SIGNATURES of the entries on screen, so a strip with
  // no entries — the baseline, or "nothing new since Tuesday" — has nothing to
  // record and pressing × did visibly nothing. An inert control is worse than
  // no control: offer it only where it does something.
  const dismissable = Boolean(onDismiss) && scan.hadSnapshot && scan.changes.length > 0

  return (
    <section className={`changes ${!scan.hadSnapshot ? 'changes--baseline' : ''}`} aria-label="What changed">
      <div className="changes__head">
        {scan.hadSnapshot && scan.changes.length > 0 && <h2 className="changes__title">What changed</h2>}
        {dismissable && (
          <button
            type="button"
            className="changes__dismiss"
            onClick={onDismiss}
            aria-label="Dismiss — hide until the next check"
            title="Dismiss until the next check"
          >
            ×
          </button>
        )}
      </div>
      {body}
    </section>
  )
}
