import { CategoryIcon } from './CategoryIcon';
import { AccountIcon } from './AccountIcon';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import TransactionForm from './TransactionForm';
import DuplicateReview from './DuplicateReview';
import { Button } from '../../ds/components/Button';
import { Modal } from '../../ds/components/Modal';
import { AlertModal, ConfirmModal } from '../../ds';
import { getCategoryColor } from '../lib/colors';
import { formatCurrency } from '../lib/currency';
import { filterByPeriod, parseTxDate } from '../lib/period';
import { applyFilters } from '../lib/filtering';
import { readJson, writeJson } from '../lib/storage';
import { accountLabelById } from '../lib/accounts';
import { SwipeableRow } from './SwipeableRow';
import PullToRefresh from './PullToRefresh';

const PAGE_SIZE = 200;

/** Notion allows ~3 requests/second — the same pacing notionClient.js uses for
 * its own paced bulk operation (scrub), so a big selection doesn't trip the
 * rate limit and rely entirely on 429 retry/backoff to recover. */
const BULK_WRITE_SPACING_MS = 350;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run one write per id, sequentially and paced. Stops at the first failure —
 * reordering bulk writes is no safer here than in the outbox — but reports
 * exactly how many succeeded before that happened, so the caller can refresh
 * and clear only the ids that actually landed rather than either wiping a
 * selection that partially failed or leaving it looking untouched.
 */
async function runBulk(ids, action) {
  const succeeded = [];
  for (let i = 0; i < ids.length; i++) {
    try {
      await action(ids[i]);
      succeeded.push(ids[i]);
    } catch (e) {
      return { succeeded, failedId: ids[i], error: e };
    }
    if (i < ids.length - 1) await sleep(BULK_WRITE_SPACING_MS);
  }
  return { succeeded, failedId: null, error: null };
}

/** Amount as money moving: income positive, expense negative, transfer neutral. */
function signedAmount(tx) {
  const value = Number(tx?.amount) || 0;
  if (tx?.type === 'Income') return value;
  if (tx?.type === 'Expense') return -value;
  return 0; // a transfer changes no total, so it sorts between the two
}

export default function TransactionsList(props) {
  return (
    <PullToRefresh onRefresh={props.onDataChange}>
      <TransactionsListInner {...props} />
    </PullToRefresh>
  );
}

