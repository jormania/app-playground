import { useState, useEffect } from 'react';
import BottomSheet from './BottomSheet';
import { Button } from '../../ds/components/Button';
import { CategorySelect } from './CategorySelect';
import { SegmentedControl } from '../../ds/components/SegmentedControl';

export default function FilterSheet({ isOpen, onClose, filterType, categoryFilter, searchQuery, onApply, categories, allowTransfer = false }) {
  const [localType, setLocalType] = useState(filterType);
  const [localCategory, setLocalCategory] = useState(categoryFilter);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalType(filterType);
      setLocalCategory(categoryFilter);
      setLocalSearch(searchQuery);
    }
  }, [isOpen, filterType, categoryFilter, searchQuery]);

  const handleApply = () => {
    onApply({ filterType: localType, categoryFilter: localCategory, searchQuery: localSearch });
    onClose();
  };

  const handleClear = () => {
    setLocalType('All');
    setLocalCategory('All');
    setLocalSearch('');
  };

  const relevantCategories = categories.filter(c => localType === 'All' || c.type === localType);
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
            <select
              value={localCategory}
              onChange={(e) => setLocalCategory(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-ink)',
                fontSize: 'var(--text-sm)'
              }}
            >
              <option value="All">All Categories</option>
              {relevantCategories.map(c => (
                <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginBottom: 'var(--space-xs)' }}>Search Description</label>
          <input
            type="text"
            placeholder="Search..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--space-sm)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-ink)',
              fontSize: 'var(--text-sm)',
              boxSizing: 'border-box'
            }}
          />
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
        <Button variant="secondary" onClick={handleClear}>Clear</Button>
        <Button variant="primary" onClick={handleApply}>Apply Filters</Button>
      </div>
    </BottomSheet>
  );
}
