import { useState, useEffect } from 'react';
import { Modal } from '../../ds/components/Modal';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';

export default function SubscriptionEditorModal({ isOpen, onClose, sub, data, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('Expense');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sub) {
      setName(sub.name || '');
      setAmount(sub.amount || '');
      setType(sub.type || 'Expense');
      setDayOfMonth(sub.dayOfMonth || 1);
      setCategoryId(sub.categoryId || '');
      setAccountId(sub.accountId || '');
      setActive(sub.active !== false);
    } else {
      setName('');
      setAmount('');
      setType('Expense');
      setDayOfMonth(1);
      setCategoryId(data?.categories?.[0]?.id || '');
      setAccountId(data?.accounts?.[0]?.id || '');
      setActive(true);
    }
  }, [sub, isOpen, data]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !amount) return;

    setSaving(true);
    const subData = {
      name,
      amount: parseFloat(amount),
      type,
      dayOfMonth: parseInt(dayOfMonth, 10),
      categoryId,
      accountId,
      active
    };

    try {
      await onSave(sub ? sub.id : null, subData);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} title={sub ? 'Edit Subscription' : 'Add Subscription'} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <Field label="Name" value={name} onChange={e => setName(e.target.value)} required />
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-md)' }}>
          <Field label="Amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
          <Field label="Type" type="select" value={type} onChange={e => setType(e.target.value)}>
            <option value="Expense">Expense</option>
            <option value="Income">Income</option>
          </Field>
        </div>

        <Field label="Day of Month (1-31)" type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} required />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-md)' }}>
          <Field label="Category" type="select" value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
            <option value="">Select...</option>
            {data.categories.map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>)}
          </Field>
          <Field label="Account" type="select" value={accountId} onChange={e => setAccountId(e.target.value)} required>
            <option value="">Select...</option>
            {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Field>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input type="checkbox" id="sub-active" checked={active} onChange={e => setActive(e.target.checked)} />
          <label htmlFor="sub-active" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>Active (Generates transactions automatically)</label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', justifyContent: 'space-between', marginTop: 'var(--space-xl)' }}>
          <div>
            {sub && (
              <Button type="button" variant="danger" disabled={saving} onClick={async () => {
                if (confirm('Are you sure you want to delete this subscription?')) {
                  setSaving(true);
                  await onDelete(sub.id);
                  setSaving(false);
                  onClose();
                }
              }}>Delete</Button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !name || !amount || !categoryId || !accountId}>
              {saving ? 'Saving...' : 'Save Subscription'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
