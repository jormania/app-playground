import { useState, useEffect } from 'react';
import { Button } from '../../ds/components/Button';
import { CategoryIcon } from './CategoryIcon';
import { Field } from '../../ds/components/Field';
import { FormError } from '../../ds/components/FormError';
import { SelectField } from '../../ds/components/SelectField';
import { formatCurrency } from '../lib/currency';
import { BUDGET_PERIODS, normalizePeriod, formatPeriodSuffix, MONTHS_PER } from '../lib/budgets';

export default function BudgetSettings({ categories, client, onDataChange, config, onConfigChange }) {
  const [limits, setLimits] = useState({});
  const [periods, setPeriods] = useState({});
  const [rollovers, setRollovers] = useState({});
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [error, setError] = useState(null);

  // Budget limits only make sense for spending — the old modal listed every
  // category including Income, so a "limit" on Salary was meaningless.
  const expenseCategories = (categories || []).filter(c => c.type !== 'Income');

  useEffect(() => {
    const initial = {};
    const initialPeriods = {};
    const initialRollovers = {};
    expenseCategories.forEach(c => {
      initial[c.id] = c.budgetLimit || '';
      initialPeriods[c.id] = normalizePeriod(c.budgetPeriod);
      initialRollovers[c.id] = !!c.budgetRollover;
    });
    setLimits(initial);
    setPeriods(initialPeriods);
    setRollovers(initialRollovers);
    setMonthlyIncome(config?.monthlyIncome || '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const handleSave = async () => {
    setSaveStatus('saving');
    setError(null);
    try {
      // Only changed categories are written, and only the fields that actually
      // changed — so saving a limit can never blank a period set in Notion.
      const updates = [];
      for (const c of expenseCategories) {
        const newLim = limits[c.id] === '' ? null : Number(limits[c.id]);
        const newPeriod = normalizePeriod(periods[c.id]);
        const newRollover = !!rollovers[c.id];
        const patch = {};
        if (newLim !== (c.budgetLimit || null)) patch.budgetLimit = newLim;
        if (newPeriod !== normalizePeriod(c.budgetPeriod)) patch.budgetPeriod = newPeriod;
        if (newRollover !== !!c.budgetRollover) patch.budgetRollover = newRollover;
        if (Object.keys(patch).length > 0) updates.push({ id: c.id, patch });
      }

      for (const update of updates) {
        await client.updateCategoryBudget(update.id, update.patch);
      }
      
      if (onConfigChange && config) {
        onConfigChange({ ...config, monthlyIncome: Number(monthlyIncome) || 0 });
      }

      setSaveStatus('saved');
      setTimeout(() => {
        onDataChange();
        setSaveStatus('idle');
      }, 700);
    } catch (e) {
      console.error('Failed to update budgets', e);
      setError(e.message || 'Failed to update budgets.');
      setSaveStatus('idle');
    }
  };

  const totalBudget = expenseCategories.reduce((acc, c) => {
    const rawVal = Number(limits[c.id]) || 0;
    const period = normalizePeriod(periods[c.id]);
    const months = MONTHS_PER[period] || 1;
    return acc + (rawVal / months);
  }, 0);

  const mixedPeriods = expenseCategories.some(c => normalizePeriod(periods[c.id]) !== 'Monthly');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: 'var(--text-sm)' }}>
        Set a limit per category and choose how long it lasts. With rollover on, unspent
        room carries into the next window — and an overspend carries too.
      </p>
      
      <div style={{ maxWidth: '250px' }}>
        <Field
          label="Expected Monthly Income"
          type="number"
          min="0"
          placeholder="e.g. 15000"
          value={monthlyIncome}
          onChange={(e) => setMonthlyIncome(e.target.value)}
        />
      </div>

      <div style={{ padding: 'var(--space-md)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', textAlign: 'center' }}>
        <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-sm)', marginBottom: '4px' }}>
          Total Global Budget{mixedPeriods ? ' (per month)' : ''}
        </div>
        <div style={{ color: 'var(--color-accent)', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>
          {formatCurrency(totalBudget)}
        </div>
      </div>

      {expenseCategories.length === 0 ? (
        <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: 'var(--text-sm)' }}>
          No spending categories found. Add some to your Notion Categories database first —
          income categories cannot have a limit.
        </p>
      ) : (
        <div className="budget-grid">
          {expenseCategories.map(c => (
            <div key={c.id} className="budget-mini-card" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-start' }}>
              <Field
                type="number"
                min="0"
                placeholder="No Limit"
                label={<span style={{display: 'flex', alignItems: 'center'}}><CategoryIcon category={c} style={{marginRight: '6px'}} />{c.name}</span>}
                value={limits[c.id]}
                onChange={(e) => setLimits({ ...limits, [c.id]: e.target.value })}
              />
              <SelectField
                aria-label={`${c.name} budget period`}
                value={periods[c.id] || 'Monthly'}
                onChange={(e) => setPeriods({ ...periods, [c.id]: e.target.value })}
              >
                {BUDGET_PERIODS.map(p => (
                  <option key={p} value={p}>per {formatPeriodSuffix(p)}</option>
                ))}
              </SelectField>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', color: 'var(--color-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!rollovers[c.id]}
                  onChange={(e) => setRollovers({ ...rollovers, [c.id]: e.target.checked })}
                />
                Roll unspent room over
              </label>
            </div>
          ))}
        </div>
      )}

      <FormError error={error} />

      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <Button variant="primary" onClick={handleSave} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved! ✓' : 'Save Limits'}
        </Button>
      </div>
    </div>
  );
}
