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
    <div className="insights-view" style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-md)' }}>
      
      {/* Attention Needed (Alerts) */}
      {alerts && alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', color: 'var(--color-ink)' }}>Attention Needed</h2>
          {alerts.map((alert, idx) => (
            <div key={idx} style={{ 
              display: 'flex', gap: 'var(--space-md)', alignItems: 'center', padding: 'var(--space-md)', 
              backgroundColor: alert.type === 'warning' ? 'var(--color-warning)' : 'var(--color-success)',
              color: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ fontSize: '24px' }}>{alert.type === 'warning' ? '⚠️' : '🌟'}</div>
              <div>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-md)' }}>{alert.title}</div>
                <div style={{ fontSize: 'var(--text-sm)', opacity: 0.9 }}>{alert.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        
        {/* Financial Health */}
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            Financial Health
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '24px', backgroundColor: 'var(--color-surface-2)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                {financialHealth.savingsRate >= 0.2 ? '🏆' : '📈'}
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', fontWeight: 'var(--weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Savings Rate</div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: financialHealth.savingsRate >= 0.2 ? 'var(--color-success)' : 'var(--color-ink)' }}>
                  {(financialHealth.savingsRate * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '2px' }}>Unspent cash flow retained.</div>
              </div>
            </div>

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

        {/* 50/30/20 Rule */}
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            The 50/30/20 Rule
          </h2>
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        
        {/* Spending by Category Change */}
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            Category Trends (MoM)
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
            How spending changed compared to the previous period.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {behavioral.spendingByCategoryChange.slice(0, 7).map((cat, idx) => (
              <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm) 0', borderBottom: idx === 6 ? 'none' : '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontWeight: 'var(--weight-medium)' }}>{cat.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>{formatCurrency(cat.currTotal)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  {/* Sparkline Visual (CSS based) */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', height: '24px', gap: '2px' }}>
                     <div style={{ width: '12px', height: `${Math.min((cat.prevTotal / Math.max(cat.prevTotal, cat.currTotal)) * 24, 24)}px`, backgroundColor: 'var(--color-border)', borderRadius: '2px 2px 0 0' }}></div>
                     <div style={{ width: '12px', height: `${Math.min((cat.currTotal / Math.max(cat.prevTotal, cat.currTotal)) * 24, 24)}px`, backgroundColor: cat.diff > 0 ? 'var(--color-danger)' : 'var(--color-success)', borderRadius: '2px 2px 0 0' }}></div>
                  </div>
                  <div style={{ fontWeight: 'var(--weight-bold)', color: cat.pctChange > 0 ? 'var(--color-danger)' : (cat.pctChange < 0 ? 'var(--color-success)' : 'var(--color-muted)'), minWidth: '50px', textAlign: 'right' }}>
                    {cat.pctChange > 0 ? '↑' : (cat.pctChange < 0 ? '↓' : '-')} {Math.abs(cat.pctChange).toFixed(0)}%
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Frequent Spending */}
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            Frequent Spending
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
            High frequency vendors that silently drain cash flow.
          </p>
          {behavioral.frequentSpending.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {behavioral.frequentSpending.map((vendor, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: idx === behavioral.frequentSpending.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>{vendor.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
                      {vendor.count} txns @ {formatCurrency(vendor.average)} avg
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-danger)' }}>
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
        
        {/* Largest Transactions */}
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            Largest Transactions
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
            Top 5 single expenses impacting cash flow this period.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {behavioral.largestTransactions.map((tx, idx) => (
              <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: idx === 4 ? 'none' : '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontWeight: 'var(--weight-medium)' }}>{tx.description}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                    {new Date(tx.date).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ fontWeight: 'var(--weight-bold)' }}>{formatCurrency(tx.amount)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        {/* Fixed Costs */}
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            Fixed Costs Breakdown
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
            Housing, Utilities, Property, and Subscriptions.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontWeight: 'var(--weight-medium)' }}>Total Fixed Costs</div>
            <div style={{ fontWeight: 'var(--weight-bold)' }}>{formatCurrency(financialHealth.totalIncome * financialHealth.fixedCostsRatio)}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontWeight: 'var(--weight-medium)' }}>As % of Income</div>
            <div style={{ fontWeight: 'var(--weight-bold)' }}>{(financialHealth.fixedCostsRatio * 100).toFixed(1)}%</div>
          </div>
          {behavioral.subscriptions && behavioral.subscriptions.length > 0 && (
            <div style={{ marginTop: 'var(--space-md)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 'var(--space-sm)' }}>Active Subscriptions</h3>
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

        {/* Overviews (Tax & Property) & Income Dependency */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              Hidden Costs
            </h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontWeight: 'var(--weight-medium)' }}>Taxes & Fees</div>
              </div>
              <div style={{ fontWeight: 'var(--weight-bold)' }}>{formatCurrency(financialHealth.overviews.taxes)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0' }}>
              <div>
                <div style={{ fontWeight: 'var(--weight-medium)' }}>Property Expenses</div>
              </div>
              <div style={{ fontWeight: 'var(--weight-bold)' }}>{formatCurrency(financialHealth.overviews.property)}</div>
            </div>
          </div>

          <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              Income Dependency
            </h2>
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
                
                <h3 style={{ fontSize: 'var(--text-md)', margin: 'var(--space-sm) 0 0 0' }}>Sources</h3>
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
    </div>
  );
}
