import { useEffect, useMemo, useState } from 'react';
import TransactionForm from './TransactionForm';
import DuplicateReview from './DuplicateReview';
import { Button } from '../../ds/components/Button';
import { Modal } from '../../ds/components/Modal';
import { AlertModal } from '../../ds';
import { getCategoryColor } from '../lib/colors';
import { formatCurrency } from '../lib/currency';
import { filterByPeriod, parseTxDate } from '../lib/period';
import { readJson, writeJson } from '../lib/storage';

const PAGE_SIZE = 200;

export default function TransactionsList({ data, client, onDataChange, filterProps, period, allowTransfer = false }) {
  const { filterType: filter = 'All', categoryFilter = 'All', searchQuery = '' } = filterProps || {};

  const [sortConfig, setSortConfig] = useState(() => readJson('whereItWent_sort', { key: 'date', direction: 'desc' }));
  const [editingTx, setEditingTx] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => { writeJson('whereItWent_sort', sortConfig); }, [sortConfig]);
  // A new filter/period/sort should start from the top of the list again.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filter, categoryFilter, searchQuery, period, sortConfig]);

  const categoriesById = useMemo(() => new Map((data.categories || []).map(c => [c.id, c])), [data.categories]);
  const accountsById = useMemo(() => new Map((data.accounts || []).map(a => [a.id, a])), [data.accounts]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const scoped = (data.transactions || []).filter(t => {
      if (filter !== 'All' && t.type !== filter) return false;
      if (categoryFilter !== 'All' && t.categoryId !== categoryFilter) return false;
      if (!q) return true;
      const desc = (t.description || '').toLowerCase();
      const cat = (categoriesById.get(t.categoryId)?.name || '').toLowerCase();
      const acc = (accountsById.get(t.accountId)?.name || '').toLowerCase();
      const amountMatch = String(t.amount ?? '').includes(q);
      return desc.includes(q) || cat.includes(q) || acc.includes(q) || amountMatch;
    });

    const inPeriod = filterByPeriod(scoped, period);

    const value = (t) => {
      switch (sortConfig.key) {
        case 'description': return (t.description || '').toLowerCase();
        case 'category': return (categoriesById.get(t.categoryId)?.name || '').toLowerCase();
        case 'account': return (accountsById.get(t.accountId)?.name || '').toLowerCase();
        case 'amount': return t.amount ?? 0;
        case 'date':
        default: {
          const d = parseTxDate(t.date);
          return d ? d.getTime() : 0;
        }
      }
    };

    return inPeriod.slice().sort((a, b) => {
      const valA = value(a);
      const valB = value(b);
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data.transactions, filter, categoryFilter, searchQuery, period, sortConfig, categoriesById, accountsById]);

  const totals = useMemo(() => filtered.reduce((acc, t) => {
    if (t.type === 'Income') acc.income += t.amount;
    else if (t.type === 'Expense') acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 }), [filtered]);

  // Grouped into real sections so each sticky header is pushed out by the next one
  // instead of stacking on top of it.
  const groups = useMemo(() => {
    const out = [];
    let current = null;

    filtered.slice(0, visibleCount).forEach(tx => {
      let label;
      if (sortConfig.key === 'date') {
        const d = parseTxDate(tx.date);
        label = d ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No date';
      } else if (sortConfig.key === 'category') {
        label = categoriesById.get(tx.categoryId)?.name || (tx.type === 'Transfer' ? '🔁 Transfer' : '⚠️ Unknown');
      } else if (sortConfig.key === 'account') {
        label = accountsById.get(tx.accountId)?.name || '— No account';
      } else if (sortConfig.key === 'description') {
        label = ((tx.description || '#')[0] || '#').toUpperCase();
      } else {
        label = null;
      }

      if (!current || current.label !== label) {
        current = { label, items: [] };
        out.push(current);
      }
      current.items.push(tx);
    });

    return out;
  }, [filtered, visibleCount, sortConfig.key, categoriesById, accountsById]);

  const gridTemplate = sortConfig.key === 'date' ? '2fr 1fr 1fr 1fr' : '1fr 2fr 1fr 1fr 1fr';

  const rowKeyHandler = (tx) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setEditingTx(tx);
    }
  };

  return (
    <div>
      {/* Scans the whole ledger, not the filtered view: a duplicate you can't
          currently see is still a duplicate, and hiding it behind a filter is
          how it survived this long. */}
      <DuplicateReview
        transactions={data.transactions}
        categoriesById={categoriesById}
        accountsById={accountsById}
        client={client}
        onDataChange={onDataChange}
        onInspect={setEditingTx}
      />

      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', marginTop: 'var(--space-md)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>🍃</div>
          <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-ink)' }}>No Transactions Found</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>Try adjusting your filters in the top menu to find what you're looking for.</p>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-sm)', padding: '0 var(--space-md) var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
            <span>{filtered.length} transaction{filtered.length === 1 ? '' : 's'}</span>
            <span>
              <span style={{ color: 'var(--color-success)' }}>+{formatCurrency(totals.income)}</span>
              {'  '}
              <span style={{ color: 'var(--color-danger)' }}>−{formatCurrency(totals.expense)}</span>
            </span>
          </div>

          <div className="transaction-list-header" style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', color: 'var(--color-muted)', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--color-border)', fontWeight: 'var(--weight-medium)' }}>
            {sortConfig.key !== 'date' && (
              <button className="tx-sort-btn" onClick={() => handleSort('date')}>Date{getSortIndicator('date')}</button>
            )}
            <button className="tx-sort-btn" onClick={() => handleSort('description')}>Description{getSortIndicator('description')}</button>
            <button className="tx-sort-btn tx-col-category" onClick={() => handleSort('category')}>Category{getSortIndicator('category')}</button>
            <button className="tx-sort-btn tx-col-account" onClick={() => handleSort('account')}>Account{getSortIndicator('account')}</button>
            <button className="tx-sort-btn tx-col-amount" style={{ textAlign: 'right' }} onClick={() => handleSort('amount')}>Amount{getSortIndicator('amount')}</button>
          </div>

          {groups.map((group, gi) => (
            <section key={`${group.label}-${gi}`}>
              {group.label && (
                <div style={{ position: 'sticky', top: 0, backgroundColor: 'color-mix(in srgb, var(--color-bg) 95%, transparent)', backdropFilter: 'blur(4px)', padding: '4px var(--space-md)', margin: 'var(--space-sm) 0 2px 0', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', zIndex: 1, borderRadius: 'var(--radius-sm)' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(tx => {
                const category = categoriesById.get(tx.categoryId);
                // A Transfer has no category by design — don't flag that as if it
                // were a deleted/missing category (⚠️ Unknown).
                const isTransfer = tx.type === 'Transfer';
                const isUnknownCat = !category && !isTransfer;
                const displayCatName = category?.name || (isTransfer ? 'Transfer' : 'Unknown');
                const catColor = isTransfer ? 'var(--color-muted)' : getCategoryColor(displayCatName);
                const txDate = parseTxDate(tx.date);
                const sign = tx.type === 'Income' ? '+' : tx.type === 'Expense' ? '−' : '±';

                return (
                  <div
                    key={tx.id}
                    className="transaction-row"
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${tx.description || 'transaction'}`}
                    style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', paddingLeft: 'var(--space-lg)', alignItems: 'center', backgroundColor: tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 3%, var(--color-surface))' : 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', borderLeft: `4px solid ${catColor}`, cursor: 'pointer' }}
                    onClick={() => setEditingTx(tx)}
                    onKeyDown={rowKeyHandler(tx)}
                  >
                    {sortConfig.key !== 'date' && (
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                        {txDate ? txDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'}
                      </div>
                    )}
                    <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                    <div>
                      <span style={{
                        fontSize: 'var(--text-xs)', padding: '2px 8px',
                        background: isUnknownCat ? 'color-mix(in srgb, var(--color-muted) 10%, transparent)' : `color-mix(in srgb, ${catColor} 10%, transparent)`,
                        color: isUnknownCat ? 'var(--color-muted)' : catColor,
                        border: `1px solid ${isUnknownCat ? 'var(--color-border)' : `color-mix(in srgb, ${catColor} 30%, transparent)`}`,
                        borderRadius: 'var(--radius-full)', display: 'inline-block'
                      }}>
                        {isUnknownCat ? '⚠️ Unknown' : isTransfer ? `🔁 ${displayCatName}` : displayCatName}
                      </span>
                    </div>
                    <div className="tx-col-account" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>{accountsById.get(tx.accountId)?.name || '—'}</div>
                    <div className="tx-col-amount" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <div style={{
                        color: tx.type === 'Income' ? 'var(--color-success)' : 'var(--color-ink)',
                        background: tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'color-mix(in srgb, var(--color-ink) 5%, transparent)',
                        border: tx.type === 'Income' ? '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)' : '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
                        padding: '4px 10px', borderRadius: 'var(--radius-full)',
                        fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap'
                      }}>
                        {sign}{formatCurrency(tx.amount)}
                      </div>
                      {tx.originalAmount != null && tx.originalCurrency && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                          ({tx.originalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} {tx.originalCurrency})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}

          {filtered.length > visibleCount && (
            <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
              <Button variant="secondary" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
              </Button>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: 'var(--space-xs)' }}>
                Showing {visibleCount} of {filtered.length}
              </div>
            </div>
          )}
        </div>
      )}

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
