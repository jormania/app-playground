import { Button } from '../ds'
import { formatWhen, stalenessDays, relativeDays } from './dates.js'
import { signalsFor, signalLabel, freshness, recommenders } from './signals.js'
import { mapUrlFor, appUrlFor } from './wanderlist.js'
import { fold } from './dedupe.js'
import { BackIcon, ExternalIcon, HideIcon, CalendarIcon, CheckIcon } from './icons.jsx'
import { formatWhen as formatWhenDate } from './dates.js'
import { useT } from './i18n.js'

/** Which store a mention came through, said in words rather than in a code. */
const kindLabel = (kind, t) => t(`kind.${kind}`)

/**
 * The detail view answers, in this order: what is this · when · where · why might
 * I care · how much · how do I go · where did this come from · can I save it.
 * That order is the spec (RADAR_B.md §7) and the reason the layout looks like a
 * record rather than a web page.
 */
/** Two place strings are "the same place" when one contains the other once
 *  folded — `Palatul Suțu` vs `Palatul Suțu, Bd. I.C. Brătianu 2, București`. */
/** Where the one prominent "go there" button should point, or null for no button.
 *
 *  Tickets always earn one — that's the action the whole screen is building to.
 *  A plain event link earns one only when it's a destination the provenance list
 *  doesn't already offer; when the event's link IS one of its sources (common,
 *  since a Radar row's `Link` is often the article it was found in), the button
 *  was just a second, larger copy of a link an inch above it. */
export function goUrlFor(event) {
  if (event.tickets) return event.tickets
  if (!event.link) return null
  const dup = (event.sources ?? []).some((s) => s.url === event.link)
  return dup ? null : event.link
}

function sameplace(a, b) {
  const fa = fold(a)
  const fb = fold(b)
  if (!fa || !fb) return false
  return fa === fb || fa.includes(fb) || fb.includes(fa)
}

