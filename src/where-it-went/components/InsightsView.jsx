import { useState, useMemo } from 'react';
import { generateInsights } from '../lib/analytics';
import { SegmentedControl } from '../../ds/components/SegmentedControl';

export default function InsightsView({ data }) {
  const { highlights, expenses, income } = useMemo(() => generateInsights(data), [data]);
  const [activeTab, setActiveTab] = useState('expenses');

  const renderList = (items, emptyMessage) => {
    if (!items || items.length === 0) {
      return (
        <p style={{ color: 'var(--color-muted)', fontStyle: 'italic', marginTop: 'var(--space-md)' }}>
          {emptyMessage}
        </p>
      );
    }
    return (
      <ul style={{ listStyleType: 'none', paddingLeft: '0', color: 'var(--color-ink)', lineHeight: '1.8' }}>
        {items.map((item, idx) => {
          if (typeof item === 'object' && item.type === 'twistie') {
            return (
              <li key={idx} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-accent)', outline: 'none' }}>
                    {item.title}
                  </summary>
                  <ul style={{ marginTop: '8px', paddingLeft: 'var(--space-lg)', listStyleType: 'disc' }}>
                    {item.items.map((sub, sidx) => (
                      <li key={sidx} style={{ color: 'var(--color-ink)', fontSize: 'var(--text-sm)', padding: '2px 0' }}>{sub}</li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          }
          return <li key={idx} style={{ padding: '4px 0', listStyleType: 'disc', marginLeft: 'var(--space-lg)' }}>{item}</li>;
        })}
      </ul>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
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

      {/* Categorized Insights */}
      <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
            Detailed Insights
          </h2>
          <SegmentedControl
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'expenses', label: 'Expenses' },
              { value: 'income', label: 'Income' }
            ]}
          />
        </div>

        <div>
          {activeTab === 'expenses' && (
            <div>
              <h3 style={{ fontSize: 'var(--text-md)', margin: '0 0 var(--space-sm) 0', color: 'var(--color-ink)' }}>Top Increases</h3>
              {renderList(expenses.increases, "No significant spending increases detected this month.")}
              
              <h3 style={{ fontSize: 'var(--text-md)', margin: 'var(--space-md) 0 var(--space-sm) 0', color: 'var(--color-ink)' }}>Top Decreases</h3>
              {renderList(expenses.decreases, "No significant spending decreases detected this month.")}
              
              <h3 style={{ fontSize: 'var(--text-md)', margin: 'var(--space-md) 0 var(--space-sm) 0', color: 'var(--color-ink)' }}>Subscriptions</h3>
              {renderList(expenses.subscriptions, "No subscriptions tracked this month.")}
              
              <h3 style={{ fontSize: 'var(--text-md)', margin: 'var(--space-md) 0 var(--space-sm) 0', color: 'var(--color-ink)' }}>Utilities</h3>
              {renderList(expenses.utilities, "No utilities tracked this month.")}
              
              <h3 style={{ fontSize: 'var(--text-md)', margin: 'var(--space-md) 0 var(--space-sm) 0', color: 'var(--color-ink)' }}>Investing</h3>
              {renderList(expenses.investing, "No investing tracked this month.")}
              
              <h3 style={{ fontSize: 'var(--text-md)', margin: 'var(--space-md) 0 var(--space-sm) 0', color: 'var(--color-ink)' }}>Other Recurring</h3>
              {renderList(expenses.otherRecurring, "No other recurring expenses detected.")}
            </div>
          )}
          {activeTab === 'income' && renderList(income.insights, "No income insights generated.")}
        </div>
      </div>
    </div>
  );
}
