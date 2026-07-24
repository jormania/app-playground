import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import BudgetEditorModal from './BudgetEditorModal';
import { Button } from '../../ds/components/Button';
import { Modal } from '../../ds/components/Modal';
import TransactionForm from './TransactionForm';
import { getCategoryColor } from '../lib/colors';

import { formatCurrency } from '../lib/currency';
import { useCountUp } from '../lib/useCountUp';

export default function Dashboard({ data, client, onDataChange, onNavigate }) {
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

  const [period, setPeriod] = useState('this_month');

  const filteredTransactions = data.transactions.filter(t => {
    const txDate = new Date(t.date);
    const now = new Date();
    
    if (period === 'all_time') return true;
    if (period === 'this_month') {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }
    if (period === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
    }
    if (period === 'last_3_months') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return txDate >= threeMonthsAgo;
    }
    if (period === 'last_6_months') {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return txDate >= sixMonthsAgo;
    }
    if (period === 'this_year') {
      return txDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const previousTransactions = data.transactions.filter(t => {
    const txDate = new Date(t.date);
    const now = new Date();
    
    if (period === 'all_time') return false;
    if (period === 'this_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
    }
    if (period === 'last_month') {
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return txDate.getMonth() === twoMonthsAgo.getMonth() && txDate.getFullYear() === twoMonthsAgo.getFullYear();
    }
    if (period === 'last_3_months') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return txDate >= sixMonthsAgo && txDate < threeMonthsAgo;
    }
    if (period === 'last_6_months') {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return txDate >= twelveMonthsAgo && txDate < sixMonthsAgo;
    }
    if (period === 'this_year') {
      return txDate.getFullYear() === now.getFullYear() - 1;
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

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Group expenses by category
    const expenseData = filteredTransactions.filter(t => t.type === 'Expense');
    const grouped = {};
    expenseData.forEach(tx => {
      const cat = data.categories.find(c => c.id === tx.categoryId)?.name || 'Uncategorized';
      grouped[cat] = (grouped[cat] || 0) + tx.amount;
    });

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const inkColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#1b1f24';
    const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-muted').trim() || '#5a636e';
    const totalExpenses = Object.values(grouped).reduce((a, b) => a + b, 0);

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
          legend: { position: 'right', labels: { color: mutedColor, font: { size: 14 }, padding: 15 } },
          title: { display: true, text: 'Expenses by Category', color: inkColor, font: { size: 16 } },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.parsed;
                const percentage = totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });

    if (trendChartInstance.current) {
      trendChartInstance.current.destroy();
    }
    
    // Group cash flow by day or month depending on period
    const isYearly = period === 'this_year' || period === 'all_time';
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
    
    if (trendChartRef.current) {
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
            x: { grid: { color: 'transparent' }, ticks: { color: mutedColor } },
            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: mutedColor } }
          },
          plugins: {
            legend: { position: 'top', labels: { color: mutedColor } },
            title: { display: true, text: 'Cash Flow Trend', color: inkColor, font: { size: 16 } }
          }
        }
      });
    }

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
      if (trendChartInstance.current) trendChartInstance.current.destroy();
    };
  }, [data, period]);

  // Calculate budgets
  const budgetCategories = data.categories.filter(c => c.budgetLimit > 0);
  const budgets = budgetCategories.map(cat => {
    const spent = filteredTransactions
      .filter(t => t.type === 'Expense' && t.categoryId === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return { ...cat, spent };
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
        <select 
          value={period} 
          onChange={(e) => setPeriod(e.target.value)}
          style={{
            padding: 'var(--space-xs) var(--space-sm)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-ink)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer'
          }}
        >
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="last_3_months">Last 3 Months</option>
          <option value="last_6_months">Last 6 Months</option>
          <option value="this_year">This Year</option>
          <option value="all_time">All Time</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div 
          style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xs)', gap: 'var(--space-xs)' }}>
            <h3 style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>Income</h3>
            {getTrendBadge(income, prevIncome, false)}
          </div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-success)', whiteSpace: 'nowrap' }}>{formatCurrency(animatedIncome)}</div>
        </div>
        <div 
          style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xs)', gap: 'var(--space-xs)' }}>
            <h3 style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>Expenses</h3>
            {getTrendBadge(expenses, prevExpenses, true)}
          </div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-danger)', whiteSpace: 'nowrap' }}>{formatCurrency(animatedExpenses)}</div>
        </div>
        <div 
          style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'default' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-xs)', gap: 'var(--space-xs)' }}>
            <h3 style={{ margin: 0, color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>Net</h3>
            {getTrendBadge(net, prevNet, false)}
          </div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: animatedNet >= 0 ? 'var(--color-success)' : 'var(--color-danger)', whiteSpace: 'nowrap' }}>{formatCurrency(animatedNet)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>Latest Transactions</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {data.transactions.slice(0, 5).map(tx => {
              const catName = data.categories.find(c => c.id === tx.categoryId)?.name || 'Unknown';
              const catColor = getCategoryColor(catName);
              return (
              <li 
                key={tx.id} 
                style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) var(--space-xs)', paddingLeft: 'var(--space-md)', borderBottom: '1px solid var(--color-border)', borderLeft: `4px solid ${catColor}`, transition: 'background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                onClick={() => setEditingTx(tx)}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div>
                  <div style={{ fontWeight: 'var(--weight-medium)' }}>{tx.description}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    {tx.date} 
                    <span style={{ 
                      padding: '1px 6px', 
                      background: `color-mix(in srgb, ${catColor} 10%, transparent)`, 
                      color: catColor, 
                      border: `1px solid color-mix(in srgb, ${catColor} 30%, transparent)`,
                      borderRadius: 'var(--radius-full)'
                    }}>
                      {catName}
                    </span>
                  </div>
                </div>
                <div style={{ 
                  color: tx.type === 'Income' ? 'var(--color-success)' : 'var(--color-ink)',
                  background: tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'color-mix(in srgb, var(--color-ink) 5%, transparent)',
                  border: tx.type === 'Income' ? '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)' : '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 'var(--weight-medium)',
                  fontSize: 'var(--text-sm)'
                }}>
                  {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </li>
              );
            })}
          </ul>
          <div style={{ marginTop: 'var(--space-md)', textAlign: 'center' }}>
            <Button variant="ghost" size="sm" onClick={() => onNavigate && onNavigate('transactions')}>
              View All Transactions &rarr;
            </Button>
          </div>
        </div>
        <div style={{ height: '450px', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <canvas ref={chartRef}></canvas>
        </div>
      </div>

      {(budgets.length > 0 || true) && (
        <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>Budget Limits</h2>
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
                    <span style={{ color: isOver ? 'var(--color-danger)' : 'var(--color-muted)' }}>
                      {formatCurrency(b.spent)} / {formatCurrency(b.budgetLimit)}
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

      <div style={{ marginTop: 'var(--space-xl)', height: '400px', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
        <canvas ref={trendChartRef}></canvas>
      </div>

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
