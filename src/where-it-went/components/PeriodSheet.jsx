import { useState } from 'react';
import BottomSheet from './BottomSheet';
import { Button } from '../../ds/components/Button';

export default function PeriodSheet({ isOpen, onClose, period, onPeriodChange }) {
  // We'll keep local state for the UI, and apply on 'Done'
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  const handleApply = () => {
    onPeriodChange(selectedPeriod);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Select period">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <Button 
          variant={selectedPeriod === 'this_month' ? 'primary' : 'secondary'} 
          size="sm" 
          onClick={() => setSelectedPeriod('this_month')}
        >
          This month
        </Button>
        <Button 
          variant={selectedPeriod === 'last_month' ? 'primary' : 'secondary'} 
          size="sm" 
          onClick={() => setSelectedPeriod('last_month')}
        >
          Last month
        </Button>
        <Button 
          variant={selectedPeriod === 'this_year' ? 'primary' : 'secondary'} 
          size="sm" 
          onClick={() => setSelectedPeriod('this_year')}
        >
          This year
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
          <button style={{ background: 'none', border: 'none', color: 'var(--color-ink)', cursor: 'pointer' }}>&lt;</button>
          <span style={{ fontWeight: 'var(--weight-medium)' }}>Jul 2026</span>
          <button style={{ background: 'none', border: 'none', color: 'var(--color-ink)', cursor: 'pointer' }}>&gt;</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span style={{ fontWeight: 'var(--weight-medium)' }}>2026</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>

      <Button variant="primary" style={{ width: '100%' }} onClick={handleApply}>Done</Button>
    </BottomSheet>
  );
}
