/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import SubscriptionEditorModal from './SubscriptionEditorModal';

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

    expect(screen.getByText('Save').closest('button').disabled).toBe(true);
  });
});
