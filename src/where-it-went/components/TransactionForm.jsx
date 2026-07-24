import { useState } from 'react';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { SegmentedControl } from '../../ds/components/SegmentedControl';

export default function TransactionForm({ categories, accounts, onSave, onCancel }) {
  const [type, setType] = useState('Expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');

  const sortedAccounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name));
  const availableCategories = categories
    .filter(c => c.type === type)
    .sort((a, b) => a.name.localeCompare(b.name));
    
  const selectedCat = categories.find(c => c.id === categoryId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description || !amount || !categoryId || !accountId) return;
    
    onSave({
      description,
      amount: parseFloat(amount),
      date,
      type,
      categoryId,
      accountId,
      tags: []
    });
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <Field label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        <Field label="Amount (RON)" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
      </div>

      <Field label="Description" type="text" value={description} onChange={e => setDescription(e.target.value)} required placeholder="e.g. Groceries" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
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
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', marginTop: '2px', fontStyle: 'italic', lineHeight: '1.4' }}>
              {selectedCat.description}
            </div>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit">Save Transaction</Button>
      </div>
    </form>
  );
}
