export function applyFilters(transactions, { filterType, categoryFilter, searchQuery }, categoriesById, accountsById) {
  const q = (searchQuery || '').trim().toLowerCase();

  return (transactions || []).filter(t => {
    if (filterType && filterType !== 'All' && t.type !== filterType) return false;
    if (categoryFilter && categoryFilter !== 'All' && t.categoryId !== categoryFilter) return false;
    if (!q) return true;
    
    const desc = (t.description || '').toLowerCase();
    const cat = (categoriesById.get(t.categoryId)?.name || '').toLowerCase();
    const acc = (accountsById.get(t.accountId)?.name || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    const amountMatch = String(t.amount ?? '').includes(q);
    
    return desc.includes(q) || cat.includes(q) || acc.includes(q) || notes.includes(q) || amountMatch;
  });
}
