/**
 * Which account a new transaction should default to, given its category.
 *
 * This used to be an inline keyword walk in TransactionForm that matched on
 * account *name* alone. That breaks the moment two accounts share a name —
 * "Revolut" in RON and "Revolut" in EUR both match `revolut`, and whichever
 * Notion happened to return first won. Picking the EUR one silently turned an
 * ordinary domestic expense into a foreign-currency transaction.
 *
 * Preferences are therefore (name, currency) pairs, tried in order: an exact
 * name+currency match first, then name alone, then the first account there is.
 */

/** Base currency preferred for everyday accounts. */
const HOME = 'RON';

/**
 * Ordered preferences per category, most specific first.
 * `currency: null` means "any currency will do".
 */
export const EXPENSE_PREFERENCES = [
  { name: 'revolut', currency: HOME },
  { name: 'card', currency: HOME },
  { name: 'checking', currency: HOME },
  { name: 'revolut', currency: null },
  { name: 'checking', currency: null },
  { name: 'bank', currency: null },
  { name: 'cash', currency: null },
];

/**
 * Income is routed by where that kind of money actually arrives: a tenant pays
 * rent in cash, a loan is repaid into the current account, and so on.
 */
export const INCOME_PREFERENCES = [
  { match: ['salary', 'wage'], prefer: [
    { name: 'checking', currency: HOME }, { name: 'bank', currency: null }, { name: 'revolut', currency: HOME },
  ] },
  { match: ['loan'], prefer: [
    { name: 'checking', currency: HOME }, { name: 'bank', currency: null }, { name: 'revolut', currency: HOME },
  ] },
  { match: ['rent'], prefer: [
    { name: 'cash', currency: null }, { name: 'checking', currency: HOME },
  ] },
  { match: ['gift'], prefer: [
    { name: 'cash', currency: null }, { name: 'checking', currency: HOME },
  ] },
  { match: ['freelance'], prefer: [
    { name: 'revolut', currency: HOME }, { name: 'checking', currency: HOME }, { name: 'bank', currency: null },
  ] },
];

/** Fallback for an income category none of the rules recognise. */
export const INCOME_FALLBACK = [
  { name: 'checking', currency: HOME },
  { name: 'revolut', currency: HOME },
  { name: 'cash', currency: null },
];

function findAccount(accounts, { name, currency }) {
  return (accounts || []).find(a => {
    if (!a?.name) return false;
    if (!a.name.toLowerCase().includes(name)) return false;
    if (currency && (a.currency || HOME) !== currency) return false;
    return true;
  }) || null;
}

/** The ordered preference list that applies to a category. */
export function preferencesFor(category) {
  if (!category) return EXPENSE_PREFERENCES;
  if (category.type !== 'Income') return EXPENSE_PREFERENCES;

  const name = (category.name || '').toLowerCase();
  const rule = INCOME_PREFERENCES.find(r => r.match.some(m => name.includes(m)));
  return rule ? rule.prefer : INCOME_FALLBACK;
}

/**
 * The account to default to, or null when there are none to choose from.
 * Never invents an account — falls back to the first one that exists so the
 * form always has something valid selected.
 */
export function pickDefaultAccount(category, accounts) {
  if (!accounts || accounts.length === 0) return null;
  for (const preference of preferencesFor(category)) {
    const match = findAccount(accounts, preference);
    if (match) return match;
  }
  return accounts[0];
}
