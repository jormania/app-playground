import { useState, useEffect } from 'react';
import { Button } from '../../ds/components/Button';
import { Field } from '../../ds/components/Field';
import { Modal } from '../../ds/components/Modal';
import { AlertModal } from '../../ds';
import { formatCurrency } from '../lib/currency';

export default function BudgetEditorModal({ isOpen, onClose, categories, client, onDataChange }) {
  const [limits, setLimits] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle');
  const [error, setError] = useState(null);

  // Budget limits only make sense for spending — the old modal listed every
  // category including Income, so a "limit" on Salary was meaningless.
  const expenseCategories = (categories || []).filter(c => c.type !== 'Income');

  useEffect(() => {
    if (isOpen) {
      const initial = {};
      expenseCategories.forEach(c => { initial[c.id] = c.budgetLimit || ''; });
      setLimits(initial);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, categories]);

  const handleSave = async () => {
    setSaveStatus('saving');
    setError(null);
    try {
      const updates = expenseCategories
        .filter(c => {
          const newLim = limits[c.id] === '' ? null : Number(limits[c.id]);
          const oldLim = c.budgetLimit || null;
          return newLim !== oldLim;
        })
        .map(c => ({ id: c.id, limit: limits[c.id] === '' ? null : Number(limits[c.id]) }));

      for (const update of updates) {
        await client.updateCategoryLimit(update.id, update.limit);
      }

      setSaveStatus('saved');
      setTimeout(() => {
        onDataChange();
        onClose();
        setSaveStatus('idle');
      }, 700);
    } catch (e) {
      console.error('Failed to update budgets', e);
      setError(e.message || 'Failed to update budgets.');
      setSaveStatus('idle');
    }
  };

  const totalBudget = Object.values(limits).reduce((acc, val) => acc + (Number(val) || 0), 0);

  return (
    <Modal open={isOpen} onClose={onClose} title="Edit Budget Limits">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: 'var(--text-sm)' }}>
          Set monthly limits for your spending categories. Your total monthly budget is calculated automatically.
        </p>

        <div style={{ padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: '4px' }}>Total Global Budget</div>
          <div style={{ color: 'var(--color-accent)', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>
            {formatCurrency(totalBudget)}
          </div>
        </div>

        {expenseCategories.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontStyle: 'italic', margin: 0 }}>No expense categories yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
            {expenseCategories.map(c => (
              <Field
                key={c.id}
                type="number"
                min="0"
                placeholder="No Limit"
                label={`${c.icon ? `${c.icon} ` : ''}${c.name}`}
                value={limits[c.id]}
                onChange={(e) => setLimits({ ...limits, [c.id]: e.target.value })}
              />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)' }}>
          <Button variant="secondary" onClick={onClose} disabled={saveStatus !== 'idle'}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saveStatus !== 'idle'}>
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved! ✓' : 'Save Limits'}
          </Button>
        </div>
      </div>

      <AlertModal
        isOpen={!!error}
        title="Could not save budgets"
        message={error || ''}
        onClose={() => setError(null)}
      />
    </Modal>
  );
}
