import { useState } from 'react';
import { Modal } from '../../ds/components/Modal';
import { CurrencyFlag } from './CurrencyFlag';

export function CurrencySelect({ id, value, onChange, currencies, style, disabled }) {
  const [open, setOpen] = useState(false);
  
  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <select 
        id={id} 
        value={value} 
        onChange={onChange}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', pointerEvents: 'none', appearance: 'none' }}
      >
        <option value="" disabled>Select…</option>
        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <button 
        type="button"
        value={value}
        aria-label="Currency"
        onClick={() => setOpen(true)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          ...style
        }}
      >

        {value}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: '4px' }}><path d="m6 9 6 6 6-6"/></svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Select Currency" style={{ maxWidth: '280px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
          {currencies.map(code => (
            <button
              key={code}
              type="button"
              onClick={() => {
                onChange({ target: { value: code } });
                setOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: code === value ? 'var(--color-primary)' : 'var(--color-surface)',
                color: code === value ? 'var(--color-on-primary)' : 'var(--color-ink)',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <CurrencyFlag currency={code} style={{ marginRight: '12px', width: '1.5em', height: '1.5em' }} />
              <span style={{ fontSize: 'var(--text-base)' }}>{code}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
