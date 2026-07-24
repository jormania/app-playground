import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import Insights from './Insights';

export default function Dashboard({ data }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const currentMonthTransactions = data.transactions.filter(t => {
    const txDate = new Date(t.date);
    const now = new Date();
    return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
  });

  const income = currentMonthTransactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + t.amount, 0);
  const expenses = currentMonthTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + t.amount, 0);
  const net = income - expenses;

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Group expenses by category
    const expenseData = currentMonthTransactions.filter(t => t.type === 'Expense');
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

    chartInstance.current = new Chart(chartRef.current, {
      type: 'doughnut',
      data: {
        labels: Object.keys(grouped),
        datasets: [{
          data: Object.values(grouped),
          backgroundColor: [
            '#4B45C6', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'
          ],
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { color: mutedColor } },
          title: { display: true, text: 'Expenses by Category (This Month)', color: inkColor }
        }
      }
    });

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [data]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>Income</h3>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-success)' }}>{income.toFixed(2)} RON</div>
        </div>
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>Expenses</h3>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-danger)' }}>{expenses.toFixed(2)} RON</div>
        </div>
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-muted)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>Net</h3>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: net >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{net.toFixed(2)} RON</div>
        </div>
      </div>

      <Insights data={data} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>
        <div style={{ padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)', fontSize: 'var(--text-lg)', marginTop: 0 }}>Latest Transactions</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {data.transactions.slice(0, 5).map(tx => (
              <li key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontWeight: 'var(--weight-medium)' }}>{tx.description}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)' }}>{tx.date} - {data.categories.find(c => c.id === tx.categoryId)?.name}</div>
                </div>
                <div style={{ color: tx.type === 'Income' ? 'var(--color-success)' : 'var(--color-ink)' }}>
                  {tx.type === 'Income' ? '+' : '-'}{tx.amount.toFixed(2)} RON
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ height: '300px', padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  );
}
