const LEI = ' L';

/**
 * Money for display. Two decimals, because a ledger whose rows don't sum to its
 * total is worse than a slightly longer number (the old formatter rounded to whole
 * lei, so 12.50 rendered as "13 L" and 0.40 as "0 L").
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '0.00' + LEI;
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + LEI;
}

/**
 * Money for tight spaces — chart axes, tooltips, animated KPI counters — where
 * two decimals are noise. Rounds, so never use it where figures must reconcile.
 */
export function formatCurrencyCompact(amount) {
  if (amount === undefined || amount === null) return '0' + LEI;
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + LEI;
}
