import React, { useMemo } from 'react';
import { generateDeepInsights } from '../lib/analytics';
import { formatCurrency } from '../lib/currency';

export default function InsightsView({ data, period, filterProps }) {
  const insights = useMemo(() => {
    return generateDeepInsights(data, period, filterProps);
  }, [data, period, filterProps]);

  if (!insights) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <p style={{ color: 'var(--color-muted)' }}>Not enough data to generate insights for this period.</p>
      </div>
    );
  }

  const { financialHealth, behavioral, trajectory, incomeStreams, alerts } = insights;

  // 50/30/20 Targets
  const targetNeeds = financialHealth.totalExpense * 0.5;
  const targetWants = financialHealth.totalExpense * 0.3;
  const targetSavings = financialHealth.totalExpense * 0.2;

  return (
    <div className="insights-view" style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-md)', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Header & Generated Timestamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', margin: 0, color: 'var(--color-ink)' }}>Financial Insights</h1>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', backgroundColor: 'var(--color-surface)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
          ⏱️ Insights generated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* SECTION: ACT */}
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)', backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>Act</span>
          <h2 style={{ fontSize: 'var(--text-xl)', margin: 0, color: 'var(--color-ink)' }}>Immediate Attention & Action</h2>
        </div>

        {/* Month in Review */}
        {insights.summaryParagraph && (
          <div style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', borderLeft: '4px solid var(--color-accent)' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-md)', lineHeight: 1.6, color: 'var(--color-ink)' }}>
              <strong>Month in Review:</strong> {insights.summaryParagraph}
            </p>
          </div>
        )}

        {/* Attention Needed (Alerts) */}
        {alerts && alerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--color-ink)' }}>Attention Needed</h3>
            {alerts.map((alert, idx) => (
              <div key={idx} style={{ 
                display: 'flex', gap: 'var(--space-md)', alignItems: 'center', padding: 'var(--space-md)', 
                backgroundColor: alert.type === 'warning' ? 'var(--color-warning)' : 'var(--color-success)',
                color: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '24px' }}>{alert.type === 'warning' ? '⚠️' : '🌟'}</div>
                <div>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-md)' }}>{alert.title}</div>
                  <div style={{ fontSize: 'var(--text-sm)', opacity: 0.95 }}>{alert.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Financial Wins */}
        {insights.wins && insights.wins.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--color-ink)' }}>Financial Wins</h3>
            <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {insights.wins.map((win, idx) => (
                  <li key={idx} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', color: 'var(--color-ink)', fontWeight: 'var(--weight-medium)' }}>
                    <span style={{ color: 'var(--color-success)' }}>✓</span> {win}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* SECTION: UNDERSTAND */}
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-success)', backgroundColor: 'color-mix(in srgb, var(--color-success) 15%, transparent)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>Understand</span>
          <h2 style={{ fontSize: 'var(--text-xl)', margin: 0, color: 'var(--color-ink)' }}>Core Financial Architecture</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
          
          {/* Financial Health with Savings Rate emphasized as Primary KPI */}
          <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              Financial Health
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
              
              {/* Primary KPI: Savings Rate Hero Banner */}
              <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Primary KPI • Savings Rate</div>
                <div style={{ fontSize: '36px', fontWeight: '900', color: financialHealth.savingsRate >= 0.2 ? 'var(--color-success)' : 'var(--color-ink)', margin: 'var(--space-xs) 0' }}>
                  {(financialHealth.savingsRate * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>Unspent cash flow retained for wealth building.</div>
              </div>

              {/* Fixed Cost Ratio */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '24px', backgroundColor: 'var(--color-surface-2)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                  {financialHealth.fixedCostsRatio <= 0.5 ? '🛡️' : '⚠️'}
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', fontWeight: 'var(--weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fixed Cost Ratio</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: financialHealth.fixedCostsRatio <= 0.5 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    {(financialHealth.fixedCostsRatio * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '2px' }}>Income tied up in recurring bills.</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderTop: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontWeight: 'var(--weight-medium)' }}>Investment Rate</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>Percent of income invested.</div>
                </div>
                <div style={{ fontWeight: 'var(--weight-bold)' }}>{(financialHealth.investmentRate * 100).toFixed(1)}%</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderTop: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontWeight: 'var(--weight-medium)' }}>Net Cash Flow</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>Income minus total expenses.</div>
                </div>
                <div style={{ fontWeight: 'var(--weight-bold)', color: financialHealth.netCashFlow >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {formatCurrency(financialHealth.netCashFlow)}
                </div>
              </div>

            </div>
          </div>

          {/* Merged Fixed Costs & Structural Costs */}
          <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              Fixed & Structural Costs
            </h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
              Housing, Utilities, Property, Taxes, Loans, and Subscriptions.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontWeight: 'var(--weight-medium)' }}>Total Fixed Costs</div>
              <div style={{ fontWeight: 'var(--weight-bold)' }}>{formatCurrency(financialHealth.totalIncome * financialHealth.fixedCostsRatio)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontWeight: 'var(--weight-medium)' }}>As % of Income</div>
              <div style={{ fontWeight: 'var(--weight-bold)' }}>{(financialHealth.fixedCostsRatio * 100).toFixed(1)}%</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontWeight: 'var(--weight-medium)' }}>Taxes & Fees</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Structural statutory cost</div>
              </div>
              <div style={{ fontWeight: 'var(--weight-bold)' }}>{formatCurrency(financialHealth.overviews?.taxes || 0)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontWeight: 'var(--weight-medium)' }}>Property Expenses</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>Maintenance & HOA</div>
              </div>
              <div style={{ fontWeight: 'var(--weight-bold)' }}>{formatCurrency(financialHealth.overviews?.property || 0)}</div>
            </div>
            {behavioral.subscriptions && behavioral.subscriptions.length > 0 && (
              <div style={{ marginTop: 'var(--space-md)' }}>
                <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 'var(--space-sm)', letterSpacing: '0.05em' }}>Active Subscriptions</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {behavioral.subscriptions.map((sub, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--text-sm)' }}>
                      <span>{sub.name}</span>
                      <span style={{ fontWeight: 'var(--weight-medium)' }}>{formatCurrency(sub.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--space-xl)' }}>
          {/* The 50/30/20 Rule */}
          <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              The 50/30/20 Rule
            </h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
              Target vs Actual spending breakdown based on total expenses.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
              
              {/* Needs */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                  <span style={{ fontWeight: 'var(--weight-medium)' }}>Needs</span>
                  <span style={{ fontWeight: 'var(--weight-bold)', color: financialHealth.needsWantsSavings.needs > targetNeeds ? 'var(--color-danger)' : 'var(--color-ink)' }}>
                    {formatCurrency(financialHealth.needsWantsSavings.needs)} ({((financialHealth.needsWantsSavings.needs / financialHealth.totalExpense) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: 'var(--space-xs)' }}>
                  <span>Target 50%: {formatCurrency(targetNeeds)}</span>
                  <span>Diff: {formatCurrency(financialHealth.needsWantsSavings.needs - targetNeeds)}</span>
                </div>
                <div className="budget-bar-wrapper">
                  <div style={{ width: `${Math.min((financialHealth.needsWantsSavings.needs / financialHealth.totalExpense) * 100, 100)}%`, height: '100%', backgroundColor: financialHealth.needsWantsSavings.needs > targetNeeds ? 'var(--color-danger)' : 'var(--color-border)' }}></div>
                </div>
              </div>

              {/* Wants */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                  <span style={{ fontWeight: 'var(--weight-medium)' }}>Wants</span>
                  <span style={{ fontWeight: 'var(--weight-bold)', color: financialHealth.needsWantsSavings.wants > targetWants ? 'var(--color-warning)' : 'var(--color-ink)' }}>
                    {formatCurrency(financialHealth.needsWantsSavings.wants)} ({((financialHealth.needsWantsSavings.wants / financialHealth.totalExpense) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: 'var(--space-xs)' }}>
                  <span>Target 30%: {formatCurrency(targetWants)}</span>
                  <span>Diff: {formatCurrency(financialHealth.needsWantsSavings.wants - targetWants)}</span>
                </div>
                <div className="budget-bar-wrapper">
                  <div style={{ width: `${Math.min((financialHealth.needsWantsSavings.wants / financialHealth.totalExpense) * 100, 100)}%`, height: '100%', backgroundColor: financialHealth.needsWantsSavings.wants > targetWants ? 'var(--color-warning)' : 'var(--color-border)' }}></div>
                </div>
              </div>

              {/* Savings */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                  <span style={{ fontWeight: 'var(--weight-medium)' }}>Investments</span>
                  <span style={{ fontWeight: 'var(--weight-bold)' }}>
                    {formatCurrency(financialHealth.needsWantsSavings.savings)} ({((financialHealth.needsWantsSavings.savings / financialHealth.totalExpense) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: 'var(--space-xs)' }}>
                  <span>Target 20%: {formatCurrency(targetSavings)}</span>
                  <span>Diff: {formatCurrency(financialHealth.needsWantsSavings.savings - targetSavings)}</span>
                </div>
                <div className="budget-bar-wrapper">
                  <div style={{ width: `${Math.min((financialHealth.needsWantsSavings.savings / financialHealth.totalExpense) * 100, 100)}%`, height: '100%', backgroundColor: (financialHealth.needsWantsSavings.savings / financialHealth.totalExpense) >= 0.2 ? 'var(--color-success)' : 'var(--color-border)' }}></div>
                </div>
              </div>

            </div>
          </div>

          {/* Income Dependency */}
          <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              Income Dependency
            </h3>
            {financialHealth.totalIncome > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '24px', backgroundColor: 'var(--color-surface-2)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                    💼
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', fontWeight: 'var(--weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Income</div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>
                      {formatCurrency(financialHealth.totalIncome)}
                    </div>
                  </div>
                </div>
                
                <h4 style={{ fontSize: 'var(--text-md)', margin: 'var(--space-sm) 0 0 0' }}>Sources</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {insights.incomeStreams.map((stream, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: idx === insights.incomeStreams.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                      <div>
                        <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>{stream.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
                          {((stream.total / financialHealth.totalIncome) * 100).toFixed(1)}% of total
                        </div>
                      </div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-success)' }}>
                        {formatCurrency(stream.total)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                <div style={{ fontSize: '36px', marginBottom: 'var(--space-sm)' }}>💤</div>
                <p style={{ margin: 0, color: 'var(--color-ink)', fontWeight: 'var(--weight-medium)' }}>No Income Detected</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION: EXPLORE */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-warning)', backgroundColor: 'color-mix(in srgb, var(--color-warning) 15%, transparent)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>Explore</span>
          <h2 style={{ fontSize: 'var(--text-xl)', margin: 0, color: 'var(--color-ink)' }}>Spending Habits & Trends</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
          
          {/* Spending by Category Change - Limited to top 5 most significant shifts */}
          <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              Category Trends (MoM)
            </h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
              Most significant monthly shifts in spending.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[...behavioral.spendingByCategoryChange]
                .sort((a, b) => Math.abs(b.diff || 0) - Math.abs(a.diff || 0))
                .slice(0, 5)
                .map((cat, idx, arr) => (
                  <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm) 0', borderBottom: idx === arr.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                    <div>
                      <div style={{ fontWeight: 'var(--weight-medium)' }}>{cat.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>{formatCurrency(cat.currTotal)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      {/* Sparkline Visual (CSS based) */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', height: '24px', gap: '2px' }}>
                         <div style={{ width: '12px', height: `${Math.min((cat.prevTotal / Math.max(cat.prevTotal || 1, cat.currTotal || 1)) * 24, 24)}px`, backgroundColor: 'var(--color-border)', borderRadius: '2px 2px 0 0' }}></div>
                         <div style={{ width: '12px', height: `${Math.min((cat.currTotal / Math.max(cat.prevTotal || 1, cat.currTotal || 1)) * 24, 24)}px`, backgroundColor: cat.diff > 0 ? 'var(--color-danger)' : 'var(--color-success)', borderRadius: '2px 2px 0 0' }}></div>
                      </div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: cat.pctChange > 0 ? 'var(--color-danger)' : (cat.pctChange < 0 ? 'var(--color-success)' : 'var(--color-muted)'), minWidth: '55px', textAlign: 'right' }}>
                        {cat.pctChange > 0 ? '↑' : (cat.pctChange < 0 ? '↓' : '-')} {Math.abs(cat.pctChange).toFixed(0)}%
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </div>

          {/* Frequent Spending with explicitly labeled values */}
          <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              Frequent Spending
            </h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
              High frequency vendors that silently drain cash flow.
            </p>
            {behavioral.frequentSpending.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {behavioral.frequentSpending.map((vendor, idx) => (
                  <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm) 0', borderBottom: idx === behavioral.frequentSpending.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                    <div>
                      <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>{vendor.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px', display: 'flex', gap: 'var(--space-sm)' }}>
                        <span><strong>Count:</strong> {vendor.count}</span>
                        <span>•</span>
                        <span><strong>Avg Spend:</strong> {formatCurrency(vendor.average)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spend</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-danger)', fontSize: 'var(--text-md)' }}>
                        {formatCurrency(vendor.total)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                <div style={{ fontSize: '36px', marginBottom: 'var(--space-sm)' }}>✨</div>
                <p style={{ margin: 0, color: 'var(--color-ink)', fontWeight: 'var(--weight-medium)' }}>No Habits Detected</p>
              </div>
            )}
          </div>

          {/* Largest Transactions with category badges */}
          <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              Largest Transactions
            </h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
              Top 5 single expenses impacting cash flow this period.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {behavioral.largestTransactions.map((tx, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm) 0', borderBottom: idx === 4 ? 'none' : '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 'var(--weight-medium)' }}>{tx.description}</span>
                      {tx.categoryName && (
                        <span style={{ fontSize: '10px', backgroundColor: 'var(--color-surface-2)', color: 'var(--color-muted)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                          {tx.categoryName}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                      {new Date(tx.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-md)' }}>{formatCurrency(tx.amount)}</div>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

    </div>
  );
}
