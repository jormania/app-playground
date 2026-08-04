import React, { useEffect, useMemo, useState } from 'react';
import { generateDeepInsights } from '../lib/analytics';
import { formatShareableSummary } from '../lib/analytics/summaries';
import { formatCurrency } from '../lib/currency';
import { formatPeriodLabel, filterByPeriod } from '../lib/period';
import { projectCashFlow } from '../lib/analytics/forecast';
import ForecastSection from './ForecastSection';
import NoraAvatar from './NoraAvatar';
import { Button } from '../../ds/components/Button';
import { CategoryIcon } from './CategoryIcon';
import SmartInsightsChat from './SmartInsightsChat';
import MonthlyDigest from './MonthlyDigest';

/** Clipboard write with a same-origin fallback for browsers/contexts where
 * the async Clipboard API isn't available (older Safari, non-HTTPS dev). */
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
  return Promise.resolve();
}

/** Percentage of `part` over `whole`, or null when `whole` is 0 — callers render
 * "—" instead of the NaN% the raw division used to produce for an income-only
 * or otherwise expense-free period. */
function pct(part, whole) {
  if (!whole) return null;
  return (part / whole) * 100;
}

function pctLabel(part, whole, digits = 1) {
  const p = pct(part, whole);
  return p === null ? '—' : `${p.toFixed(digits)}%`;
}

