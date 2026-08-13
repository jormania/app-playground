import { describe, it, expect } from 'vitest';
import { vendorKey, buildVendorMemory, lookupVendor, preferredAccountForTrip } from './vendorMemory';

function tx(description, categoryId, accountId, extra = {}) {
  return { description, categoryId, accountId, type: 'Expense', ...extra };
}

describe('vendorKey', () => {
  it('takes the venue after "at" or "from"', () => {
    expect(vendorKey('Groceries at Mega Image')).toBe('mega image');
    expect(vendorKey('Coffee from Origo')).toBe('origo');
  });

  it('uses the whole description when there is no venue', () => {
    expect(vendorKey('Netflix')).toBe('netflix');
  });

  it('strips the split markers so one vendor stays one vendor', () => {
    expect(vendorKey('Dinner at Kane (Split)')).toBe('kane');
    expect(vendorKey('Swimming at Otopeni (Nora)')).toBe('otopeni');
  });

  it('normalises punctuation and spacing', () => {
    expect(vendorKey("Dinner at  McDonald's! ")).toBe("mcdonald's");
  });

  it('returns empty for nothing useful', () => {
    expect(vendorKey('')).toBe('');
    expect(vendorKey(null)).toBe('');
  });
});

describe('buildVendorMemory', () => {
  it('learns the category and account you usually use', () => {
    const memory = buildVendorMemory([
      tx('Groceries at Mega Image', 'cat_food', 'acc_revolut'),
      tx('Groceries at Mega Image', 'cat_food', 'acc_revolut'),
      tx('Groceries at Mega Image', 'cat_food', 'acc_revolut'),
    ]);
    expect(memory).toEqual([
      { vendor: 'mega image', categoryId: 'cat_food', accountId: 'acc_revolut', count: 3 },
    ]);
  });

  it('ignores a vendor seen only once', () => {
    expect(buildVendorMemory([tx('Lunch at Japanos', 'cat_food', 'acc_revolut')])).toEqual([]);
  });

  it('drops a vendor with no dominant category', () => {
    const memory = buildVendorMemory([
      tx('Order at Glovo', 'cat_food', 'acc_revolut'),
      tx('Order at Glovo', 'cat_groceries', 'acc_revolut'),
    ]);
    expect(memory).toEqual([]);
  });

  it('keeps the category but drops an account with no majority', () => {
    const memory = buildVendorMemory([
      tx('Coffee at Origo', 'cat_food', 'acc_cash'),
      tx('Coffee at Origo', 'cat_food', 'acc_revolut'),
    ]);
    expect(memory).toEqual([
      { vendor: 'origo', categoryId: 'cat_food', accountId: null, count: 2 },
    ]);
  });

  it('skips transfers and uncategorised rows', () => {
    const memory = buildVendorMemory([
      { description: 'Top-up at Revolut', type: 'Transfer', categoryId: 'cat_food' },
      { description: 'Top-up at Revolut', type: 'Transfer', categoryId: 'cat_food' },
      tx('Lunch at Japanos', '', 'acc_revolut'),
      tx('Lunch at Japanos', '', 'acc_revolut'),
    ]);
    expect(memory).toEqual([]);
  });

  it('sorts by how often the vendor is used and caps the list', () => {
    const rows = [
      tx('A at Alpha', 'c1', 'a1'), tx('A at Alpha', 'c1', 'a1'),
      tx('B at Beta', 'c1', 'a1'), tx('B at Beta', 'c1', 'a1'), tx('B at Beta', 'c1', 'a1'),
    ];
    expect(buildVendorMemory(rows).map(v => v.vendor)).toEqual(['beta', 'alpha']);
    expect(buildVendorMemory(rows, { limit: 1 }).map(v => v.vendor)).toEqual(['beta']);
  });

  it('handles an empty ledger', () => {
    expect(buildVendorMemory([])).toEqual([]);
    expect(buildVendorMemory(undefined)).toEqual([]);
  });
});

describe('lookupVendor', () => {
  const memory = buildVendorMemory([
    tx('Groceries at Mega Image', 'cat_food', 'acc_revolut'),
    tx('Shopping at Mega Image', 'cat_food', 'acc_revolut'),
  ]);

  it('matches a new description against the same venue', () => {
    expect(lookupVendor(memory, 'Snacks at Mega Image')?.categoryId).toBe('cat_food');
  });

  it('returns null for an unknown venue', () => {
    expect(lookupVendor(memory, 'Lunch at Japanos')).toBeNull();
    expect(lookupVendor(memory, '')).toBeNull();
  });
});

describe('preferredAccountForTrip', () => {
  it('returns the account used for most of the trip', () => {
    const rows = [
      tx('Lunch', 'c1', 'acc_eur', { tripId: 't1' }),
      tx('Taxi', 'c1', 'acc_eur', { tripId: 't1' }),
      tx('Museum', 'c1', 'acc_cash', { tripId: 't1' }),
      tx('Groceries', 'c1', 'acc_revolut', { tripId: 't2' }),
    ];
    expect(preferredAccountForTrip(rows, 't1')).toBe('acc_eur');
  });

  it('returns null without a clear majority', () => {
    const rows = [
      tx('Lunch', 'c1', 'acc_eur', { tripId: 't1' }),
      tx('Taxi', 'c1', 'acc_cash', { tripId: 't1' }),
    ];
    expect(preferredAccountForTrip(rows, 't1')).toBeNull();
  });

  it('returns null for a trip with no history, or no trip', () => {
    expect(preferredAccountForTrip([], 't1')).toBeNull();
    expect(preferredAccountForTrip([tx('Lunch', 'c1', 'a1', { tripId: 't1' })], null)).toBeNull();
  });
});
