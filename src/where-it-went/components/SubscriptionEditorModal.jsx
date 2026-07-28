import { useState, useEffect } from 'react';
import { Modal } from '../../ds/components/Modal';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { SegmentedControl } from '../../ds/components/SegmentedControl';

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
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Field label="Name" value={name} onChange={e => setName(e.target.value)} required />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <Field label="Amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Type</label>
            <SegmentedControl
              value={type}
              onChange={val => { setType(val); setCategoryId(''); }}
              options={[
                { value: 'Expense', label: 'Expense' },
                { value: 'Income', label: 'Income' }
              ]}
            />
          </div>
        </div>

        <Field label="Day of Month (1-31)" type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} required />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Category <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit' }}>
              <option value="">Select...</option>
              {(data?.categories || []).filter(c => c.type === type).map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Account <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} required style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit' }}>
              <option value="">Select...</option>
              {(data?.accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input type="checkbox" id="sub-active" checked={active} onChange={e => setActive(e.target.checked)} />
          <label htmlFor="sub-active" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>Active (auto-generates transactions)</label>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: '4px' }}>
          {sub && (
            <div style={{ marginRight: 'auto' }}>
              <Button type="button" variant="danger" disabled={saving} onClick={async () => {
                if (confirm('Are you sure you want to delete this subscription?')) {
                  setSaving(true);
                  await onDelete(sub.id);
                  setSaving(false);
                  onClose();
                }
              }}>Delete</Button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginLeft: sub ? 0 : 'auto' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !name || !amount || !categoryId || !accountId}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
