/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import SubscriptionEditorModal from './SubscriptionEditorModal';
import { fetchRate } from '../lib/fx';

// Never hit the network from a unit test; each case sets the rate it needs.
vi.mock('../lib/fx', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchRate: vi.fn(),
}));

beforeEach(() => {
  fetchRate.mockReset();
  fetchRate.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

describe('SubscriptionEditorModal', () => {
  const mockData = {
    categories: [
      { id: 'cat1', name: 'Food', icon: '🍔', type: 'Expense' }
    ],
    accounts: [
      { id: 'acc1', name: 'Revolut' }
    ]
  };
  const multiCurrencyData = {
    ...mockData,
    accounts: [
      { id: 'acc1', name: 'Revolut RON', currency: 'RON' },
      { id: 'acc2', name: 'Revolut EUR', currency: 'EUR' },
    ],
  };

  it('renders correctly when adding a new subscription', () => {
    render(
      <SubscriptionEditorModal
        isOpen={true}
        onClose={vi.fn()}
        data={mockData}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getAllByText('Add Subscription')[0]).toBeDefined();
    expect(screen.getByLabelText(/Name/i)).toBeDefined();
  });

  it('renders correctly when editing an existing subscription', () => {
    const mockSub = {
      id: 'sub1',
      name: 'Netflix',
      amount: 60,
      type: 'Expense',
      dayOfMonth: 5,
      categoryId: 'cat1',
      accountId: 'acc1',
      active: true
    };

    render(
      <SubscriptionEditorModal
        isOpen={true}
        onClose={vi.fn()}
        sub={mockSub}
        data={mockData}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Edit Subscription')).toBeDefined();
    expect(screen.getByDisplayValue('Netflix')).toBeDefined();
    expect(screen.getByDisplayValue('60')).toBeDefined();
  });

  it('does not crash if data categories or accounts are missing', () => {
    render(
      <SubscriptionEditorModal
        isOpen={true}
        onClose={vi.fn()}
        data={{}}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getAllByText('Add Subscription')[0]).toBeDefined();
  });

  it('submits a filled-in form and calls onSave with the parsed values', async () => {
    const onSave = vi.fn().mockResolvedValue();
    const onClose = vi.fn();
    render(
      <SubscriptionEditorModal
        isOpen={true}
        onClose={onClose}
        data={mockData}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Netflix' } });
    fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText(/Day of Month/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: 'cat1' } });
    fireEvent.change(screen.getByLabelText(/Account/i), { target: { value: 'acc1' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null, expect.objectContaining({
      name: 'Netflix', amount: 60, dayOfMonth: 5, categoryId: 'cat1', accountId: 'acc1'
    })));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('rejects a day-of-month outside 1-31 instead of silently posting it', () => {
    render(
      <SubscriptionEditorModal
        isOpen={true}
        onClose={vi.fn()}
        data={mockData}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Rent' } });
    fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/Day of Month/i), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: 'cat1' } });
    fireEvent.change(screen.getByLabelText(/Account/i), { target: { value: 'acc1' } });

    fireEvent.submit(screen.getByText('Save').closest('form'));
    expect(screen.getByRole('alert').textContent).toContain('Fill in every required field');
  });

  describe('currency', () => {
    it('defaults the currency to the selected account and shows no RON helper for RON', () => {
      render(<SubscriptionEditorModal isOpen={true} onClose={vi.fn()} data={multiCurrencyData} onSave={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByLabelText('Currency').value).toBe('RON');
      expect(screen.queryByLabelText('Amount in RON')).toBeNull();
    });

    it('adopts the EUR account currency and converts to RON at the fetched rate', async () => {
      fetchRate.mockResolvedValue({ rate: 5, date: '2026-07-28' });
      const onSave = vi.fn().mockResolvedValue();
      render(<SubscriptionEditorModal isOpen={true} onClose={vi.fn()} data={multiCurrencyData} onSave={onSave} onDelete={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/Account/i), { target: { value: 'acc2' } }); // Revolut EUR
      await waitFor(() => expect(screen.getByLabelText('Currency').value).toBe('EUR'));

      fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Spotify' } });
      fireEvent.change(screen.getByLabelText('Amount *'), { target: { value: '10' } });
      await waitFor(() => expect(screen.getByLabelText('Amount in RON').value).toBe('50'));

      fireEvent.change(screen.getByLabelText(/Day of Month/i), { target: { value: '5' } });
      fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: 'cat1' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => expect(onSave).toHaveBeenCalledWith(null, expect.objectContaining({
        amount: 50, originalAmount: 10, originalCurrency: 'EUR',
      })));
    });

    it('resets a hand-picked currency when the account is changed', async () => {
      render(<SubscriptionEditorModal isOpen={true} onClose={vi.fn()} data={multiCurrencyData} onSave={vi.fn()} onDelete={vi.fn()} />);
      fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });
      expect(screen.getByLabelText('Currency').value).toBe('USD');
      fireEvent.change(screen.getByLabelText(/Account/i), { target: { value: 'acc2' } }); // Revolut EUR
      await waitFor(() => expect(screen.getByLabelText('Currency').value).toBe('EUR'));
    });

    it('reopening an existing foreign subscription keeps its saved RON figure', () => {
      const mockSub = {
        id: 'sub1', name: 'Adobe', amount: 50, originalAmount: 10, originalCurrency: 'EUR',
        type: 'Expense', dayOfMonth: 15, categoryId: 'cat1', accountId: 'acc2', active: true,
      };
      render(<SubscriptionEditorModal isOpen={true} onClose={vi.fn()} sub={mockSub} data={multiCurrencyData} onSave={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByDisplayValue('10')).toBeDefined(); // the foreign amount, in the main field
      expect(screen.getByLabelText('Amount in RON').value).toBe('50');
      expect(screen.getByLabelText('Currency').value).toBe('EUR');
    });
  });
});
