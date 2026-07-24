import { useState, useMemo } from 'react';
import { generateDeepInsights } from '../lib/analytics';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import { formatCurrency } from '../lib/currency';

export default function InsightsView({ data, period, filterProps }) {
  const insights = useMemo(() => generateDeepInsights(data, period, filterProps), [data, period, filterProps]);

  if (!insights || !insights.financialHealth) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>🍃</div>
        <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-ink)' }}>No Data for Insights</h3>
        <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>Add some transactions to see your financial insights.</p>
      </div>
    );
  }

  const { financialHealth, behavioral, trajectory } = insights;
  const { needs, wants, savings } = financialHealth.needsWantsSavings;
  const totalExpense = financialHealth.totalExpense;

  const needsPct = totalExpense > 0 ? (needs / totalExpense) * 100 : 0;
  const wantsPct = totalExpense > 0 ? (wants / totalExpense) * 100 : 0;
  const savingsPct = totalExpense > 0 ? (savings / totalExpense) * 100 : 0;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>
        
        {/* Financial Health / 50-30-20 Card */}
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            The 50/30/20 Rule
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
            A breakdown of your <strong>Total Expenses</strong> across the Needs, Wants, and Savings buckets. (Note: The classical 50/30/20 rule is based on Income).
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Needs (Target 50%)</span>
                <span style={{ color: needsPct > 50 ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                  {formatCurrency(needs)} ({needsPct.toFixed(1)}%)
                </span>
              </div>
              <div className="budget-bar-wrapper">
                <div style={{ width: `${Math.min(needsPct, 100)}%`, height: '100%', backgroundColor: needsPct > 50 ? 'var(--color-danger)' : 'var(--color-accent)' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Wants (Target 30%)</span>
                <span style={{ color: wantsPct > 30 ? 'var(--color-warning)' : 'var(--color-muted)' }}>
                  {formatCurrency(wants)} ({wantsPct.toFixed(1)}%)
                </span>
              </div>
              <div className="budget-bar-wrapper">
                <div style={{ width: `${Math.min(wantsPct, 100)}%`, height: '100%', backgroundColor: wantsPct > 30 ? 'var(--color-warning)' : 'hsl(45, 100%, 50%)' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Savings (Target 20%)</span>
                <span style={{ color: savingsPct >= 20 ? 'var(--color-success)' : 'var(--color-muted)' }}>
                  {formatCurrency(savings)} ({savingsPct.toFixed(1)}%)
                </span>
              </div>
              <div className="budget-bar-wrapper">
                <div style={{ width: `${Math.min(savingsPct, 100)}%`, height: '100%', backgroundColor: savingsPct >= 20 ? 'var(--color-success)' : 'var(--color-border)' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Trajectory & Savings Rate Card */}
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            Velocity & Health
          </h2>
          
          <div style={{ marginTop: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: '24px', backgroundColor: 'var(--color-surface-2)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                {financialHealth.savingsRate >= 0.2 ? '🏆' : '📈'}
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', fontWeight: 'var(--weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Savings Rate</div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: financialHealth.savingsRate >= 0.2 ? 'var(--color-success)' : 'var(--color-ink)' }}>
                  {(financialHealth.savingsRate * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '2px' }}>Of your income is retained.</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: '24px', backgroundColor: 'var(--color-surface-2)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                {financialHealth.fixedCostsRatio <= 0.5 ? '🛡️' : '⚠️'}
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', fontWeight: 'var(--weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fixed Costs Load</div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: financialHealth.fixedCostsRatio <= 0.5 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {(financialHealth.fixedCostsRatio * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '2px' }}>Income tied up in recurring bills.</div>
              </div>
            </div>

            {trajectory && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '24px', backgroundColor: 'var(--color-surface-2)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                  🔥
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', fontWeight: 'var(--weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Burn Rate</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>
                    {formatCurrency(trajectory.dailyBurnRate)} / day
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '2px' }}>
                    Projected end of month: <strong>{formatCurrency(trajectory.projectedEnd)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>
        
        {/* The Latte Factor Card */}
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            The "Latte Factor"
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
            Your most frequently visited vendors. High frequency small purchases can add up.
          </p>

          {behavioral.latteFactor.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {behavioral.latteFactor.map((vendor, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: idx === behavioral.latteFactor.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>{vendor.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
                      {vendor.count} transactions in {period.replace('_', ' ')}
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
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>You don't seem to frequent any specific vendor heavily.</p>
            </div>
          )}
        </div>

        {/* Income Dependency Card */}
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            Income Dependency
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
            How diversified are your income streams?
          </p>
          
          {financialHealth.totalIncome > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '24px', backgroundColor: 'var(--color-surface-2)', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                  💼
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', fontWeight: 'var(--weight-medium)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Income</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>
                    {formatCurrency(financialHealth.totalIncome)}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginTop: '2px' }}>
                    During this period.
                  </div>
                </div>
              </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
              <div style={{ fontSize: '36px', marginBottom: 'var(--space-sm)' }}>💤</div>
              <p style={{ margin: 0, color: 'var(--color-ink)', fontWeight: 'var(--weight-medium)' }}>No Income Detected</p>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>Add income to see dependency insights.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
