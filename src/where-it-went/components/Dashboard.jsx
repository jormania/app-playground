import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import BudgetEditorModal from './BudgetEditorModal';
import UpcomingBills from './UpcomingBills';
import { Button } from '../../ds/components/Button';
import { Modal } from '../../ds/components/Modal';
import { AlertModal } from '../../ds';
import TransactionForm from './TransactionForm';
import { getCategoryColor } from '../lib/colors';
import { formatCurrency, formatCurrencyCompact } from '../lib/currency';
import { useCountUp } from '../lib/useCountUp';
import {
  filterByPeriod,
  filterByPreviousPeriod,
  getPreviousPeriodRange,
  parseTxDate
} from '../lib/period';
import { getUpcomingBills, getUpcomingTransactions, DEFAULT_HORIZON_DAYS } from '../lib/upcoming';
import { computeAllBudgets, monthlyEquivalent } from '../lib/budgets';

const CARD = {
  padding: 'var(--space-lg)',
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)'
};

export default function Dashboard({ data, client, onDataChange, onNavigate, config, period = 'this_month', filterProps, onViewTripInInsights, scrollToUpcoming, onConsumeScrollToUpcoming }) {
  const activePeriod = period || 'this_month';
  const allowTransfer = config?.features?.transfers === true;
  const { filterType: filter = 'All', categoryFilter = 'All', searchQuery = '' } = filterProps || {};
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const trendChartRef = useRef(null);
  const trendChartInstance = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Set only by the Upcoming banner strip — clicking it used to just switch to
  // the Dashboard tab and leave the agenda card wherever it fell in the
  // scroll, several sections down. Consumed once on mount (Dashboard remounts
  // fresh each time the tab is switched to), so returning here later via the
  // nav tab doesn't keep re-scrolling.
  useEffect(() => {
    if (!scrollToUpcoming) return;
    if (onConsumeScrollToUpcoming) onConsumeScrollToUpcoming();
    requestAnimationFrame(() => {
      document.getElementById('upcoming-bills-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoriesById = useMemo(
    () => new Map((data.categories || []).map(c => [c.id, c])),
    [data.categories]
  );
  const accountsById = useMemo(
    () => new Map((data.accounts || []).map(a => [a.id, a])),
    [data.accounts]
  );

  // One pass for type/category/search; the period filter lives in lib/period so the
  // Dashboard, the ledger and the insights engine can never disagree again.
  const scoped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (data.transactions || []).filter(t => {
      if (filter !== 'All' && t.type !== filter) return false;
      if (categoryFilter !== 'All' && t.categoryId !== categoryFilter) return false;
      if (!q) return true;
      const desc = (t.description || '').toLowerCase();
      const cat = (categoriesById.get(t.categoryId)?.name || '').toLowerCase();
      const acc = (accountsById.get(t.accountId)?.name || '').toLowerCase();
      const notes = (t.notes || '').toLowerCase();
      return desc.includes(q) || cat.includes(q) || acc.includes(q) || notes.includes(q);
    });
  }, [data.transactions, filter, categoryFilter, searchQuery, categoriesById, accountsById]);

  const filteredTransactions = useMemo(
    () => filterByPeriod(scoped, activePeriod).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [scoped, activePeriod]
  );

  const previousTransactions = useMemo(
    () => filterByPreviousPeriod(scoped, activePeriod),
    [scoped, activePeriod]
  );
  const previousIsPartial = getPreviousPeriodRange(activePeriod).partial === true;

  const { income, expenses, net } = useMemo(() => {
    const inc = filteredTransactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + t.amount, 0);
    const exp = filteredTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + t.amount, 0);
    return { income: inc, expenses: exp, net: inc - exp };
  }, [filteredTransactions]);

  const { prevIncome, prevExpenses, prevNet } = useMemo(() => {
    const inc = previousTransactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + t.amount, 0);
    const exp = previousTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + t.amount, 0);
    return { prevIncome: inc, prevExpenses: exp, prevNet: inc - exp };
  }, [previousTransactions]);

  const animatedIncome = useCountUp(income);
  const animatedExpenses = useCountUp(expenses);
  const animatedNet = useCountUp(net);

  /**
   * Trend vs the previous period. For a month in progress the comparison window is
   * the *same slice* of the previous month (see lib/period) — comparing 3 days
   * against a full month made every early-month figure look like a huge win.
   */
  const getTrendBadge = (current, previous, inverse = false) => {
    if (!previous) return null;
    const diff = current - previous;
    if (diff === 0) return null;
    // A negative baseline makes percentage change meaningless; show the delta instead.
    const usePercent = previous > 0;
    const pct = usePercent ? Math.abs((diff / previous) * 100).toFixed(0) : null;
    if (usePercent && pct === '0') return null;

    let isPositive = diff > 0;
    if (inverse) isPositive = !isPositive;

    const color = isPositive ? 'var(--color-success)' : 'var(--color-danger)';
    const bg = isPositive
      ? 'color-mix(in srgb, var(--color-success) 10%, transparent)'
      : 'color-mix(in srgb, var(--color-danger) 10%, transparent)';

    return (
      <span
        title={previousIsPartial ? 'Compared with the same days of the previous period' : 'Compared with the previous period'}
        style={{
          display: 'inline-flex', alignItems: 'center', padding: '2px 6px',
          borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-bold)', color, background: bg,
          verticalAlign: 'middle', whiteSpace: 'nowrap'
        }}
      >
        {diff > 0 ? '↗' : '↘'} {usePercent ? `${pct}%` : formatCurrencyCompact(Math.abs(diff))}
      </span>
    );
  };

  // Transfers have no category, so there is nothing to break down by category —
  // the chart keeps showing expenses and the empty state explains why.
  const chartType = filter === 'Income' ? 'Income' : 'Expense';
  const chartData = useMemo(
    () => (filter === 'Transfer' ? [] : filteredTransactions.filter(t => t.type === chartType)),
    [filteredTransactions, chartType, filter]
  );

  // Grouping is memoised separately so the chart effects depend on stable values —
  // previously both effects listed freshly-built arrays and so tore down and rebuilt
  // a Chart.js instance on literally every render.
  const groupedByCategory = useMemo(() => {
    const grouped = {};
    chartData.forEach(tx => {
      const cat = categoriesById.get(tx.categoryId)?.name || 'Uncategorized';
      grouped[cat] = (grouped[cat] || 0) + tx.amount;
    });
    return grouped;
  }, [chartData, categoriesById]);
  const groupedKey = useMemo(() => JSON.stringify(groupedByCategory), [groupedByCategory]);

  const trendSeries = useMemo(() => {
    const isYearly = activePeriod === 'this_year' || activePeriod === 'all_time' || /^\d{4}$/.test(activePeriod);
    const buckets = {};
    filteredTransactions.forEach(tx => {
      if (tx.type !== 'Expense' && tx.type !== 'Income') return;
      const d = parseTxDate(tx.date);
      if (!d) return;
      // Sort on a full ISO key so a window crossing New Year doesn't plot January
      // before December, and label separately for display.
      const sortKey = isYearly
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      // A 2-digit year here ("Aug 26") reads exactly like a day-of-month —
      // a monthly total for August 2026 was mistaken for a single Aug 26th
      // transaction. Every other month+year label in this app (budgets.js,
      // forecast.js, PeriodSheet, period.js) already uses a 4-digit year for
      // this reason; this was the one outlier.
      const label = isYearly
        ? d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
        : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      if (!buckets[sortKey]) buckets[sortKey] = { label, expense: 0, income: 0 };
      if (tx.type === 'Expense') buckets[sortKey].expense += tx.amount;
      if (tx.type === 'Income') buckets[sortKey].income += tx.amount;
    });

    const keys = Object.keys(buckets).sort();
    return {
      labels: keys.map(k => buckets[k].label),
      income: keys.map(k => buckets[k].income),
      expense: keys.map(k => buckets[k].expense)
    };
  }, [filteredTransactions, activePeriod]);
  const trendKey = useMemo(() => JSON.stringify(trendSeries), [trendSeries]);

  useEffect(() => {
    if (!chartRef.current) return undefined;
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
    const labels = Object.keys(groupedByCategory);
    if (labels.length === 0) return undefined;

    const inkColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#1b1f24';
    const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#ffffff';
    const values = Object.values(groupedByCategory);
    const totalAmount = values.reduce((a, b) => a + b, 0);

    chartInstance.current = new Chart(chartRef.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map(k => getCategoryColor(k)),
          borderColor: surfaceColor,
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        layout: {
          padding: 10
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { 
              color: inkColor, 
              font: { size: 13, weight: '500' }, 
              padding: 20, 
              usePointStyle: true 
            }
          },
          title: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                const percentage = totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(1) : '0.0';
                return ` ${context.label}: ${formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [groupedKey, groupedByCategory, config?.theme]);

  useEffect(() => {
    if (!trendChartRef.current) return undefined;
    if (trendChartInstance.current) {
      trendChartInstance.current.destroy();
      trendChartInstance.current = null;
    }
    if (trendSeries.labels.length === 0) return undefined;

    const inkColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#1b1f24';
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-muted').trim() || '#5a636e';
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#e1e4e8';

    const canvas = trendChartRef.current;
    const ctx = canvas.getContext('2d');
    // Use offsetHeight or fallback to 300 for the gradient height
    const chartHeight = canvas.offsetHeight || 300;

    // ctx can be null in environments without a real canvas backend (e.g. tests) — fall back to a flat color.
    const incomeGradient = ctx ? ctx.createLinearGradient(0, 0, 0, chartHeight) : 'hsla(142, 71%, 45%, 0.4)';
    if (ctx) {
      incomeGradient.addColorStop(0, 'hsla(142, 71%, 45%, 0.8)');
      incomeGradient.addColorStop(1, 'hsla(142, 71%, 45%, 0.1)');
    }

    const expenseGradient = ctx ? ctx.createLinearGradient(0, 0, 0, chartHeight) : 'hsla(348, 83%, 60%, 0.4)';
    if (ctx) {
      expenseGradient.addColorStop(0, 'hsla(348, 83%, 60%, 0.8)');
      expenseGradient.addColorStop(1, 'hsla(348, 83%, 60%, 0.1)');
    }

    trendChartInstance.current = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: trendSeries.labels,
        datasets: [
          { 
            label: 'Income', 
            data: trendSeries.income, 
            backgroundColor: incomeGradient, 
            borderColor: 'hsl(142, 71%, 45%)',
            borderWidth: 2,
            borderRadius: 6 
          },
          { 
            label: 'Expense', 
            data: trendSeries.expense, 
            backgroundColor: expenseGradient, 
            borderColor: 'hsl(348, 83%, 60%)',
            borderWidth: 2,
            borderRadius: 6 
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 10 }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: inkColor, 
              autoSkip: true, 
              maxTicksLimit: 8,
              maxRotation: 0, 
              minRotation: 0,
              font: { size: window.innerWidth < 600 ? 11 : 13, weight: '500' }
            }
          },
          y: {
            border: { display: false },
            grid: { color: borderColor, drawTicks: false },
            ticks: { 
              color: inkColor,
              padding: 8,
              font: { size: 12, weight: '500' },
              callback: (value) => formatCurrencyCompact(value) 
            }
          }
        },
        plugins: {
          legend: { 
            position: 'bottom', 
            labels: { color: inkColor, font: { size: 13, weight: '500' }, padding: 20, usePointStyle: true } 
          },
          tooltip: { 
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
            callbacks: { label: (context) => ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } 
          }
        }
      }
    });

    return () => {
      if (trendChartInstance.current) {
        trendChartInstance.current.destroy();
        trendChartInstance.current = null;
      }
    };
  }, [trendKey, trendSeries, config?.theme]);

  useEffect(() => {
    let frame = null;
    const handleResize = () => {
      if (frame) return; // coalesce a burst of resize events into one update
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (chartInstance.current) {
          // Legend position is now statically set to bottom, no resize update needed for it
        }
        if (trendChartInstance.current) {
          trendChartInstance.current.options.scales.x.ticks.font.size = window.innerWidth < 600 ? 10 : 12;
          trendChartInstance.current.update();
        }
      });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  /**
   * Budgets are *monthly* limits, so they are always measured against the current
   * calendar month — and never narrowed by the category/search filters. Measuring a
   * monthly cap against "This year" (or against a single filtered category) made
   * every bar either permanently red or permanently empty.
   */
  // Each category is now measured against *its own* window (monthly, quarterly
  // or yearly, optionally anchored to a renewal month) rather than against the
  // calendar month, and picks up any rollover carried in from earlier windows.
  const budgets = useMemo(
    () => computeAllBudgets(data.categories, data.transactions),
    [data.transactions, data.categories],
  );

  // Like budgets, deliberately independent of the selected period and of the
  // active filters: "what's due next" is a fact about the calendar, not about
  // whichever slice of history is currently on screen.
  const upcomingHorizonDays = Number(config?.upcomingHorizonDays) > 0
    ? Number(config.upcomingHorizonDays)
    : DEFAULT_HORIZON_DAYS;

  const upcomingBills = useMemo(
    () => getUpcomingBills(data.subscriptions, data.transactions, { horizonDays: upcomingHorizonDays }),
    [data.subscriptions, data.transactions, upcomingHorizonDays],
  );

  // Future-dated transactions already in the ledger — a hotel stay booked and
  // logged ahead of time — surfaced alongside the subscription agenda rather
  // than only findable by scrolling the ledger. `upcomingBills` is passed in
  // so an occurrence a subscription already claims is never listed twice.
  const upcomingTransactions = useMemo(
    () => getUpcomingTransactions(data.transactions, upcomingBills, { horizonDays: upcomingHorizonDays }),
    [data.transactions, upcomingBills, upcomingHorizonDays],
  );

  const rowKeyHandler = (tx) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setEditingTx(tx);
    }
  };

  return (
    <div className="fade-in">
      {/* KPI Cards */}
      <div style={{
        display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)',
        overflowX: 'auto', paddingBottom: 'var(--space-xs)', WebkitOverflowScrolling: 'touch'
      }}>
        {[
          { label: 'Income', value: animatedIncome, real: income, prev: prevIncome, color: 'var(--color-success)', inverse: false },
          { label: 'Expenses', value: animatedExpenses, real: expenses, prev: prevExpenses, color: 'var(--color-danger)', inverse: true },
          { label: 'Net', value: animatedNet, real: net, prev: prevNet, color: net >= 0 ? 'var(--color-success)' : 'var(--color-danger)', inverse: false }
        ].map(kpi => (
          <div
            key={kpi.label}
            className="kpi-card"
            style={{ flex: 1, minWidth: '100px', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div style={{ marginBottom: '4px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{kpi.label}</h3>
            </div>
            <div title={formatCurrency(kpi.real)} style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: kpi.color, whiteSpace: 'nowrap', marginBottom: '4px' }}>
              {formatCurrencyCompact(kpi.value)}
            </div>
            <div>{getTrendBadge(kpi.real, kpi.prev, kpi.inverse)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>
        <div style={CARD}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>🧾 Latest Transactions</h2>
          {filteredTransactions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xl) var(--space-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: 'var(--space-sm)' }}>🍃</div>
              <p style={{ margin: 0, color: 'var(--color-ink)', fontWeight: 'var(--weight-medium)' }}>No Transactions</p>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {filteredTransactions.slice(0, 5).map(tx => {
                const category = categoriesById.get(tx.categoryId);
                // A Transfer legitimately has no category — that's not the same
                // failure mode as a category that was deleted out from under a
                // transaction, so it shouldn't wear the same "⚠️ Unknown" warning.
                const isTransfer = tx.type === 'Transfer';
                const isUnknownCat = !category && !isTransfer;
                const catName = category?.name || (isTransfer ? 'Transfer' : 'Unknown');
                const catColor = isTransfer ? 'var(--color-muted)' : getCategoryColor(catName);
                const txDate = parseTxDate(tx.date);
                return (
                  <li
                    key={tx.id}
                    className="transaction-row"
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${tx.description || 'transaction'}`}
                    style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: 'var(--space-sm) var(--space-xs)', paddingLeft: 'var(--space-md)',
                      borderBottom: '1px solid var(--color-border)',
                      borderLeft: `4px solid ${catColor}`, cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 4%, transparent)' : 'transparent'
                    }}
                    onClick={() => setEditingTx(tx)}
                    onKeyDown={rowKeyHandler(tx)}
                  >
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 'var(--weight-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                        {txDate ? txDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                        <span style={{
                          padding: '1px 6px',
                          background: isUnknownCat ? 'color-mix(in srgb, var(--color-muted) 10%, transparent)' : `color-mix(in srgb, ${catColor} 10%, transparent)`,
                          color: isUnknownCat ? 'var(--color-muted)' : catColor,
                          border: `1px solid ${isUnknownCat ? 'var(--color-border)' : `color-mix(in srgb, ${catColor} 30%, transparent)`}`,
                          borderRadius: 'var(--radius-pill)'
                        }}>
                          {isUnknownCat ? '⚠️ Unknown' : isTransfer ? `🔁 ${catName}` : catName}
                        </span>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, alignSelf: 'center', textAlign: 'right' }}>
                      <div style={{
                        color: tx.type === 'Income' ? 'var(--color-success)' : 'var(--color-ink)',
                        background: tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'color-mix(in srgb, var(--color-ink) 5%, transparent)',
                        border: tx.type === 'Income' ? '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)' : '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
                        padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                        fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap'
                      }}>
                        {tx.type === 'Income' ? '+' : tx.type === 'Expense' ? '−' : '±'}{formatCurrency(tx.amount)}
                      </div>
                      {tx.originalAmount != null && tx.originalCurrency && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
                          ({tx.originalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} {tx.originalCurrency})
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div style={{ marginTop: 'var(--space-md)', textAlign: 'center' }}>
            {filteredTransactions.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onNavigate && onNavigate('transactions')}>
                View All Transactions &rarr;
              </Button>
            )}
          </div>
        </div>

        {/* Flex column with a flex:1 chart area, rather than the old
            `calc(100% - 45px)`: that 45px was a guess at the heading's height
            (really ~49px once its margin counts), so the canvas overflowed the
            card and the card scrolled a little. Chart.js runs with
            maintainAspectRatio:false and fills whatever box it is given. */}
        <div style={{ ...CARD, height: '450px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0, marginBottom: 'var(--space-md)' }}>
            {chartType === 'Income' ? '📈 Income by Category' : '📊 Expenses by Category'}
          </h2>
          {chartData.length === 0 ? (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>📊</div>
              <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-ink)' }}>Nothing to chart</h3>
              <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
                {filter === 'Transfer'
                  ? 'Transfers move money between your own accounts, so they have no category to chart.'
                  : `There are no ${chartType.toLowerCase()} transactions in this period to chart.`}
              </p>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <canvas ref={chartRef} role="img" aria-label={`${chartType} by category`}></canvas>
            </div>
          )}
        </div>
      </div>

      {config?.features?.budgeting !== false && (
        <div style={{ ...CARD, marginTop: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-md)', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>💰 Budget Limits</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                Each category is measured against its own budget window — never the selected period or filters.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowBudgetModal(true)}>Edit Budgets</Button>
          </div>

          {budgets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
              <div style={{ gridColumn: '1 / -1', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                {(() => {
                  // Each category's own limit/spent is already correct against
                  // its own window — but a monthly 500 and a yearly 6 000
                  // summed straight together mixed timescales into a number
                  // that meant nothing on its own. Every category's share is
                  // normalized to its monthly equivalent first, so a quarterly
                  // or yearly budget contributes 1/3 or 1/12 of its figure —
                  // the same "how much of a normal month is this" scale a
                  // monthly category already reports.
                  const mixedPeriods = budgets.some(b => b.window.period !== 'Monthly');
                  const totals = budgets.reduce((acc, b) => {
                    const m = monthlyEquivalent(b);
                    acc.limit += m.limit;
                    acc.spent += m.spent;
                    return acc;
                  }, { limit: 0, spent: 0 });
                  const totalLimit = totals.limit;
                  const totalSpent = totals.spent;
                  const percent = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;
                  const isOver = totalSpent > totalLimit;
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 'var(--weight-bold)' }}>
                          Total Global Budget{mixedPeriods ? ' (per month)' : ''}
                        </span>
                        <span style={{ color: isOver ? 'var(--color-danger)' : 'var(--color-ink)', fontWeight: 'var(--weight-bold)' }}>
                          {formatCurrency(totalSpent)} / {formatCurrency(totalLimit)}
                        </span>
                      </div>
                      {mixedPeriods && (
                        <p style={{ margin: '0 0 8px 0', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                          Quarterly and yearly budgets are shown here at their monthly-equivalent share, so this
                          combined figure is on one consistent scale.
                        </p>
                      )}
                      <div className="budget-bar-wrapper-large" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Total budget used">
                        <div style={{
                          width: loaded ? `${percent}%` : '0%', height: '100%',
                          backgroundColor: isOver ? 'var(--color-danger)' : 'var(--color-accent)',
                          transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}></div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {budgets.map(b => {
                const percent = b.percent;
                const isOver = b.isOver;
                return (
                  <div key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 'var(--weight-medium)' }}>{b.icon ? `${b.icon} ` : ''}{b.name}</span>
                      <span style={{ color: isOver ? 'var(--color-danger)' : b.spent === 0 ? 'var(--color-muted)' : 'var(--color-ink)' }}>
                        {b.spent === 0
                          ? <em style={{ fontSize: 'var(--text-xs)' }}>Nothing spent yet</em>
                          : <>{formatCurrency(b.spent)} / {formatCurrency(b.effectiveLimit)}</>}
                      </span>
                    </div>
                    {/* The window label is not decoration: without it a yearly
                        budget sitting at 40% reads as "40% of this month". */}
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                      <span>{b.window.label}</span>
                      {b.hasRollover && b.carry !== 0 && (
                        <span style={{
                          padding: '1px 5px', borderRadius: 'var(--radius-sm)',
                          backgroundColor: b.carry > 0
                            ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
                            : 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
                          color: b.carry > 0 ? 'var(--color-success)' : 'var(--color-danger)'
                        }}>
                          {b.carry > 0 ? '+' : '−'}{formatCurrency(Math.abs(b.carry))} rolled over
                        </span>
                      )}
                    </div>
                    <div className="budget-bar-wrapper" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.name} budget used`}>
                      <div style={{
                        width: loaded ? `${percent}%` : '0%', height: '100%',
                        backgroundColor: isOver ? 'var(--color-danger)' : 'var(--color-accent)',
                        transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s'
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: 'var(--text-sm)' }}>
              No limits set yet. Give a category a limit — monthly, quarterly or yearly — and
              you will see how much of it you have used, with the option to carry unspent
              room into the next period.
            </p>
          )}
        </div>
      )}

      {/* What's coming, rather than what happened — the only forward-looking
          section on the Dashboard. Independent of the selected period: a bill
          due next week is due next week whether you're looking at July or 2026. */}
      {config?.features?.upcoming !== false && (
        <div id="upcoming-bills-card" style={{ ...CARD, marginTop: 'var(--space-xl)' }}>
          <UpcomingBills bills={upcomingBills} transactions={upcomingTransactions} categories={data.categories} horizonDays={upcomingHorizonDays} />
        </div>
      )}

      {config?.features?.cashFlow !== false && (
        <div className="trend-chart-container" style={{ ...CARD, marginTop: 'var(--space-xl)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0, marginBottom: 'var(--space-md)' }}>📊 Cash Flow Trend</h2>
          {trendSeries.labels.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>No income or spending recorded in this period yet.</p>
          ) : (
            /* The canvas sat directly in the fixed-height card, so Chart.js sized
               it against the *card* rather than the space left under the heading
               and overflowed by ~25px. */
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <canvas ref={trendChartRef} role="img" aria-label="Income and expenses over time"></canvas>
            </div>
          )}
        </div>
      )}

      <BudgetEditorModal
        isOpen={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        categories={data.categories}
        client={client}
        onDataChange={onDataChange}
      />

      {editingTx && (
        <Modal open={true} title="Edit Transaction" onClose={() => setEditingTx(null)}>
          <TransactionForm
            categories={data.categories}
            accounts={data.accounts}
            trips={data.trips}
            allowTransfer={allowTransfer}
            initialTx={editingTx}
            onSave={async (id, txData) => {
              try {
                await client.updateTransaction(id, txData);
                await onDataChange();
                setEditingTx(null);
              } catch (e) {
                console.error('Failed to update transaction', e);
                setActionError(e.message || 'Failed to update transaction.');
                throw e;
              }
            }}
            onDelete={async (id) => {
              try {
                await client.deleteTransaction(id);
                await onDataChange();
                setEditingTx(null);
              } catch (e) {
                console.error('Failed to delete transaction', e);
                setActionError(e.message || 'Failed to delete transaction.');
                throw e;
              }
            }}
            onCancel={() => setEditingTx(null)}
            onViewTrip={onViewTripInInsights ? (tripId) => { setEditingTx(null); onViewTripInInsights(tripId); } : undefined}
          />
        </Modal>
      )}

      <AlertModal
        isOpen={!!actionError}
        title="Something went wrong"
        message={actionError || ''}
        onClose={() => setActionError(null)}
      />
    </div>
  );
}
