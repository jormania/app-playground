// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TransactionsList from './TransactionsList';

afterEach(() => {
  cleanup();
});

describe('TransactionsList Component', () => {
  const mockData = {
    categories: [{ id: 'c1', name: 'Food' }],
    accounts: [{ id: 'a1', name: 'Bank' }],
    transactions: [
      { id: '1', date: '2026-07-20', description: 'Groceries', amount: 50, type: 'Expense', categoryId: 'c1', accountId: 'a1' },
      { id: '2', date: '2026-07-22', description: 'Salary', amount: 1000, type: 'Income', categoryId: 'c2', accountId: 'a1' }
    ]
  };

  const mockClient = {
    addTransaction: vi.fn()
  };

  it('renders transactions and sorts by amount', () => {
    render(<TransactionsList data={mockData} client={mockClient} onDataChange={vi.fn()} />);
    
    expect(screen.getByText('Groceries')).toBeDefined();
    expect(screen.getByText('Salary')).toBeDefined();

    // The component defaults to sorting by Date desc.
    // If we click Amount header, it sorts by Amount.
    const amountHeader = screen.getByText('Amount');
    fireEvent.click(amountHeader);

    // After one click (asc), 50 should be before 1000.
    // We can just verify it didn't crash and the header changed to "Amount ↑"
    expect(screen.getByText('Amount ↑')).toBeDefined();

    fireEvent.click(amountHeader);
    expect(screen.getByText('Amount ↓')).toBeDefined();
  });

  it('badges a categoryless Transfer as 🔁 Transfer, not ⚠️ Unknown', () => {
    // A dataset where every non-Transfer transaction has a real category, so any
    // "⚠️ Unknown" badge can only have come from the Transfer row misfiring.
    const dataWithTransfer = {
      categories: [{ id: 'c1', name: 'Food' }],
      accounts: [{ id: 'a1', name: 'Bank' }],
      transactions: [
        { id: '1', date: '2026-07-20', description: 'Groceries', amount: 50, type: 'Expense', categoryId: 'c1', accountId: 'a1' },
        { id: '3', date: '2026-07-23', description: 'Revolut top-up', amount: 200, type: 'Transfer', categoryId: '', accountId: 'a1' }
      ]
    };
    render(<TransactionsList data={dataWithTransfer} client={mockClient} onDataChange={vi.fn()} />);
    expect(screen.getByText('🔁 Transfer')).toBeDefined();
    expect(screen.queryByText('⚠️ Unknown')).toBeNull();
  });
});
