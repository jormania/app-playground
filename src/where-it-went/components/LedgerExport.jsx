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
    
    .filters {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      background: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .filters input, .filters select {
      padding: 10px 14px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 1em;
      outline: none;
      flex: 1;
    }
    .filters input:focus, .filters select:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }
    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Transaction Ledger</h1>
    <div class="meta">Exported on ${new Date().toLocaleString()} &bull; <span id="count">${data.transactions?.length || 0}</span> Transactions</div>
  </div>
  
  <div class="filters">
    <input type="text" id="searchInput" placeholder="Search description, category, or account...">
    <select id="typeFilter" style="flex: 0 0 120px;">
      <option value="all">All Types</option>
      <option value="income">Income</option>
      <option value="expense">Expense</option>
      <option value="transfer">Transfer</option>
    </select>
    <select id="periodFilter" style="flex: 0 0 140px;">
      <option value="all_time">All Time</option>
      <option value="this_month">This Month</option>
      <option value="last_month">Last Month</option>
      <option value="last_3_months">Last 3 Months</option>
      <option value="last_6_months">Last 6 Months</option>
      <option value="this_year">This Year</option>
    </select>
    <select id="categoryFilter" style="flex: 0 0 150px;">
      <option value="all">All Categories</option>
    </select>
    <select id="accountFilter" style="flex: 0 0 150px;">
      <option value="all">All Accounts</option>
    </select>
  </div>

  <div class="card">
    <table id="ledgerTable">
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

  <script>
    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const periodFilter = document.getElementById('periodFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const accountFilter = document.getElementById('accountFilter');
    const tableRows = document.querySelectorAll('#ledgerTable tbody tr');
    const countDisplay = document.getElementById('count');

    // Populate category and account dropdowns dynamically
    const categories = new Set();
    const accounts = new Set();
    tableRows.forEach(row => {
      const cat = row.cells[3].innerText.trim();
      const acc = row.cells[4].innerText.trim();
      if (cat) categories.add(cat);
      if (acc) accounts.add(acc);
    });
    
    Array.from(categories).sort().forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.toLowerCase();
      opt.innerText = cat;
      categoryFilter.appendChild(opt);
    });
    
    Array.from(accounts).sort().forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.toLowerCase();
      opt.innerText = acc;
      accountFilter.appendChild(opt);
    });

    // Anchor 'relative' periods to the moment of export, not the moment the file is viewed
    const exportDate = new Date('${new Date().toISOString()}');
    const exportYear = exportDate.getFullYear();
    const exportMonth = exportDate.getMonth();

    function isInPeriod(dateStr, period) {
      if (period === 'all_time') return true;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      
      const startOfExportMonth = new Date(exportYear, exportMonth, 1);
      
      if (period === 'this_month') {
        return d >= startOfExportMonth && d < new Date(exportYear, exportMonth + 1, 1);
      }
      if (period === 'last_month') {
        const start = new Date(exportYear, exportMonth - 1, 1);
        return d >= start && d < startOfExportMonth;
      }
      if (period === 'last_3_months') {
        const start = new Date(exportYear, exportMonth - 2, 1);
        return d >= start && d < new Date(exportYear, exportMonth + 1, 1);
      }
      if (period === 'last_6_months') {
        const start = new Date(exportYear, exportMonth - 5, 1);
        return d >= start && d < new Date(exportYear, exportMonth + 1, 1);
      }
      if (period === 'this_year') {
        const start = new Date(exportYear, 0, 1);
        return d >= start && d < new Date(exportYear + 1, 0, 1);
      }
      return true;
    }

    function filterTable() {
      const searchTerm = searchInput.value.toLowerCase();
      const typeTerm = typeFilter.value.toLowerCase();
      const periodTerm = periodFilter.value;
      const catTerm = categoryFilter.value;
      const accTerm = accountFilter.value;
      let visibleCount = 0;

      tableRows.forEach(row => {
        const dateStr = row.cells[0].innerText;
        const typeBadge = row.querySelector('.badge').innerText.toLowerCase();
        const catStr = row.cells[3].innerText.toLowerCase();
        const accStr = row.cells[4].innerText.toLowerCase();
        const text = row.innerText.toLowerCase();
        
        const matchesSearch = text.includes(searchTerm);
        const matchesType = typeTerm === 'all' || typeBadge === typeTerm;
        const matchesPeriod = isInPeriod(dateStr, periodTerm);
        const matchesCat = catTerm === 'all' || catStr === catTerm;
        const matchesAcc = accTerm === 'all' || accStr === accTerm;

        if (matchesSearch && matchesType && matchesPeriod && matchesCat && matchesAcc) {
          row.classList.remove('hidden');
          visibleCount++;
        } else {
          row.classList.add('hidden');
        }
      });
      
      countDisplay.innerText = visibleCount;
    }

    searchInput.addEventListener('input', filterTable);
    typeFilter.addEventListener('change', filterTable);
    periodFilter.addEventListener('change', filterTable);
    categoryFilter.addEventListener('change', filterTable);
    accountFilter.addEventListener('change', filterTable);
  </script>
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
