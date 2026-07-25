export function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '0 L';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) + ' L';
}
