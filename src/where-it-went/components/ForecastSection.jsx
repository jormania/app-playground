import { formatCurrency } from '../lib/currency';
import { summarizeForecast, MIN_HISTORY_MONTHS } from '../lib/analytics/forecast';

/**
 * "Next 90 Days" — the only forward-looking block in Insights.
 *
 * Committed and estimated are drawn as distinct segments rather than one total,
 * because they carry very different confidence: a subscription charge has a
 * known date and amount, while the rest is a trailing median. Merging them into
 * a single bar would present a guess with the same authority as a fact.
 */
export default function ForecastSection({ forecast }) {
  if (!forecast || forecast.months.length === 0) return null;

  const scale = Math.max(
    1,
    ...forecast.months.map(m => Math.max(m.income, m.expense)),
  );
  const pctOf = (value) => `${Math.max(0, Math.min(100, (value / scale) * 100))}%`;

  return (
    <div style={{ marginBottom: 'var(--space-2xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--color-accent)',
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
          padding: '2px 8px', borderRadius: 'var(--radius-sm)'
        }}>Ahead</span>
        <h2 style={{ fontSize: 'var(--text-xl)', margin: 0, color: 'var(--color-ink)' }}>Next 90 Days</h2>
      </div>

      <div style={{
        padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)', overflow: 'hidden', boxSizing: 'border-box'
      }}>
        <p style={{ margin: '0 0 var(--space-md) 0', color: 'var(--color-ink)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-body)' }}>
          {summarizeForecast(forecast)}
        </p>

        {!forecast.hasHistory ? (
          <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
            A projection needs at least {MIN_HISTORY_MONTHS} complete months to be worth trusting, so
            nothing is estimated yet. Scheduled subscription charges are still listed on the Dashboard.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {forecast.months.map(m => (
                <div key={m.monthKey} style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-sm)', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', fontSize: 'var(--text-sm)' }}>
                      {m.label}{m.isCurrentMonth ? ' (rest of month)' : ''}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: m.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {m.net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(m.net))}
                    </span>
                  </div>

                  {/* Income */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: '4px' }}>
                    <span style={{ width: '52px', flex: 'none', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>In</span>
                    <div style={{ flex: 1, minWidth: 0, height: '10px', backgroundColor: 'var(--color-surface-2)', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: pctOf(m.committedIncome), backgroundColor: 'var(--color-success)' }} />
                      <div style={{ width: pctOf(m.estimatedIncome), backgroundColor: 'color-mix(in srgb, var(--color-success) 35%, transparent)' }} />
                    </div>
                    <span style={{ flex: 'none', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                      {formatCurrency(m.income)}
                    </span>
                  </div>

                  {/* Expense */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span style={{ width: '52px', flex: 'none', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Out</span>
                    <div style={{ flex: 1, minWidth: 0, height: '10px', backgroundColor: 'var(--color-surface-2)', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: pctOf(m.committedExpense), backgroundColor: 'var(--color-danger)' }} />
                      <div style={{ width: pctOf(m.estimatedExpense), backgroundColor: 'color-mix(in srgb, var(--color-danger) 35%, transparent)' }} />
                    </div>
                    <span style={{ flex: 'none', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                      {formatCurrency(m.expense)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
              <span><span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, backgroundColor: 'var(--color-ink)', marginRight: 4 }} />Solid = committed (scheduled subscriptions)</span>
              <span><span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, backgroundColor: 'color-mix(in srgb, var(--color-ink) 35%, transparent)', marginRight: 4 }} />Faded = estimated from your last {forecast.basis.trailingMonths} months</span>
            </div>

            <p style={{ margin: 'var(--space-sm) 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontStyle: 'italic' }}>
              This projects cash <em>flow</em>, not a balance — the app tracks what you spend, not what
              you hold. Based on {forecast.monthsOfHistory} complete {forecast.monthsOfHistory === 1 ? 'month' : 'months'} of
              history ({forecast.confidence} confidence).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