function TransactionsListInner({ data, client, onDataChange, filterProps, period, allowTransfer = false, onRepeat, onSplit, mobileSwipe, dismissedDuplicates, onDismissedDuplicatesChange, onViewTripInInsights }) {
  const { filterType: filter = 'All', categoryFilter = 'All', searchQuery = '' } = filterProps || {};

  const [sortConfig, setSortConfig] = useState(() => readJson('whereItWent_sort', { key: 'date', direction: 'desc' }));
  const [editingTx, setEditingTx] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Bulk Mode
  const [selectedTxs, setSelectedTxs] = useState(new Set());
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Action toast
  const [toast, setToast] = useState(null); // { message, key }
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const key = Date.now();
    setToast({ message, key });
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);
  // The timer would otherwise keep a stale setState alive past unmount if the
  // tab is switched inside the 5s window.
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const toggleSelection = (id) => {
    setSelectedTxs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Drop the ids a partially-failed bulk run *did* land, so retrying only
   * touches what's actually still left, instead of either clearing a
   * selection that partially failed or leaving it looking wholly untouched. */
  const settlePartial = (succeeded) => {
    if (succeeded.length === 0) return;
    setSelectedTxs(prev => {
      const next = new Set(prev);
      succeeded.forEach(id => next.delete(id));
      return next;
    });
  };

  const handleBulkReconcile = async () => {
    setBulkProcessing(true);
    const ids = Array.from(selectedTxs);
    const allSelectedReconciled = ids.every(id => {
      const tx = data.transactions.find(t => t.id === id);
      return tx && tx.reconciled;
    });
    const shouldReconcile = !allSelectedReconciled;
    const { succeeded, error } = await runBulk(ids, id => client.updateTransaction(id, { reconciled: shouldReconcile }));
    if (onDataChange && succeeded.length > 0) await onDataChange();
    settlePartial(succeeded);
    setBulkProcessing(false);
    if (error) {
      setActionError(`${error.message || 'Failed to bulk update'} — ${succeeded.length} of ${ids.length} updated before this happened.`);
      return;
    }
    showToast(`${shouldReconcile ? '✓ Reconciled' : '↩ Unreconciled'} ${succeeded.length} transaction${succeeded.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async () => {
    setShowBulkDeleteConfirm(false);
    setBulkProcessing(true);
    const ids = Array.from(selectedTxs);
    const { succeeded, error } = await runBulk(ids, id => client.deleteTransaction(id));
    if (onDataChange && succeeded.length > 0) await onDataChange();
    settlePartial(succeeded);
    setBulkProcessing(false);
    if (error) {
      setActionError(`${error.message || 'Failed to bulk delete'} — ${succeeded.length} of ${ids.length} deleted before this happened.`);
      return;
    }
    showToast(`🗑 Deleted ${succeeded.length} transaction${succeeded.length !== 1 ? 's' : ''}`);
  };

  const handleBulkCategorize = async (categoryId) => {
    setBulkProcessing(true);
    const ids = Array.from(selectedTxs);
    const catName = (data.categories || []).find(c => c.id === categoryId)?.name || 'category';
    const { succeeded, error } = await runBulk(ids, id => client.updateTransaction(id, { categoryId }));
    if (onDataChange && succeeded.length > 0) await onDataChange();
    settlePartial(succeeded);
    setShowBulkCategoryModal(false);
    setBulkProcessing(false);
    if (error) {
      setActionError(`${error.message || 'Failed to bulk update'} — ${succeeded.length} of ${ids.length} moved to ${catName} before this happened.`);
      return;
    }
    showToast(`🏷 ${succeeded.length} transaction${succeeded.length !== 1 ? 's' : ''} → ${catName}`);
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
    const scoped = applyFilters(data.transactions, filterProps || {}, categoriesById, accountsById);

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
  }, [data.transactions, period, sortConfig, categoriesById, accountsById, filterProps]);

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
        current = { label, items: [], income: 0, expense: 0 };
        out.push(current);
      }
      current.items.push(tx);
      if (tx.type === 'Income') current.income += tx.amount;
      else if (tx.type === 'Expense') current.expense += tx.amount;
    });

    return out;
  }, [filtered, visibleCount, sortConfig.key, categoriesById, accountsById]);

  const gridTemplate = sortConfig.key === 'date' ? '3fr 1fr 1fr 120px' : '100px 3fr 1fr 1fr 120px';

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
            justifyContent: 'space-between',
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
            
            {(totals.income > 0 || totals.expense > 0) && (
              <div style={{ display: 'flex', gap: '1ch', alignItems: 'center' }}>
                {totals.income > 0 && <span style={{ color: 'var(--color-success)' }}>Income +{formatCurrency(totals.income)}</span>}
                {totals.income > 0 && totals.expense > 0 && <span style={{ color: 'var(--color-muted)' }}>&middot;</span>}
                {totals.expense > 0 && <span style={{ color: 'var(--color-danger)' }}>Expense &minus;{formatCurrency(totals.expense)}</span>}
              </div>
            )}
          </div>
          <div className="card-container stagger-3" style={{ marginTop: 'var(--space-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>

          <div className="transaction-list-header" style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', paddingLeft: 'calc(var(--space-lg) + 4px)', color: 'var(--color-muted)', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--color-border)', fontWeight: 'var(--weight-medium)' }}>
            {sortConfig.key !== 'date' && (
              <button className="tx-sort-btn" onClick={() => handleSort('date')}>Date{getSortIndicator('date')}</button>
            )}
            <button className="tx-sort-btn" onClick={() => handleSort('description')}>Description{getSortIndicator('description')}</button>
            <button className="tx-sort-btn tx-col-category" style={{ textAlign: 'center' }} onClick={() => handleSort('category')}>Category{getSortIndicator('category')}</button>
            <button className="tx-sort-btn tx-col-account" onClick={() => handleSort('account')}>Account{getSortIndicator('account')}</button>
            <button className="tx-sort-btn tx-col-amount" style={{ textAlign: 'right' }} onClick={() => handleSort('amount')}>Amount{getSortIndicator('amount')}</button>
          </div>

          {groups.map((group, gi) => (
            <section key={`${group.label}-${gi}`}>
              {group.label && (
                <div style={{ position: 'sticky', top: 0, backgroundColor: 'color-mix(in srgb, var(--color-bg) 95%, transparent)', backdropFilter: 'blur(4px)', padding: '4px var(--space-md)', margin: 'var(--space-sm) 0 2px 0', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', zIndex: 1, borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{group.label}</span>
                  {(group.income > 0 || group.expense > 0) && (
                    <div style={{ display: 'flex', gap: '1ch', textTransform: 'none', letterSpacing: 'normal' }}>
                      {group.income > 0 && <span style={{ color: 'var(--color-success)' }}>Income +{formatCurrency(group.income)}</span>}
                      {group.income > 0 && group.expense > 0 && <span style={{ color: 'var(--color-muted)' }}>&middot;</span>}
                      {group.expense > 0 && <span style={{ color: 'var(--color-danger)' }}>Expense &minus;{formatCurrency(group.expense)}</span>}
                    </div>
                  )}
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
                    style={{ display: 'grid', gridTemplateColumns: gridTemplate, gap: 'var(--space-sm)', padding: 'var(--space-sm) var(--space-md)', paddingLeft: 'var(--space-lg)', alignItems: 'center', backgroundColor: selectedTxs.has(tx.id) ? 'color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))' : tx.type === 'Income' ? 'color-mix(in srgb, var(--color-success) 3%, var(--color-surface))' : 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', borderLeft: `4px solid ${selectedTxs.has(tx.id) ? 'var(--color-accent)' : catColor}`, cursor: 'pointer' }}
                    onKeyDown={rowKeyHandler(tx)}
                  >
                    {sortConfig.key !== 'date' && (
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
                        {txDate ? txDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-base)', color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.reconciled && <span title="Reconciled" style={{ color: 'var(--color-success)', marginRight: '6px', fontSize: '14px' }}>✓</span>}
                        {tx.description}
                      </div>
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
                    <div className="tx-col-account" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                      {isTransfer && tx.toAccountId ? (
                        <>
                          <AccountIcon account={accountsById.get(tx.accountId)} style={{ marginRight: '4px' }} />
                          {accountLabelById(accountsById, tx.accountId)}
                          <span style={{ margin: '0 4px' }}>→</span>
                          <AccountIcon account={accountsById.get(tx.toAccountId)} style={{ marginRight: '4px' }} />
                          {accountLabelById(accountsById, tx.toAccountId)}
                        </>
                      ) : (
                        <>
                          <AccountIcon account={accountsById.get(tx.accountId)} style={{ marginRight: '4px' }} />
                          {accountLabelById(accountsById, tx.accountId)}
                        </>
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
        const allSelectedReconciled = Array.from(selectedTxs).every(id => {
          const tx = (data.transactions || []).find(t => t.id === id);
          return tx && tx.reconciled;
        });
        const reconcileText = allSelectedReconciled ? 'Unreconcile' : 'Reconcile';
        return createPortal(
          <div className="tx-bottom-bar">
            <div className="tx-bottom-bar-header">{selectedTxs.size} selected</div>
            <div className="tx-bottom-bar-actions">
              {onSplit && <button type="button" className="action-pill-btn" onClick={() => { if (singleTx) { onSplit(singleTx, () => { setSelectedTxs(new Set()); showToast('✂ Transaction split into 2'); }); } }} disabled={bulkProcessing || !singleTx} style={{ opacity: singleTx ? 1 : 0.5 }}>Split</button>}
              {onRepeat && <button type="button" className="action-pill-btn" onClick={() => { if (singleTx) { setSelectedTxs(new Set()); showToast(`↺ Repeating: ${singleTx.description}`); onRepeat(singleTx); } }} disabled={bulkProcessing || !singleTx} style={{ opacity: singleTx ? 1 : 0.5 }}>Repeat</button>}
              <button type="button" className="action-pill-btn" onClick={() => setShowBulkCategoryModal(true)} disabled={bulkProcessing}>Categorize</button>
              <button type="button" className="action-pill-btn" onClick={handleBulkReconcile} disabled={bulkProcessing}>{reconcileText}</button>
              <button type="button" className="action-pill-btn danger" style={{ color: 'var(--color-danger)' }} onClick={() => setShowBulkDeleteConfirm(true)} disabled={bulkProcessing}>Delete</button>
              <button type="button" className="action-pill-btn" onClick={() => setSelectedTxs(new Set())} disabled={bulkProcessing}>Cancel</button>
            </div>
          </div>,
          document.body
        );
      })()}

      <Modal open={showBulkCategoryModal} onClose={() => setShowBulkCategoryModal(false)} title="Bulk Categorize">
           {(() => {
             // Transfers are deliberately not filtered out of this set (unlike
             // before) — a selection made entirely of Transfers has no
             // matching category by design (no category is typed "Transfer"),
             // and should show that plainly rather than falling through to
             // "no filter" and offering every category in the workspace.
             const selectedTypes = new Set(Array.from(selectedTxs).map(id => {
               const t = data.transactions.find(tx => tx.id === id);
               if (!t) return null;
               return t.type || (t.amount < 0 ? 'Expense' : 'Income');
             }).filter(Boolean));
             // A bulk assignment is always a fresh pick across possibly many rows —
             // no single existing selection to preserve the way a single-row edit
             // has, so an inactive category is simply not offered here.
             const eligible = (data.categories || []).filter(cat =>
               cat.active !== false && (selectedTypes.size === 0 || selectedTypes.has(cat.type)));

             if (eligible.length === 0) {
               return (
                 <p style={{ padding: '12px', margin: 0, color: 'var(--color-muted)', fontSize: 'var(--text-sm)' }}>
                   Transfers move money between your own accounts, so they have no category to assign.
                 </p>
               );
             }
             return (
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '12px' }}>
                 {eligible.map(cat => (
                   <Button key={cat.id} size="sm" variant="secondary" onClick={() => handleBulkCategorize(cat.id)} disabled={bulkProcessing} style={{ padding: '6px 8px', justifyContent: 'flex-start' }}>
                     <CategoryIcon category={cat} style={{ marginRight: '6px' }} />
                     <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                   </Button>
                 ))}
               </div>
             );
           })()}
        </Modal>

      <ConfirmModal
        isOpen={showBulkDeleteConfirm}
        title="Delete Transactions"
        message={`Are you sure you want to delete ${selectedTxs.size} transaction${selectedTxs.size !== 1 ? 's' : ''}? They will be archived in Notion and can be restored from the trash there.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />

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

      {/* Action toast — bottom-right, above nav */}
      {toast && createPortal(
        <div key={toast.key} className="action-toast" role="status" aria-live="polite">
          {toast.message}
        </div>,
        document.body
      )}
    </div>
  );
}
