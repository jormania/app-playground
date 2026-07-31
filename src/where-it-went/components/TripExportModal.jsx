import React, { useMemo, useState } from 'react';
import { Modal } from '../../ds';
import { Button } from '../../ds/components/Button';
import { CategoryIcon } from './CategoryIcon';
import { generateDeepInsights } from '../lib/analytics';
import { BASE_CURRENCY } from '../lib/fx';
import { toDateString } from '../lib/period';

export default function TripExportModal({ trip, data, onClose }) {
  const [copied, setCopied] = useState(false);

  // List all transactions associated with this trip
  const tripTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    return data.transactions
      .filter(t => t.tripId === trip.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [data, trip.id]);

  // Sort categories by total spending
  const categoryBreakdown = useMemo(() => {
    const sums = {};
    let total = 0;
    tripTransactions.forEach(t => {
      if (t.type === 'Expense') {
        sums[t.categoryId] = (sums[t.categoryId] || 0) + t.amount;
        total += t.amount;
      }
    });
    
    return {
      total,
      breakdown: Object.entries(sums)
        .map(([id, amount]) => {
          const cat = data.categories?.find(c => c.id === id);
          return { id, name: cat?.name || 'Uncategorized', cat, total: amount };
        })
        .sort((a, b) => b.total - a.total)
    };
  }, [tripTransactions, data.categories]);

  const totalExpense = categoryBreakdown.total;
  const breakdownList = categoryBreakdown.breakdown;



  const handleCopyText = async () => {
    const lines = [];
    lines.push(`Trip Summary: ${trip.name}`);
    if (trip.destination) lines.push(`Destination: ${trip.destination}`);
    lines.push(`Dates: ${trip.startDate || '?'} to ${trip.endDate || '?'}`);
    lines.push(`Total Spent: ${totalExpense.toFixed(0)} ${BASE_CURRENCY}`);
    lines.push('');

    lines.push(`-- Category Breakdown --`);
    breakdownList.forEach(c => {
      lines.push(`${c.name}: ${c.total.toFixed(0)} ${BASE_CURRENCY}`);
    });
    lines.push('');

    lines.push(`-- All Transactions --`);
    tripTransactions.forEach(t => {
      const catName = data.categories.find(c => c.id === t.categoryId)?.name || 'Uncategorized';
      lines.push(`[${toDateString(t.date)}] ${t.description} (${catName}) - ${t.amount.toFixed(0)} ${BASE_CURRENCY}`);
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Trip Export" style={{ maxWidth: '400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
        
        {/* Receipt-style snapshot card */}
        <div style={{ 
          backgroundColor: 'var(--color-surface-2)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          border: '1px solid var(--color-border)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', margin: '0 0 4px 0' }}>
              {trip.name}
            </h2>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)' }}>
              {trip.destination && `${trip.destination} • `}{trip.startDate || '?'} - {trip.endDate || '?'}
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '10px 0' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-muted)', marginBottom: '4px' }}>Total Spent</div>
            <div style={{ fontSize: '28px', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>
              {totalExpense.toFixed(0)} {BASE_CURRENCY}
            </div>
          </div>

          {breakdownList.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)', marginBottom: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                Category Breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {breakdownList.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CategoryIcon category={c.cat} name={c.name} />
                      <span style={{ fontSize: 'var(--text-base)', color: 'var(--color-ink)' }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)' }}>
                      {c.total.toFixed(0)} {BASE_CURRENCY}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tripTransactions.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)', marginBottom: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                All Transactions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tripTransactions.map(t => {
                  const cat = data.categories.find(c => c.id === t.categoryId);
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.description}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', display: 'flex', gap: '4px' }}>
                          <span>{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span>•</span>
                          <span>{cat?.name || 'Uncategorized'}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', flex: 'none', marginTop: '2px' }}>
                        {t.amount.toFixed(0)} {BASE_CURRENCY}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Close</Button>
          <Button variant="primary" onClick={handleCopyText} style={{ flex: 1 }}>
            {copied ? 'Copied!' : 'Copy Text'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
