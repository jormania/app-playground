import { useMemo } from 'react';
import { generateInsights } from '../lib/analytics';

export default function Insights({ data }) {
  const { highlights, expenses, income } = useMemo(() => generateInsights(data), [data]);

  const hasInsights = expenses?.increases.length > 0 || expenses?.decreases.length > 0 || income?.insights.length > 0 || expenses?.subscriptions.length > 0 || expenses?.utilities.length > 0 || expenses?.otherRecurring.length > 0 || expenses?.investing.length > 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
      {/* Monthly Reflection Card */}
      <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0, color: 'var(--color-accent)' }}>
          {new Date().toLocaleString('default', { month: 'long' })} in Review
        </h2>
        {highlights && highlights.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
            {highlights.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '24px', backgroundColor: 'var(--color-surface-2)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                  {h.icon}
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', fontWeight: 'var(--weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h.title}</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: h.positive ? 'var(--color-success)' : 'var(--color-ink)' }}>{h.value}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '2px' }}>{h.description}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--color-ink)', lineHeight: '1.6' }}>
            Not enough data to generate a review this month.
          </p>
        )}
      </div>

      {/* Insights & Recurring */}
      <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
          Actionable Insights
        </h2>
        {hasInsights ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', color: 'var(--color-ink)', lineHeight: '1.6' }}>
            {income.insights.length > 0 && (
              <div>
                <h3 style={{ fontSize: 'var(--text-md)', margin: '0 0 8px 0', color: 'var(--color-accent)' }}>Income</h3>
                <ul style={{ listStyleType: 'disc', paddingLeft: 'var(--space-lg)', margin: 0 }}>
                  {income.insights.map((item, idx) => <li key={idx} style={{ padding: '2px 0' }}>{item}</li>)}
                </ul>
              </div>
            )}
            
            {(expenses.increases.length > 0 || expenses.decreases.length > 0) && (
              <div>
                <h3 style={{ fontSize: 'var(--text-md)', margin: '0 0 8px 0', color: 'var(--color-accent)' }}>Spending Changes</h3>
                <ul style={{ listStyleType: 'disc', paddingLeft: 'var(--space-lg)', margin: 0 }}>
                  {expenses.increases.map((item, idx) => <li key={idx} style={{ padding: '2px 0' }}>{item}</li>)}
                  {expenses.decreases.map((item, idx) => <li key={idx} style={{ padding: '2px 0' }}>{item}</li>)}
                </ul>
              </div>
            )}

            {(expenses.subscriptions.length > 0 || expenses.utilities.length > 0 || expenses.otherRecurring.length > 0) && (
              <div>
                <h3 style={{ fontSize: 'var(--text-md)', margin: '0 0 8px 0', color: 'var(--color-accent)' }}>Recurring Bills & Subscriptions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...expenses.subscriptions, ...expenses.utilities, ...expenses.otherRecurring].map((group, idx) => (
                    <details key={idx} style={{ backgroundColor: 'var(--color-surface-2)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 'var(--weight-medium)', outline: 'none' }}>{group.title}</summary>
                      <ul style={{ listStyleType: 'circle', paddingLeft: 'var(--space-xl)', marginTop: '8px', marginBottom: 0, fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                        {group.items.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {expenses.investing.length > 0 && (
              <div>
                <h3 style={{ fontSize: 'var(--text-md)', margin: '0 0 8px 0', color: 'var(--color-accent)' }}>Investing</h3>
                <ul style={{ listStyleType: 'disc', paddingLeft: 'var(--space-lg)', margin: 0 }}>
                  {expenses.investing.map((item, idx) => <li key={idx} style={{ padding: '2px 0' }}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center', marginTop: 'var(--space-md)' }}>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>✨</div>
            <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-ink)' }}>No Insights Yet</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: '0' }}>Keep tracking your expenses. We'll generate actionable insights for you once you have more data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
