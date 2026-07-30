import { useState, useEffect, useId } from 'react';
import { formatAccountLabel } from '../lib/accounts';
import { Modal } from '../../ds/components/Modal';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { ConfirmModal } from '../../ds';
import { SegmentedControl } from '../../ds/components/SegmentedControl';

// Matches ds/Field's own input box, same reasoning as TransactionForm.jsx —
// a --color-bg fill read as a flat grey slab next to Field's own inputs.
const selectStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-2)', backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit'
};

export default function SubscriptionEditorModal({ isOpen, onClose, sub, data, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('Expense');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const categorySelectId = useId();
  const accountSelectId = useId();
  const activeCheckboxId = useId();

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
      // A recurring bill is a subscription far more often than not, so start
      // there instead of whichever category the Notion query happened to
      // return first — that was frequently a mismatched guess the user had
      // to correct on every single add.
      const expenseCategories = (data?.categories || []).filter(c => c.type === 'Expense');
      const subsCategory = expenseCategories.find(c => (c.name || '').trim().toLowerCase() === 'subscriptions')
        || expenseCategories.find(c => /subscri/i.test(c.name || ''));
      setCategoryId(subsCategory?.id || data?.categories?.[0]?.id || '');
      setAccountId(data?.accounts?.[0]?.id || '');
      setActive(true);
    }
    setFormError(null);
  }, [sub, isOpen, data]);

  const parsedAmount = parseFloat(amount);
  const parsedDay = parseInt(dayOfMonth, 10);
  const canSubmit = !!name.trim() && Number.isFinite(parsedAmount) && parsedAmount > 0 &&
    Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31 && !!categoryId && !!accountId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!canSubmit) {
      setFormError('Fill in every required field with a valid amount and a day between 1 and 31.');
      return;
    }

    setSaving(true);
    const subData = {
      name: name.trim(),
      amount: parsedAmount,
      type,
      dayOfMonth: parsedDay,
      categoryId,
      accountId,
      active
    };

    try {
      await onSave(sub ? sub.id : null, subData);
      onClose();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || 'Could not save this subscription.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={isOpen} title={sub ? 'Edit Subscription' : 'Add Subscription'} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowX: 'hidden', boxSizing: 'border-box', minWidth: 0 }}>
        <Field label="Name" value={name} onChange={e => setName(e.target.value)} required />

        <Field label="Amount" type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} required />
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

        <Field label="Day of Month (1-31)" type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} required />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor={categorySelectId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Category <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <select id={categorySelectId} value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={selectStyle}>
              <option value="">Select…</option>
              {(data?.categories || []).filter(c => c.type === type).map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor={accountSelectId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>Account <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <select id={accountSelectId} value={accountId} onChange={e => setAccountId(e.target.value)} required style={selectStyle}>
              <option value="">Select…</option>
              {(data?.accounts || []).map(a => <option key={a.id} value={a.id}>{formatAccountLabel(a)}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input type="checkbox" id={activeCheckboxId} checked={active} onChange={e => setActive(e.target.checked)} />
          <label htmlFor={activeCheckboxId} style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>Active (auto-generates transactions)</label>
        </div>

        {formError && (
          <div role="alert" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
            {formError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: '4px' }}>
          {sub && (
            <div style={{ marginRight: 'auto' }}>
              <Button type="button" variant="danger" disabled={saving} onClick={() => setShowConfirmDelete(true)}>Delete</Button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginLeft: sub ? 0 : 'auto' }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !canSubmit}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
      <ConfirmModal
        isOpen={showConfirmDelete}
        title="Delete Subscription"
        message="Are you sure you want to delete this subscription? It will be archived in Notion and can be restored from the trash there."
        confirmText="Delete"
        variant="danger"
        onConfirm={async () => {
          setShowConfirmDelete(false);
          setSaving(true);
          try {
            await onDelete(sub.id);
            onClose();
          } catch (err) {
            setFormError(err?.message || 'Could not delete this subscription.');
          } finally {
            setSaving(false);
          }
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </Modal>
  );
}
