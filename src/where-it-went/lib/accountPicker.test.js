import { describe, it, expect } from 'vitest';
import { pickDefaultAccount, preferencesFor } from './accountPicker';

// Mirrors the real Accounts database, which has *two* accounts called
// "Revolut" — one RON, one EUR — and no Cash account.
const realAccounts = [
  { id: 'a_checking', name: 'Checking', type: 'Bank', currency: 'RON' },
  { id: 'a_rev_ron', name: 'Revolut', type: 'Fintech', currency: 'RON' },
  { id: 'a_card', name: 'Credit Card', type: 'Fintech', currency: 'RON' },
  { id: 'a_rev_eur', name: 'Revolut', type: 'Fintech', currency: 'EUR' },
];

// Same, but with the EUR Revolut listed first — the order Notion returns rows
// in is not guaranteed, and the old name-only match was at its mercy.
const eurFirst = [
  { id: 'a_rev_eur', name: 'Revolut', type: 'Fintech', currency: 'EUR' },
  { id: 'a_rev_ron', name: 'Revolut', type: 'Fintech', currency: 'RON' },
  { id: 'a_checking', name: 'Checking', type: 'Bank', currency: 'RON' },
];

const withCash = [...realAccounts, { id: 'a_cash', name: 'Cash', type: 'Cash', currency: 'RON' }];

const cat = (name, type = 'Expense') => ({ id: `c_${name}`, name, type });

describe('pickDefaultAccount — expenses', () => {
  it('picks the RON Revolut, not the EUR one that shares its name', () => {
    // The whole point: an ordinary domestic expense must not silently become a
    // foreign-currency transaction because two accounts share a name.
    expect(pickDefaultAccount(cat('Dining'), realAccounts).id).toBe('a_rev_ron');
  });

  it('still picks the RON Revolut when the EUR one is listed first', () => {
    expect(pickDefaultAccount(cat('Dining'), eurFirst).id).toBe('a_rev_ron');
  });

  it('falls back to a card, then checking, when there is no Revolut', () => {
    const noRevolut = realAccounts.filter(a => !a.name.includes('Revolut'));
    expect(pickDefaultAccount(cat('Dining'), noRevolut).id).toBe('a_card');
    const onlyChecking = [{ id: 'a_checking', name: 'Checking', currency: 'RON' }];
    expect(pickDefaultAccount(cat('Dining'), onlyChecking).id).toBe('a_checking');
  });

  it('accepts a non-RON Revolut only when no RON account matches at all', () => {
    const eurOnly = [{ id: 'a_rev_eur', name: 'Revolut', currency: 'EUR' }];
    expect(pickDefaultAccount(cat('Dining'), eurOnly).id).toBe('a_rev_eur');
  });

  it('treats a missing currency as the home currency', () => {
    const untyped = [{ id: 'a_rev', name: 'Revolut' }];
    expect(pickDefaultAccount(cat('Dining'), untyped).id).toBe('a_rev');
  });
});

describe('pickDefaultAccount — income', () => {
  it('routes Salary to Checking', () => {
    expect(pickDefaultAccount(cat('Salary', 'Income'), withCash).id).toBe('a_checking');
  });

  it('routes Loan to Checking', () => {
    // Previously went to Revolut, which is not where a repayment lands.
    expect(pickDefaultAccount(cat('Loan', 'Income'), withCash).id).toBe('a_checking');
  });

  it('routes Rent to Cash', () => {
    expect(pickDefaultAccount(cat('Rent', 'Income'), withCash).id).toBe('a_cash');
  });

  it('routes Gift to Cash', () => {
    expect(pickDefaultAccount(cat('Gift', 'Income'), withCash).id).toBe('a_cash');
  });

  it('routes Freelance to the RON Revolut', () => {
    expect(pickDefaultAccount(cat('Freelance', 'Income'), withCash).id).toBe('a_rev_ron');
  });

  it('falls back to Checking when a cash-preferring category has no Cash account', () => {
    // The live database has no Cash account yet, so Rent and Gift have to land
    // somewhere sensible rather than on whatever happens to be first.
    expect(pickDefaultAccount(cat('Rent', 'Income'), realAccounts).id).toBe('a_checking');
    expect(pickDefaultAccount(cat('Gift', 'Income'), realAccounts).id).toBe('a_checking');
  });

  it('sends an unrecognised income category to Checking', () => {
    expect(pickDefaultAccount(cat('Refund', 'Income'), withCash).id).toBe('a_checking');
  });

  it('matches on a longer name containing the keyword', () => {
    expect(pickDefaultAccount(cat('Rental Income', 'Income'), withCash).id).toBe('a_cash');
  });
});

describe('edge cases', () => {
  it('returns null when there are no accounts', () => {
    expect(pickDefaultAccount(cat('Dining'), [])).toBeNull();
    expect(pickDefaultAccount(cat('Dining'), null)).toBeNull();
  });

  it('falls back to the first account when nothing matches', () => {
    const odd = [{ id: 'a_odd', name: 'Brokerage', currency: 'USD' }];
    expect(pickDefaultAccount(cat('Dining'), odd).id).toBe('a_odd');
  });

  it('treats a missing category as an expense', () => {
    expect(preferencesFor(null)).toBe(preferencesFor(cat('Anything')));
  });
});
