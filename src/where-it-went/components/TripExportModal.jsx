import React, { useMemo, useState } from 'react';
import { Modal } from '../../ds';
import { Button } from '../../ds/components/Button';
import { CategoryIcon } from './CategoryIcon';
import { BASE_CURRENCY } from '../lib/fx';
import { toDateString } from '../lib/period';
import { Download, Copy, Calendar, MapPin, PieChart, List, FileText } from 'lucide-react';

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
        const amt = Math.abs(t.amount);
        sums[t.categoryId] = (sums[t.categoryId] || 0) + amt;
        total += amt;
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

  const tripDurationDays = useMemo(() => {
    if (!trip.startDate || !trip.endDate) return 0;
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [trip.startDate, trip.endDate]);

  const dailyAverage = tripDurationDays > 0 ? totalExpense / tripDurationDays : 0;

  const handleCopyText = async () => {
    const lines = [];
    lines.push(`## Trip Report: ${trip.name}`);
    if (trip.destination) lines.push(`Destination: ${trip.destination}`);
    lines.push(`Dates: ${trip.startDate || '?'} to ${trip.endDate || '?'}`);
    lines.push(`Duration: ${tripDurationDays} days`);
    lines.push(`Total Spent: ${totalExpense.toFixed(0)} ${BASE_CURRENCY}`);
    if (dailyAverage > 0) lines.push(`Daily Average: ${dailyAverage.toFixed(0)} ${BASE_CURRENCY}/day`);
    lines.push('');

    lines.push(`### Category Breakdown`);
    breakdownList.forEach(c => {
      lines.push(`- ${c.name}: ${c.total.toFixed(0)} ${BASE_CURRENCY}`);
    });
    lines.push('');

    lines.push(`### All Transactions (${tripTransactions.length})`);
    tripTransactions.forEach(t => {
      const catName = data.categories.find(c => c.id === t.categoryId)?.name || 'Uncategorized';
      lines.push(`[${new Date(t.date).toLocaleDateString()}] ${t.description} (${catName}) - ${Math.abs(t.amount).toFixed(0)} ${BASE_CURRENCY}`);
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Account', 'Amount', 'Currency'];
    const rows = tripTransactions.map(t => {
      const cat = data.categories.find(c => c.id === t.categoryId);
      const acc = data.accounts?.find(a => a.id === t.accountId);
      return [
        toDateString(new Date(t.date)),
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${cat?.name || 'Uncategorized'}"`,
        `"${acc?.name || 'Unknown'}"`,
        Math.abs(t.amount).toFixed(2),
        BASE_CURRENCY
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${trip.name || 'trip'}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal open={true} onClose={onClose} title="Trip Report" style={{ maxWidth: '540px', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px 16px' }}>
        
        {/* Premium Header Card */}
        <div style={{ 
          background: 'linear-gradient(135deg, var(--color-accent) 0%, #7c3aed 100%)',
          borderRadius: 'var(--radius-lg)', 
          padding: '24px',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(59, 110, 245, 0.4)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative background element */}
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1, transform: 'scale(2)' }}>
            <MapPin size={100} />
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} /> {trip.name}
            </h2>
            
            {/* Travel Period & Location nicely separated */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.15)', padding: '12px 16px', borderRadius: 'var(--radius-md)', backdropFilter: 'blur(10px)' }}>
              {trip.destination && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
                  <MapPin size={16} /> <span>{trip.destination}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)' }}>
                <Calendar size={16} /> 
                <span>
                  {trip.startDate ? new Date(trip.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '?'} 
                  {' — '} 
                  {trip.endDate ? new Date(trip.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '?'}
                  {tripDurationDays > 0 && ` (${tripDurationDays} days)`}
                </span>
              </div>
            </div>

            {/* Spent Summary */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9, marginBottom: '4px' }}>Total Spent</div>
                <div style={{ fontSize: '32px', fontWeight: 'var(--weight-bold)', lineHeight: 1 }}>
                  {totalExpense.toFixed(0)} <span style={{ fontSize: '16px', fontWeight: 'normal', opacity: 0.9 }}>{BASE_CURRENCY}</span>
                </div>
              </div>
              {dailyAverage > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9, marginBottom: '4px' }}>Daily Avg</div>
                  <div style={{ fontSize: '20px', fontWeight: 'var(--weight-bold)' }}>
                    {dailyAverage.toFixed(0)} <span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.9 }}>{BASE_CURRENCY}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {breakdownList.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'var(--weight-bold)', color: 'var(--color-muted)', marginBottom: '12px' }}>
              <PieChart size={16} /> Category Breakdown
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {breakdownList.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--color-surface)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
                      <CategoryIcon category={c.cat} name={c.name} size={16} />
                    </div>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)', fontWeight: 'var(--weight-medium)' }}>{c.name}</span>
                  </div>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)' }}>
                    {c.total.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Transactions */}
        {tripTransactions.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'var(--weight-bold)', color: 'var(--color-muted)' }}>
                <List size={16} /> All Transactions
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', backgroundColor: 'var(--color-surface-2)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                {tripTransactions.length} total
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tripTransactions.map(t => {
                const cat = data.categories.find(c => c.id === t.categoryId);
                const acc = data.accounts?.find(a => a.id === t.accountId);
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                      <div style={{ 
                        fontSize: 'var(--text-sm)', 
                        fontWeight: 'var(--weight-medium)', 
                        color: 'var(--color-ink)', 
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-word'
                      }}>
                        {t.description}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 'var(--weight-medium)' }}>{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span style={{ color: 'var(--color-border)' }}>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CategoryIcon category={cat} name={cat?.name} size={12} />
                          {cat?.name || 'Uncategorized'}
                        </span>
                        {acc && (
                          <>
                            <span style={{ color: 'var(--color-border)' }}>•</span>
                            <span>{acc.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--color-ink)', flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ whiteSpace: 'nowrap' }}>{Math.abs(t.amount).toFixed(0)}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-muted)', fontWeight: 'normal', marginTop: '2px' }}>{BASE_CURRENCY}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
          <Button variant="secondary" onClick={handleDownloadCSV} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Download size={16} /> CSV
          </Button>
          <Button variant="primary" onClick={handleCopyText} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Copy size={16} /> {copied ? 'Copied!' : 'Copy Text'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