export default function InsightsView({ data, period, filterProps, config, initialTripFilter, onConsumeInitialTripFilter }) {
  // Seeded from "View this trip in Insights" on a transaction — App.jsx passes
  // a one-shot target trip id and this view remounts fresh every time the tab
  // is switched to (it's conditionally rendered, not display:none'd), so a
  // plain useState default is enough for the initial value.
  const [tripFilter, setTripFilter] = useState(initialTripFilter || 'ALL');
  // "Copy summary" confirmation — briefly swaps the button label, mirroring
  // the pattern used for other one-shot confirmations in this app.
  const [copied, setCopied] = useState(false);

  // Consume the one-shot jump target once, on mount only, so returning to
  // Insights later via the nav tab (not another "View this trip") doesn't
  // keep reapplying a stale filter. Also scrolls to the Travel card itself —
  // landing on the tab and leaving the user to scroll past three other
  // sections to find the trip they just asked for defeated the whole point.
  useEffect(() => {
    if (!initialTripFilter) return;
    if (onConsumeInitialTripFilter) onConsumeInitialTripFilter();
    // One frame so the Travel card (which depends on `insights`, computed in
    // the same render) has actually painted before measuring its position.
    requestAnimationFrame(() => {
      document.getElementById('travel-insights-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deliberately ignores `period` and `filterProps`: a projection is about what
  // is still to come, so narrowing it to "last month" or to one category would
  // be meaningless. It reads the full ledger every time.
  const showForecast = config?.features?.cashFlow !== false;
  const forecast = useMemo(
    () => (showForecast ? projectCashFlow(data) : null),
    [showForecast, data],
  );
  const insights = useMemo(() => {
    return generateDeepInsights(data, period, { ...filterProps, tripFilter });
  }, [data, period, filterProps, tripFilter]);

  // Destructure with optional chaining — safe when insights is null
  const financialHealth = insights?.financialHealth;
  const behavioral = insights?.behavioral;
  const alerts = insights?.alerts;

  // 50/30/20 Targets (only meaningful when insights exists)
  const targetNeeds = financialHealth ? financialHealth.totalExpense * 0.5 : 0;
  const targetWants = financialHealth ? financialHealth.totalExpense * 0.3 : 0;
  const targetSavings = financialHealth ? financialHealth.totalExpense * 0.2 : 0;

  const periodLabel = formatPeriodLabel(period);

  const handleCopySummary = () => {
    copyText(formatShareableSummary(periodLabel, insights))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(e => console.error('Failed to copy summary:', e));
  };

  return (
    <div className="insights-view" style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-md)', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Header removed as requested */}

      {config?.features?.aiParser && (
        <SmartInsightsChat 
          transactions={filterByPeriod(data.transactions || [], period)} 
          categories={data.categories || []} 
          config={config} 
        />
      )}

      {!insights ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>✨</div>
          <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-ink)' }}>Nothing to analyse yet</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', maxWidth: '380px', marginBottom: 0 }}>
            Insights compare this period against the ones before it, so they need a few
            transactions to work from. Add some spending — or widen the period using the
            calendar button above — and this fills in.
          </p>
        </div>
      ) : (<>



      {/* SECTION: ACT */}
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)', backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>Act</span>
          <h2 style={{ fontSize: 'var(--text-xl)', margin: 0, color: 'var(--color-ink)' }}>Immediate Attention & Action</h2>
        </div>

        {/* Period in Review */}
        {insights.summaryParagraph && (
          <div className="card-container stagger-1" style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', borderLeft: '4px solid var(--color-accent)' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--color-ink)' }}>
              <strong>📅 {periodLabel} in Review:</strong> {insights.summaryParagraph}
            </p>
            <div style={{ marginTop: 'var(--space-sm)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="sm" variant="ghost" onClick={handleCopySummary}>
                {copied ? '✓ Copied' : '📋 Copy summary'}
              </Button>
            </div>
          </div>
        )}

        {/* Attention Needed (Alerts) */}
        {alerts && alerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--color-ink)' }}>Attention Needed</h3>
            {alerts.map((alert, idx) => {
              // Tinted background + coloured text/border — the same pattern used by
              // every other alert box in this file (Pattern Deviation, Seasonal
              // Recognition, etc.). The old solid warning/success fill with white
              // text computed to roughly 2:1 contrast in dark theme (needs 4.5:1
              // for WCAG AA); token-colour-on-surface reliably clears that bar.
              const tone = alert.type === 'warning' ? 'var(--color-warning)' : 'var(--color-success)';
              return (
                <div key={idx} style={{
                  display: 'flex', gap: 'var(--space-md)', alignItems: 'center', padding: 'var(--space-md)',
                  backgroundColor: `color-mix(in srgb, ${tone} 12%, var(--color-surface))`,
                  color: tone, border: `1px solid color-mix(in srgb, ${tone} 40%, transparent)`,
                  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ fontSize: '24px' }}>{alert.type === 'warning' ? '⚠️' : '🌟'}</div>
                  <div>
                    <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', color: 'var(--color-ink)' }}>{alert.title}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: tone }}>{alert.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Financial Wins */}
        {insights.wins && insights.wins.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', color: 'var(--color-ink)' }}>Financial Wins</h3>
            <div className="card-container stagger-2" style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
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

      {/* SECTION: REVIEW */}
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)', backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>Review</span>
          <h2 style={{ fontSize: 'var(--text-xl)', margin: 0, color: 'var(--color-ink)' }}>Current Standing</h2>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <MonthlyDigest transactions={data.transactions || []} categories={data.categories || []} period="this_month" title="This Month" />
          <MonthlyDigest transactions={data.transactions || []} categories={data.categories || []} period="this_year" title="This Year" />
        </div>
      </div>

      {/* SECTION: AHEAD — the forecast. Placed straight after "Act" because it's
          the other thing you can still do something about; everything below is
          retrospective. Gated on the same toggle as the Cash Flow Trend chart. */}
      {showForecast && <ForecastSection forecast={forecast} />}

      {/* SECTION: UNDERSTAND */}
      <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-success)', backgroundColor: 'color-mix(in srgb, var(--color-success) 15%, transparent)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>Understand</span>
          <h2 style={{ fontSize: 'var(--text-xl)', margin: 0, color: 'var(--color-ink)' }}>Core Financial Architecture</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          
          {/* Financial Health with Savings Rate emphasized as Primary KPI */}
          <div className="card-container stagger-2" style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
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
          <div className="card-container stagger-3" style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
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
          <div className="card-container stagger-3" style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              The 50/30/20 Rule
            </h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
              Target vs Actual spending breakdown based on total expenses.
            </p>

            {financialHealth.totalExpense > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

                {/* Needs */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                    <span style={{ fontWeight: 'var(--weight-medium)' }}>Needs</span>
                    <span style={{ fontWeight: 'var(--weight-bold)', color: financialHealth.needsWantsSavings.needs > targetNeeds ? 'var(--color-danger)' : 'var(--color-ink)' }}>
                      {formatCurrency(financialHealth.needsWantsSavings.needs)} ({pctLabel(financialHealth.needsWantsSavings.needs, financialHealth.totalExpense, 1)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: 'var(--space-xs)' }}>
                    <span>Target 50%: {formatCurrency(targetNeeds)}</span>
                    <span>Diff: {formatCurrency(financialHealth.needsWantsSavings.needs - targetNeeds)}</span>
                  </div>
                  <div className="budget-bar-wrapper">
                    <div style={{ width: `${Math.min(pct(financialHealth.needsWantsSavings.needs, financialHealth.totalExpense) || 0, 100)}%`, height: '100%', backgroundColor: financialHealth.needsWantsSavings.needs > targetNeeds ? 'var(--color-danger)' : 'var(--color-border)' }}></div>
                  </div>
                </div>

                {/* Wants */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                    <span style={{ fontWeight: 'var(--weight-medium)' }}>Wants</span>
                    <span style={{ fontWeight: 'var(--weight-bold)', color: financialHealth.needsWantsSavings.wants > targetWants ? 'var(--color-warning)' : 'var(--color-ink)' }}>
                      {formatCurrency(financialHealth.needsWantsSavings.wants)} ({pctLabel(financialHealth.needsWantsSavings.wants, financialHealth.totalExpense, 1)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: 'var(--space-xs)' }}>
                    <span>Target 30%: {formatCurrency(targetWants)}</span>
                    <span>Diff: {formatCurrency(financialHealth.needsWantsSavings.wants - targetWants)}</span>
                  </div>
                  <div className="budget-bar-wrapper">
                    <div style={{ width: `${Math.min(pct(financialHealth.needsWantsSavings.wants, financialHealth.totalExpense) || 0, 100)}%`, height: '100%', backgroundColor: financialHealth.needsWantsSavings.wants > targetWants ? 'var(--color-warning)' : 'var(--color-border)' }}></div>
                  </div>
                </div>

                {/* Savings */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                    <span style={{ fontWeight: 'var(--weight-medium)' }}>Savings &amp; Investments</span>
                    <span style={{ fontWeight: 'var(--weight-bold)' }}>
                      {formatCurrency(financialHealth.needsWantsSavings.savings)} ({pctLabel(financialHealth.needsWantsSavings.savings, financialHealth.totalExpense, 1)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginBottom: 'var(--space-xs)' }}>
                    <span>Target 20%: {formatCurrency(targetSavings)}</span>
                    <span>Diff: {formatCurrency(financialHealth.needsWantsSavings.savings - targetSavings)}</span>
                  </div>
                  <div className="budget-bar-wrapper">
                    <div style={{ width: `${Math.min(pct(financialHealth.needsWantsSavings.savings, financialHealth.totalExpense) || 0, 100)}%`, height: '100%', backgroundColor: (pct(financialHealth.needsWantsSavings.savings, financialHealth.totalExpense) || 0) >= 20 ? 'var(--color-success)' : 'var(--color-border)' }}></div>
                  </div>
                </div>

              </div>
            ) : (
              <p style={{ color: 'var(--color-muted)', fontStyle: 'italic', margin: 0 }}>No expenses recorded this period — nothing to break down yet.</p>
            )}
          </div>

          {/* Income Dependency */}
          <div className="card-container stagger-4" style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
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
                
                <h4 style={{ fontSize: 'var(--text-base)', margin: 'var(--space-sm) 0 0 0' }}>Sources</h4>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          
          {/* Spending by Category Change - Limited to top 5 most significant shifts */}
          <div className="card-container stagger-4" style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
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
          <div className="card-container stagger-4" style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
              Frequent Spending
            </h3>
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
              Vendors you buy from often. Repeating by nature — a bus fare, a grocery run — isn't
              a problem; the ones flagged <strong>Worth a look</strong> are discretionary and add up.
            </p>
            {behavioral.frequentSpending.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {behavioral.frequentSpending.map((vendor, idx) => (
                  <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm) 0', borderBottom: idx === behavioral.frequentSpending.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                    <div>
                      <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {vendor.name}
                        <span style={{
                          fontSize: '10px', padding: '1px 6px', borderRadius: 'var(--radius-pill)',
                          textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 'var(--weight-bold)',
                          color: vendor.isEssential ? 'var(--color-muted)' : 'var(--color-warning)',
                          background: vendor.isEssential
                            ? 'color-mix(in srgb, var(--color-muted) 12%, transparent)'
                            : 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
                        }}>
                          {vendor.isEssential ? 'Routine' : 'Worth a look'}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px', display: 'flex', gap: 'var(--space-sm)' }}>
                        <span><strong>Count:</strong> {vendor.count}</span>
                        <span>•</span>
                        <span><strong>Avg Spend:</strong> {formatCurrency(vendor.average)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Spend</div>
                      <div style={{ fontWeight: 'var(--weight-bold)', color: vendor.isEssential ? 'var(--color-ink)' : 'var(--color-danger)', fontSize: 'var(--text-base)' }}>
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
          <div className="card-container stagger-4" style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
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
                  <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 'var(--space-sm)' }}>{formatCurrency(tx.amount)}</div>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Travel Insights Card */}
        {behavioral.travelAnalysis && (
          <div id="travel-insights-card" className="card-container stagger-4" style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', margin: '0 0 4px 0' }}>✈️ Travel Insights</h3>
                <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', margin: '0 0 var(--space-sm) 0' }}>
                  {behavioral.travelAnalysis.count > 0 
                    ? 'Analyzing travel spending during the selected period.' 
                    : 'Prepared for travel analysis when expenses are logged under the Travel category.'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label htmlFor="trip-filter-select" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap' }}>Filter Trip:</label>
                  <select
                    id="trip-filter-select"
                    value={tripFilter}
                    onChange={e => setTripFilter(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg)',
                      color: 'var(--color-ink)',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'inherit'
                    }}
                  >
                    <option value="ALL">All Trips</option>
                    <option value="UNASSIGNED">Unassigned Travel</option>
                    {data && data.trips && data.trips.map(t => (
                      <option key={t.id} value={t.id}>{t.name}{t.destination ? ` (${t.destination})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {behavioral.travelAnalysis.count > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', backgroundColor: 'var(--color-surface-2)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-md)', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Total Spend</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-brass)', fontSize: 'var(--text-base)' }}>{formatCurrency(behavioral.travelAnalysis.totalSpend)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Share of Budget</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', fontSize: 'var(--text-base)' }}>{(behavioral.travelAnalysis.shareOfTotalExpense * 100).toFixed(1)}%</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Avg Transaction</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', fontSize: 'var(--text-base)' }}>{formatCurrency(behavioral.travelAnalysis.averageTxAmount)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Transactions</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', fontSize: 'var(--text-base)' }}>{behavioral.travelAnalysis.count}</div>
                  </div>
                </div>
              )}

              {(behavioral.travelAnalysis.prevTotalSpend > 0 || behavioral.travelAnalysis.unusualSpending) && behavioral.travelAnalysis.count > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 'var(--space-md)' }}>
                  {behavioral.travelAnalysis.prevTotalSpend > 0 && (
                    <div style={{ fontSize: 'var(--text-xs)', padding: '6px 12px', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                      <span>vs. Previous Period: </span>
                      <b style={{ color: behavioral.travelAnalysis.diffFromPrev > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {behavioral.travelAnalysis.diffFromPrev > 0 ? '+' : ''}{formatCurrency(behavioral.travelAnalysis.diffFromPrev)}
                        {behavioral.travelAnalysis.pctChangeFromPrev !== null ? ` (${(behavioral.travelAnalysis.pctChangeFromPrev * 100).toFixed(0)}%)` : ''}
                      </b>
                      <span style={{ color: 'var(--color-muted)' }}> ({formatCurrency(behavioral.travelAnalysis.prevTotalSpend)} prev)</span>
                    </div>
                  )}
                  {behavioral.travelAnalysis.unusualSpending && (
                    <div style={{ fontSize: 'var(--text-xs)', padding: '8px 12px', backgroundColor: behavioral.travelAnalysis.unusualSpending.type === 'high' ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' : 'color-mix(in srgb, var(--color-success) 10%, transparent)', color: behavioral.travelAnalysis.unusualSpending.type === 'high' ? 'var(--color-danger)' : 'var(--color-success)', borderRadius: 'var(--radius-sm)', border: `1px solid ${behavioral.travelAnalysis.unusualSpending.type === 'high' ? 'var(--color-danger)' : 'var(--color-success)'}` }}>
                      ⚠️ <b>Pattern Deviation:</b> {behavioral.travelAnalysis.unusualSpending.message}
                    </div>
                  )}
                </div>
              )}

              {behavioral.travelAnalysis.count > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 'var(--space-xl)' }}>
                  {/* Left Column: Sub-type breakdown */}
                  <div>
                    <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                      Travel Expense Breakdown
                    </h4>
                    {behavioral.travelAnalysis.dominantSubcategory && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink)', backgroundColor: 'var(--color-surface-2)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '10px', borderLeft: '3px solid var(--color-brass)' }}>
                        👑 <b>Dominant Category:</b> {behavioral.travelAnalysis.dominantSubcategory.name} accounted for <b>{(behavioral.travelAnalysis.dominantSubcategory.percentage * 100).toFixed(0)}%</b> of travel spending in this period ({formatCurrency(behavioral.travelAnalysis.dominantSubcategory.amount)}).
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { iconName: 'accommodation', name: 'Accommodation & Resort', amount: behavioral.travelAnalysis.breakdown.accommodation, color: 'var(--color-purple)' },
                        { iconName: 'transit', name: 'Transit & Flights', amount: behavioral.travelAnalysis.breakdown.transit, color: 'var(--color-brass)' },
                        { iconName: 'dining', name: 'Dining & Bar', amount: behavioral.travelAnalysis.breakdown.dining, color: 'var(--color-warning)' },
                        { iconName: 'activities', name: 'Tours & Activities', amount: behavioral.travelAnalysis.breakdown.activities, color: 'var(--color-success)' },
                        { iconName: 'shopping', name: 'Shopping', amount: behavioral.travelAnalysis.breakdown.shopping, color: 'var(--color-danger)' },
                        { iconName: 'other', name: 'Other', amount: behavioral.travelAnalysis.breakdown.other, color: 'var(--color-muted)' }
                      ].filter(item => item.amount > 0).map((item, idx) => {
                        const pct = (item.amount / behavioral.travelAnalysis.totalSpend) * 100;
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-sm)', gap: '8px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-ink)', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              <CategoryIcon name={item.iconName} size={14} style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                            </span>
                            <span style={{ fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {formatCurrency(item.amount)} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Prepaid vs In-Destination */}
                    <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
                          <span style={{ color: 'var(--color-muted)' }}>Prepaid Spending</span>
                          <span style={{ color: 'var(--color-brass)', fontWeight: 'var(--weight-bold)' }}>
                            {formatCurrency(behavioral.travelAnalysis.prepaidSpending)} ({((behavioral.travelAnalysis.prepaidSpending / behavioral.travelAnalysis.totalSpend) * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-xs)' }}>
                          <span style={{ color: 'var(--color-muted)' }}>In-Destination</span>
                          <span style={{ color: 'var(--color-warning)', fontWeight: 'var(--weight-bold)' }}>
                            {formatCurrency(behavioral.travelAnalysis.inDestinationSpending)} ({((behavioral.travelAnalysis.inDestinationSpending / behavioral.travelAnalysis.totalSpend) * 100).toFixed(0)}%)
                          </span>
                        </div>
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
                          <span style={{ fontWeight: 'var(--weight-bold)', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 'var(--space-sm)' }}>{formatCurrency(tx.amount)}</span>
                        </li>
                      ))}
                    </ul>

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', backgroundColor: 'color-mix(in srgb, var(--color-brass) 8%, transparent)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-brass)' }}>
                      💡 <b>Long-Term Financial Insight:</b> Grouping all travel-related purchases, future bookings, and independent trip expenses under the <b>Travel</b> category isolates variable mobility and tourism costs from your baseline household budget. This prevents temporary travel spikes from distorting your normal monthly trends for food, shopping, and transportation over long-term multi-month or annual reviews.
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


        {/* Property Insights Card (Operations Dashboard) */}
        {behavioral.propertyAnalysis && (
          <div className="card-container stagger-4" style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>
                    🏠 Property Insights
                  </h3>
                  <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', margin: '4px 0 0 0' }}>
                    {behavioral.propertyAnalysis.count > 0 
                      ? 'Monitoring rental property yields, operating overhead, and cash flow trends.' 
                      : 'Prepared for real estate operations tracking when property records are logged.'}
                  </p>
                </div>
              </div>

              {behavioral.propertyAnalysis.count > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', backgroundColor: 'var(--color-surface-2)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-md)', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Net Cash Flow</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: behavioral.propertyAnalysis.netFlow >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 'var(--text-base)' }}>
                      {behavioral.propertyAnalysis.netFlow >= 0 ? '+' : ''}{formatCurrency(behavioral.propertyAnalysis.netFlow)}
                    </div>
                    {behavioral.propertyAnalysis.prevNetFlow !== undefined && (
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '1px' }}>
                        {behavioral.propertyAnalysis.diffFlowFromPrev === 0 ? 'Stable' : `${behavioral.propertyAnalysis.diffFlowFromPrev > 0 ? '+' : ''}${formatCurrency(behavioral.propertyAnalysis.diffFlowFromPrev)} vs prev`}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Rental Income</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-success)', fontSize: 'var(--text-base)' }}>{formatCurrency(behavioral.propertyAnalysis.totalIncome)}</div>
                    {behavioral.propertyAnalysis.prevTotalIncome !== undefined && (
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '1px' }}>
                        {behavioral.propertyAnalysis.diffIncomeFromPrev === 0 ? 'Stable' : `${behavioral.propertyAnalysis.diffIncomeFromPrev > 0 ? '+' : ''}${formatCurrency(behavioral.propertyAnalysis.diffIncomeFromPrev)} vs prev`}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Expenses</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-danger)', fontSize: 'var(--text-base)' }}>{formatCurrency(behavioral.propertyAnalysis.totalExpense)}</div>
                    {behavioral.propertyAnalysis.prevTotalExpense !== undefined && (
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '1px' }}>
                        {behavioral.propertyAnalysis.diffExpenseFromPrev === 0 ? 'Stable' : `${behavioral.propertyAnalysis.diffExpenseFromPrev > 0 ? '+' : ''}${formatCurrency(behavioral.propertyAnalysis.diffExpenseFromPrev)} vs prev`}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Expense Ratio</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', fontSize: 'var(--text-base)' }}>
                      {behavioral.propertyAnalysis.expenseRatio !== null ? `${(behavioral.propertyAnalysis.expenseRatio * 100).toFixed(0)}%` : '0%'}
                    </div>
                    {behavioral.propertyAnalysis.diffRatioFromPrev !== null && behavioral.propertyAnalysis.diffRatioFromPrev !== undefined && (
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '1px' }}>
                        {Math.round(behavioral.propertyAnalysis.diffRatioFromPrev * 100) === 0 ? 'Stable' : `${behavioral.propertyAnalysis.diffRatioFromPrev > 0 ? '+' : ''}${Math.round(behavioral.propertyAnalysis.diffRatioFromPrev * 100)}% pts`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {behavioral.propertyAnalysis.count > 0 ? (
                <div>
                  {/* Pattern Deviation Alert */}
                  {behavioral.propertyAnalysis.unusualSpending && (
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', padding: '8px 12px', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚠️ <b>Pattern Deviation:</b> {behavioral.propertyAnalysis.unusualSpending.message}</span>
                      </div>
                    </div>
                  )}

                  {/* Compact Net Cash Flow Trend */}
                  {behavioral.propertyAnalysis.cashFlowTrend && behavioral.propertyAnalysis.cashFlowTrend.length > 1 && (
                    <div style={{ padding: '10px 12px', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-lg)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>📈 Net Cash Flow Trend</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px' }}>
                        {behavioral.propertyAnalysis.cashFlowTrend.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                            <span style={{ color: 'var(--color-muted)', fontSize: '11px' }}>{item.month}</span>
                            <span style={{ fontWeight: 'var(--weight-bold)', fontSize: '11px', color: item.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                              {item.net >= 0 ? '+' : ''}{formatCurrency(item.net)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-xl)' }}>
                    {/* Left Column: Sub-type breakdown */}
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                        Property Expense Breakdown
                      </h4>
                      {behavioral.propertyAnalysis.dominantSubcategory && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink)', backgroundColor: 'var(--color-surface-2)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', borderLeft: '3px solid var(--color-brass)' }}>
                          👑 <b>Primary Operating Cost:</b> {behavioral.propertyAnalysis.dominantSubcategory.name} dominated operating overhead this period, representing <b>{(behavioral.propertyAnalysis.dominantSubcategory.percentage * 100).toFixed(0)}%</b> ({formatCurrency(behavioral.propertyAnalysis.dominantSubcategory.amount)}) of total property expenditures.
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { iconName: 'mortgage', name: 'Mortgage & Structural Loans', amount: behavioral.propertyAnalysis.breakdown.mortgage, color: 'var(--color-purple)' },
                          { iconName: 'maintenance', name: 'Maintenance & Repairs', amount: behavioral.propertyAnalysis.breakdown.maintenance, color: 'var(--color-danger)' },
                          { iconName: 'taxes', name: 'Property Taxes & Insurance', amount: behavioral.propertyAnalysis.breakdown.taxes, color: 'var(--color-brass)' },
                          { iconName: 'utilities', name: 'Utilities & HOA Fees', amount: behavioral.propertyAnalysis.breakdown.utilities, color: 'var(--color-warning)' },
                          { iconName: 'other', name: 'Other Property Overhead', amount: behavioral.propertyAnalysis.breakdown.other, color: 'var(--color-muted)' }
                        ].filter(item => item.amount > 0).map((item, idx) => {
                          const pct = behavioral.propertyAnalysis.totalExpense > 0 ? (item.amount / behavioral.propertyAnalysis.totalExpense) * 100 : 0;
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-ink)', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                <CategoryIcon name={item.iconName} size={14} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                              </span>
                              <span style={{ fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap', flexShrink: 0 }}>
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

                    {/* Right Column: Top Expenses & Explanatory Summary */}
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                        Largest Property Expenses
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-lg) 0' }}>
                        {behavioral.propertyAnalysis.topExpenses.map((tx, idx) => (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx === behavioral.propertyAnalysis.topExpenses.length - 1 ? 'none' : '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }}>
                            <div>
                              <span style={{ fontWeight: 'var(--weight-medium)' }}>{tx.description}</span>
                              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{new Date(tx.date).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontWeight: 'var(--weight-bold)', textAlign: 'right', flexShrink: 0, marginLeft: 'var(--space-sm)' }}>
                              <div style={{ whiteSpace: 'nowrap' }}>{formatCurrency(tx.amount)}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-muted)', fontWeight: 'normal' }}>
                                {tx.percentageOfExpense ? `${tx.percentageOfExpense.toFixed(0)}% of total` : ''}
                              </div>
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* Deterministic Executive Summary */}
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink)', backgroundColor: 'color-mix(in srgb, var(--color-success) 8%, transparent)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)', lineHeight: '1.5' }}>
                        📋 <b>Operations Executive Summary:</b> {behavioral.propertyAnalysis.operationsSummary}
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

        {/* Nora Insights Card (Family Support Dashboard) */}
        {behavioral.noraAnalysis && (
          <div className="card-container stagger-4" style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--text-lg)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <NoraAvatar /> Nora Insights
                  </h3>
                  <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', margin: '4px 0 0 0' }}>
                    {behavioral.noraAnalysis.count > 0 
                      ? 'Tracking education, activities, and child-related family support priorities.' 
                      : 'Prepared for family support analysis when Nora records are logged.'}
                  </p>
                </div>
              </div>

              {behavioral.noraAnalysis.count > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', backgroundColor: 'var(--color-surface-2)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-md)', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Share of Budget</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-purple)', fontSize: 'var(--text-base)' }}>{(behavioral.noraAnalysis.shareOfTotalExpense * 100).toFixed(1)}%</div>
                    {behavioral.noraAnalysis.diffShareFromPrev !== null && behavioral.noraAnalysis.diffShareFromPrev !== undefined && (
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '1px' }}>
                        {Math.round(behavioral.noraAnalysis.diffShareFromPrev * 100) === 0 ? 'Stable' : `${behavioral.noraAnalysis.diffShareFromPrev > 0 ? '+' : ''}${(behavioral.noraAnalysis.diffShareFromPrev * 100).toFixed(1)}% pts`}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Support This Period</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', fontSize: 'var(--text-base)' }}>{formatCurrency(behavioral.noraAnalysis.totalSpend)}</div>
                    {behavioral.noraAnalysis.prevTotalSpend > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '1px' }}>
                        {behavioral.noraAnalysis.diffFromPrev === 0 ? 'Stable' : `${behavioral.noraAnalysis.diffFromPrev > 0 ? '+' : ''}${formatCurrency(behavioral.noraAnalysis.diffFromPrev)} vs prev`}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Primary Focus</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', fontSize: 'var(--text-base)', lineHeight: 1.2 }}>{behavioral.noraAnalysis.primaryFocusText}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Transactions</div>
                    <div style={{ fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', fontSize: 'var(--text-base)' }}>{behavioral.noraAnalysis.count}</div>
                  </div>
                </div>
              )}

              {behavioral.noraAnalysis.count > 0 ? (
                <div>
                  {/* Pattern Deviation & Seasonal Recognition Alerts */}
                  {(behavioral.noraAnalysis.unusualSpending || behavioral.noraAnalysis.seasonalNote) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                      {behavioral.noraAnalysis.unusualSpending && (
                        <div style={{ fontSize: 'var(--text-xs)', padding: '8px 12px', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>⚠️ <b>Pattern Deviation:</b> {behavioral.noraAnalysis.unusualSpending.message}</span>
                        </div>
                      )}
                      {behavioral.noraAnalysis.seasonalNote && (
                        <div style={{ fontSize: 'var(--text-xs)', padding: '8px 12px', backgroundColor: 'color-mix(in srgb, var(--color-brass) 15%, transparent)', color: 'var(--color-brass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-brass)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>📅 <b>Seasonal Pattern:</b> {behavioral.noraAnalysis.seasonalNote.message}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 'var(--space-xl)' }}>
                    {/* Left Column: Sub-type breakdown */}
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                        Support Breakdown
                      </h4>
                      {behavioral.noraAnalysis.dominantSubcategory && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink)', backgroundColor: 'var(--color-surface-2)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '14px', borderLeft: '3px solid var(--color-purple)' }}>
                          👑 <b>Primary Focus:</b> {behavioral.noraAnalysis.dominantSubcategory.name} accounted for <b>{(behavioral.noraAnalysis.dominantSubcategory.percentage * 100).toFixed(0)}%</b> of family support this period ({formatCurrency(behavioral.noraAnalysis.dominantSubcategory.amount)}).
                        </div>
                      )}
                      
                      {/* Recurring Commitments */}
                      <div style={{ fontSize: '11px', fontWeight: 'var(--weight-bold)', color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.03em' }}>
                        Recurring Commitments
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                        {[
                          { iconName: 'education', name: 'Education & Tuition', amount: behavioral.noraAnalysis.breakdown.education, color: 'var(--color-purple)' },
                          { iconName: 'health', name: 'Healthcare & Pediatrician', amount: behavioral.noraAnalysis.breakdown.health, color: 'var(--color-danger)' }
                        ].filter(item => item.amount > 0).map((item, idx) => {
                          const pct = (item.amount / behavioral.noraAnalysis.totalSpend) * 100;
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-ink)', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                <CategoryIcon name={item.iconName} size={14} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                              </span>
                              <span style={{ fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {formatCurrency(item.amount)} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Activities & Enrichment */}
                      <div style={{ fontSize: '11px', fontWeight: 'var(--weight-bold)', color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.03em' }}>
                        Activities & Enrichment
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { iconName: 'activities', name: 'Sports & Extracurriculars', amount: behavioral.noraAnalysis.breakdown.activities, color: 'var(--color-success)' },
                          { iconName: 'clothes', name: 'Clothing & Shoes', amount: behavioral.noraAnalysis.breakdown.clothes, color: 'var(--color-warning)' },
                          { iconName: 'gifts', name: 'Toys & Gifts', amount: behavioral.noraAnalysis.breakdown.gifts, color: 'var(--color-brass)' },
                          { iconName: 'other', name: 'Child Overhead', amount: behavioral.noraAnalysis.breakdown.other, color: 'var(--color-muted)' }
                        ].filter(item => item.amount > 0).map((item, idx) => {
                          const pct = (item.amount / behavioral.noraAnalysis.totalSpend) * 100;
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-ink)', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                <CategoryIcon name={item.iconName} size={14} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                              </span>
                              <span style={{ fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {formatCurrency(item.amount)} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Recurring vs Enrichment Bar */}
                      {(() => {
                        const recurringTotal = behavioral.noraAnalysis.breakdown.education + behavioral.noraAnalysis.breakdown.health;
                        const enrichmentTotal = behavioral.noraAnalysis.totalSpend - recurringTotal;
                        return (
                          <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '6px' }}>
                              <span style={{ color: 'var(--color-purple)', fontWeight: 'var(--weight-medium)' }}>
                                Recurring Commitments: {formatCurrency(recurringTotal)} ({((recurringTotal / behavioral.noraAnalysis.totalSpend) * 100).toFixed(0)}%)
                              </span>
                              <span style={{ color: 'var(--color-success)', fontWeight: 'var(--weight-medium)' }}>
                                Activities & Enrichment: {formatCurrency(enrichmentTotal)} ({((enrichmentTotal / behavioral.noraAnalysis.totalSpend) * 100).toFixed(0)}%)
                              </span>
                            </div>
                            <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                              <div style={{ width: `${(recurringTotal / behavioral.noraAnalysis.totalSpend) * 100}%`, height: '100%', backgroundColor: 'var(--color-purple)' }}></div>
                              <div style={{ width: `${(enrichmentTotal / behavioral.noraAnalysis.totalSpend) * 100}%`, height: '100%', backgroundColor: 'var(--color-success)' }}></div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right Column: Top Expenses & Explanatory Summary */}
                    <div>
                      <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-sm)', marginTop: 0 }}>
                        Largest Support Expenses
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-lg) 0' }}>
                        {behavioral.noraAnalysis.topExpenses.map((tx, idx) => (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx === behavioral.noraAnalysis.topExpenses.length - 1 ? 'none' : '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }}>
                            <div>
                              <span style={{ fontWeight: 'var(--weight-medium)' }}>{tx.description}</span>
                              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{new Date(tx.date).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontWeight: 'var(--weight-bold)', textAlign: 'right', flexShrink: 0, marginLeft: 'var(--space-sm)' }}>
                              <div style={{ whiteSpace: 'nowrap' }}>{formatCurrency(tx.amount)}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-muted)', fontWeight: 'normal' }}>
                                {tx.percentageOfSpend ? `${tx.percentageOfSpend.toFixed(0)}% of total` : ''}
                              </div>
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* Deterministic Executive Summary */}
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink)', backgroundColor: 'color-mix(in srgb, var(--color-purple) 8%, transparent)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-purple)', lineHeight: '1.5' }}>
                        📋 <b>Support Executive Summary:</b> {behavioral.noraAnalysis.supportSummary}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl) var(--space-md)', color: 'var(--color-muted)' }}>
                  <div style={{ marginBottom: 'var(--space-sm)' }}><NoraAvatar size="44px" /></div>
                  <p style={{ margin: '0 0 var(--space-xs) 0', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Nothing logged for Nora in this period</p>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', maxWidth: '500px', marginInline: 'auto' }}>
                    When you log school tuition, sports, clothing, or child support under the <b>Nora</b> category, this panel automatically analyzes family spending trends, categorizes commitments versus activities, and integrates with the 50/30/20 rules engine.
                  </p>
                </div>
              )}
            </div>
          )}

      </div>

    </>
      )}
    </div>
  );
}
