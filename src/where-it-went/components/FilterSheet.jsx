import { useState, useEffect } from 'react';
import BottomSheet from './BottomSheet';
import { Button } from '../../ds/components/Button';
import { CategorySelect } from './CategorySelect';
import { SegmentedControl } from '../../ds/components/SegmentedControl';

export default function FilterSheet({ isOpen, onClose, filterType, categoryFilter, searchQuery, unreconciledOnly = false, onApply, categories, allowTransfer = false }) {
  const [localType, setLocalType] = useState(filterType);
  const [localCategory, setLocalCategory] = useState(categoryFilter);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [localUnreconciledOnly, setLocalUnreconciledOnly] = useState(unreconciledOnly);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalType(filterType);
      setLocalCategory(categoryFilter);
      setLocalSearch(searchQuery);
      setLocalUnreconciledOnly(unreconciledOnly);
    }
  }, [isOpen, filterType, categoryFilter, searchQuery, unreconciledOnly]);

  const handleApply = () => {
    onApply({ filterType: localType, categoryFilter: localCategory, searchQuery: localSearch, unreconciledOnly: localUnreconciledOnly });
    onClose();
  };

  const handleClear = () => {
    setLocalType('All');
    setLocalCategory('All');
    setLocalSearch('');
    setLocalUnreconciledOnly(false);
  };

  // An inactive category is hidden from the picker, unless it's the one
  // already applied — filtering *to* a category you've since deactivated is
  // exactly how you'd review its old history, and that option shouldn't
  // disappear the moment you turn the category off.
  const relevantCategories = categories.filter(c =>
    (localType === 'All' || c.type === localType) && (c.active !== false || c.id === localCategory));
  // Transfers carry no category at all, so a category picker would only ever be
  // able to produce an empty result set here.
  const categoryFilterApplies = localType !== 'Transfer';
  // Offer the option when the feature is on, or when a Transfer filter is
  // already applied — turning the toggle off later shouldn't silently hide the
  // fact that the ledger is currently filtered to Transfers.
  const canFilterTransfer = allowTransfer || filterType === 'Transfer';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Filters">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginBottom: 'var(--space-xs)' }}>Transaction Type</label>
          <SegmentedControl
            size="sm"
            value={localType}
            onChange={(val) => {
              setLocalType(val);
              setLocalCategory('All');
            }}
            options={[
              { value: 'All', label: 'All' },
              { value: 'Expense', label: 'Expenses' },
              { value: 'Income', label: 'Income' },
              ...(canFilterTransfer ? [{ value: 'Transfer', label: 'Transfers' }] : [])
            ]}
          />
        </div>

        {categoryFilterApplies && (
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginBottom: 'var(--space-xs)' }}>Category</label>
            <CategorySelect
              id="cat-filter"
              value={localCategory === 'All' ? 'All' : localCategory}
              onChange={(e) => setLocalCategory(e.target.value)}
              categories={[{ id: 'All', name: 'All Categories' }, ...relevantCategories]}
              style={{
                width: '100%',
                padding: 'var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-ink)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginBottom: 'var(--space-xs)' }}>Search Description</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-sm)',
                paddingRight: '32px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-ink)',
                fontSize: 'var(--text-sm)',
                boxSizing: 'border-box'
              }}
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-ink)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={localUnreconciledOnly}
            onChange={(e) => setLocalUnreconciledOnly(e.target.checked)}
          />
          Unreconciled only
        </label>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
        <Button variant="secondary" onClick={handleClear}>Clear</Button>
        <Button variant="primary" onClick={handleApply}>Apply Filters</Button>
      </div>
    </BottomSheet>
  );
}
