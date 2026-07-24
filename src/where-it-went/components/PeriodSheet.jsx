import { useState, useEffect } from 'react';
import BottomSheet from './BottomSheet';
import { Button } from '../../ds/components/Button';

// Helper to get YYYY-MM from a Date
const getMonthString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export default function PeriodSheet({ isOpen, onClose, period, onPeriodChange }) {
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [pickerDate, setPickerDate] = useState(new Date());

  // Initialize the picker date based on selected period
  useEffect(() => {
    if (isOpen) {
      setSelectedPeriod(period);
      const now = new Date();
      if (period === 'this_month' || period === 'this_year' || period === 'all_time') {
        setPickerDate(now);
      } else if (period === 'last_month') {
        setPickerDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      } else if (period.match(/^\d{4}-\d{2}$/)) {
        const [y, m] = period.split('-');
        setPickerDate(new Date(parseInt(y), parseInt(m) - 1, 1));
      } else if (period.match(/^\d{4}$/)) {
        setPickerDate(new Date(parseInt(period), 0, 1));
      }
    }
  }, [isOpen, period]);

  const handleApply = () => {
    onPeriodChange(selectedPeriod);
    onClose();
  };

  const shiftMonth = (delta) => {
    const d = new Date(pickerDate);
    d.setMonth(d.getMonth() + delta);
    setPickerDate(d);
    setSelectedPeriod(getMonthString(d));
  };

  const shiftYear = (delta) => {
    const d = new Date(pickerDate);
    d.setFullYear(d.getFullYear() + delta);
    setPickerDate(d);
    setSelectedPeriod(d.getFullYear().toString());
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Select period">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <Button 
          variant={selectedPeriod === 'this_month' ? 'primary' : 'secondary'} 
          size="sm" 
          onClick={() => { setSelectedPeriod('this_month'); setPickerDate(new Date()); }}
        >
          This month
        </Button>
        <Button 
          variant={selectedPeriod === 'last_month' ? 'primary' : 'secondary'} 
          size="sm" 
          onClick={() => { setSelectedPeriod('last_month'); setPickerDate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)); }}
        >
          Last month
        </Button>
        <Button 
          variant={selectedPeriod === 'this_year' ? 'primary' : 'secondary'} 
          size="sm" 
          onClick={() => { setSelectedPeriod('this_year'); setPickerDate(new Date()); }}
        >
          This year
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        
        {/* Month Picker */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          padding: 'var(--space-sm)', border: '1px solid var(--color-border)', 
          borderRadius: 'var(--radius-sm)', 
          backgroundColor: selectedPeriod.match(/^\d{4}-\d{2}$/) ? 'var(--color-surface-2)' : 'transparent'
        }}>
          <button onClick={() => shiftMonth(-1)} style={{ background: 'none', border: 'none', color: 'var(--color-ink)', cursor: 'pointer', padding: '0 8px' }}>&lt;</button>
          <span 
            style={{ fontWeight: 'var(--weight-medium)', cursor: 'pointer', flex: 1, textAlign: 'center' }}
            onClick={() => setSelectedPeriod(getMonthString(pickerDate))}
          >
            {pickerDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
          <button onClick={() => shiftMonth(1)} style={{ background: 'none', border: 'none', color: 'var(--color-ink)', cursor: 'pointer', padding: '0 8px' }}>&gt;</button>
        </div>

        {/* Year Picker */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          padding: 'var(--space-sm)', border: '1px solid var(--color-border)', 
          borderRadius: 'var(--radius-sm)',
          backgroundColor: selectedPeriod.match(/^\d{4}$/) ? 'var(--color-surface-2)' : 'transparent'
        }}>
          <button onClick={() => shiftYear(-1)} style={{ background: 'none', border: 'none', color: 'var(--color-ink)', cursor: 'pointer', padding: '0 8px' }}>&lt;</button>
          <div 
            style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', flex: 1, justifyContent: 'center' }}
            onClick={() => setSelectedPeriod(pickerDate.getFullYear().toString())}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span style={{ fontWeight: 'var(--weight-medium)' }}>{pickerDate.getFullYear()}</span>
          </div>
          <button onClick={() => shiftYear(1)} style={{ background: 'none', border: 'none', color: 'var(--color-ink)', cursor: 'pointer', padding: '0 8px' }}>&gt;</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
        <Button variant="secondary" onClick={() => setSelectedPeriod('all_time')}>All Time</Button>
        <Button variant="primary" onClick={handleApply}>Done</Button>
      </div>
    </BottomSheet>
  );
}
