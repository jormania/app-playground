import React, { useMemo } from 'react';
import { filterByPeriod } from '../lib/period';
import { formatCurrency } from '../lib/currency';

export default function MonthlyDigest({ transactions = [], categories = [], title = "Monthly Summary", period = "this_month" }) {
  const data = useMemo(() => {
    const inPeriod = filterByPeriod(transactions, period);
    let income = 0;
    let expense = 0;
    const catTotals = {};

    inPeriod.forEach(t => {
      if (t.type === 'Income') income += t.amount;
      else if (t.type === 'Expense') {
        expense += t.amount;
        catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
      }
    });

    let topCatId = null;
    let topCatAmount = 0;
    for (const [id, amt] of Object.entries(catTotals)) {
      if (amt > topCatAmount) {
        topCatAmount = amt;
        topCatId = id;
      }
    }

    const topCategory = categories.find(c => c.id === topCatId);

    return { income, expense, remaining: income - expense, topCategory, topCatAmount };
  }, [transactions, period, categories]);

  return (
    <div className="card-container stagger-1" style={{ flex: 1, padding: 'var(--space-lg)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
      <h3 style={{ margin: '0 0 var(--space-md) 0', color: 'var(--color-ink)', fontSize: 'var(--text-lg)' }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Income</div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-success)' }}>{formatCurrency(data.income)}</div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expenses</div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-danger)' }}>{formatCurrency(data.expense)}</div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining</div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: data.remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{formatCurrency(data.remaining)}</div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Expense</div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.topCategory ? `${data.topCategory.name} (${formatCurrency(data.topCatAmount)})` : 'None'}
          </div>
        </div>
      </div>
    </div>
  );
}
