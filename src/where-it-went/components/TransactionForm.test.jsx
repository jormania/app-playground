// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import TransactionForm from './TransactionForm';

const categories = [{ id: 'c1', name: 'Groceries', type: 'Expense' }];
const accounts = [{ id: 'a1', name: 'Cash' }, { id: 'a2', name: 'Revolut' }];

afterEach(() => {
  cleanup();
});

describe('TransactionForm', () => {
  it('calls onSave(null, data) for a new transaction — App.jsx used to receive only the first argument', async () => {
    const onSave = vi.fn().mockResolvedValue();
    render(<TransactionForm categories={categories} accounts={accounts} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });

    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [id, data] = onSave.mock.calls[0];
    expect(id).toBeNull();
    expect(data).toMatchObject({ description: 'Milk', amount: 12.5, categoryId: 'c1' });
  });

  it('blocks submission and shows an error when the amount is zero', async () => {
    const onSave = vi.fn();
    render(<TransactionForm categories={categories} accounts={accounts} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });

    fireEvent.submit(document.querySelector('form'));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText(/greater than zero/i)).toBeDefined();
  });

  it('does not silently swap the Account when opening an existing transaction for edit', () => {
    // Regression: the account auto-picker used to fire on mount for an existing
    // transaction, rewriting a deliberately-chosen Account to whatever keyword
    // heuristic matched the category.
    const initialTx = {
      id: 'tx1', description: 'Cash withdrawal', amount: 100, date: '2026-01-01',
      type: 'Expense', categoryId: 'c1', accountId: 'a1', tags: []
    };
    render(<TransactionForm categories={categories} accounts={accounts} initialTx={initialTx} onSave={vi.fn()} onCancel={vi.fn()} onDelete={vi.fn()} />);

    const accountSelect = screen.getByLabelText(/account/i);
    expect(accountSelect.value).toBe('a1');
  });

  it('surfaces a thrown save error and keeps the form open with values intact', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Notion rejected the write'));
    render(<TransactionForm categories={categories} accounts={accounts} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });
    fireEvent.submit(document.querySelector('form'));

    expect(await screen.findByText('Notion rejected the write')).toBeDefined();
    expect(screen.getByDisplayValue('Milk')).toBeDefined();
  });
});
