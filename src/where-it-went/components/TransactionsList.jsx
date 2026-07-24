import { useState } from 'react';
import TransactionForm from './TransactionForm';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import { Button } from '../../ds/components/Button';
import { Modal } from '../../ds/components/Modal';
import { getCategoryColor } from '../lib/colors';
import { formatCurrency } from '../lib/currency';

export default function TransactionsList({ data, client, onDataChange }) {
  const [filter, setFilter] = useState('All'); // All, Income, Expense
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [editingTx, setEditingTx] = useState(null);
  
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
    .filter(t => categoryFilter === 'All' || t.categoryId === categoryFilter)
    .filter(t => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const descMatch = t.description.toLowerCase().includes(q);
      const catMatch = (data.categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase().includes(q);
      const accMatch = (data.accounts.find(a => a.id === t.accountId)?.name || '').toLowerCase().includes(q);
      const amountMatch = t.amount.toString().includes(q);
      return descMatch || catMatch || accMatch || amountMatch;
    })
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



  // Get relevant categories based on Income/Expense type filter
  const relevantCategories = data.categories.filter(c => filter === 'All' || c.type === filter);

  const gridTemplate = sortConfig.key === 'date' ? '2fr 1fr 1fr 1fr' : '1fr 2fr 1fr 1fr 1fr';

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <SegmentedControl
            size="sm"
            value={filter}
            onChange={(val) => {
              setFilter(val);
              setCategoryFilter('All'); // Reset category when switching type
            }}
            options={[
              { value: 'All', label: 'All' },
              { value: 'Expense', label: 'Expenses' },
              { value: 'Income', label: 'Income' }
            ]}
          />
          
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: 'var(--space-xs) var(--space-sm)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-ink)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              maxWidth: '140px'
            }}
          >
            <option value="All">All Categories</option>
            {relevantCategories.map(c => (
              <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: 'var(--space-xs) var(--space-sm)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-ink)',
              fontSize: 'var(--text-sm)',
              width: '120px'
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', marginTop: 'var(--space-md)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>🍃</div>
          <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-ink)' }}>No Transactions Found</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>Try adjusting your search or filters to find what you're looking for.</p>
          <Button variant="secondary" onClick={() => { setFilter('All'); setCategoryFilter('All'); setSearchQuery(''); }}>Clear Filters</Button>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', color: 'var(--color-muted)', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--color-border)', fontWeight: 'var(--weight-medium)' }}>
            {sortConfig.key !== 'date' && (
              <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('date')}>Date{getSortIndicator('date')}</div>
            )}
            <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('description')}>Description{getSortIndicator('description')}</div>
            <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('category')}>Category{getSortIndicator('category')}</div>
            <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('account')}>Account{getSortIndicator('account')}</div>
            <div style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }} onClick={() => handleSort('amount')}>Amount{getSortIndicator('amount')}</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(() => {
              let lastGroup = null;
              return filtered.map((tx, idx) => {
                let showHeader = false;
                if (sortConfig.key === 'date') {
                  const txDate = tx.date;
                  if (txDate !== lastGroup) {
                    showHeader = true;
                    lastGroup = txDate;
                  }
                }
                
                return (
                  <div key={tx.id}>
                    {showHeader && (
                      <div style={{ position: 'sticky', top: '0', backgroundColor: 'color-mix(in srgb, var(--color-bg) 95%, transparent)', backdropFilter: 'blur(4px)', padding: '4px var(--space-md)', margin: 'var(--space-sm) 0 2px 0', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', zIndex: 1, borderRadius: 'var(--radius-sm)' }}>
                        {new Date(tx.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                    {(() => {
                      const catName = data.categories.find(c => c.id === tx.categoryId)?.name || 'Unknown';
                      const catColor = getCategoryColor(catName);
                      return (
                        <div 
                          className="transaction-row"
                          style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', paddingLeft: 'var(--space-lg)', alignItems: 'center', backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', borderLeft: `4px solid ${catColor}`, cursor: 'pointer' }}
                          onClick={() => setEditingTx(tx)}
                        >
                          {sortConfig.key !== 'date' && (
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>{tx.date}</div>
                      )}
                      <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>{tx.description}</div>
                      <div>
                        <span style={{ 
                          fontSize: 'var(--text-xs)', 
                          padding: '2px 8px', 
                          background: `color-mix(in srgb, ${catColor} 10%, transparent)`, 
                          color: catColor, 
                          border: `1px solid color-mix(in srgb, ${catColor} 30%, transparent)`,
                          borderRadius: 'var(--radius-full)',
                          display: 'inline-block'
                        }}>
                          {catName}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>{data.accounts.find(a => a.id === tx.accountId)?.name || 'Unknown'}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                      </div>
                    </div>
                  );
                })()}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

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
