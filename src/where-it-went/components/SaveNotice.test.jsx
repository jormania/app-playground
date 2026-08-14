// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SaveNotice from './SaveNotice';

const CATEGORIES = [{ id: 'cat-travel', name: 'Travel' }, { id: 'cat-food', name: 'Groceries' }];
const ACCOUNTS = [{ id: 'acc-1', name: 'Revolut' }];
const TRIPS = [{ id: 'trip-poland', name: '2026 – Poland' }];

function show(notice, props = {}) {
  return render(
    <SaveNotice
      notice={notice}
      categories={CATEGORIES}
      accounts={ACCOUNTS}
      trips={TRIPS}
      {...props}
    />,
  );
}

afterEach(cleanup);

describe('SaveNotice', () => {
  it('renders nothing without a save to report', () => {
    const { container } = show(null);
    expect(container.firstChild).toBeNull();
  });

  it('reports an ordinary save, with no trip and no foreign currency in sight', () => {
    // The whole point of widening this beyond trips: most saves look like this
    // one, and they were the ones the app filed silently.
    show({ id: 'tx-1', action: 'create', others: 0, tx: { description: 'Lunch', amount: 42, categoryId: 'cat-food', accountId: 'acc-1' } });

    expect(screen.getByText('Lunch')).toBeDefined();
    expect(screen.getByText('Saved 42 L — filed under Groceries, from Revolut.')).toBeDefined();
  });

  it('pairs a foreign figure with what it converted to', () => {
    // Printing the RON figure against the foreign code — "82 PLN" for a 67 PLN
    // shop — reads as the app disagreeing with the row it just wrote.
    show({ id: 'tx-2', action: 'create', others: 0, tx: { description: 'Lunch at Restaurant', amount: 82, originalAmount: 67, originalCurrency: 'PLN', categoryId: 'cat-travel', tripId: 'trip-poland' } });

    expect(screen.getByText(/67 PLN \(82 L\)/)).toBeDefined();
    // Naming the trip isn't the same as saying one was attached.
    expect(screen.getByText(/on your ✈️ 2026 – Poland trip/)).toBeDefined();
  });

  it('says a trip was used even before that trip has loaded', () => {
    show({ id: 'tx-3', action: 'create', others: 0, tx: { description: 'Taxi', amount: 30, tripId: 'trip-unknown' } });
    expect(screen.getByText(/on your ✈️ ongoing trip/)).toBeDefined();
  });

  it('counts the rest of a batch', () => {
    show({ id: 'tx-4', action: 'create', others: 2, tx: { description: 'Lunch', amount: 42 } });
    expect(screen.getByText(/Same for 2 more\./)).toBeDefined();
  });

  it('says Updated for an edit', () => {
    show({ id: 'tx-5', action: 'update', others: 0, tx: { description: 'Gym membership', amount: 200, categoryId: 'cat-food' } });
    expect(screen.getByText(/^Updated 200 L/)).toBeDefined();
  });

  it('offers Change and nothing else — it leaves on its own', () => {
    const onChange = vi.fn();
    show({ id: 'tx-6', action: 'create', others: 0, tx: { description: 'Lunch', amount: 42 } }, { onChange });

    expect(screen.queryByText('Got it')).toBeNull();
    expect(screen.queryByText('Dismiss')).toBeNull();

    fireEvent.click(screen.getByText('Change'));
    expect(onChange).toHaveBeenCalledWith('tx-6');
  });

  it('drops Change when there is no single row to open', () => {
    // A Nora split writes two rows and reports no id — there'd be nothing for
    // the button to point at.
    show({ id: null, action: 'create', others: 1, tx: { description: 'Dinner', amount: 60 } }, { onChange: vi.fn() });
    expect(screen.queryByText('Change')).toBeNull();
  });

  it('announces itself, since it leaves before you might look', () => {
    show({ id: 'tx-7', action: 'create', others: 0, tx: { description: 'Lunch', amount: 42 } });
    expect(screen.getByRole('status')).toBeDefined();
  });
});
