/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SubscriptionEditorModal from './SubscriptionEditorModal';

describe('SubscriptionEditorModal', () => {
  const mockData = {
    categories: [
      { id: 'cat1', name: 'Food', icon: '🍔' }
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
});
