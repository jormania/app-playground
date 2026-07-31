import React, { useState } from 'react';
import { Modal } from '../../ds/components/Modal';
import { Field } from '../../ds/components/Field';
import { Button } from '../../ds/components/Button';
import { SegmentedControl } from '../../ds/components/SegmentedControl';

export default function TemplateEditorModal({ isOpen, onClose, template, categories = [], accounts = [], onSave, onDelete }) {
  const [description, setDescription] = useState(template?.description || '');
  const [amount, setAmount] = useState(template?.amount || '');
  const [type, setType] = useState(template?.type || 'Expense');
  const [categoryId, setCategoryId] = useState(template?.categoryId || '');
  const [accountId, setAccountId] = useState(template?.accountId || accounts[0]?.id || '');
  const [active, setActive] = useState(template?.active !== false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: template?.id,
        description,
        amount,
        type,
        categoryId,
        accountId,
        active
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={template ? "Edit Template" : "New Template"}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <SegmentedControl
          options={[{ value: 'Expense', label: 'Expense' }, { value: 'Income', label: 'Income' }]}
          value={type}
          onChange={setType}
        />
        
        <Field 
          label="Description" 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          required 
          placeholder="e.g. Coffee" 
        />
        
        <Field 
          label="Amount" 
          type="number" 
          step="0.01" 
          value={amount} 
          onChange={e => setAmount(e.target.value)} 
          placeholder="Leave blank to enter when clicking"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>Category</label>
          <select 
            value={categoryId} 
            onChange={e => setCategoryId(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-2)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit' }}
            required
          >
            <option value="">Select Category...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>Account</label>
          <select 
            value={accountId} 
            onChange={e => setAccountId(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-2)', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink)', fontSize: 'var(--text-base)', fontFamily: 'inherit' }}
            required
          >
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input type="checkbox" id="template-active-checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          <label htmlFor="template-active-checkbox" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>Active (shows on Dashboard)</label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          {template && (
            <Button type="button" variant="ghost" onClick={() => onDelete(template.id)} style={{ color: 'var(--color-danger)', marginRight: 'auto' }}>
              Delete
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}
