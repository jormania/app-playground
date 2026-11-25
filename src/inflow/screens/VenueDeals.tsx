/**
 * Venue deals: which arrangements make you the most money.
 *
 * A summary (revenue, paid to venues, kept), then one row per venue with its
 * actual deal and results, best average first, and a small "what if" under
 * each. The actual deal is set by the venue and shown as fact; the what-if
 * is a separate, throwaway set of terms run over the same sessions. Nothing
 * here writes anything.
 */
import { useMemo, useState } from 'react'
import { useInflow } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { SegmentedControl } from '../../ds'
import { TextInput } from '../components/fields'
import { DEAL } from '../domain/vocabulary'
import { ANY_SCOPE, inScope, NO_ENTITY } from '../lib/analytics'
import { dealTotals, defaultAlternative, feeCoveredAt, sameDayRepeats, scenario, venueDeals, type Terms, type VenueDeal } from '../lib/deals'
import { lei, percent } from '../lib/money'
import { WiderPeriod } from './Insights'
import styles from '../styles/ui.module.css'

/** The deal in a few words: "Fixed fee · 600 lei a session", "Revenue share · 30%". */
export function dealTerms(t: Terms): string {
  switch (t.deal) {
    case 'fixed': return `${DEAL.fixed} · ${lei(t.feePerSession)} a session`
    case 'share': return `${DEAL.share} · ${percent(t.sharePct)}`
    case 'hybrid': return `${DEAL.hybrid} · ${lei(t.feePerSession)} + ${percent(t.sharePct)}`
    case 'monthly': return `${DEAL.monthly} · ${lei(t.monthlyFee)} a month`
    case 'none': return DEAL.none
  }
}

export function DealsReport() {
  const { data, scope: rawScope, on } = useInflow()
  const scope = on('reportTools') ? rawScope : ANY_SCOPE
  const { range } = usePeriodData()
  const records = useMemo(() => data.records.filter((r) => inScope(r, { ...scope, venueId: '' })), [data.records, scope])
  const deals = useMemo(
    () => venueDeals(data.venues, records, range)
      .filter((d) => d.venue.deal !== 'none')
      .filter((d) => !scope.venueId || scope.venueId === NO_ENTITY || d.venue.id === scope.venueId)
      .sort((a, b) => b.takePerSession - a.takePerSession),
    [data.venues, records, range, scope.venueId],
  )
  const withoutDeal = data.venues.filter((v) => v.deal === 'none' && records.some((r) => r.venueId === v.id && r.status === 'received' && r.date >= range.from && r.date <= range.to)).length

  if (!deals.length) {
    return (
      <section className={styles.panel}>
        <p className={styles.emptyNote}>No sessions at a venue with a deal in this period.</p>
        <p className={styles.hint} style={{ textAlign: 'center' }}>Deals are set on each venue in Settings → Clients, sources & venues.</p>
        <div style={{ textAlign: 'center' }}><WiderPeriod what="" /></div>
      </section>
    )
  }
  const t = dealTotals(deals)
  const best = Math.max(1, ...deals.map((d) => Math.abs(d.takePerSession)))

  return (
    <>
      <section className={styles.panel} aria-label="Venue deals in total">
        <div className={styles.kpis} style={{ borderTop: 0, paddingTop: 0 }}>
          <div><span className={styles.statLabel}>Revenue</span><b>{lei(t.revenue)}</b></div>
          <div><span className={styles.statLabel}>Paid to venues</span><b>{lei(t.venueCost)}</b></div>
          <div><span className={styles.statLabel}>You kept</span><b>{lei(t.retained)}</b></div>
          <div><span className={styles.statLabel}>Sessions</span><b>{t.sessions}</b></div>
        </div>
        <p className={styles.hint} style={{ marginBottom: 0 }}>{deals.length} {deals.length === 1 ? 'venue' : 'venues'} · {range.label}{withoutDeal ? ` · ${withoutDeal} with no venue cost not listed` : ''}</p>
      </section>

      <section className={styles.panel} aria-label="Venues">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>By average kept a session</h2>
        </div>
        <div className={styles.dealList}>
          {deals.map((d) => <VenueRow key={d.venue.id} d={d} best={best} />)}
        </div>
      </section>
    </>
  )
}

