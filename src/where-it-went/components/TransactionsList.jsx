import { useState, useEffect } from 'react';
import TransactionForm from './TransactionForm';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import { Button } from '../../ds/components/Button';
import { Modal } from '../../ds/components/Modal';
import { getCategoryColor } from '../lib/colors';
import { formatCurrency } from '../lib/currency';

export default function TransactionsList({ data, client, onDataChange, filterProps, period }) {
  const { filterType: filter, categoryFilter, searchQuery } = filterProps || { filterType: 'All', categoryFilter: 'All', searchQuery: '' };
  
  const [sortConfig, setSortConfig] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('whereItWent_sort')) || { key: 'date', direction: 'desc' };
    } catch { return { key: 'date', direction: 'desc' }; }
  });

  useEffect(() => {
    localStorage.setItem('whereItWent_sort', JSON.stringify(sortConfig));
  }, [sortConfig]);

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
      const txDate = new Date(t.date);
      const now = new Date();
      if (!period || period === 'all_time') return true;
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
      if (period.match(/^\d{4}-\d{2}$/)) {
        const [y, m] = period.split('-');
        return txDate.getFullYear() === parseInt(y) && txDate.getMonth() === parseInt(m) - 1;
      }
      if (period.match(/^\d{4}$/)) {
        return txDate.getFullYear() === parseInt(period);
      }
      return true;
    })
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
      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', marginTop: 'var(--space-md)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>🍃</div>
          <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-ink)' }}>No Transactions Found</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>Try adjusting your filters in the top menu to find what you're looking for.</p>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <div>
            <div className="transaction-list-header" style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', color: 'var(--color-muted)', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--color-border)', fontWeight: 'var(--weight-medium)' }}>
              {sortConfig.key !== 'date' && (
                <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('date')}>Date{getSortIndicator('date')}</div>
              )}
              <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('description')}>Description{getSortIndicator('description')}</div>
              <div className="tx-col-category" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('category')}>Category{getSortIndicator('category')}</div>
              <div className="tx-col-account" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('account')}>Account{getSortIndicator('account')}</div>
              <div className="tx-col-amount" style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }} onClick={() => handleSort('amount')}>Amount{getSortIndicator('amount')}</div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(() => {
                let lastGroup = null;
                return filtered.map((tx, idx) => {
                  let showHeader = false;
                  let groupLabel = null;

                  if (sortConfig.key === 'date') {
                    if (tx.date !== lastGroup) {
                      showHeader = true;
                      lastGroup = tx.date;
                      groupLabel = new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    }
                  } else if (sortConfig.key === 'category') {
                    const cat = data.categories.find(c => c.id === tx.categoryId)?.name || '⚠️ Unknown';
                    if (cat !== lastGroup) { showHeader = true; lastGroup = cat; groupLabel = cat; }
                  } else if (sortConfig.key === 'account') {
                    const acc = data.accounts.find(a => a.id === tx.accountId)?.name || '? Unknown';
                    if (acc !== lastGroup) { showHeader = true; lastGroup = acc; groupLabel = acc; }
                  } else if (sortConfig.key === 'description') {
                    const letter = (tx.description[0] || '#').toUpperCase();
                    if (letter !== lastGroup) { showHeader = true; lastGroup = letter; groupLabel = letter; }
                  }

                  const catName = data.categories.find(c => c.id === tx.categoryId)?.name;
                  const isUnknownCat = !catName;
                  const displayCatName = catName || 'Unknown';
                  const catColor = getCategoryColor(displayCatName);

                  return (
                    <div key={tx.id}>
                      {showHeader && (
                        <div style={{ position: 'sticky', top: '0', backgroundColor: 'color-mix(in srgb, var(--color-bg) 95%, transparent)', backdropFilter: 'blur(4px)', padding: '4px var(--space-md)', margin: 'var(--space-sm) 0 2px 0', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', zIndex: 1, borderRadius: 'var(--radius-sm)' }}>
                          {groupLabel}
                        </div>
                      )}
                      <div
                        className="transaction-row"
                        style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', paddingLeft: 'var(--space-lg)', alignItems: 'center', backgroundColor: tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 3%, var(--color-surface))' : 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', borderLeft: `4px solid ${catColor}`, cursor: 'pointer' }}
                        onClick={() => setEditingTx(tx)}
                      >
                        {sortConfig.key !== 'date' && (
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                            {new Date(tx.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                        <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                        <div>
                          <span style={{ 
                            fontSize: 'var(--text-xs)', 
                            padding: '2px 8px', 
                            background: isUnknownCat ? 'color-mix(in srgb, var(--color-muted) 10%, transparent)' : `color-mix(in srgb, ${catColor} 10%, transparent)`, 
                            color: isUnknownCat ? 'var(--color-muted)' : catColor, 
                            border: `1px solid ${isUnknownCat ? 'var(--color-border)' : `color-mix(in srgb, ${catColor} 30%, transparent)`}`,
                            borderRadius: 'var(--radius-full)',
                            display: 'inline-block'
                          }}>
                            {isUnknownCat ? '⚠️ Unknown' : displayCatName}
                          </span>
                        </div>
                        <div className="tx-col-account" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>{data.accounts.find(a => a.id === tx.accountId)?.name || '—'}</div>
                        <div className="tx-col-amount" style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

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
