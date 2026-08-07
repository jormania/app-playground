// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FilterSheet from './FilterSheet';

afterEach(() => {
  cleanup();
});

const categories = [{ id: 'cat1', name: 'Groceries', type: 'Expense', active: true }];

describe('FilterSheet — Unreconciled only', () => {
  it('defaults unchecked and reports true when toggled and applied', () => {
    const onApply = vi.fn();
    render(
      <FilterSheet
        isOpen filterType="All" categoryFilter="All" searchQuery=""
        categories={categories} onApply={onApply} onClose={vi.fn()}
      />
    );

    const checkbox = screen.getByLabelText('Unreconciled only');
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText('Apply Filters'));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ unreconciledOnly: true }));
  });

  it('opens pre-checked when the currently-applied filter has it on', () => {
    render(
      <FilterSheet
        isOpen filterType="All" categoryFilter="All" searchQuery="" unreconciledOnly
        categories={categories} onApply={vi.fn()} onClose={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Unreconciled only').checked).toBe(true);
  });

  it('Clear resets it back off', () => {
    const onApply = vi.fn();
    render(
      <FilterSheet
        isOpen filterType="All" categoryFilter="All" searchQuery="" unreconciledOnly
        categories={categories} onApply={onApply} onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByLabelText('Unreconciled only').checked).toBe(false);
  });
});
