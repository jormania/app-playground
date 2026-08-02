import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import UpcomingBills from './UpcomingBills';
import { Button } from '../../ds/components/Button';
import { Modal } from '../../ds/components/Modal';
import { AlertModal } from '../../ds';
import TransactionForm from './TransactionForm';
import { getCategoryColor } from '../lib/colors';
import { CategoryIcon } from './CategoryIcon';
import Sparkline from './Sparkline';
import { formatCurrency, formatCurrencyCompact } from '../lib/currency';
import { useCountUp } from '../lib/useCountUp';
import { ReceiptText, PieChart, TrendingUp, PiggyBank } from 'lucide-react';
import {
  filterByPeriod,
  filterByPreviousPeriod,
  getPreviousPeriodRange,
  parseTxDate
} from '../lib/period';
import { applyFilters } from '../lib/filtering';
import { getUpcomingBills, getUpcomingTransactions, DEFAULT_HORIZON_DAYS } from '../lib/upcoming';
import { computeAllBudgets, monthlyEquivalent } from '../lib/budgets';
import { calculateMovingAverage, calculateLinearRegression } from '../lib/trends';
import PullToRefresh from './PullToRefresh';
import QuickTemplates from './QuickTemplates';
import SmartTextEntry from './SmartTextEntry';
import { getChartColors, getDoughnutOptions, getBarOptions } from '../lib/chartConfig';

const CARD = {
  padding: 'var(--space-lg)',
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-sm)'
};

