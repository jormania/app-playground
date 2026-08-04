/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import SplitTransactionModal from './SplitTransactionModal';

afterEach(cleanup);

const categories = [
  { id: 'cat-groceries', name: 'Groceries', type: 'Expense' },
  { id: 'cat-dining', name: 'Dining', type: 'Expense' },
];

const expenseTx = {
  id: 'tx-1',
  description: 'Big shop',
  amount: 101,
  type: 'Expense',
  categoryId: 'cat-groceries',
};

describe('SplitTransactionModal', () => {
  it('splitting 101 at 33% never invents or loses money — split + remainder sum to the original', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SplitTransactionModal isOpen transaction={expenseTx} categories={categories} onSave={onSave} onClose={() => {}} />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Percentage %' }));
    await user.click(screen.getByRole('button', { name: '33%' }));

    // Pick the split category.
    const select = document.querySelector('select');
    fireEvent.change(select, { target: { value: 'cat-dining' } });

    await user.click(screen.getByRole('button', { name: 'Save Split' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    // 101 at 33% used to ceil both the split (34) and a separately-rounded
    // remainder (68), summing to 102 — a leu invented out of nowhere.
    expect(payload.splitAmount + payload.remainderAmount).toBe(101);
    expect(payload.splitAmount).toBeGreaterThan(0);
    expect(payload.remainderAmount).toBeGreaterThan(0);
  });

  it('resets its fields when reopened on a different transaction', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <SplitTransactionModal isOpen transaction={expenseTx} categories={categories} onSave={onSave} onClose={() => {}} />
    );

    const amountInput = screen.getByPlaceholderText('Enter split amount');
    fireEvent.change(amountInput, { target: { value: '40' } });
    expect(amountInput.value).toBe('40');

    // A different transaction, same modal instance (App.jsx never unmounts it).
    const otherTx = { id: 'tx-2', description: 'Coffee', amount: 20, type: 'Expense', categoryId: 'cat-groceries' };
    rerender(
      <SplitTransactionModal isOpen transaction={otherTx} categories={categories} onSave={onSave} onClose={() => {}} />
    );

    const freshAmountInput = screen.getByPlaceholderText('Enter split amount');
    expect(freshAmountInput.value).toBe('');
  });

  it('reports a clear error instead of doing nothing on an invalid submit', async () => {
    const onSave = vi.fn();
    render(
      <SplitTransactionModal isOpen transaction={expenseTx} categories={categories} onSave={onSave} onClose={() => {}} />
    );

    // Satisfy the native `required` category select so the submit actually
    // reaches handleSubmit; the split amount is left blank, which is what's
    // under test — canSubmit's own validation, not the browser's.
    fireEvent.change(document.querySelector('select'), { target: { value: 'cat-dining' } });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save Split' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter a split amount or percentage/i)).toBeTruthy();
  });
});
