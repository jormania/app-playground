import React, { useState } from 'react';
import { Button } from '../../ds/components/Button';
import { BASE_CURRENCY } from '../lib/fx';
import { toDateString } from '../lib/period';

export default function LedgerExport({ data }) {
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const headers = ['Date', 'Type', 'Description', 'Category', 'Account', 'Amount', 'Currency'];
      const rows = (data.transactions || []).map(t => {
        const cat = data.categories?.find(c => c.id === t.categoryId);
        const acc = data.accounts?.find(a => a.id === t.accountId);
        return [
          toDateString(new Date(t.date)),
          t.type,
          `"${(t.description || '').replace(/"/g, '""')}"`,
          `"${cat?.name || 'Uncategorized'}"`,
          `"${acc?.name || 'Unknown'}"`,
          t.amount.toFixed(2),
          BASE_CURRENCY
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Ledger_Export_${toDateString(new Date())}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="secondary" onClick={handleExportCSV} disabled={exporting}>
      {exporting ? 'Exporting...' : 'Export Full Ledger (CSV)'}
    </Button>
  );
}
