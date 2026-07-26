import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import BudgetEditorModal from './BudgetEditorModal';
import { Button } from '../../ds/components/Button';
import { Modal } from '../../ds/components/Modal';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import TransactionForm from './TransactionForm';
import { getCategoryColor } from '../lib/colors';

import { formatCurrency } from '../lib/currency';
import { useCountUp } from '../lib/useCountUp';

export default function Dashboard({ data, client, onDataChange, onNavigate, config, period = 'this_month', filterProps }) {
  const activePeriod = period || 'this_month';
  const { filterType: filter = 'All', categoryFilter = 'All', searchQuery = '' } = filterProps || {};
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const trendChartRef = useRef(null);
  const trendChartInstance = useRef(null);

  useEffect(() => {
    // Trigger animations after mount
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);
  const filteredTransactions = data.transactions
    .filter(t => filter === 'All' || t.type === filter)
    .filter(t => categoryFilter === 'All' || t.categoryId === categoryFilter)
    .filter(t => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const descMatch = t.description.toLowerCase().includes(q);
      const catMatch = (data.categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase().includes(q);
      const accMatch = (data.accounts.find(a => a.id === t.accountId)?.name || '').toLowerCase().includes(q);
      return descMatch || catMatch || accMatch;
    })
    .filter(t => {
      const txDate = new Date(t.date);
      const now = new Date();
    
    if (activePeriod === 'all_time') return true;
    if (activePeriod === 'this_month') {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }
    if (activePeriod === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
    }
    if (activePeriod === 'last_3_months') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return txDate >= threeMonthsAgo;
    }
    if (activePeriod === 'last_6_months') {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return txDate >= sixMonthsAgo;
    }
    if (activePeriod === 'this_year') {
      return txDate.getFullYear() === now.getFullYear();
    }
    if (activePeriod.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = activePeriod.split('-');
      return txDate.getFullYear() === parseInt(y) && txDate.getMonth() === parseInt(m) - 1;
    }
    if (activePeriod.match(/^\d{4}$/)) {
      return txDate.getFullYear() === parseInt(activePeriod);
    }
    return true;
  });

  const previousTransactions = data.transactions.filter(t => {
    const txDate = new Date(t.date);
    const now = new Date();
    
    if (activePeriod === 'all_time') return false;
    if (activePeriod === 'this_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
    }
    if (activePeriod === 'last_month') {
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return txDate.getMonth() === twoMonthsAgo.getMonth() && txDate.getFullYear() === twoMonthsAgo.getFullYear();
    }
    if (activePeriod === 'last_3_months') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return txDate >= sixMonthsAgo && txDate < threeMonthsAgo;
    }
    if (activePeriod === 'last_6_months') {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return txDate >= twelveMonthsAgo && txDate < sixMonthsAgo;
    }
    if (activePeriod === 'this_year') {
      return txDate.getFullYear() === now.getFullYear() - 1;
    }
    if (activePeriod.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = activePeriod.split('-');
      const prev = new Date(parseInt(y), parseInt(m) - 2, 1);
      return txDate.getFullYear() === prev.getFullYear() && txDate.getMonth() === prev.getMonth();
    }
    if (activePeriod.match(/^\d{4}$/)) {
      return txDate.getFullYear() === parseInt(activePeriod) - 1;
    }
    return false;
  });

  const income = filteredTransactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + t.amount, 0);
  const expenses = filteredTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + t.amount, 0);
  const net = income - expenses;

  const prevIncome = previousTransactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + t.amount, 0);
  const prevExpenses = previousTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + t.amount, 0);
  const prevNet = prevIncome - prevExpenses;

  const animatedIncome = useCountUp(income);
  const animatedExpenses = useCountUp(expenses);
  const animatedNet = useCountUp(net);

  const getTrendBadge = (current, previous, inverse = false) => {
    if (!previous || previous === 0) return null;
    const diff = current - previous;
    const pct = Math.abs((diff / previous) * 100).toFixed(0);
    if (diff === 0 || pct === '0') return null;
    
    let isPositive = diff > 0;
    if (inverse) isPositive = !isPositive;
    
    const color = isPositive ? 'var(--color-success)' : 'var(--color-danger)';
    const bg = isPositive ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'color-mix(in srgb, var(--color-danger) 10%, transparent)';
    const icon = diff > 0 ? '↗' : '↘';
    
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-bold)',
        color: color,
        background: bg,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap'
      }}>
        {icon} {pct}%
      </span>
    );
  };

  const chartType = filter === 'Income' ? 'Income' : 'Expense';
  const chartData = filteredTransactions.filter(t => t.type === chartType);

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Group data by category based on current filter
    const grouped = {};
    chartData.forEach(tx => {
      const cat = data.categories.find(c => c.id === tx.categoryId)?.name || 'Uncategorized';
      grouped[cat] = (grouped[cat] || 0) + tx.amount;
    });

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Don't render chart if no data
    if (chartData.length === 0) return;

    const inkColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#1b1f24';
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-muted').trim() || '#5a636e';
    const totalAmount = Object.values(grouped).reduce((a, b) => a + b, 0);

    chartInstance.current = new Chart(chartRef.current, {
      type: 'doughnut',
      data: {
        labels: Object.keys(grouped),
        datasets: [{
          data: Object.values(grouped),
          backgroundColor: Object.keys(grouped).map(k => getCategoryColor(k)),
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: window.innerWidth < 768 ? 'bottom' : 'right', labels: { color: mutedColor, font: { size: window.innerWidth < 768 ? 12 : 13 }, padding: 10, boxWidth: 12 } },
          title: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed;
                const percentage = totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });

    // We MUST return a cleanup function since chartData is a dependency
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [chartData, data.categories, config?.theme]);

  useEffect(() => {
    if (!trendChartRef.current) return;
    
    if (trendChartInstance.current) {
      trendChartInstance.current.destroy();
    }

    // Only render trend chart if there is data
    if (filteredTransactions.length === 0) return;
    
    // Group cash flow by day or month depending on period
    const isYearly = activePeriod === 'this_year' || activePeriod === 'all_time';
    const trendData = {};
    filteredTransactions.forEach(tx => {
      if (tx.type !== 'Expense' && tx.type !== 'Income') return;
      const d = new Date(tx.date);
      const key = isYearly 
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!trendData[key]) trendData[key] = { expense: 0, income: 0 };
      if (tx.type === 'Expense') trendData[key].expense += tx.amount;
      if (tx.type === 'Income') trendData[key].income += tx.amount;
    });

    const sortedTrendKeys = Object.keys(trendData).sort();
    
    const inkColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#1b1f24';
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-muted').trim() || '#5a636e';

    trendChartInstance.current = new Chart(trendChartRef.current, {
      type: 'bar',
      data: {
        labels: sortedTrendKeys,
        datasets: [
          {
            label: 'Income',
            data: sortedTrendKeys.map(k => trendData[k].income),
            backgroundColor: 'hsl(142, 71%, 45%)',
            borderRadius: 4
          },
          {
            label: 'Expense',
            data: sortedTrendKeys.map(k => trendData[k].expense),
            backgroundColor: 'hsl(348, 83%, 60%)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { 
            grid: { color: 'transparent' }, 
            ticks: { 
              color: mutedColor,
              autoSkip: true,
              maxTicksLimit: 8,
              maxRotation: 0,
              minRotation: 0,
              font: { size: window.innerWidth < 600 ? 10 : 12 }
            } 
          },
          y: { grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#e1e4e8' }, ticks: { color: mutedColor } }
        },
        plugins: {
          legend: { position: 'top', labels: { color: inkColor } },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
              }
            }
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
  }, [filteredTransactions, activePeriod, config?.theme]);

  // #15 — update chart legend position on window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.options.plugins.legend.position = window.innerWidth < 768 ? 'bottom' : 'right';
        chartInstance.current.update();
      }
      if (trendChartInstance.current) {
        trendChartInstance.current.options.scales.x.ticks.font.size = window.innerWidth < 600 ? 10 : 12;
        trendChartInstance.current.update();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate budgets
  const budgetCategories = data.categories.filter(c => c.budgetLimit > 0);
  const budgets = budgetCategories.map(cat => {
    const spent = filteredTransactions
      .filter(t => t.type === 'Expense' && t.categoryId === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return { ...cat, spent };
  });

  return (
    <div className="fade-in">

      {/* KPI Cards */}
      <div style={{ 
        display: 'flex', 
        gap: 'var(--space-md)', 
        marginBottom: 'var(--space-xl)',
        overflowX: 'auto',
        paddingBottom: 'var(--space-xs)',
        WebkitOverflowScrolling: 'touch'
      }}>
        <div 
          style={{ flex: 1, minWidth: '100px', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
        >
          <div style={{ marginBottom: '4px' }}>
            <h3 style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>Income</h3>
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-success)', whiteSpace: 'nowrap', marginBottom: '4px' }}>{formatCurrency(animatedIncome)}</div>
          <div>{getTrendBadge(income, prevIncome, false)}</div>
        </div>
        <div 
          style={{ flex: 1, minWidth: '100px', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
        >
          <div style={{ marginBottom: '4px' }}>
            <h3 style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>Expenses</h3>
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-danger)', whiteSpace: 'nowrap', marginBottom: '4px' }}>{formatCurrency(animatedExpenses)}</div>
          <div>{getTrendBadge(expenses, prevExpenses, true)}</div>
        </div>
        <div 
          style={{ flex: 1, minWidth: '90px', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
        >
          <div style={{ marginBottom: '4px' }}>
            <h3 style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>Net</h3>
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: animatedNet >= 0 ? 'var(--color-success)' : 'var(--color-danger)', whiteSpace: 'nowrap', marginBottom: '4px' }}>{formatCurrency(animatedNet)}</div>
          <div>{getTrendBadge(net, prevNet, false)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
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
                const catName = data.categories.find(c => c.id === tx.categoryId)?.name || 'Unknown';
                const catColor = getCategoryColor(catName);
                const isUnknownCat = !data.categories.find(c => c.id === tx.categoryId);
                return (
                <li 
                  key={tx.id} 
                  className="transaction-row"
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: 'var(--space-sm) var(--space-xs)', 
                    paddingLeft: 'var(--space-md)', 
                    borderBottom: '1px solid var(--color-border)', 
                    borderLeft: `4px solid ${catColor}`, 
                    cursor: 'pointer', 
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 4%, transparent)' : 'transparent'
                  }}
                  onClick={() => setEditingTx(tx)}
                >
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 'var(--weight-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                      {new Date(tx.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
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
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 'var(--weight-medium)',
                    fontSize: 'var(--text-sm)',
                    alignSelf: 'center'
                  }}>
                    {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
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
        <div style={{ height: '450px', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
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
              <canvas ref={chartRef}></canvas>
            </div>
          )}
        </div>
      </div>

      {config?.features?.budgeting !== false && (
        <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>💰 Budget Limits</h2>
            <Button size="sm" variant="secondary" onClick={() => setShowBudgetModal(true)}>
              Edit Budgets
            </Button>
          </div>

          {budgets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
              {/* Total Global Budget */}
              <div style={{ gridColumn: '1 / -1', padding: 'var(--space-md)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                {(() => {
                  const totalLimit = budgets.reduce((acc, b) => acc + b.budgetLimit, 0);
                  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
                  const percent = Math.min((totalSpent / totalLimit) * 100, 100);
                  const isOver = totalSpent > totalLimit;
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'var(--weight-bold)' }}>Total Global Budget</span>
                        <span style={{ color: isOver ? 'var(--color-danger)' : 'var(--color-ink)', fontWeight: 'var(--weight-bold)' }}>
                          {formatCurrency(totalSpent)} / {formatCurrency(totalLimit)}
                        </span>
                      </div>
                      <div className="budget-bar-wrapper-large">
                        <div style={{ 
                          width: loaded ? `${percent}%` : '0%', 
                          height: '100%', 
                          backgroundColor: isOver ? 'var(--color-danger)' : 'var(--color-accent)',
                          transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}></div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Individual Budgets */}
            {budgets.map(b => {
              const percent = Math.min((b.spent / b.budgetLimit) * 100, 100);
              const isOver = b.spent > b.budgetLimit;
              return (
                <div key={b.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'var(--weight-medium)' }}>{b.icon ? `${b.icon} ` : ''}{b.name}</span>
                    <span style={{ color: isOver ? 'var(--color-danger)' : b.spent === 0 ? 'var(--color-muted)' : 'var(--color-ink)' }}>
                      {b.spent === 0
                        ? <em style={{ fontSize: 'var(--text-xs)' }}>No spending this period</em>
                        : <>{formatCurrency(b.spent)} / {formatCurrency(b.budgetLimit)}</>}
                    </span>
                  </div>
                  <div className="budget-bar-wrapper">
                    <div style={{ 
                      width: loaded ? `${percent}%` : '0%', 
                      height: '100%', 
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
        <div className="trend-chart-container" style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0, marginBottom: 'var(--space-md)' }}>📊 Cash Flow Trend</h2>
          <canvas ref={trendChartRef}></canvas>
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
                onDataChange();
                setEditingTx(null);
              } catch (e) {
                console.error("Failed to update transaction", e);
                alert("Failed to update transaction.");
              }
            }} 
            onDelete={async (id) => {
              try {
                await client.deleteTransaction(id);
                onDataChange();
                setEditingTx(null);
              } catch (e) {
                console.error("Failed to delete transaction", e);
                alert("Failed to delete transaction.");
              }
            }}
            onCancel={() => setEditingTx(null)} 
          />
        </Modal>
      )}
    </div>
  );
}