function VenueRow({ d, best }: { d: VenueDeal; best: number }) {
  const v = d.venue
  const n = d.sessions.length
  const covered = feeCoveredAt(d)
  const repeats = v.deal === 'fixed' ? sameDayRepeats(d) : 0
  return (
    <article className={styles.dealRow} aria-label={v.name}>
      <div className={styles.dealRowHead}>
        <b className={styles.dealName}>{v.name}</b>
        <span className={styles.dealAvg}><b className={d.takePerSession < 0 ? styles.down : undefined}>{lei(d.takePerSession)}</b> a session</span>
      </div>
      <div className={styles.dealTermsLine}>
        <span className={styles.dealTag}>{dealTerms(v)}</span>
        <span>{n} {n === 1 ? 'session' : 'sessions'}</span>
      </div>
      <div className={styles.dealBar} aria-hidden>
        <span className={d.takePerSession < 0 ? styles.moverDown : styles.moverUp} style={{ width: `${(Math.abs(d.takePerSession) / best) * 100}%` }} />
      </div>
      <dl className={styles.dealFigures}>
        <div><dt>Revenue</dt><dd>{lei(d.revenue)}</dd></div>
        <div><dt>To venue</dt><dd>{lei(d.venueCost)}</dd></div>
        <div><dt>You kept</dt><dd className={d.takeHome < 0 ? styles.down : undefined}>{lei(d.takeHome)}</dd></div>
      </dl>
      <p className={styles.dealNote}>
        {covered
          ? <>Fee covered at <b>{lei(covered.revenue)}</b> of session revenue{covered.people ? <> (about {covered.people} {covered.people === 1 ? 'person' : 'people'} at {lei(d.revenuePerHead!)})</> : null}.</>
          : v.deal === 'share'
            ? <>You keep <b>{percent(1 - v.sharePct)}</b> of session revenue.</>
            : null}
        {repeats > 0 && <> {repeats} {repeats === 1 ? 'payment shares' : 'payments share'} a day with another and {repeats === 1 ? 'counts' : 'count'} as a separate session.</>}
      </p>
      <WhatIf d={d} />
    </article>
  )
}

/** Hypothetical terms over the same sessions. Held in this component only, never saved. */
function WhatIf({ d }: { d: VenueDeal }) {
  const start = defaultAlternative(d)
  const [deal, setDeal] = useState<'fixed' | 'share'>(start.deal === 'share' ? 'share' : 'fixed')
  const [fee, setFee] = useState(String(Math.round(start.deal === 'fixed' ? start.feePerSession : d.venue.feePerSession || 0)))
  const [share, setShare] = useState(String(Math.round((start.deal === 'share' ? start.sharePct : d.venue.sharePct || 0.3) * 100)))
  const num = (s: string) => { const x = Number(s.replace(',', '.')); return Number.isFinite(x) && x >= 0 ? x : 0 }
  const alt: Terms = deal === 'fixed'
    ? { deal: 'fixed', feePerSession: num(fee), sharePct: 0, monthlyFee: 0 }
    : { deal: 'share', feePerSession: 0, sharePct: Math.min(100, num(share)) / 100, monthlyFee: 0 }
  const s = scenario(d, alt)
  const sign = s.difference > 0 ? '+' : s.difference < 0 ? '−' : ''
  return (
    <details className={styles.whatIfBox}>
      <summary><span className={styles.twistyArrow} aria-hidden>▶</span>What if…</summary>
      <div className={styles.whatIfBody}>
        <div className={styles.whatIfInputs}>
          <SegmentedControl size="sm" label="Hypothetical deal" value={deal} onChange={(x) => setDeal(x as 'fixed' | 'share')}
            options={[{ value: 'fixed', label: 'Fixed fee' }, { value: 'share', label: 'Revenue share' }]} />
          {deal === 'fixed'
            ? <TextInput label="Fee a session (lei)" value={fee} onChange={setFee} inputMode="decimal" />
            : <TextInput label="Venue's share (%)" value={share} onChange={setShare} inputMode="decimal" />}
        </div>
        <dl className={styles.dealFigures}>
          <div><dt>Actual</dt><dd>{lei(s.current)}</dd></div>
          <div><dt>Hypothetical</dt><dd>{lei(s.hypothetical)}</dd></div>
          <div><dt>Difference</dt><dd className={s.difference > 0 ? styles.up : s.difference < 0 ? styles.down : undefined}>
            {sign}{lei(Math.abs(s.difference))}{s.differencePct !== null && s.difference !== 0 ? ` (${sign}${percent(Math.abs(s.differencePct), 1)})` : ''}
          </dd></div>
        </dl>
        <p className={styles.dealNote}>Same {d.sessions.length} {d.sessions.length === 1 ? 'session' : 'sessions'} and revenue. Hypothetical only; the venue's deal is unchanged.</p>
      </div>
    </details>
  )
}
