import { describe, it, expect } from 'vitest';
import {
  DEMO_CATEGORIES, DEMO_ACCOUNTS, DEMO_TRANSACTIONS,
  DEMO_SUBSCRIPTIONS, DEMO_TRIPS,
} from './demoData';

/**
 * The fixture is keyed by id everywhere — `categories.find(c => c.id === …)`,
 * React list keys, the account picker, the duplicate scanner. A repeated id is
 * therefore silent and confusing rather than loud: `find` simply returns the
 * wrong record.
 *
 * This has bitten twice. First when the multi-currency rows reused
 * `demo_tx_31`/`demo_tx_32`, and again when a new income "Gift" category was
 * given `cat_gift`, which the *expense* category "Gifts" already held — so
 * choosing Gift as income silently resolved to the expense category and routed
 * the transaction to the wrong default account.
 */
const duplicates = (values) => {
  const seen = new Map();
  values.forEach(v => seen.set(v, (seen.get(v) || 0) + 1));
  return [...seen.entries()].filter(([, n]) => n > 1).map(([v]) => v);
};

describe('demo fixture ids are unique', () => {
  it.each([
    ['categories', DEMO_CATEGORIES],
    ['accounts', DEMO_ACCOUNTS],
    ['transactions', DEMO_TRANSACTIONS],
    ['subscriptions', DEMO_SUBSCRIPTIONS],
    ['trips', DEMO_TRIPS],
  ])('%s have no repeated id', (_label, rows) => {
    expect(duplicates((rows || []).map(r => r.id))).toEqual([]);
  });

  it('no id is shared across two different collections', () => {
    const all = [
      ...DEMO_CATEGORIES, ...DEMO_ACCOUNTS, ...DEMO_TRANSACTIONS,
      ...DEMO_SUBSCRIPTIONS, ...DEMO_TRIPS,
    ].map(r => r.id);
    expect(duplicates(all)).toEqual([]);
  });
});

describe('demo fixture is internally consistent', () => {
  it('every transaction points at a real account', () => {
    const ids = new Set(DEMO_ACCOUNTS.map(a => a.id));
    const orphans = DEMO_TRANSACTIONS.filter(t => t.accountId && !ids.has(t.accountId));
    expect(orphans.map(t => `${t.id}->${t.accountId}`)).toEqual([]);
  });

  it('every transaction points at a real category, or none at all', () => {
    const ids = new Set(DEMO_CATEGORIES.map(c => c.id));
    const orphans = DEMO_TRANSACTIONS.filter(t => t.categoryId && !ids.has(t.categoryId));
    expect(orphans.map(t => `${t.id}->${t.categoryId}`)).toEqual([]);
  });

  it('a transfer names two different real accounts', () => {
    const ids = new Set(DEMO_ACCOUNTS.map(a => a.id));
    const transfers = DEMO_TRANSACTIONS.filter(t => t.type === 'Transfer');
    expect(transfers.length).toBeGreaterThan(0);
    for (const t of transfers) {
      expect(ids.has(t.accountId)).toBe(true);
      expect(ids.has(t.toAccountId)).toBe(true);
      expect(t.accountId).not.toBe(t.toAccountId);
    }
  });

  it('every subscription points at a real category and account', () => {
    const cats = new Set(DEMO_CATEGORIES.map(c => c.id));
    const accs = new Set(DEMO_ACCOUNTS.map(a => a.id));
    for (const sub of DEMO_SUBSCRIPTIONS) {
      expect(cats.has(sub.categoryId)).toBe(true);
      expect(accs.has(sub.accountId)).toBe(true);
    }
  });

  it('keeps two same-named accounts in different currencies, mirroring real setups', () => {
    // The account picker has to disambiguate by currency; without this pair in
    // the fixture that path is never exercised.
    const revolut = DEMO_ACCOUNTS.filter(a => /revolut/i.test(a.name));
    expect(revolut.length).toBeGreaterThanOrEqual(2);
    expect(new Set(revolut.map(a => a.currency)).size).toBeGreaterThanOrEqual(2);
  });
});
