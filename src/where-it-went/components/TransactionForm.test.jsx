// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import TransactionForm from './TransactionForm';
import { fetchRate } from '../lib/fx';
import { writeJson } from '../lib/storage';

// Never hit the network from a unit test; each case sets the rate it needs.
vi.mock('../lib/fx', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchRate: vi.fn(),
}));

const categories = [{ id: 'c1', name: 'Groceries', type: 'Expense' }];
const accounts = [{ id: 'a1', name: 'Cash' }, { id: 'a2', name: 'Revolut' }];
// Currency lives on the account (a trip can override it).
const multiCurrencyAccounts = [
  { id: 'a1', name: 'Cash', currency: 'RON' },
  { id: 'a2', name: 'Revolut', currency: 'EUR' }
];

beforeEach(() => {
  fetchRate.mockReset();
  fetchRate.mockResolvedValue(null);
  // General hygiene — the form still persists things like recently-used
  // currencies to localStorage, which must not leak between tests.
  try {
    localStorage.clear();
  } catch (_e) {}
});

afterEach(() => {
  cleanup();
});

describe('TransactionForm', () => {
  it('calls onSave(null, data) for a new transaction — App.jsx used to receive only the first argument', async () => {
    const onSave = vi.fn().mockResolvedValue();
    render(<TransactionForm categories={categories} accounts={accounts} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });

    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [id, data] = onSave.mock.calls[0];
    expect(id).toBeNull();
    expect(data).toMatchObject({ description: 'Milk', amount: 12.5, categoryId: 'c1' });
  });

  it('a blank "+ Add" always opens on Expense, even if Income was used last', () => {
    // A stale key from before this was removed must also be ignored, not
    // just "nothing to remember yet".
    writeJson('whereItWent_last_add_type', 'Income');
    render(<TransactionForm categories={categories} accounts={accounts} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Expense' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Income' }).getAttribute('aria-checked')).toBe('false');
  });

  it('a Repeat draft still opens on the original transaction\'s own type', () => {
    const prefill = { type: 'Income', description: 'Salary', amount: 5000, categoryId: 'c1', accountId: 'a1' };
    render(<TransactionForm categories={categories} accounts={accounts} prefill={prefill} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Income' }).getAttribute('aria-checked')).toBe('true');
  });

  it('hides an inactive category from the picker on a new transaction', () => {
    const withInactive = [
      { id: 'c1', name: 'Groceries', type: 'Expense' },
      { id: 'c2', name: 'Other', type: 'Expense', active: false },
    ];
    render(<TransactionForm categories={withInactive} accounts={accounts} onSave={vi.fn()} onCancel={vi.fn()} />);

    const options = Array.from(screen.getByLabelText(/category/i).querySelectorAll('option')).map(o => o.textContent);
    expect(options).not.toContain('Other');
  });

  it('keeps an inactive category visible when editing a transaction already filed under it', () => {
    const withInactive = [
      { id: 'c1', name: 'Groceries', type: 'Expense' },
      { id: 'c2', name: 'Other', type: 'Expense', active: false },
    ];
    const initialTx = { id: 'tx1', description: 'Misc', amount: 10, type: 'Expense', categoryId: 'c2', accountId: 'a1', date: '2026-08-01' };
    render(<TransactionForm categories={withInactive} accounts={accounts} initialTx={initialTx} onSave={vi.fn()} onCancel={vi.fn()} />);

    const options = Array.from(screen.getByLabelText(/category/i).querySelectorAll('option')).map(o => o.textContent);
    expect(options).toContain('Other');
    expect(screen.getByLabelText(/category/i).value).toBe('c2');
  });

  it('blocks submission and shows an error when the amount is zero', async () => {
    const onSave = vi.fn();
    render(<TransactionForm categories={categories} accounts={accounts} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '0' } });
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

  it.each([
    ['Expense', 'e.g. Groceries'],
    ['Income', 'e.g. Salary'],
  ])('hints a %s description with %s', (type, hint) => {
    // Suggesting "Groceries" while logging income reads as though the form has
    // not noticed what you are doing.
    render(<TransactionForm categories={categories} accounts={accounts} onSave={vi.fn()} onCancel={vi.fn()} />);
    if (type === 'Income') fireEvent.click(screen.getByRole('radio', { name: 'Income' }));
    expect(screen.getByPlaceholderText(hint)).toBeDefined();
  });

  it('never re-picks the account when the category is corrected on an existing transaction', () => {
    // Fixing a miscategorised row must not quietly move the money somewhere
    // else. The picker used to skip only the first render, so any later
    // category change rewrote the recorded account.
    const initialTx = {
      id: 'tx1', description: 'Bakery', amount: 30, date: '2026-01-01',
      type: 'Expense', categoryId: 'c1', accountId: 'a1', tags: []
    };
    const cats = [
      { id: 'c1', name: 'Groceries', type: 'Expense' },
      { id: 'c2', name: 'Dining', type: 'Expense' },
    ];
    render(<TransactionForm categories={cats} accounts={multiCurrencyAccounts} initialTx={initialTx} onSave={vi.fn()} onCancel={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByLabelText(/account/i).value).toBe('a1');
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c2' } });
    expect(screen.getByLabelText(/account/i).value).toBe('a1');
  });

  it('adopts the new account currency when the account is changed by hand', async () => {
    // A manually-picked currency used to shadow the account's own for good, so
    // realising you had the wrong account left the wrong currency behind.
    render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });
    expect(screen.getByLabelText('Currency').value).toBe('USD');

    fireEvent.change(screen.getByLabelText(/account/i), { target: { value: 'a2' } }); // Revolut, EUR
    await waitFor(() => expect(screen.getByLabelText('Currency').value).toBe('EUR'));
  });

  it('surfaces a thrown save error and keeps the form open with values intact', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Notion rejected the write'));
    render(<TransactionForm categories={categories} accounts={accounts} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Milk' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '10' } });
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
      fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '200' } });
      // A transfer now needs both ends.
      fireEvent.change(screen.getByLabelText(/^From/), { target: { value: 'a1' } });
      fireEvent.change(screen.getByLabelText(/^To/), { target: { value: 'a2' } });
      fireEvent.submit(document.querySelector('form'));

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const [, data] = onSave.mock.calls[0];
      expect(data).toMatchObject({ type: 'Transfer', categoryId: '', accountId: 'a1', toAccountId: 'a2' });
    });

    it('starts both ends unset, so neither can be saved by accident', async () => {
      // From used to arrive pre-filled with the first account, which made the
      // most likely mistake — leaving it alone — also the easiest one.
      render(<TransactionForm categories={categories} accounts={accounts} allowTransfer onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.click(screen.getByRole('radio', { name: 'Transfer' }));

      expect(screen.getByLabelText(/^From/).value).toBe('');
      expect(screen.getByLabelText(/^To/).value).toBe('');
      // Both offer the same short placeholder.
      expect(screen.getByLabelText(/^From/).querySelector('option[value=""]').textContent).toBe('Select…');
      expect(screen.getByLabelText(/^To/).querySelector('option[value=""]').textContent).toBe('Select…');
    });

    it('never offers the same account on both ends', async () => {
      render(<TransactionForm categories={categories} accounts={accounts} allowTransfer onSave={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.click(screen.getByRole('radio', { name: 'Transfer' }));

      fireEvent.change(screen.getByLabelText(/^To/), { target: { value: 'a2' } });
      const fromValues = [...screen.getByLabelText(/^From/).options].map(o => o.value);
      expect(fromValues).not.toContain('a2');

      fireEvent.change(screen.getByLabelText(/^From/), { target: { value: 'a1' } });
      const toValues = [...screen.getByLabelText(/^To/).options].map(o => o.value);
      expect(toValues).not.toContain('a1');
    });

    it('will not save a transfer without a destination account', async () => {
      const onSave = vi.fn();
      render(<TransactionForm categories={categories} accounts={accounts} allowTransfer onSave={onSave} onCancel={vi.fn()} />);

      fireEvent.click(screen.getByRole('radio', { name: 'Transfer' }));
      fireEvent.change(screen.getByPlaceholderText('e.g. Revolut top-up'), { target: { value: 'Top-up' } });
      fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '200' } });
      fireEvent.submit(document.querySelector('form'));

      expect(onSave).not.toHaveBeenCalled();
      expect(await screen.findByText(/account the money went to/i)).toBeDefined();
    });

    it('will not let a transfer send money to the account it came from', async () => {
      // "Cash to Cash" records nothing and would reconcile against itself.
      const onSave = vi.fn();
      render(<TransactionForm categories={categories} accounts={accounts} allowTransfer onSave={onSave} onCancel={vi.fn()} />);

      fireEvent.click(screen.getByRole('radio', { name: 'Transfer' }));
      fireEvent.change(screen.getByPlaceholderText('e.g. Revolut top-up'), { target: { value: 'Top-up' } });
      fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '200' } });
      // The To list excludes the From account, so force the collision directly.
      const to = screen.getByLabelText(/^To/);
      Object.defineProperty(to, 'value', { value: 'a1', configurable: true });
      fireEvent.change(to);
      fireEvent.submit(document.querySelector('form'));

      expect(onSave).not.toHaveBeenCalled();
    });

    it('omits the destination account entirely for a non-transfer', async () => {
      const onSave = vi.fn().mockResolvedValue();
      render(<TransactionForm categories={categories} accounts={accounts} allowTransfer onSave={onSave} onCancel={vi.fn()} />);

      fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Milk' } });
      fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '10' } });
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });
      fireEvent.submit(document.querySelector('form'));

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(onSave.mock.calls[0][1].toAccountId).toBe('');
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

  describe('Currency + live FX', () => {
    it('defaults the currency to the account currency', () => {
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByLabelText('Currency').value).toBe('RON'); // Cash
      fireEvent.change(screen.getByLabelText(/account/i), { target: { value: 'a2' } });
      expect(screen.getByLabelText('Currency').value).toBe('EUR'); // Revolut
    });

    it('lets a trip currency win over the account currency', async () => {
      // On a trip you spend the destination's money, whatever card settles it.
      const travelCats = [{ id: 'c_travel', name: 'Travel', type: 'Expense' }];
      const trips = [{ id: 'trip1', name: 'Krakow', destination: 'Poland', currency: 'PLN', status: 'Active' }];
      render(<TransactionForm categories={travelCats} accounts={multiCurrencyAccounts} trips={trips} onSave={vi.fn()} onCancel={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c_travel' } });
      fireEvent.change(screen.getByLabelText(/trip/i), { target: { value: 'trip1' } });
      await waitFor(() => expect(screen.getByLabelText('Currency').value).toBe('PLN'));
    });

    it('shows no RON helper line at all while the currency is RON', () => {
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.queryByLabelText('Amount in RON')).toBeNull();
    });

    it('converts the typed foreign amount into RON using the fetched rate', async () => {
      fetchRate.mockResolvedValue({ rate: 5, date: '2026-07-28' });
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={vi.fn()} onCancel={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/account/i), { target: { value: 'a2' } });
      fireEvent.change(screen.getByLabelText('Amount *'), { target: { value: '8.5' } });

      await waitFor(() => expect(screen.getByLabelText('Amount in RON').value).toBe('43'));
    });

    it('saves RON as the amount and the typed figure as the original', async () => {
      fetchRate.mockResolvedValue({ rate: 5, date: '2026-07-28' });
      const onSave = vi.fn().mockResolvedValue();
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={onSave} onCancel={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/account/i), { target: { value: 'a2' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Cafe' } });
      fireEvent.change(screen.getByLabelText('Amount *'), { target: { value: '8.5' } });
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });
      await waitFor(() => expect(screen.getByLabelText('Amount in RON').value).toBe('43'));
      fireEvent.submit(document.querySelector('form'));

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const [, data] = onSave.mock.calls[0];
      expect(data.amount).toBe(43); // RON stays the source of truth
      expect(data.originalAmount).toBe(8.5);
      expect(data.originalCurrency).toBe('EUR');
    });

    it('stops overwriting the RON amount once it has been edited by hand', async () => {
      // A card's own fee beats any published rate, so a manual figure must stick.
      fetchRate.mockResolvedValue({ rate: 5, date: '2026-07-28' });
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={vi.fn()} onCancel={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/account/i), { target: { value: 'a2' } });
      fireEvent.change(screen.getByLabelText('Amount *'), { target: { value: '8.5' } });
      await waitFor(() => expect(screen.getByLabelText('Amount in RON').value).toBe('43'));

      fireEvent.change(screen.getByLabelText('Amount in RON'), { target: { value: '44.10' } });
      fireEvent.change(screen.getByLabelText('Amount *'), { target: { value: '9' } });

      await new Promise(r => setTimeout(r, 20));
      expect(screen.getByLabelText('Amount in RON').value).toBe('44.10');
    });

    it('keeps originalAmount null for a plain RON transaction', async () => {
      const onSave = vi.fn().mockResolvedValue();
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={onSave} onCancel={vi.fn()} />);

      fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Bread' } });
      fireEvent.change(screen.getByLabelText('Amount *'), { target: { value: '12' } });
      // Category first: choosing one runs the account auto-picker, which prefers
      // "Revolut" (EUR here) and would drag the currency along with it. Picking
      // the RON account afterwards is what a user doing this deliberately does.
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });
      fireEvent.change(screen.getByLabelText(/account/i), { target: { value: 'a1' } });
      expect(screen.getByLabelText('Currency').value).toBe('RON');
      fireEvent.submit(document.querySelector('form'));

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      const [, data] = onSave.mock.calls[0];
      expect(data.amount).toBe(12);
      expect(data.originalAmount).toBeNull();
      expect(data.originalCurrency).toBe('');
    });

    it('asks for the RON amount when no rate is available', async () => {
      // BGN is still recordable but the ECB no longer quotes it.
      fetchRate.mockResolvedValue(null);
      const onSave = vi.fn().mockResolvedValue();
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} onSave={onSave} onCancel={vi.fn()} />);

      fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'BGN' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Sofia lunch' } });
      fireEvent.change(screen.getByLabelText('Amount *'), { target: { value: '40' } });
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'c1' } });
      fireEvent.submit(document.querySelector('form'));

      expect(onSave).not.toHaveBeenCalled();
      expect(await screen.findByText(/no exchange rate was available/i)).toBeDefined();
    });

    it('reopens an existing foreign transaction showing the original amount, not the RON one', () => {
      const initialTx = {
        id: 'tx1', description: 'Cafe in Vienna', amount: 42, originalAmount: 8.5,
        originalCurrency: 'EUR', date: '2026-01-01', type: 'Expense',
        categoryId: 'c1', accountId: 'a2', tags: []
      };
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} initialTx={initialTx} onSave={vi.fn()} onCancel={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByLabelText('Amount *').value).toBe('8.5');
      expect(screen.getByLabelText('Currency').value).toBe('EUR');
      expect(screen.getByLabelText('Amount in RON').value).toBe('42');
    });

    it('keeps the saved RON figure on open but re-derives it once the foreign amount changes', async () => {
      // Restating a saved transaction at today's rate would rewrite history; but
      // leaving RON alone after the foreign amount changes implied a nonsense
      // rate (20 EUR still showing 42 L).
      fetchRate.mockResolvedValue({ rate: 5, date: '2026-07-28' });
      const initialTx = {
        id: 'tx1', description: 'Cafe in Vienna', amount: 42, originalAmount: 8.5,
        originalCurrency: 'EUR', date: '2026-01-01', type: 'Expense',
        categoryId: 'c1', accountId: 'a2', tags: []
      };
      render(<TransactionForm categories={categories} accounts={multiCurrencyAccounts} initialTx={initialTx} onSave={vi.fn()} onCancel={vi.fn()} onDelete={vi.fn()} />);

      // Untouched: the stored figure survives even after the rate arrives.
      await new Promise(r => setTimeout(r, 20));
      expect(screen.getByLabelText('Amount in RON').value).toBe('42');

      fireEvent.change(screen.getByLabelText('Amount *'), { target: { value: '20' } });
      await waitFor(() => expect(screen.getByLabelText('Amount in RON').value).toBe('100'));
    });
  });
});