function DashboardInner({ data, client, onDataChange, onNavigate, config, period = 'this_month', filterProps, onViewTripInInsights, scrollToUpcoming, onConsumeScrollToUpcoming, onPrefillTransaction }) {
  const activePeriod = period || 'this_month';
  const allowTransfer = config?.features?.transfers === true;
  const { filterType: filter = 'All', categoryFilter = 'All', searchQuery = '' } = filterProps || {};
  const [editingTx, setEditingTx] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [highlightedTxIds, setHighlightedTxIds] = useState([]);
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
    return applyFilters(data.transactions, filterProps || {}, categoriesById, accountsById);
  }, [data.transactions, filterProps, categoriesById, accountsById]);

  const filteredTransactions = useMemo(
    () => filterByPeriod(scoped, activePeriod).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [scoped, activePeriod]
  );

  const previousTransactions = useMemo(
    () => filterByPreviousPeriod(scoped, activePeriod),
    [scoped, activePeriod]
  );
  const previousIsPartial = getPreviousPeriodRange(activePeriod).partial === true;

  const { income, expenses, net, foreign } = useMemo(() => {
    let inc = 0, exp = 0;
    const f = {};
    filteredTransactions.forEach(t => {
      if (t.type === 'Income') inc += t.amount;
      if (t.type === 'Expense') exp += t.amount;
      
      const c = t.originalCurrency;
      if (c && c !== 'RON') {
        if (!f[c]) f[c] = { income: 0, expense: 0 };
        if (t.type === 'Income') f[c].income += t.originalAmount;
        if (t.type === 'Expense') f[c].expense += t.originalAmount;
      }
    });
    return { income: inc, expenses: exp, net: inc - exp, foreign: f };
  }, [filteredTransactions]);

  const { prevIncome, prevExpenses, prevNet } = useMemo(() => {
    const inc = previousTransactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + t.amount, 0);
    const exp = previousTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + t.amount, 0);
    return { prevIncome: inc, prevExpenses: exp, prevNet: inc - exp };
  }, [previousTransactions]);

  const animatedIncome = useCountUp(income);
  const animatedExpenses = useCountUp(expenses);
  const animatedNet = useCountUp(net);

  const budgets = useMemo(
    () => computeAllBudgets(data.categories, data.transactions),
    [data.transactions, data.categories],
  );

  const budgetLeft = useMemo(() => {
    return budgets.reduce((sum, b) => {
      const eq = monthlyEquivalent(b);
      const remaining = eq.limit - eq.spent;
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);
  }, [budgets]);
  
  const animatedBudgetLeft = useCountUp(budgetLeft);

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
      expense: keys.map(k => buckets[k].expense),
      net: keys.map(k => buckets[k].income - buckets[k].expense)
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
      options: getDoughnutOptions(totalAmount)
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

    const baseDatasets = [
      { 
        label: 'Income', 
        data: trendSeries.income, 
        backgroundColor: incomeGradient, 
        borderColor: 'hsl(142, 71%, 45%)',
        borderWidth: 2,
        borderRadius: 6,
        order: 2
      },
      { 
        label: 'Expense', 
        data: trendSeries.expense, 
        backgroundColor: expenseGradient, 
        borderColor: 'hsl(348, 83%, 60%)',
        borderWidth: 2,
        borderRadius: 6,
        order: 2
      }
    ];

    const trendMode = config?.features?.trendLineMode || 'none';
    const activeDatasets = [...baseDatasets];

    if (trendMode !== 'none') {
      let incomeTrendData, expenseTrendData;
      let tension = 0;
      let borderDash = [];
      
      if (trendMode === 'moving_average') {
        incomeTrendData = calculateMovingAverage(trendSeries.income, 3);
        expenseTrendData = calculateMovingAverage(trendSeries.expense, 3);
        tension = 0.4;
      } else if (trendMode === 'linear_regression') {
        incomeTrendData = calculateLinearRegression(trendSeries.income);
        expenseTrendData = calculateLinearRegression(trendSeries.expense);
        borderDash = [5, 5];
      } else if (trendMode === 'smooth') {
        incomeTrendData = trendSeries.income;
        expenseTrendData = trendSeries.expense;
        tension = 0.4;
      }

      // Add lines on top of the bars
      activeDatasets.push({
        type: 'line',
        label: 'Income Trend',
        data: incomeTrendData,
        borderColor: 'hsl(142, 71%, 45%)',
        borderWidth: 3,
        tension,
        cubicInterpolationMode: tension > 0 ? 'monotone' : 'default',
        borderDash,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        order: 1
      });

      activeDatasets.push({
        type: 'line',
        label: 'Expense Trend',
        data: expenseTrendData,
        borderColor: 'hsl(348, 83%, 60%)',
        borderWidth: 3,
        tension,
        cubicInterpolationMode: tension > 0 ? 'monotone' : 'default',
        borderDash,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        order: 1
      });
    }

    trendChartInstance.current = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: trendSeries.labels,
        datasets: activeDatasets
      },
      options: getBarOptions()
    });

    return () => {
      if (trendChartInstance.current) {
        trendChartInstance.current.destroy();
        trendChartInstance.current = null;
      }
    };
  }, [trendKey, trendSeries, config?.theme, config?.features?.trendLineMode]);

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


  const upcomingBills = useMemo(
    () => getUpcomingBills(data.subscriptions, data.transactions, { horizonDays: DEFAULT_HORIZON_DAYS }),
    [data.subscriptions, data.transactions],
  );

  // Future-dated transactions already in the ledger — a hotel stay booked and
  // logged ahead of time — surfaced alongside the subscription agenda rather
  // than only findable by scrolling the ledger. `upcomingBills` is passed in
  // so an occurrence a subscription already claims is never listed twice.
  const upcomingTransactions = useMemo(
    () => getUpcomingTransactions(data.transactions, upcomingBills, { horizonDays: DEFAULT_HORIZON_DAYS }),
    [data.transactions, upcomingBills],
  );

  const rowKeyHandler = (tx) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setEditingTx(tx);
    }
  };

  return (
    <div className="fade-in">
      <SmartTextEntry
        config={config}
        accounts={data.accounts || []}
        categories={data.categories || []}
        trips={data.trips || []}
        recentTransactions={(data.transactions || []).slice(0, 15)}
        onAdd={async (tx) => {
          return await client.addTransaction(tx);
        }}
        onUpdate={async (id, updates) => {
          return await client.updateTransaction(id, updates);
        }}
        onAddSubscription={async (sub) => {
          if (client.addSubscription) {
            return await client.addSubscription(sub);
          }
        }}
        onSuccess={async (addedIds) => {
          await onDataChange();
          if (addedIds && addedIds.length > 0) {
            setHighlightedTxIds(addedIds);
            setTimeout(() => {
              setHighlightedTxIds(prev => prev.filter(id => !addedIds.includes(id)));
            }, 3000);
          }
        }}
      />

      {config?.features?.quickTemplates && (
        <QuickTemplates 
          templates={data.templates} 
          categories={data.categories}
          accounts={data.accounts}
          onApplyTemplate={async (tpl) => {
            if (!tpl.amount) {
              if (onPrefillTransaction) onPrefillTransaction(tpl);
              return;
            }
            const tx = {
              description: tpl.description,
              amount: tpl.amount || 0,
              type: tpl.type || 'Expense',
              categoryId: tpl.categoryId,
              accountId: tpl.accountId,
              date: new Date().toISOString().slice(0, 10),
            };
            await client.addTransaction(tx);
            await onDataChange();
          }}
          onSaveTemplate={async (tpl) => {
            if (tpl.id) {
              await client.updateTemplate(tpl.id, tpl);
            } else {
              await client.addTemplate(tpl);
            }
            await onDataChange();
          }}
          onDeleteTemplate={async (id) => {
            await client.deleteTemplate(id);
            await onDataChange();
          }}
        />
      )}

      {/* KPI Cards */}
      <div className="hide-scrollbar" style={{
        display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)',
        overflowX: 'auto', overflowY: 'hidden', paddingBottom: 'var(--space-xs)', WebkitOverflowScrolling: 'touch'
      }}>
        {[
          { label: 'Income', value: animatedIncome, real: income, prev: prevIncome, color: 'var(--color-success)', inverse: false, data: trendSeries.income, fKey: 'income' },
          { label: 'Expenses', value: animatedExpenses, real: expenses, prev: prevExpenses, color: 'var(--color-danger)', inverse: true, data: trendSeries.expense, fKey: 'expense' },
          { label: 'Net', value: animatedNet, real: net, prev: prevNet, color: net >= 0 ? 'var(--color-success)' : 'var(--color-danger)', inverse: false, data: trendSeries.net, fKey: 'net' },
          { label: 'Budget Left', value: animatedBudgetLeft, real: budgetLeft, prev: null, color: 'var(--color-ink)', inverse: false, data: null, fKey: null }
        ].filter(kpi => kpi.label !== 'Budget Left' || config?.features?.budgeting !== false).map(kpi => (
          <div
            key={kpi.label}
            className={`kpi-card kpi-${kpi.label.replace(' ', '-').toLowerCase()} stagger-1`}
            style={{ flex: 1, minWidth: '100px', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', position: 'relative' }}
          >
            <div style={{ marginBottom: '4px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{kpi.label}</h3>
            </div>
            <div title={formatCurrency(kpi.real)} style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: kpi.color, whiteSpace: 'nowrap', marginBottom: '4px' }}>
              {formatCurrencyCompact(kpi.value)}
            </div>
            {config?.features?.multiCurrency && kpi.fKey && Object.keys(foreign).length > 0 ? (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px', zIndex: 1, position: 'relative' }}>
                {Object.entries(foreign).map(([currency, data]) => {
                  let fVal = 0;
                  if (kpi.fKey === 'income') fVal = data.income;
                  if (kpi.fKey === 'expense') fVal = data.expense;
                  if (kpi.fKey === 'net') fVal = data.income - data.expense;
                  if (fVal === 0) return null;
                  return <span key={currency}>{kpi.fKey === 'net' && fVal > 0 ? '+' : ''}{formatCurrencyCompact(fVal).replace(' L', ` ${currency}`)}</span>;
                })}
              </div>
            ) : (
              <div className="kpi-trend-badge" style={{ position: 'relative', zIndex: 1 }}>{getTrendBadge(kpi.real, kpi.prev, kpi.inverse)}</div>
            )}
            {kpi.data && (
              <div style={{ marginTop: '-10px', marginLeft: 'calc(-1 * var(--space-md))', marginRight: 'calc(-1 * var(--space-md))', marginBottom: 'calc(-1 * var(--space-md))' }}>
                <Sparkline data={kpi.data} color={kpi.color} height={30} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>
        <div className="card-container stagger-2" style={CARD}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>
            <ReceiptText size={20} color="var(--color-muted)" /> Latest Transactions
          </h2>
          {filteredTransactions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xl) var(--space-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: 'var(--space-sm)' }}>🍃</div>
              <p style={{ margin: 0, color: 'var(--color-ink)', fontWeight: 'var(--weight-medium)' }}>No Transactions</p>
              <p style={{ margin: '4px 0 0 0', color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, paddingBottom: 'var(--space-sm)' }}>
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
                const isHighlighted = highlightedTxIds.includes(tx.id);
                return (
                  <li
                    key={tx.id}
                    className={`transaction-row ${isHighlighted ? 'highlight-pulse' : ''}`}
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
        <div className="card-container stagger-2" style={{ ...CARD, height: '450px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0, marginBottom: 'var(--space-md)' }}>
            <PieChart size={20} color="var(--color-muted)" /> {chartType === 'Income' ? 'Income by Category' : 'Expenses by Category'}
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
        <div className="card-container stagger-3" style={{ ...CARD, marginTop: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-md)', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-lg)', margin: 0 }}>
                <PiggyBank size={20} color="var(--color-muted)" /> Budget Limits
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
                Each category is measured against its own budget window — never the selected period or filters.
              </p>
            </div>
          </div>

          {budgets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
              <div className="budget-hero-card" style={{ gridColumn: '1 / -1', marginBottom: 'var(--space-md)' }}>
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
                  const remaining = totalLimit - totalSpent;
                  const percent = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;
                  const isOver = totalSpent > totalLimit;
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', gap: 'var(--space-xs)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div>
                          <h3 style={{ margin: '0 0 4px 0', fontSize: 'var(--text-lg)', color: 'var(--color-ink)' }}>
                            Total Global Budget{mixedPeriods ? ' (per month)' : ''}
                          </h3>
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                            {formatCurrency(totalSpent)} spent of {formatCurrency(totalLimit)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-muted)', marginBottom: '4px' }}>
                            {isOver ? 'Over Budget' : 'Remaining'}
                          </div>
                          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: isOver ? 'var(--color-danger)' : 'var(--color-accent)' }}>
                            {isOver ? formatCurrency(Math.abs(remaining)) : formatCurrency(remaining)}
                          </div>
                        </div>
                      </div>
                      {mixedPeriods && (
                        <p style={{ margin: '0 0 16px 0', fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
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
                  <div key={b.id} className="budget-mini-card">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: 'var(--space-xs)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 'var(--weight-bold)', display: 'flex', alignItems: 'center' }}><CategoryIcon category={b} style={{marginRight: '8px'}}/>{b.name}</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: isOver ? 'var(--color-danger)' : b.spent === 0 ? 'var(--color-muted)' : 'var(--color-ink)', fontWeight: 'var(--weight-bold)' }}>
                            {b.spent === 0
                              ? <em style={{ fontSize: 'var(--text-xs)', fontWeight: 'normal' }}>Nothing spent yet</em>
                              : <>{formatCurrency(b.spent)} / {formatCurrency(b.effectiveLimit)}</>}
                          </span>
                        </div>
                      </div>
                      {/* The window label is not decoration: without it a yearly
                          budget sitting at 40% reads as "40% of this month". */}
                      <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>
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
        <div id="upcoming-bills-card" className="card-container stagger-4" style={{ ...CARD, marginTop: 'var(--space-xl)' }}>
          <UpcomingBills bills={upcomingBills} transactions={upcomingTransactions} categories={data.categories} horizonDays={DEFAULT_HORIZON_DAYS} />
        </div>
      )}

      {config?.features?.cashFlow !== false && (
        <div className="card-container stagger-4" style={{ ...CARD, height: '400px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0, marginBottom: 'var(--space-md)' }}>
            <TrendingUp size={20} color="var(--color-muted)" /> Cash Flow Trend
          </h2>
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
      {editingTx && (
        <Modal open={true} title="Edit Transaction" onClose={() => setEditingTx(null)}>
          <TransactionForm
            transactions={data.transactions}
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

export default function Dashboard(props) {
  return (
    <PullToRefresh onRefresh={props.onDataChange}>
      <DashboardInner {...props} />
    </PullToRefresh>
  );
}
