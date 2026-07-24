import { useState, useEffect } from 'react';
import { Button } from '../../ds/components/Button';
import { Field } from '../../ds/components/Field';

export default function BudgetEditorModal({ isOpen, onClose, categories, client, onDataChange }) {
  const [limits, setLimits] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle');

  useEffect(() => {
    if (isOpen) {
      const initial = {};
      categories.forEach(c => {
        initial[c.id] = c.budgetLimit || '';
      });
      setLimits(initial);
    }
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // Find what changed
      const updates = categories
        .filter(c => {
          const newLim = limits[c.id] === '' ? null : Number(limits[c.id]);
          const oldLim = c.budgetLimit || null;
          return newLim !== oldLim;
        })
        .map(c => ({
          id: c.id,
          limit: limits[c.id] === '' ? null : Number(limits[c.id])
        }));

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
      console.error("Failed to update budgets", e);
      alert("Failed to update budgets. Check console.");
      setSaveStatus('idle');
    }
  };

  const totalBudget = Object.values(limits).reduce((acc, val) => acc + (Number(val) || 0), 0);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'var(--color-bg)', padding: 'var(--space-xl)', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0, marginBottom: 'var(--space-xs)', color: 'var(--color-ink)' }}>Edit Budget Limits</h2>
        <p style={{ color: 'var(--color-muted)', marginBottom: 'var(--space-lg)', fontSize: 'var(--text-sm)' }}>
          Set monthly limits for your categories. Your total monthly budget is automatically calculated.
        </p>
        
        <div style={{ padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-lg)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: '4px' }}>Total Global Budget</div>
          <div style={{ color: 'var(--color-accent)', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>
            {totalBudget.toFixed(0)} RON
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
          {categories.map(c => (
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
          <Button variant="secondary" onClick={onClose} disabled={saveStatus !== 'idle'}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saveStatus !== 'idle'}>
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved! ✓' : 'Save Limits'}
          </Button>
        </div>
      </div>
    </div>
  );
}
