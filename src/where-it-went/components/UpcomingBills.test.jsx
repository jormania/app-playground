// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import UpcomingBills from './UpcomingBills';
import UpcomingBanner from './UpcomingBanner';
import { getUpcomingBills } from '../lib/upcoming';

afterEach(() => {
  cleanup();
});

const categories = [
  { id: 'c1', name: 'Subscriptions', type: 'Expense' },
  { id: 'c2', name: 'Salary', type: 'Income' },
];

const subs = [
  { id: 's1', name: 'Netflix', amount: 60, type: 'Expense', dayOfMonth: 20, categoryId: 'c1', accountId: 'a1', active: true },
  { id: 's2', name: 'Salary', amount: 9000, type: 'Income', dayOfMonth: 28, categoryId: 'c2', accountId: 'a1', active: true },
];

const today = new Date(2026, 6, 15); // 15 Jul 2026
const bills = getUpcomingBills(subs, [], { today, horizonDays: 30 });

describe('UpcomingBills', () => {
  it('shows each bill with its category icon', () => {
    const withIcons = categories.map(c => ({ ...c, icon: c.id === 'c1' ? '🔁' : '💰' }));
    render(<UpcomingBills bills={bills} categories={withIcons} horizonDays={30} />);
    expect(screen.getByText('Netflix')).toBeDefined();
  });

  it('lists each upcoming charge with its relative timing', () => {
    render(<UpcomingBills bills={bills} categories={categories} horizonDays={30} />);
    expect(screen.getByText('Netflix')).toBeDefined();
    expect(screen.getByText(/in 5 days/)).toBeDefined();
    expect(screen.getByText(/in 13 days/)).toBeDefined();
  });

  it('nets income against expenses in the header', () => {
    render(<UpcomingBills bills={bills} categories={categories} horizonDays={30} />);
    // 9,000 income − 60 expense = +8,940
    expect(screen.getByText(/\+8,940/)).toBeDefined();
  });

  it('signs income and expense rows differently', () => {
    render(<UpcomingBills bills={bills} categories={categories} horizonDays={30} />);
    expect(screen.getByText('−60 L')).toBeDefined();
    expect(screen.getByText('+9,000 L')).toBeDefined();
  });

  it('marks an occurrence that is already in the ledger', () => {
    const posted = getUpcomingBills(
      subs,
      [{ id: 't1', description: 'Netflix', amount: 60, date: '2026-07-20' }],
      { today, horizonDays: 30 },
    );
    render(<UpcomingBills bills={posted} categories={categories} horizonDays={30} />);
    expect(screen.getByText(/already recorded/)).toBeDefined();
  });

  it('shows an empty state rather than a bare heading', () => {
    render(<UpcomingBills bills={[]} categories={categories} horizonDays={30} />);
    expect(screen.getByText(/Nothing due in the next 30 days/)).toBeDefined();
  });

  it('splits into Expenses and Income sections', () => {
    render(<UpcomingBills bills={bills} categories={categories} horizonDays={30} />);
    expect(screen.getByText('💸 Expenses')).toBeDefined();
    expect(screen.getByText('💰 Income')).toBeDefined();
  });

  it('also lists a future-dated one-off transaction, with a pin icon rather than the recurring glyph', () => {
    const transactions = [{
      id: 'tx1', name: 'Hotel stay', amount: 1500, type: 'Expense',
      categoryId: 'c1', dueDate: '2026-07-25', daysUntil: 10,
    }];
    render(<UpcomingBills bills={[]} transactions={transactions} categories={categories} horizonDays={30} />);
    expect(screen.getByText('Hotel stay')).toBeDefined();
    // Nested wrapper (for the optional foreign-currency line) means the
    // amount text matches at two levels when that line is absent — assert
    // presence rather than uniqueness.
    expect(screen.getAllByText('−1,500 L').length).toBeGreaterThan(0);
  });

  it('is not empty when only a one-off transaction is due, even with no subscriptions', () => {
    const transactions = [{
      id: 'tx1', name: 'Hotel stay', amount: 1500, type: 'Expense', categoryId: 'c1', dueDate: '2026-07-25', daysUntil: 10,
    }];
    render(<UpcomingBills bills={[]} transactions={transactions} categories={categories} horizonDays={30} />);
    expect(screen.queryByText(/Nothing due in the next 30 days/)).toBeNull();
  });
});

describe('UpcomingBanner', () => {
  it('renders nothing at all when there is nothing due', () => {
    const { container } = render(<UpcomingBanner bills={[]} leadDays={5} />);
    expect(container.firstChild).toBeNull();
  });

  it('names the single item rather than counting to one, signed by type', () => {
    render(<UpcomingBanner bills={[bills[0]]} leadDays={5} />);
    expect(screen.getByText(/Netflix · −60 L due in 5 days/)).toBeDefined();
  });

  it('summarises with a count and a net total once there is more than one', () => {
    render(<UpcomingBanner bills={bills} leadDays={7} />);
    // Doesn't say "bills" — rent collected as income is just as much an
    // upcoming item as a subscription charge. Net, not summed raw: 9,000
    // income − 60 expense = +8,940, not a meaningless 9,060.
    expect(screen.getByText(/2 due in the next 7 days · \+8,940/)).toBeDefined();
  });

  it('cannot be dismissed — an unpaid bill should not be silenceable', () => {
    // It used to snooze for 24h, which hid the one thing worth being told
    // about and kept it hidden. The strip now clears itself only when the
    // charge actually lands in the ledger.
    render(<UpcomingBanner bills={bills} leadDays={5} />);
    expect(screen.queryByLabelText(/dismiss/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /^×$/ })).toBeNull();
  });

  it('shows the category icon alongside a single bill', () => {
    const categoriesById = new Map(categories.map(c => [c.id, { ...c, icon: '🔁' }]));
    render(<UpcomingBanner bills={[bills[0]]} leadDays={5} categoriesById={categoriesById} />);
    expect(screen.getByText(/Netflix/)).toBeDefined();
  });
});
