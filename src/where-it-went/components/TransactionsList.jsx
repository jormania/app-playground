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
import { accountLabelById } from '../lib/accounts';
import { SwipeableRow } from './SwipeableRow';

const PAGE_SIZE = 200;

/** Amount as money moving: income positive, expense negative, transfer neutral. */
function signedAmount(tx) {
  const value = Number(tx?.amount) || 0;
  if (tx?.type === 'Income') return value;
  if (tx?.type === 'Expense') return -value;
  return 0; // a transfer changes no total, so it sorts between the two
}

export default function TransactionsList({ data, client, onDataChange, filterProps, period, allowTransfer = false, onRepeat, onSplit, mobileSwipe, dismissedDuplicates, onDismissedDuplicatesChange, onViewTripInInsights }) {
  const { filterType: filter = 'All', categoryFilter = 'All', searchQuery = '' } = filterProps || {};

  const [sortConfig, setSortConfig] = useState(() => readJson('whereItWent_sort', { key: 'date', direction: 'desc' }));
  const [editingTx, setEditingTx] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Bulk Mode
  const [selectedTxs, setSelectedTxs] = useState(new Set());
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const toggleSelection = (id) => {
    setSelectedTxs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkReconcile = async () => {
    setBulkProcessing(true);
    try {
      const jobs = Array.from(selectedTxs).map(id => client.updateTransaction(id, { reconciled: true }));
      await Promise.all(jobs);
      setSelectedTxs(new Set());
      if (onDataChange) onDataChange();
    } catch (e) {
      setActionError(e.message || 'Failed to bulk update');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedTxs.size} transactions?`)) return;
    setBulkProcessing(true);
    try {
      const jobs = Array.from(selectedTxs).map(id => client.deleteTransaction(id));
      await Promise.all(jobs);
      setSelectedTxs(new Set());
      if (onDataChange) onDataChange();
    } catch (e) {
      setActionError(e.message || 'Failed to bulk delete');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkCategorize = async (categoryId) => {
    setBulkProcessing(true);
    try {
      const jobs = Array.from(selectedTxs).map(id => client.updateTransaction(id, { categoryId }));
      await Promise.all(jobs);
      setSelectedTxs(new Set());
      setShowBulkCategoryModal(false);
      if (onDataChange) onDataChange();
    } catch (e) {
      setActionError(e.message || 'Failed to bulk update');
    } finally {
      setBulkProcessing(false);
    }
  };


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
      const notes = (t.notes || '').toLowerCase();
      const amountMatch = String(t.amount ?? '').includes(q);
      return desc.includes(q) || cat.includes(q) || acc.includes(q) || notes.includes(q) || amountMatch;
    });

    const inPeriod = filterByPeriod(scoped, period);

    const value = (t) => {
      switch (sortConfig.key) {
        case 'description': return (t.description || '').toLowerCase();
        case 'category': return (categoriesById.get(t.categoryId)?.name || '').toLowerCase();
        case 'account': return (accountsById.get(t.accountId)?.name || '').toLowerCase();
        // Signed, so the sort matches what the row actually shows. Amounts are
        // stored unsigned, so an Income of 100 and an Expense of 100 used to
        // compare equal and an expense of 500 outranked an income of 200 —
        // "highest amount" meant magnitude, not money in or out.
        case 'amount': return signedAmount(t);
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
        label = accountLabelById(accountsById, tx.accountId, { fallback: '— No account' });
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

  const gridTemplate = sortConfig.key === 'date' ? '2fr 1fr 1fr 40px 1fr' : '1fr 2fr 1fr 1fr 40px 1fr';

  /** A row still sitting in the offline outbox, drawn as clearly unsent. */
  const pendingBadge = (tx) => (tx.pending ? (
    <span
      title="Saved on this device — not yet synced to Notion"
      style={{
        fontSize: '0.6rem', fontWeight: 'var(--weight-bold)', padding: '1px 5px',
        borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.5px',
        backgroundColor: 'color-mix(in srgb, var(--color-warning) 18%, transparent)',
        color: 'var(--color-warning)', whiteSpace: 'nowrap', flex: 'none'
      }}
    >
      ⏳ Syncing
    </span>
  ) : null);

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
        dismissed={dismissedDuplicates}
        onDismissedChange={onDismissedDuplicatesChange}
      />

      {filtered.length === 0 ? (
        <div className="card-container stagger-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl)', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', marginTop: 'var(--space-md)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>🍃</div>
          <h3 style={{ margin: '0 0 var(--space-xs) 0', color: 'var(--color-ink)' }}>Nothing here</h3>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
            No transactions match the current period and filters. Try the calendar or filter
            buttons at the top, or add one with “+ Add”.
          </p>
        </div>
      ) : (
        <>
          <div className="card-container stagger-2" style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1ch',
            padding: 'var(--space-sm) var(--space-md)',
            marginTop: 'var(--space-md)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
            minWidth: 0
          }}>
            <span style={{ color: 'var(--color-muted)' }}>{filtered.length} transaction{filtered.length === 1 ? '' : 's'}</span>
            <span style={{ color: 'var(--color-muted)' }}>&middot;</span>
            <span style={{ color: 'var(--color-success)' }}>Income +{formatCurrency(totals.income)}</span>
            <span style={{ color: 'var(--color-muted)' }}>&middot;</span>
            <span style={{ color: 'var(--color-danger)' }}>Expense &minus;{formatCurrency(totals.expense)}</span>
          </div>
          <div className="card-container stagger-3" style={{ marginTop: 'var(--space-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>

          <div className="transaction-list-header" style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', paddingLeft: 'calc(var(--space-lg) + 4px)', color: 'var(--color-muted)', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--color-border)', fontWeight: 'var(--weight-medium)' }}>
            {sortConfig.key !== 'date' && (
              <button className="tx-sort-btn" onClick={() => handleSort('date')}>Date{getSortIndicator('date')}</button>
            )}
            <button className="tx-sort-btn" onClick={() => handleSort('description')}>Description{getSortIndicator('description')}</button>
            <button className="tx-sort-btn tx-col-category" style={{ textAlign: 'center' }} onClick={() => handleSort('category')}>Category{getSortIndicator('category')}</button>
            <button className="tx-sort-btn tx-col-account" onClick={() => handleSort('account')}>Account{getSortIndicator('account')}</button>
            <div className="tx-col-repeat"></div>
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
                  <SwipeableRow
                    key={tx.id}
                    enabled={true}
                    onSwipeRight={mobileSwipe ? () => onRepeat?.(tx) : undefined}
                    onSwipeLeft={mobileSwipe ? () => onSplit?.(tx) : undefined}
                    onLongPress={() => toggleSelection(tx.id)}
                    onClick={() => selectedTxs.size > 0 ? toggleSelection(tx.id) : setEditingTx(tx)}
                  >
                    <div
                      className="transaction-row"
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${tx.description || 'transaction'}`}
                    style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', paddingLeft: 'var(--space-lg)', alignItems: 'center', backgroundColor: selectedTxs.has(tx.id) ? 'color-mix(in srgb, var(--color-primary) 15%, var(--color-surface))' : tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 3%, var(--color-surface))' : 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', borderLeft: `4px solid ${selectedTxs.has(tx.id) ? 'var(--color-primary)' : catColor}`, cursor: 'pointer' }}
                    onKeyDown={rowKeyHandler(tx)}
                  >
                    {sortConfig.key !== 'date' && (
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                        {txDate ? txDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-base)', color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                      {/* A note used to be write-only: typed into the form, read by the
                          classifiers, never shown again. One line, truncated. */}
                      {tx.notes && (
                        <div
                          title={tx.notes}
                          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}
                        >
                          📝 {tx.notes}
                        </div>
                      )}
                    </div>
                    <div className="tx-col-category" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                      <span style={{
                        fontSize: 'var(--text-xs)', padding: '2px 8px',
                        background: isUnknownCat ? 'color-mix(in srgb, var(--color-muted) 10%, transparent)' : `color-mix(in srgb, ${catColor} 10%, transparent)`,
                        color: isUnknownCat ? 'var(--color-muted)' : catColor,
                        border: `1px solid ${isUnknownCat ? 'var(--color-border)' : `color-mix(in srgb, ${catColor} 30%, transparent)`}`,
                        borderRadius: 'var(--radius-pill)', display: 'inline-block',
                        maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {isUnknownCat ? '⚠️ Unknown' : isTransfer ? `🔁 ${displayCatName}` : displayCatName}
                      </span>
                      {pendingBadge(tx)}
                    </div>
                    {/* A transfer's account cell reads as a route, so both ends
                        are visible without opening the row. */}
                    <div className="tx-col-account" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isTransfer && tx.toAccountId
                        ? `${accountLabelById(accountsById, tx.accountId)} → ${accountLabelById(accountsById, tx.toAccountId)}`
                        : accountLabelById(accountsById, tx.accountId)}
                    </div>
                    <div className="tx-col-repeat" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '4px' }}>
                      {onRepeat && (
                        <button
                          type="button"
                          title="Repeat this transaction"
                          aria-label={`Repeat ${tx.description || 'transaction'}`}
                          onClick={(e) => { e.stopPropagation(); onRepeat(tx); }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '20px', height: '20px', padding: 0,
                            background: 'none', border: '1px solid var(--color-border)', borderRadius: '50%',
                            color: 'var(--color-muted)', cursor: 'pointer', flex: 'none'
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="17 1 21 5 17 9"></polyline>
                            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                            <polyline points="7 23 3 19 7 15"></polyline>
                            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="tx-col-amount" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          color: tx.type === 'Income' ? 'var(--color-success)' : 'var(--color-ink)',
                          background: tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'color-mix(in srgb, var(--color-ink) 5%, transparent)',
                          border: tx.type === 'Income' ? '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)' : '1px solid color-mix(in srgb, var(--color-border) 50%, transparent)',
                          padding: '4px 10px', borderRadius: 'var(--radius-pill)',
                          fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap'
                        }}>
                          {sign}{formatCurrency(Math.abs(tx.amount))}
                        </div>
                      </div>
                      {tx.originalAmount != null && tx.originalCurrency && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                          ({tx.originalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} {tx.originalCurrency})
                        </div>
                      )}
                    </div>
                  </div>
                  </SwipeableRow>
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
        </>
      )}
      {selectedTxs.size > 0 && (() => {
        const singleTx = selectedTxs.size === 1 ? (data.transactions || []).find(t => selectedTxs.has(t.id)) : null;
        return (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            padding: 'var(--space-md)',
            display: 'flex', gap: 'var(--space-sm)',
            alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
            zIndex: 50,
            flexWrap: 'wrap'
          }}>
            <div style={{ fontWeight: 'bold' }}>{selectedTxs.size} selected</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {singleTx && onSplit && <Button size="sm" variant="secondary" onClick={() => onSplit(singleTx)} disabled={bulkProcessing}>Split</Button>}
              {singleTx && onRepeat && <Button size="sm" variant="secondary" onClick={() => onRepeat(singleTx)} disabled={bulkProcessing}>Repeat</Button>}
              <Button size="sm" variant="secondary" onClick={() => setShowBulkCategoryModal(true)} disabled={bulkProcessing}>Categorize</Button>
              <Button size="sm" variant="secondary" onClick={handleBulkReconcile} disabled={bulkProcessing}>Reconcile</Button>
              <Button size="sm" variant="danger" onClick={handleBulkDelete} disabled={bulkProcessing}>Delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedTxs(new Set())} disabled={bulkProcessing}>Cancel</Button>
            </div>
          </div>
        );
      })()}

      <Modal isOpen={showBulkCategoryModal} onClose={() => setShowBulkCategoryModal(false)} title="Bulk Categorize">
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', padding: '16px' }}>
           {(data.categories || []).map(cat => (
             <Button key={cat.id} variant="secondary" onClick={() => handleBulkCategorize(cat.id)} disabled={bulkProcessing}>{cat.name}</Button>
           ))}
         </div>
      </Modal>

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
