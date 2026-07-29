import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import BudgetEditorModal from './BudgetEditorModal';
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
  parseTxDate,
  formatPeriodLabel
} from '../lib/period';

const CARD = {
  padding: 'var(--space-lg)',
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)'
};

export default function Dashboard({ data, client, onDataChange, onNavigate, config, period = 'this_month', filterProps }) {
  const activePeriod = period || 'this_month';
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
      return desc.includes(q) || cat.includes(q) || acc.includes(q);
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

  const chartType = filter === 'Income' ? 'Income' : 'Expense';
  const chartData = useMemo(
    () => filteredTransactions.filter(t => t.type === chartType),
    [filteredTransactions, chartType]
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
      const label = isYearly
        ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
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

    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-muted').trim() || '#5a636e';
    const values = Object.values(groupedByCategory);
    const totalAmount = values.reduce((a, b) => a + b, 0);

    chartInstance.current = new Chart(chartRef.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map(k => getCategoryColor(k)),
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: window.innerWidth < 768 ? 'bottom' : 'right',
            labels: { color: mutedColor, font: { size: window.innerWidth < 768 ? 12 : 13 }, padding: 10, boxWidth: 12 }
          },
          title: { display: false },
          tooltip: {
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

    trendChartInstance.current = new Chart(trendChartRef.current, {
      type: 'bar',
      data: {
        labels: trendSeries.labels,
        datasets: [
          { label: 'Income', data: trendSeries.income, backgroundColor: 'hsl(142, 71%, 45%)', borderRadius: 4 },
          { label: 'Expense', data: trendSeries.expense, backgroundColor: 'hsl(348, 83%, 60%)', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: 'transparent' },
            ticks: {
              color: mutedColor, autoSkip: true, maxTicksLimit: 8,
              maxRotation: 0, minRotation: 0,
              font: { size: window.innerWidth < 600 ? 10 : 12 }
            }
          },
          y: {
            grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#e1e4e8' },
            ticks: { color: mutedColor, callback: (value) => formatCurrencyCompact(value) }
          }
        },
        plugins: {
          legend: { position: 'top', labels: { color: inkColor } },
          tooltip: { callbacks: { label: (context) => ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } }
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
          chartInstance.current.options.plugins.legend.position = window.innerWidth < 768 ? 'bottom' : 'right';
          chartInstance.current.update();
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
  const budgets = useMemo(() => {
    const thisMonth = filterByPeriod(data.transactions || [], 'this_month');
    return (data.categories || [])
      .filter(c => c.budgetLimit > 0 && c.type !== 'Income')
      .map(cat => ({
        ...cat,
        spent: thisMonth
          .filter(t => t.type === 'Expense' && t.categoryId === cat.id)
          .reduce((sum, t) => sum + t.amount, 0)
      }));
  }, [data.transactions, data.categories]);

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
                const catName = category?.name || 'Unknown';
                const catColor = getCategoryColor(catName);
                const isUnknownCat = !category;
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
                          borderRadius: 'var(--radius-full)'
                        }}>
                          {isUnknownCat ? '⚠️ Unknown' : catName}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      flexShrink: 0,
                      color: tx.type === 'Income' ? 'var(--color-success)' : 'var(--color-ink)',
                      background: tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'color-mix(in srgb, var(--color-ink) 5%, transparent)',
                      border: tx.type === 'Income' ? '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)' : '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
                      padding: '4px 10px', borderRadius: 'var(--radius-full)',
                      fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', alignSelf: 'center'
                    }}>
                      {tx.type === 'Income' ? '+' : tx.type === 'Expense' ? '−' : '±'}{formatCurrency(tx.amount)}
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

        <div style={{ ...CARD, height: '450px' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0, marginBottom: 'var(--space-md)' }}>
            {chartType === 'Income' ? '📈 Income by Category' : '📊 Expenses by Category'}
          </h2>
          {chartData.length === 0 ? (
            <div style={{ height: 'calc(100% - 45px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>📊</div>
              <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-ink)' }}>Not Enough Data</h3>
              <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>There are no {chartType.toLowerCase()} transactions in this period to chart.</p>
            </div>
          ) : (
            <div style={{ height: 'calc(100% - 45px)', position: 'relative' }}>
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
                Monthly limits, always measured against {formatPeriodLabel('this_month')} — not the selected period or filters.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowBudgetModal(true)}>Edit Budgets</Button>
          </div>

          {budgets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
              <div style={{ gridColumn: '1 / -1', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                {(() => {
                  const totalLimit = budgets.reduce((acc, b) => acc + b.budgetLimit, 0);
                  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
                  const percent = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;
                  const isOver = totalSpent > totalLimit;
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'var(--weight-bold)' }}>Total Global Budget</span>
                        <span style={{ color: isOver ? 'var(--color-danger)' : 'var(--color-ink)', fontWeight: 'var(--weight-bold)' }}>
                          {formatCurrency(totalSpent)} / {formatCurrency(totalLimit)}
                        </span>
                      </div>
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
                const percent = Math.min((b.spent / b.budgetLimit) * 100, 100);
                const isOver = b.spent > b.budgetLimit;
                return (
                  <div key={b.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'var(--weight-medium)' }}>{b.icon ? `${b.icon} ` : ''}{b.name}</span>
                      <span style={{ color: isOver ? 'var(--color-danger)' : b.spent === 0 ? 'var(--color-muted)' : 'var(--color-ink)' }}>
                        {b.spent === 0
                          ? <em style={{ fontSize: 'var(--text-xs)' }}>Nothing spent this month</em>
                          : <>{formatCurrency(b.spent)} / {formatCurrency(b.budgetLimit)}</>}
                      </span>
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
            <p style={{ color: 'var(--color-muted)', margin: 0, fontStyle: 'italic' }}>No budgets set yet. Click "Edit Budgets" to get started!</p>
          )}
        </div>
      )}

      {config?.features?.cashFlow !== false && (
        <div className="trend-chart-container" style={{ ...CARD, marginTop: 'var(--space-xl)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0, marginBottom: 'var(--space-md)' }}>📊 Cash Flow Trend</h2>
          {trendSeries.labels.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>Nothing to plot for this period yet.</p>
          ) : (
            <canvas ref={trendChartRef} role="img" aria-label="Income and expenses over time"></canvas>
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
