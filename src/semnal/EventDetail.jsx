import { Button } from '../ds'
import { formatWhen, stalenessDays, relativeDays } from './dates.js'
import { signalsFor, SIGNAL_LABELS, freshness, recommenders } from './signals.js'
import { mapUrlFor } from './wanderlist.js'
import { BackIcon, ExternalIcon, DismissIcon } from './icons.jsx'

/** Which store a mention came through, said in words rather than in a code. */
const KIND_LABEL = {
  recommendation: 'recomandare',
  saved: 'wanderlist',
  editorial: 'menționat',
}

/**
 * The detail view answers, in this order: what is this · when · where · why might
 * I care · how much · how do I go · where did this come from · can I save it.
 * That order is the spec (SEMNAL.md §7) and the reason the layout looks like a
 * record rather than a web page.
 */
export function EventDetail({ event, now, onClose, onSave, onDismiss, saving }) {
  const sigs = signalsFor(event)
  const fresh = freshness(event, now)
  const recs = recommenders(event)
  const mapUrl = mapUrlFor(event)
  const free = sigs.includes('free')
  const goUrl = event.tickets || event.link

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={event.name}>
      <div className="detailInner">
        <div className="detailBar">
          <button type="button" className="iconBtn" onClick={onClose} aria-label="Înapoi"><BackIcon /></button>
          {!event.saved && (
            <button type="button" className="iconBtn" onClick={() => onDismiss(event)} aria-label="Nu mă interesează">
              <DismissIcon />
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
                {event.address && <div style={{ color: 'var(--color-muted)' }}>{event.address}</div>}
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
