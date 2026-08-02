import React, { useState } from 'react';
import { Button } from '../../ds/components/Button';
import { BASE_CURRENCY } from '../lib/fx';
import { toDateString } from '../lib/period';

export default function LedgerExport({ data }) {
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingHTML, setExportingHTML] = useState(false);

  const handleExportCSV = async () => {
    setExportingCSV(true);
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
      setExportingCSV(false);
    }
  };

  const handleExportHTML = async () => {
    setExportingHTML(true);
    try {
      const rows = (data.transactions || []).map(t => {
        const cat = data.categories?.find(c => c.id === t.categoryId);
        const acc = data.accounts?.find(a => a.id === t.accountId);
        const amountStr = new Intl.NumberFormat(undefined, { style: 'currency', currency: BASE_CURRENCY }).format(t.amount);
        const color = t.type === 'Income' ? '#10b981' : (t.type === 'Transfer' ? '#6b7280' : '#ef4444');
        return `
          <tr>
            <td>${toDateString(new Date(t.date))}</td>
            <td><span class="badge ${t.type.toLowerCase()}">${t.type}</span></td>
            <td><strong>${(t.description || '')}</strong></td>
            <td>${cat?.name || 'Uncategorized'}</td>
            <td>${acc?.name || 'Unknown'}</td>
            <td style="color: ${color}; text-align: right; font-weight: bold;">${amountStr}</td>
          </tr>
        `;
      }).join('');

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ledger Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px 20px;
      background-color: #f9fafb;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    h1 {
      color: #111827;
      margin-bottom: 8px;
    }
    .meta {
      color: #6b7280;
      font-size: 0.95em;
    }
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th, td {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 600;
      color: #374151;
      text-transform: uppercase;
      font-size: 0.8em;
      letter-spacing: 0.05em;
    }
    tr:last-child td {
      border-bottom: none;
    }
    tr:hover {
      background-color: #f9fafb;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 9999px;
      font-size: 0.75em;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge.income { background-color: #d1fae5; color: #065f46; }
    .badge.expense { background-color: #fee2e2; color: #991b1b; }
    .badge.transfer { background-color: #f3f4f6; color: #374151; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Transaction Ledger</h1>
    <div class="meta">Exported on ${new Date().toLocaleString()} &bull; ${data.transactions?.length || 0} Transactions</div>
  </div>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Description</th>
          <th>Category</th>
          <th>Account</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
</body>
</html>
      `;
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Ledger_Export_${toDateString(new Date())}.html`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExportingHTML(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
      <Button variant="secondary" onClick={handleExportCSV} disabled={exportingCSV || exportingHTML}>
        {exportingCSV ? 'Exporting...' : 'Export as CSV'}
      </Button>
      <Button variant="primary" onClick={handleExportHTML} disabled={exportingCSV || exportingHTML}>
        {exportingHTML ? 'Exporting...' : 'Export as HTML'}
      </Button>
    </div>
  );
}
