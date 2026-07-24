import { useMemo } from 'react';
import { generateInsights } from '../lib/analytics';

export default function Insights({ data }) {
  const { review, question, insights } = useMemo(() => generateInsights(data), [data]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
      {/* Monthly Reflection Card */}
      <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0, color: 'var(--color-accent)' }}>
          {new Date().toLocaleString('default', { month: 'long' })} in Review
        </h2>
        <p style={{ color: 'var(--color-ink)', lineHeight: '1.6' }}>
          {review}
        </p>
        {question && (
          <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderLeft: '3px solid var(--color-accent)', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', display: 'block', marginBottom: 'var(--space-xs)' }}>Question:</span>
            <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>{question}</span>
          </div>
        )}
      </div>

      {/* Insights & Recurring */}
      <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
          Insights & Recurring
        </h2>
        {insights.length > 0 ? (
          <ul style={{ listStyleType: 'disc', paddingLeft: 'var(--space-lg)', color: 'var(--color-ink)', lineHeight: '1.8' }}>
            {insights.map((insight, idx) => (
              <li key={idx} style={{ padding: '4px 0' }}>{insight}</li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--color-muted)', fontStyle: 'italic', marginTop: 'var(--space-md)' }}>
            Not enough data to generate insights yet.
          </p>
        )}
      </div>
    </div>
  );
}
