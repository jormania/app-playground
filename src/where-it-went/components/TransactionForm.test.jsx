// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import TransactionForm from './TransactionForm';

const categories = [{ id: 'c1', name: 'Groceries', type: 'Expense' }];
const accounts = [{ id: 'a1', name: 'Cash' }, { id: 'a2', name: 'Revolut' }];
// Currency lives on the account; only a non-RON one should surface the
// foreign-amount fields.
const multiCurrencyAccounts = [
  { id: 'a1', name: 'Cash', currency: 'RON' },
  { id: 'a2', name: 'Revolut', currency: 'EUR' }
];

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

  describe('Transfer type (behind allowTransfer)', () => {
    it('does not offer the Transfer option when allowTransfer is false', () => {
      render(<TransactionForm categories={categories} accounts={accounts} onSave={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.queryByRole('radio', { name: 'Transfer' })).toBeNull();
    });

    it('offers Transfer, skips category, and excludes it from the saved payload when allowed', async () => {
      const onSave = vi.fn().mockResolvedValue();
      render(<TransactionForm categories={categories} accounts={accounts} allowTransfer onSave={onSave} onCancel={vi.fn()} />);

      fireEvent.click(screen.getByRole('radio', { name: 'Transfer' }));
      // No Category field should be required/rendered for a Transfer.
      expect(screen.queryByLabelText(/^category/i)).toBeNull();

      fireEvent.change(screen.getByPlaceholderText('e.g. Revolut top-up'), { target: { value: 'Top-up' } });
      fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '200' } });
      fireEvent.submit(document.querySelector('form'));

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const [, data] = onSave.mock.calls[0];
      expect(data).toMatchObject({ type: 'Transfer', categoryId: '' });
    });

    it('still offers Transfer when editing an existing Transfer even if the toggle is now off', () => {
      // Regression guard: disabling the feature later must not force an
      // existing transfer's type to silently change out from under it.
      const initialTx = {
        id: 'tx1', description: 'Old transfer', amount: 50, date: '2026-01-01',
        type: 'Transfer', categoryId: '', accountId: 'a1', tags: []
      };
      render(<TransactionForm categories={categories} accounts={accounts} allowTransfer={false} initialTx={initialTx} onSave={vi.fn()} onCancel={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByRole('radio', { name: 'Transfer' })).toBeDefined();
      expect(screen.getByRole('radio', { name: 'Transfer' }).getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('Foreign-currency amount', () => {
    it('is hidden for a RON account and shown once a non-RON account is selected', () => {
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={vi.fn()} onCancel={vi.fn()} />);
      // Default account (Cash, RON) — no foreign-amount section.
      expect(screen.queryByLabelText(/original amount/i)).toBeNull();

      fireEvent.change(screen.getByLabelText(/account/i), { target: { value: 'a2' } });
      expect(screen.getByLabelText(/original amount/i)).toBeDefined();
    });

    it('defaults the currency field to the account currency and includes both values on save', async () => {
      const onSave = vi.fn().mockResolvedValue();
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={onSave} onCancel={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/account/i), { target: { value: 'a2' } }); // Revolut, EUR
      fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Café' } });
      // Both the RON amount and the new Original amount field share the "0.00"
      // placeholder once the foreign-currency section appears — disambiguate by
      // exact accessible label instead.
      fireEvent.change(screen.getByLabelText(/^Amount\b/), { target: { value: '42' } });
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });
      fireEvent.change(screen.getByLabelText(/original amount/i), { target: { value: '8.5' } });
      fireEvent.submit(document.querySelector('form'));

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const [, data] = onSave.mock.calls[0];
      expect(data.originalAmount).toBe(8.5);
      expect(data.originalCurrency).toBe('EUR');
    });

    it('omits the foreign amount entirely when left blank', async () => {
      const onSave = vi.fn().mockResolvedValue();
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={onSave} onCancel={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/account/i), { target: { value: 'a2' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Café' } });
      fireEvent.change(screen.getByLabelText(/^Amount\b/), { target: { value: '42' } });
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });
      fireEvent.submit(document.querySelector('form'));

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const [, data] = onSave.mock.calls[0];
      expect(data.originalAmount).toBeNull();
      expect(data.originalCurrency).toBe('');
    });
  });
});
