import { useState } from 'react';
import { Button } from '../../ds/components/Button';
import { Modal } from '../../ds/components/Modal';
import { CategoryIcon } from './CategoryIcon';

export function CategorySelect({ id, value, onChange, categories, required, style, disabled }) {
  const [open, setOpen] = useState(false);
  const selectedCat = categories.find(c => c.id === value);
  
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <select 
        id={id} 
        value={value} 
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', pointerEvents: 'none', appearance: 'none' }}
      >
        <option value="" disabled>Select…</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <Button 
        type="button" 
        variant="secondary" 
        onClick={() => setOpen(true)} 
        disabled={disabled}
        value={value}
        style={{ 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          backgroundColor: 'var(--color-surface)', 
          color: value ? 'var(--color-ink)' : 'var(--color-muted)', 
          padding: '8px 12px',
          height: '40px', // standard select height
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          ...style 
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          {selectedCat && <CategoryIcon category={selectedCat} style={{ marginRight: '8px' }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedCat ? selectedCat.name : 'Select…'}
          </span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: '8px' }}><path d="m6 9 6 6 6-6"/></svg>
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Select Category">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
          {categories.map(cat => (
            <Button
              key={cat.id}
              type="button"
              size="sm"
              variant={cat.id === value ? 'primary' : 'secondary'}
              onClick={() => {
                onChange({ target: { value: cat.id } });
                setOpen(false);
              }}
              style={{ padding: '6px 8px', justifyContent: 'flex-start' }}
            >
              <CategoryIcon category={cat} style={{ opacity: cat.id === value ? 1 : 0.7, marginRight: '6px' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
            </Button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
