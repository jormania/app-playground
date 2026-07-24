import { useState } from 'react';
import TransactionForm from './TransactionForm';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import { Button } from '../../ds/components/Button';

export default function TransactionsList({ data, client, onDataChange }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('All'); // All, Income, Expense
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
  };

  const filtered = data.transactions
    .filter(t => filter === 'All' || t.type === filter)
    .sort((a, b) => {
      let valA, valB;
      switch (sortConfig.key) {
        case 'date':
          valA = new Date(a.date).getTime();
          valB = new Date(b.date).getTime();
          break;
        case 'description':
          valA = a.description.toLowerCase();
          valB = b.description.toLowerCase();
          break;
        case 'category':
          valA = (data.categories.find(c => c.id === a.categoryId)?.name || '').toLowerCase();
          valB = (data.categories.find(c => c.id === b.categoryId)?.name || '').toLowerCase();
          break;
        case 'account':
          valA = (data.accounts.find(acc => acc.id === a.accountId)?.name || '').toLowerCase();
          valB = (data.accounts.find(acc => acc.id === b.accountId)?.name || '').toLowerCase();
          break;
        case 'amount':
          valA = a.amount;
          valB = b.amount;
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleAdd = async (tx) => {
    await client.addTransaction(tx);
    onDataChange();
    setShowForm(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'All', label: 'All' },
            { value: 'Expense', label: 'Expenses' },
            { value: 'Income', label: 'Income' }
          ]}
        />
        <Button variant="primary" onClick={() => setShowForm(true)}>+ Add Transaction</Button>
      </div>

      {showForm && (
        <div style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-md)', backgroundColor: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ margin: '0 0 var(--space-md) 0' }}>New Transaction</h3>
          <TransactionForm categories={data.categories} accounts={data.accounts} onSave={handleAdd} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left', color: 'var(--color-muted)' }}>
            <th style={{ padding: 'var(--space-sm)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('date')}>Date{getSortIndicator('date')}</th>
            <th style={{ padding: 'var(--space-sm)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('description')}>Description{getSortIndicator('description')}</th>
            <th style={{ padding: 'var(--space-sm)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('category')}>Category{getSortIndicator('category')}</th>
            <th style={{ padding: 'var(--space-sm)', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('account')}>Account{getSortIndicator('account')}</th>
            <th style={{ padding: 'var(--space-sm)', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('amount')}>Amount{getSortIndicator('amount')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(tx => (
            <tr key={tx.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: 'var(--space-sm)' }}>{tx.date}</td>
              <td style={{ padding: 'var(--space-sm)' }}>{tx.description}</td>
              <td style={{ padding: 'var(--space-sm)' }}>
                <span style={{ fontSize: 'var(--text-xs)', padding: '2px 6px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}>
                  {data.categories.find(c => c.id === tx.categoryId)?.name || 'Unknown'}
                </span>
              </td>
              <td style={{ padding: 'var(--space-sm)' }}>{data.accounts.find(a => a.id === tx.accountId)?.name || 'Unknown'}</td>
              <td style={{ padding: 'var(--space-sm)', textAlign: 'right', color: tx.type === 'Income' ? 'var(--color-success)' : 'inherit' }}>
                {tx.type === 'Income' ? '+' : '-'}{tx.amount.toFixed(2)}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan="5" style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-muted)' }}>No transactions found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
