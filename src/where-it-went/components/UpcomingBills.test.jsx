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
    expect(screen.getByText('🔁')).toBeDefined();
    expect(screen.getByText('💰')).toBeDefined();
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
    expect(screen.getByText(/\+8,940\.00/)).toBeDefined();
  });

  it('signs income and expense rows differently', () => {
    render(<UpcomingBills bills={bills} categories={categories} horizonDays={30} />);
    expect(screen.getByText('−60.00 L')).toBeDefined();
    expect(screen.getByText('+9,000.00 L')).toBeDefined();
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
});

describe('UpcomingBanner', () => {
  it('renders nothing at all when there is nothing due', () => {
    const { container } = render(<UpcomingBanner bills={[]} leadDays={5} />);
    expect(container.firstChild).toBeNull();
  });

  it('names the single bill rather than counting to one', () => {
    render(<UpcomingBanner bills={[bills[0]]} leadDays={5} />);
    expect(screen.getByText(/Netflix · 60\.00 L due in 5 days/)).toBeDefined();
  });

  it('summarises with a count and a total once there is more than one', () => {
    render(<UpcomingBanner bills={bills} leadDays={7} />);
    expect(screen.getByText(/2 bills due in the next 7 days/)).toBeDefined();
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
    expect(screen.getByText(/🔁 Netflix/)).toBeDefined();
  });
});