export function EventDetail({ event, now, onClose, onSave, onDismiss, saving }) {
  const t = useT()
  const sigs = signalsFor(event)
  const fresh = freshness(event, now)
  const recs = recommenders(event)
  const findingsUrl = event.sources.find((s) => s.kind === 'saved')?.url ?? null
  // Into the Wanderlist APP; the Notion page is already the `saved` source above.
  const wanderlistUrl = appUrlFor(event) ?? findingsUrl
  const mapUrl = mapUrlFor(event)
  const free = sigs.includes('free')
  const showAddress = Boolean(event.address) && !sameplace(event.venue, event.address)
  const goUrl = goUrlFor(event)

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={event.name}>
      <div className="detailInner">
        {/* Two destructive-looking glyphs side by side told you nothing about
            which was which. Both now carry a word: one navigates, one hides. */}
        <div className="detailBar">
          <button type="button" className="barBtn" onClick={onClose}>
            <BackIcon /> <span>{t('detail.back')}</span>
          </button>
          {!event.saved && (
            <button type="button" className="barBtn danger" onClick={() => onDismiss(event)}>
              <HideIcon /> <span>{t('detail.hide')}</span>
            </button>
          )}
        </div>

        {event.image && <img className="detailHero" src={event.image} alt="" loading="lazy" />}

        <h1 className="detailName">{event.name}</h1>

        {/* Uncertainty is stated in words rather than implied by a dimmed pixel. */}
        {event.confidence === 'uncertain' && (
          <p className="notice warn">{t('detail.uncertain')}</p>
        )}

        <dl>
          <div className="detailRow">
            <dt>{t('detail.when')}</dt>
            <dd>{formatWhen(event, now, t)}{!event.hasTime && event.start && <span style={{ color: 'var(--color-faint)' }}> · {t('detail.timeUnconfirmed')}</span>}</dd>
          </div>
          {(event.venue || event.address) && (
            <div className="detailRow">
              <dt>{t('detail.where')}</dt>
              <dd>
                {event.venue}
                {/* A Radar row often carries the full address in BOTH `Venue` and
                    `Address`, and a Findings row has only one combined `Place`.
                    Rendering both verbatim printed the same line twice. */}
                {showAddress && <div style={{ color: 'var(--color-muted)' }}>{event.address}</div>}
                {event.area && <div style={{ color: 'var(--color-faint)' }}>{event.area}</div>}
                {mapUrl && <div><a href={mapUrl} target="_blank" rel="noreferrer">{t('detail.openMaps')} <ExternalIcon /></a></div>}
              </dd>
            </div>
          )}
          <div className="detailRow">
            <dt>{t('detail.cost')}</dt>
            <dd>{free ? t('detail.free') : typeof event.cost === 'number' ? t('card.lei', { n: event.cost }) : t('detail.priceUnknown')}</dd>
          </div>
          {event.organizer && (
            <div className="detailRow"><dt>{t('detail.who')}</dt><dd>{event.organizer}</dd></div>
          )}
        </dl>

        {event.summary && <p className="detailSummary">{event.summary}</p>}

        {(sigs.length > 0 || recs.length > 0) && (
          <div className="cardFoot" style={{ marginTop: 'var(--space-md)' }}>
            {sigs.map((s) => <span key={s} className={`badge ${s}`}>{signalLabel(s, t)}</span>)}
          </div>
        )}
        {recs.length > 0 && (
          <p className="provenanceNote">{t('detail.recommendedBy', { names: recs.join(', ') })}</p>
        )}

        {/* ── Provenance. The part no other app in the ecosystem can show. ── */}
        <h2 className="sectionTitle">{t('detail.provenance')}</h2>
        <ul className="sources">
          {event.sources.map((s, i) => (
            <li key={`${s.name}-${i}`} className={`source ${s.kind}`}>
              <span>
                {s.url
                  ? <a href={s.url} target="_blank" rel="noreferrer">{s.name} <ExternalIcon /></a>
                  : s.name}
                {s.date && <span style={{ color: 'var(--color-faint)' }}> · {s.date}</span>}
              </span>
              <span className="sourceKind">{kindLabel(s.kind, t)}</span>
            </li>
          ))}
          {event.sources.length === 0 && <li className="source"><span style={{ color: 'var(--color-faint)' }}>{t('detail.noSources')}</span></li>}
        </ul>

        <p className="provenanceNote">
          {fresh.state === 'unknown'
            ? t('detail.neverChecked')
            : t('detail.checkedAgo', { when: relativeDays(stalenessDays(event, now), t) })}
          {fresh.state === 'stale' && ` ${t('detail.mayBeStale')}`}
          {event.mergedFrom?.length > 1 && ` ${t('detail.mergedFrom', { n: event.mergedFrom.length })}`}
        </p>

        {/* What you already decided, so the basics don't require opening
            Wanderlist. Deliberately one compact row, not a second event panel. */}
        {event.saved && (
          <>
            <h2 className="sectionTitle">{t('wl.heading')}</h2>
            <div className="wlState">
              <span className={`wlChip ${event.going ? 'on' : ''}`}>
                <CheckIcon /> {event.going ? t('wl.going') : t('wl.undecided')}
              </span>
              {event.plannedDate && (
                <span className="wlChip">
                  <CalendarIcon /> {formatWhenDate({ start: event.plannedTime ? `${event.plannedDate}T${event.plannedTime}` : event.plannedDate, hasTime: Boolean(event.plannedTime) }, now, t)}
                </span>
              )}
              {event.hasTickets && <span className="wlChip gold">{t('wl.hasTickets')}</span>}
              {event.dateExpiring && <span className="wlChip">{t('wl.expires', { date: event.dateExpiring })}</span>}
              {!event.plannedDate && !event.going && <span className="wlChip muted">{t('wl.noPlannedDate')}</span>}
            </div>
          </>
        )}

        {/* One row, every entry in it something you can actually press. A saved
            event used to end on a disabled "Already in Wanderlist" restating the
            section directly above it; the useful thing to offer there is the way
            IN to Wanderlist, not a label. */}
        <div className="actions">
          {goUrl && (
            <Button variant="outline" onClick={() => window.open(goUrl, '_blank', 'noopener')}>
              {event.tickets ? t('detail.tickets') : t('detail.eventPage')}
            </Button>
          )}
          {event.saved
            ? (wanderlistUrl && (
              <Button onClick={() => window.open(wanderlistUrl, '_blank', 'noopener')}>
                {t('wl.open')}
              </Button>
            ))
            : <Button onClick={() => onSave(event)} disabled={saving}>{saving ? t('detail.saving') : t('detail.save')}</Button>}
        </div>
      </div>
    </div>
  )
}
