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

          {/* Travel Insights Card */}
          {behavioral.travelAnalysis && (
            <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
                    ✈️ Travel Insights
                  </h3>
                  <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', margin: '4px 0 0 0' }}>
                    {behavioral.travelAnalysis.count > 0 
                      ? 'Analyzing travel spending during the selected period.' 
                      : 'Prepared for travel analysis when expenses are logged under the Travel category.'}
                  </p>
                </div>
                {behavioral.travelAnalysis.count > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', backgroundColor: 'var(--color-surface-2)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Total Travel Spend</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-brass)' }}>{formatCurrency(behavioral.travelAnalysis.totalSpend)}</div>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Share of Budget</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>{(behavioral.travelAnalysis.shareOfTotalExpense * 100).toFixed(1)}%</div>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Avg Transaction</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>{formatCurrency(behavioral.travelAnalysis.averageTxAmount)}</div>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Transactions</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>{behavioral.travelAnalysis.count}</div>
                    </div>
                  </div>
                )}
              </div>

              {behavioral.travelAnalysis.count > 0 ? (
                <div>
                  {/* Period Comparison & Deviation Alerts */}
                  {(behavioral.travelAnalysis.prevTotalSpend > 0 || behavioral.travelAnalysis.unusualSpending) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                      {behavioral.travelAnalysis.prevTotalSpend > 0 && (
                        <div style={{ fontSize: 'var(--text-xs)', padding: '6px 12px', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>vs. Previous Period:</span>
                          <b style={{ color: behavioral.travelAnalysis.diffFromPrev > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {behavioral.travelAnalysis.diffFromPrev > 0 ? '+' : ''}{formatCurrency(behavioral.travelAnalysis.diffFromPrev)}
                            {behavioral.travelAnalysis.pctChangeFromPrev !== null ? ` (${(behavioral.travelAnalysis.pctChangeFromPrev * 100).toFixed(0)}%)` : ''}
                          </b>
                          <span style={{ color: 'var(--color-muted)' }}>({formatCurrency(behavioral.travelAnalysis.prevTotalSpend)} prev)</span>
                        </div>
                      )}
                      {behavioral.travelAnalysis.unusualSpending && (
                        <div style={{ fontSize: 'var(--text-xs)', padding: '6px 12px', backgroundColor: behavioral.travelAnalysis.unusualSpending.type === 'high' ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' : 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: behavioral.travelAnalysis.unusualSpending.type === 'high' ? 'var(--color-danger)' : 'var(--color-success)', borderRadius: 'var(--radius-sm)', border: `1px solid ${behavioral.travelAnalysis.unusualSpending.type === 'high' ? 'var(--color-danger)' : 'var(--color-success)'}`, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>⚠️ <b>Pattern Deviation:</b> {behavioral.travelAnalysis.unusualSpending.message}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-xl)' }}>
                    {/* Left Column: Sub-type breakdown */}
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                        Travel Expense Breakdown
                      </h4>
                      {behavioral.travelAnalysis.dominantSubcategory && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink)', backgroundColor: 'var(--color-surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '10px', borderLeft: '3px solid var(--color-brass)' }}>
                          👑 <b>Dominant Category:</b> {behavioral.travelAnalysis.dominantSubcategory.label} accounted for <b>{(behavioral.travelAnalysis.dominantSubcategory.percentage * 100).toFixed(0)}%</b> of travel spending in this period ({formatCurrency(behavioral.travelAnalysis.dominantSubcategory.amount)}).
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { label: '🏨 Accommodation & Resort', amount: behavioral.travelAnalysis.breakdown.accommodation, color: 'var(--color-purple)' },
                          { label: '✈️ Transit & Flights', amount: behavioral.travelAnalysis.breakdown.transit, color: 'var(--color-brass)' },
                          { label: '🍽️ Dining & Bar', amount: behavioral.travelAnalysis.breakdown.dining, color: 'var(--color-warning)' },
                          { label: '🎟️ Tours & Activities', amount: behavioral.travelAnalysis.breakdown.activities, color: 'var(--color-success)' },
                          { label: '🛍️ Souvenirs & Shopping', amount: behavioral.travelAnalysis.breakdown.shopping, color: 'var(--color-danger)' },
                          { label: '📦 Other Overhead', amount: behavioral.travelAnalysis.breakdown.other, color: 'var(--color-muted)' }
                        ].filter(item => item.amount > 0).map((item, idx) => {
                          const pct = (item.amount / behavioral.travelAnalysis.totalSpend) * 100;
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-ink)' }}>
                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></span>
                                {item.label}
                              </span>
                              <span style={{ fontWeight: 'var(--weight-medium)' }}>
                                {formatCurrency(item.amount)} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Prepaid vs In-Destination bar */}
                      <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--color-brass)', fontWeight: 'var(--weight-medium)' }}>
                            Prepaid Spending: {formatCurrency(behavioral.travelAnalysis.prepaidSpending)} ({((behavioral.travelAnalysis.prepaidSpending / behavioral.travelAnalysis.totalSpend) * 100).toFixed(0)}%)
                          </span>
                          <span style={{ color: 'var(--color-warning)', fontWeight: 'var(--weight-medium)' }}>
                            In-Destination: {formatCurrency(behavioral.travelAnalysis.inDestinationSpending)} ({((behavioral.travelAnalysis.inDestinationSpending / behavioral.travelAnalysis.totalSpend) * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${(behavioral.travelAnalysis.prepaidSpending / behavioral.travelAnalysis.totalSpend) * 100}%`, height: '100%', backgroundColor: 'var(--color-brass)' }}></div>
                          <div style={{ width: `${(behavioral.travelAnalysis.inDestinationSpending / behavioral.travelAnalysis.totalSpend) * 100}%`, height: '100%', backgroundColor: 'var(--color-warning)' }}></div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Largest Travel Expenses & Explanatory Insight */}
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                        Largest Travel Expenses
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-lg) 0' }}>
                        {behavioral.travelAnalysis.topExpenses.map((tx, idx) => (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: idx === behavioral.travelAnalysis.topExpenses.length - 1 ? 'none' : '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }}>
                            <div>
                              <span style={{ fontWeight: 'var(--weight-medium)' }}>{tx.description}</span>
                              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{new Date(tx.date).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontWeight: 'var(--weight-bold)' }}>{formatCurrency(tx.amount)}</span>
                          </li>
                        ))}
                      </ul>

                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', backgroundColor: 'color-mix(in srgb, var(--color-brass) 8%, transparent)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-brass)' }}>
                        💡 <b>Long-Term Financial Insight:</b> Grouping all travel-related purchases, future bookings, and independent trip expenses under the <b>Travel</b> category isolates variable mobility and tourism costs from your baseline household budget. This prevents temporary travel spikes from distorting your normal monthly trends for food, shopping, and transportation over long-term multi-month or annual reviews.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl) var(--space-md)', color: 'var(--color-muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: 'var(--space-sm)' }}>🏖️</div>
                  <p style={{ margin: '0 0 var(--space-xs) 0', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>No Travel Spending Logged in This Period</p>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', maxWidth: '500px', marginInline: 'auto' }}>
                    When you log travel-related purchases, bookings, or trip expenses under the <b>Travel</b> category, this panel automatically analyzes your spending breakdown, compares it against previous periods and historical averages, and isolates variable travel costs from your normal monthly budget.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Property Insights Card */}
          {behavioral.propertyAnalysis && (
            <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', marginTop: 'var(--space-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
                    🏠 Property Insights
                  </h3>
                  <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', margin: '4px 0 0 0' }}>
                    {behavioral.propertyAnalysis.count > 0 
                      ? 'Analyzing rental income and property operating expenses in this period.' 
                      : 'Prepared for real estate asset analysis when property records are logged.'}
                  </p>
                </div>
                {behavioral.propertyAnalysis.count > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', backgroundColor: 'var(--color-surface-2)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Net Cash Flow</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: behavioral.propertyAnalysis.netFlow >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {behavioral.propertyAnalysis.netFlow >= 0 ? '+' : ''}{formatCurrency(behavioral.propertyAnalysis.netFlow)}
                      </div>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Rental Income</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-success)' }}>{formatCurrency(behavioral.propertyAnalysis.totalIncome)}</div>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Expenses</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-danger)' }}>{formatCurrency(behavioral.propertyAnalysis.totalExpense)}</div>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Expense Ratio</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>
                        {behavioral.propertyAnalysis.expenseRatio !== null ? `${(behavioral.propertyAnalysis.expenseRatio * 100).toFixed(0)}%` : '0%'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {behavioral.propertyAnalysis.count > 0 ? (
                <div>
                  {/* Period Comparison & Deviation Alerts */}
                  {(behavioral.propertyAnalysis.prevNetFlow !== 0 || behavioral.propertyAnalysis.unusualSpending) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                      {behavioral.propertyAnalysis.prevNetFlow !== 0 && (
                        <div style={{ fontSize: 'var(--text-xs)', padding: '6px 12px', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>vs. Previous Net Flow:</span>
                          <b style={{ color: behavioral.propertyAnalysis.diffFlowFromPrev >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {behavioral.propertyAnalysis.diffFlowFromPrev >= 0 ? '+' : ''}{formatCurrency(behavioral.propertyAnalysis.diffFlowFromPrev)}
                          </b>
                          <span style={{ color: 'var(--color-muted)' }}>({formatCurrency(behavioral.propertyAnalysis.prevNetFlow)} prev)</span>
                        </div>
                      )}
                      {behavioral.propertyAnalysis.unusualSpending && (
                        <div style={{ fontSize: 'var(--text-xs)', padding: '6px 12px', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>⚠️ <b>Pattern Deviation:</b> {behavioral.propertyAnalysis.unusualSpending.message}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-xl)' }}>
                    {/* Left Column: Sub-type breakdown */}
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                        Property Expense Breakdown
                      </h4>
                      {behavioral.propertyAnalysis.dominantSubcategory && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink)', backgroundColor: 'var(--color-surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '10px', borderLeft: '3px solid var(--color-brass)' }}>
                          👑 <b>Dominant Cost:</b> {behavioral.propertyAnalysis.dominantSubcategory.label} accounted for <b>{(behavioral.propertyAnalysis.dominantSubcategory.percentage * 100).toFixed(0)}%</b> of property operating expenses ({formatCurrency(behavioral.propertyAnalysis.dominantSubcategory.amount)}).
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { label: '🏦 Mortgage & Structural Loans', amount: behavioral.propertyAnalysis.breakdown.mortgage, color: 'var(--color-purple)' },
                          { label: '🛠️ Maintenance & Repairs', amount: behavioral.propertyAnalysis.breakdown.maintenance, color: 'var(--color-danger)' },
                          { label: '🏛️ Property Taxes & Insurance', amount: behavioral.propertyAnalysis.breakdown.taxes, color: 'var(--color-brass)' },
                          { label: '💡 Utilities & HOA Fees', amount: behavioral.propertyAnalysis.breakdown.utilities, color: 'var(--color-warning)' },
                          { label: '📦 Other Property Overhead', amount: behavioral.propertyAnalysis.breakdown.other, color: 'var(--color-muted)' }
                        ].filter(item => item.amount > 0).map((item, idx) => {
                          const pct = behavioral.propertyAnalysis.totalExpense > 0 ? (item.amount / behavioral.propertyAnalysis.totalExpense) * 100 : 0;
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-ink)' }}>
                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></span>
                                {item.label}
                              </span>
                              <span style={{ fontWeight: 'var(--weight-medium)' }}>
                                {formatCurrency(item.amount)} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Income vs Expense Bar */}
                      {behavioral.propertyAnalysis.totalIncome > 0 && (
                        <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--color-success)', fontWeight: 'var(--weight-medium)' }}>
                              Income: {formatCurrency(behavioral.propertyAnalysis.totalIncome)}
                            </span>
                            <span style={{ color: 'var(--color-danger)', fontWeight: 'var(--weight-medium)' }}>
                              Expenses: {formatCurrency(behavioral.propertyAnalysis.totalExpense)}
                            </span>
                          </div>
                          <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${Math.min(100, (behavioral.propertyAnalysis.totalIncome / (behavioral.propertyAnalysis.totalIncome + behavioral.propertyAnalysis.totalExpense)) * 100)}%`, height: '100%', backgroundColor: 'var(--color-success)' }}></div>
                            <div style={{ width: `${Math.min(100, (behavioral.propertyAnalysis.totalExpense / (behavioral.propertyAnalysis.totalIncome + behavioral.propertyAnalysis.totalExpense)) * 100)}%`, height: '100%', backgroundColor: 'var(--color-danger)' }}></div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Top Expenses & Explanatory Insight */}
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                        Largest Property Expenses
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-lg) 0' }}>
                        {behavioral.propertyAnalysis.topExpenses.map((tx, idx) => (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: idx === behavioral.propertyAnalysis.topExpenses.length - 1 ? 'none' : '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }}>
                            <div>
                              <span style={{ fontWeight: 'var(--weight-medium)' }}>{tx.description}</span>
                              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{new Date(tx.date).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontWeight: 'var(--weight-bold)' }}>{formatCurrency(tx.amount)}</span>
                          </li>
                        ))}
                      </ul>

                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', backgroundColor: 'color-mix(in srgb, var(--color-success) 8%, transparent)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)' }}>
                        💡 <b>Real Estate Asset Insight:</b> Separating rental income and property operating costs from your personal cash flow gives you a true picture of your real estate investment performance. Monitoring Net Cash Flow and categorizing maintenance versus recurring structural costs (mortgage, taxes, HOA) prevents lumpy property repairs from distorting your personal lifestyle spending metrics.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl) var(--space-md)', color: 'var(--color-muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: 'var(--space-sm)' }}>🏠</div>
                  <p style={{ margin: '0 0 var(--space-xs) 0', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>No Property Activity Logged in This Period</p>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', maxWidth: '500px', marginInline: 'auto' }}>
                    When you log rental income or real estate operating costs under the <b>Property</b> or <b>Rental Income</b> categories, this panel automatically tracks Net Cash Flow, calculates expense-to-income ratios, and isolates property investment performance from your household budget.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Nora Insights Card */}
          {behavioral.noraAnalysis && (
            <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', marginTop: 'var(--space-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
                    👧 Nora Insights
                  </h3>
                  <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', margin: '4px 0 0 0' }}>
                    {behavioral.noraAnalysis.count > 0 
                      ? 'Tracking education, activities, and child-related family support.' 
                      : 'Prepared for child & family support analysis when Nora records are logged.'}
                  </p>
                </div>
                {behavioral.noraAnalysis.count > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', backgroundColor: 'var(--color-surface-2)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Total Child Spend</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-purple)' }}>{formatCurrency(behavioral.noraAnalysis.totalSpend)}</div>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Share of Budget</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>{(behavioral.noraAnalysis.shareOfTotalExpense * 100).toFixed(1)}%</div>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Avg Transaction</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>{formatCurrency(behavioral.noraAnalysis.averageTxAmount)}</div>
                    </div>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', textTransform: 'uppercase' }}>Transactions</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>{behavioral.noraAnalysis.count}</div>
                    </div>
                  </div>
                )}
              </div>

              {behavioral.noraAnalysis.count > 0 ? (
                <div>
                  {/* Period Comparison & Deviation Alerts */}
                  {(behavioral.noraAnalysis.prevTotalSpend > 0 || behavioral.noraAnalysis.unusualSpending) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                      {behavioral.noraAnalysis.prevTotalSpend > 0 && (
                        <div style={{ fontSize: 'var(--text-xs)', padding: '6px 12px', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>vs. Previous Period:</span>
                          <b style={{ color: behavioral.noraAnalysis.diffFromPrev > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {behavioral.noraAnalysis.diffFromPrev > 0 ? '+' : ''}{formatCurrency(behavioral.noraAnalysis.diffFromPrev)}
                            {behavioral.noraAnalysis.pctChangeFromPrev !== null ? ` (${(behavioral.noraAnalysis.pctChangeFromPrev * 100).toFixed(0)}%)` : ''}
                          </b>
                          <span style={{ color: 'var(--color-muted)' }}>({formatCurrency(behavioral.noraAnalysis.prevTotalSpend)} prev)</span>
                        </div>
                      )}
                      {behavioral.noraAnalysis.unusualSpending && (
                        <div style={{ fontSize: 'var(--text-xs)', padding: '6px 12px', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>⚠️ <b>Pattern Deviation:</b> {behavioral.noraAnalysis.unusualSpending.message}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-xl)' }}>
                    {/* Left Column: Sub-type breakdown */}
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                        Child Expense Breakdown
                      </h4>
                      {behavioral.noraAnalysis.dominantSubcategory && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink)', backgroundColor: 'var(--color-surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '10px', borderLeft: '3px solid var(--color-purple)' }}>
                          👑 <b>Dominant Commitment:</b> {behavioral.noraAnalysis.dominantSubcategory.label} accounted for <b>{(behavioral.noraAnalysis.dominantSubcategory.percentage * 100).toFixed(0)}%</b> of child expenditures ({formatCurrency(behavioral.noraAnalysis.dominantSubcategory.amount)}).
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { label: '📚 Education & Child Support', amount: behavioral.noraAnalysis.breakdown.education, color: 'var(--color-purple)' },
                          { label: '🎟️ Sports & Extracurriculars', amount: behavioral.noraAnalysis.breakdown.activities, color: 'var(--color-success)' },
                          { label: '🏥 Healthcare & Pediatrician', amount: behavioral.noraAnalysis.breakdown.health, color: 'var(--color-danger)' },
                          { label: '👗 Clothing & Shoes', amount: behavioral.noraAnalysis.breakdown.clothes, color: 'var(--color-warning)' },
                          { label: '🎁 Toys & Gifts', amount: behavioral.noraAnalysis.breakdown.gifts, color: 'var(--color-brass)' },
                          { label: '📦 Other Child Overhead', amount: behavioral.noraAnalysis.breakdown.other, color: 'var(--color-muted)' }
                        ].filter(item => item.amount > 0).map((item, idx) => {
                          const pct = (item.amount / behavioral.noraAnalysis.totalSpend) * 100;
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-ink)' }}>
                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></span>
                                {item.label}
                              </span>
                              <span style={{ fontWeight: 'var(--weight-medium)' }}>
                                {formatCurrency(item.amount)} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Education/Support vs Discretionary Bar */}
                      <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--color-purple)', fontWeight: 'var(--weight-medium)' }}>
                            Education & Support: {formatCurrency(behavioral.noraAnalysis.breakdown.education)} ({((behavioral.noraAnalysis.breakdown.education / behavioral.noraAnalysis.totalSpend) * 100).toFixed(0)}%)
                          </span>
                          <span style={{ color: 'var(--color-success)', fontWeight: 'var(--weight-medium)' }}>
                            Activities & Other: {formatCurrency(behavioral.noraAnalysis.totalSpend - behavioral.noraAnalysis.breakdown.education)} ({(((behavioral.noraAnalysis.totalSpend - behavioral.noraAnalysis.breakdown.education) / behavioral.noraAnalysis.totalSpend) * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${(behavioral.noraAnalysis.breakdown.education / behavioral.noraAnalysis.totalSpend) * 100}%`, height: '100%', backgroundColor: 'var(--color-purple)' }}></div>
                          <div style={{ width: `${(((behavioral.noraAnalysis.totalSpend - behavioral.noraAnalysis.breakdown.education) / behavioral.noraAnalysis.totalSpend) * 100)}%`, height: '100%', backgroundColor: 'var(--color-success)' }}></div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Top Expenses & Explanatory Insight */}
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                        Largest Child Expenses
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-lg) 0' }}>
                        {behavioral.noraAnalysis.topExpenses.map((tx, idx) => (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: idx === behavioral.noraAnalysis.topExpenses.length - 1 ? 'none' : '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }}>
                            <div>
                              <span style={{ fontWeight: 'var(--weight-medium)' }}>{tx.description}</span>
                              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{new Date(tx.date).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontWeight: 'var(--weight-bold)' }}>{formatCurrency(tx.amount)}</span>
                          </li>
                        ))}
                      </ul>

                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', backgroundColor: 'color-mix(in srgb, var(--color-purple) 8%, transparent)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-purple)' }}>
                        💡 <b>Family Budget Insight:</b> Tracking education, sports, healthcare, and clothing for Nora in a dedicated view isolates child rearing and support commitments from general household lifestyle wants. Notice how school tuition and child support automatically elevate into mandatory <b>Needs (50%)</b> in your primary 50/30/20 budget hero.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl) var(--space-md)', color: 'var(--color-muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: 'var(--space-sm)' }}>👧</div>
                  <p style={{ margin: '0 0 var(--space-xs) 0', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>No Child Activity Logged in This Period</p>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', maxWidth: '500px', marginInline: 'auto' }}>
                    When you log school tuition, sports, clothing, or child support under the <b>Nora</b> category, this panel automatically analyzes family spending trends, categorizes commitments versus activities, and integrates with the 50/30/20 rules engine.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
