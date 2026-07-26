import { useState, useEffect } from 'react';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { SegmentedControl } from '../../ds/components/SegmentedControl';
import { sortTrips } from '../services/trips';

export default function TransactionForm({ categories, accounts, trips = [], onSave, onCancel, initialTx, onDelete }) {
  const [type, setType] = useState(initialTx?.type || 'Expense');
  const [description, setDescription] = useState(initialTx?.description || '');
  const [amount, setAmount] = useState(initialTx?.amount || '');
  const [date, setDate] = useState(initialTx?.date ? initialTx.date.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState(initialTx?.categoryId || '');
  const [accountId, setAccountId] = useState(initialTx?.accountId || accounts[0]?.id || '');
  const [tripId, setTripId] = useState(initialTx?.tripId || '');
  const [isSaving, setIsSaving] = useState(false);

  const sortedAccounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name));
  const availableCategories = categories
    .filter(c => c.type === type)
    .sort((a, b) => a.name.localeCompare(b.name));
    
  const selectedCat = categories.find(c => c.id === categoryId);
  const isTravelCategory = selectedCat && selectedCat.name?.toLowerCase().includes('travel');

  useEffect(() => {
    if (!selectedCat || !accounts || accounts.length === 0) return;

    let keywords = [];
    if (selectedCat.type === 'Expense') {
      keywords = ['revolut', 'card', 'checking', 'bank', 'cash'];
    } else if (selectedCat.type === 'Income') {
      const catName = selectedCat.name.toLowerCase();
      if (catName.includes('salary')) {
        keywords = ['checking', 'bank', 'revolut', 'main'];
      } else if (catName.includes('rent') || catName.includes('gift')) {
        keywords = ['cash', 'revolut', 'checking'];
      } else if (catName.includes('freelance') || catName.includes('loan')) {
        keywords = ['revolut', 'checking', 'bank'];
      } else {
        keywords = ['checking', 'revolut', 'cash'];
      }
    }

    let targetAcc = null;
    for (const kw of keywords) {
      targetAcc = accounts.find(a => a.name.toLowerCase().includes(kw));
      if (targetAcc) break;
    }
    if (!targetAcc && accounts.length > 0) {
      targetAcc = accounts[0];
    }

    if (targetAcc) {
      setAccountId(targetAcc.id);
    }
  }, [categoryId, selectedCat, accounts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !amount || !categoryId || !accountId) return;
    
    setIsSaving(true);
    try {
      await onSave(initialTx ? initialTx.id : null, {
        description,
        amount: parseFloat(amount),
        date,
        type,
        categoryId,
        accountId,
        tripId: isTravelCategory && tripId ? tripId : '',
        tags: initialTx?.tags || []
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialTx || !onDelete) return;
    if (confirm('Are you sure you want to delete this transaction?')) {
      setIsSaving(true);
      try {
        await onDelete(initialTx.id);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <SegmentedControl
        value={type}
        onChange={(val) => { setType(val); setCategoryId(''); }}
        options={[
          { value: 'Expense', label: 'Expense' },
          { value: 'Income', label: 'Income' }
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-md)' }}>
        <Field label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        <Field label="Amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
      </div>

      <Field label="Description" type="text" value={description} onChange={e => setDescription(e.target.value)} required placeholder="e.g. Groceries" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-md)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>
            Category <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={{ 
            width: '100%', 
            padding: '10px 12px', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--color-border)', 
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-ink)',
            fontSize: 'var(--text-base)',
            fontFamily: 'inherit'
          }}>
            <option value="" disabled>Select category...</option>
            {availableCategories.map(c => (
              <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ${c.name}` : c.name}</option>
            ))}
          </select>
          {selectedCat?.description && (
            <details style={{ marginTop: '2px' }}>
              <summary style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', cursor: 'pointer', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px' }}>▶</span> Category description
              </summary>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '4px', fontStyle: 'italic', lineHeight: '1.4', paddingLeft: '14px' }}>
                {selectedCat.description}
              </div>
            </details>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>
            Account <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} required style={{ 
            width: '100%', 
            padding: '10px 12px', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--color-border)', 
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-ink)',
            fontSize: 'var(--text-base)',
            fontFamily: 'inherit'
          }}>
            {sortedAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isTravelCategory && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: 'var(--space-sm)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✈️</span> Assign to Trip (Optional)
          </label>
          <select value={tripId} onChange={e => setTripId(e.target.value)} style={{ 
            width: '100%', 
            padding: '10px 12px', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--color-border)', 
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-ink)',
            fontSize: 'var(--text-base)',
            fontFamily: 'inherit'
          }}>
            <option value="">No specific trip (General / Unassigned Travel)</option>
            {sortTrips(trips || []).map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.destination ? ` (${t.destination})` : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
        {initialTx && (
          <div style={{ marginRight: 'auto' }}>
            <Button variant="danger" type="button" onClick={handleDelete} disabled={isSaving}>Delete</Button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginLeft: initialTx ? 0 : 'auto' }}>
          <Button variant="ghost" type="button" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    </form>
  );
}
