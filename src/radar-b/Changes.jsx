import { formatWhen } from './dates.js'
import { CloseIcon } from './icons.jsx'
import { useT } from './i18n.js'

/** What changed since you last looked — modeled directly on Marquee's
 *  Changes.jsx (same empty-state-first structure, same dismiss-until-next-check
 *  rule). The strip's job is to answer "anything new?" in ten seconds and let
 *  you close it — "nothing new since Tuesday" is a real, and the commonest,
 *  answer.
 *
 *  Dismissing hides the entries on screen until the NEXT refresh; there is
 *  deliberately no way to bring them back for this one — a fresh refresh
 *  produces a fresh (and un-dismissed) list on its own. */
export function Changes({ result, now, dismissed = false, onDismiss, onOpen }) {
  const t = useT()
  if (!result || dismissed) return null

  let body
  if (!result.hadSnapshot) {
    body = <p className="changesEmpty">{t('changes.baseline')}</p>
  } else if (result.changes.length === 0) {
    body = <p className="changesEmpty">{t('changes.nothingNew')}</p>
  } else {
    body = (
      <ul className="changesList">
        {result.changes.map((change) => (
          <li key={`${change.kind}:${change.key}`}>
            <button type="button" className={`change change--${change.kind}`} onClick={() => onOpen?.(change)}>
              <span className="changeKind">{t(`changes.kind.${change.kind}`)}</span>
              <span className="changeTitle">{change.name}</span>
              <span className="changeMeta">
                {change.venue}
                {change.venue ? ' · ' : ''}
                {formatWhen(change, now, t)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  // Dismissal records the signatures of the entries on screen, so a strip with
  // nothing on it (the baseline, or "nothing new") has nothing to record and the
  // × would visibly do nothing — offer it only where it does something.
  const dismissable = Boolean(onDismiss) && result.hadSnapshot && result.changes.length > 0

  return (
    <section className={`changes${!result.hadSnapshot ? ' changesBaseline' : ''}`} aria-label={t('changes.label')}>
      <div className="changesHead">
        {result.hadSnapshot && result.changes.length > 0 && <h2 className="changesTitle">{t('changes.title')}</h2>}
        {dismissable && (
          <button type="button" className="changesDismiss" onClick={onDismiss} aria-label={t('changes.dismiss')} title={t('changes.dismiss')}>
            <CloseIcon />
          </button>
        )}
      </div>
      {body}
    </section>
  )
}
