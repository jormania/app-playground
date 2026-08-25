import { Button } from '../ds'
import { formatWhen, stalenessDays, relativeDays } from './dates.js'
import { signalsFor, SIGNAL_LABELS, freshness, recommenders } from './signals.js'
import { mapUrlFor } from './wanderlist.js'
import { fold } from './dedupe.js'
import { BackIcon, ExternalIcon, HideIcon, CalendarIcon, CheckIcon } from './icons.jsx'
import { formatWhen as formatWhenDate } from './dates.js'

/** Which store a mention came through, said in words rather than in a code. */
const KIND_LABEL = {
  recommendation: 'recomandare',
  saved: 'wanderlist',
  editorial: 'menționat',
}

/**
 * The detail view answers, in this order: what is this · when · where · why might
 * I care · how much · how do I go · where did this come from · can I save it.
 * That order is the spec (RADAR_B.md §7) and the reason the layout looks like a
 * record rather than a web page.
 */
/** Two place strings are "the same place" when one contains the other once
 *  folded — `Palatul Suțu` vs `Palatul Suțu, Bd. I.C. Brătianu 2, București`. */
function sameplace(a, b) {
  const fa = fold(a)
  const fb = fold(b)
  if (!fa || !fb) return false
  return fa === fb || fa.includes(fb) || fb.includes(fa)
}

export function EventDetail({ event, now, onClose, onSave, onDismiss, saving }) {
  const sigs = signalsFor(event)
  const fresh = freshness(event, now)
  const recs = recommenders(event)
  const findingsUrl = event.sources.find((s) => s.kind === 'saved')?.url ?? null
  const mapUrl = mapUrlFor(event)
  const free = sigs.includes('free')
  const showAddress = Boolean(event.address) && !sameplace(event.venue, event.address)
  const goUrl = event.tickets || event.link

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={event.name}>
      <div className="detailInner">
        {/* Two destructive-looking glyphs side by side told you nothing about
            which was which. Both now carry a word: one navigates, one hides. */}
        <div className="detailBar">
          <button type="button" className="barBtn" onClick={onClose}>
            <BackIcon /> <span>Înapoi</span>
          </button>
          {!event.saved && (
            <button type="button" className="barBtn danger" onClick={() => onDismiss(event)}>
              <HideIcon /> <span>Ascunde</span>
            </button>
          )}
        </div>

        {event.image && <img className="detailHero" src={event.image} alt="" loading="lazy" />}

        <h1 className="detailName">{event.name}</h1>

        {/* Uncertainty is stated in words rather than implied by a dimmed pixel. */}
        {event.confidence === 'uncertain' && (
          <p className="notice warn">
            Informație aproximativă — o singură sursă, fără confirmare de la organizator.
            Verifică înainte să pleci de acasă.
          </p>
        )}

        <dl>
          <div className="detailRow">
            <dt>Când</dt>
            <dd>{formatWhen(event, now)}{!event.hasTime && event.start && <span style={{ color: 'var(--color-faint)' }}> · ora neconfirmată</span>}</dd>
          </div>
          {(event.venue || event.address) && (
            <div className="detailRow">
              <dt>Unde</dt>
              <dd>
                {event.venue}
                {/* A Radar row often carries the full address in BOTH `Venue` and
                    `Address`, and a Findings row has only one combined `Place`.
                    Rendering both verbatim printed the same line twice. */}
                {showAddress && <div style={{ color: 'var(--color-muted)' }}>{event.address}</div>}
                {event.area && <div style={{ color: 'var(--color-faint)' }}>{event.area}</div>}
                {mapUrl && <div><a href={mapUrl} target="_blank" rel="noreferrer">Deschide în Maps <ExternalIcon /></a></div>}
              </dd>
            </div>
          )}
          <div className="detailRow">
            <dt>Cât</dt>
            <dd>{free ? 'Gratuit' : typeof event.cost === 'number' ? `${event.cost} lei` : 'Preț necunoscut'}</dd>
          </div>
          {event.organizer && (
            <div className="detailRow"><dt>Cine</dt><dd>{event.organizer}</dd></div>
          )}
        </dl>

        {event.summary && <p className="detailSummary">{event.summary}</p>}

        {(sigs.length > 0 || recs.length > 0) && (
          <div className="cardFoot" style={{ marginTop: 'var(--space-md)' }}>
            {sigs.map((s) => <span key={s} className={`badge ${s}`}>{SIGNAL_LABELS[s] ?? s}</span>)}
          </div>
        )}
        {recs.length > 0 && (
          <p className="provenanceNote">Recomandat de {recs.join(', ')}.</p>
        )}

        {/* ── Provenance. The part no other app in the ecosystem can show. ── */}
        <h2 className="sectionTitle">De unde știm</h2>
        <ul className="sources">
          {event.sources.map((s, i) => (
            <li key={`${s.name}-${i}`} className={`source ${s.kind}`}>
              <span>
                {s.url
                  ? <a href={s.url} target="_blank" rel="noreferrer">{s.name} <ExternalIcon /></a>
                  : s.name}
                {s.date && <span style={{ color: 'var(--color-faint)' }}> · {s.date}</span>}
              </span>
              <span className="sourceKind">{KIND_LABEL[s.kind] ?? s.kind}</span>
            </li>
          ))}
          {event.sources.length === 0 && <li className="source"><span style={{ color: 'var(--color-faint)' }}>Fără sursă înregistrată.</span></li>}
        </ul>

        <p className="provenanceNote">
          {fresh.state === 'unknown'
            ? 'Nu se știe când a fost verificată ultima oară.'
            : `Verificat ${relativeDays(stalenessDays(event, now))}.`}
          {fresh.state === 'stale' && ' Poate fi depășit — confirmă la sursă.'}
          {event.mergedFrom?.length > 1 && ` Reunit din ${event.mergedFrom.length} înregistrări.`}
        </p>

        {/* What you already decided, so the basics don't require opening
            Wanderlist. Deliberately one compact row, not a second event panel. */}
        {event.saved && (
          <>
            <h2 className="sectionTitle">În Wanderlist</h2>
            <div className="wlState">
              <span className={`wlChip ${event.going ? 'on' : ''}`}>
                <CheckIcon /> {event.going ? 'Mergi' : 'Încă nedecis'}
              </span>
              {event.plannedDate && (
                <span className="wlChip">
                  <CalendarIcon /> {formatWhenDate({ start: event.plannedTime ? `${event.plannedDate}T${event.plannedTime}` : event.plannedDate, hasTime: Boolean(event.plannedTime) }, now)}
                </span>
              )}
              {event.hasTickets && <span className="wlChip gold">Bilete la tine</span>}
              {event.dateExpiring && <span className="wlChip">expiră {event.dateExpiring}</span>}
              {!event.plannedDate && !event.going && <span className="wlChip muted">fără dată planificată</span>}
            </div>
            {findingsUrl && (
              <p className="provenanceNote">
                <a href={findingsUrl} target="_blank" rel="noreferrer">Deschide în Wanderlist <ExternalIcon /></a>
              </p>
            )}
          </>
        )}

        <div className="actions">
          {goUrl && (
            <Button variant="outline" onClick={() => window.open(goUrl, '_blank', 'noopener')}>
              {event.tickets ? 'Bilete' : 'Pagina evenimentului'}
            </Button>
          )}
          {event.saved
            ? <Button variant="ghost" disabled>Deja în Wanderlist</Button>
            : <Button onClick={() => onSave(event)} disabled={saving}>{saving ? 'Se salvează…' : 'Salvează în Wanderlist'}</Button>}
        </div>
      </div>
    </div>
  )
}
