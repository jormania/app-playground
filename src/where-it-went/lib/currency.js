export function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '0.00 RON';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' RON';
}
