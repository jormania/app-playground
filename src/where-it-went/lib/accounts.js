/**
 * How an account is written wherever it appears.
 *
 * One helper rather than the same expression inlined in five components, because
 * the pieces are not obvious and they had already drifted: the transaction form
 * appended the currency, the ledger did not, the subscription editor showed a
 * bare name, and none of them showed the account's icon at all.
 *
 * The currency suffix is not decoration — two accounts may legitimately share a
 * name and differ only by currency (a RON and a EUR "Revolut" is a common real
 * setup), and then it is the *only* thing telling them apart.
 */
import { BASE_CURRENCY } from './fx';

/** "📱 Revolut" · "💶 Revolut (EUR)" · "Checking" when there is no icon. */
export function formatAccountLabel(account, { fallback = '—' } = {}) {
  if (!account || !account.name) return fallback;
  const icon = ''; // SVG used in components instead
  const suffix = account.currency && account.currency !== BASE_CURRENCY
    ? ` (${account.currency})`
    : '';
  return `${icon}${account.name}${suffix}`;
}

/** The same label, resolved from an id via a lookup map. */
export function accountLabelById(accountsById, id, options) {
  return formatAccountLabel(accountsById?.get(id), options);
}
