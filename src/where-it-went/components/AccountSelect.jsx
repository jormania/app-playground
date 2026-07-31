import { useState } from 'react';
import { Button } from '../../ds/components/Button';
import { Modal } from '../../ds/components/Modal';
import { AccountIcon } from './AccountIcon';
import { formatAccountLabel } from '../lib/accounts';

export function AccountSelect({ id, value, onChange, accounts, required, style, disabled }) {
  const [open, setOpen] = useState(false);
  const selectedAcc = accounts.find(a => a.id === value);
  
  return (
    <>
      <Button 
        type="button" 
        variant="secondary" 
        onClick={() => setOpen(true)} 
        disabled={disabled}
        id={id}
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
          {selectedAcc && <AccountIcon account={selectedAcc} style={{ marginRight: '8px' }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedAcc ? formatAccountLabel(selectedAcc) : 'Select…'}
          </span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: '8px' }}><path d="m6 9 6 6 6-6"/></svg>
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Select Account">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', padding: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
          {accounts.map(acc => (
            <Button
              key={acc.id}
              type="button"
              size="sm"
              variant={acc.id === value ? 'primary' : 'secondary'}
              onClick={() => {
                onChange({ target: { value: acc.id } });
                setOpen(false);
              }}
              style={{ padding: '8px 12px', justifyContent: 'flex-start' }}
            >
              <AccountIcon account={acc} style={{ opacity: acc.id === value ? 1 : 0.7, marginRight: '8px' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatAccountLabel(acc)}</span>
            </Button>
          ))}
        </div>
      </Modal>
    </>
  );
}
