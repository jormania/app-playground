import { KEYWORDS } from './constants';

export function calculateMetrics(transactions, categories) {
  const expenses = transactions.filter(t => t.type === 'Expense');
  const incomes = transactions.filter(t => t.type === 'Income');
  
  const totalExpense = expenses.reduce((a, b) => a + b.amount, 0);
  const totalIncome = incomes.reduce((a, b) => a + b.amount, 0);
  const netCashFlow = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;

  const getCatName = (id) => categories.find(c => c.id === id)?.name || 'Uncategorized';

  let needsTotal = 0;
  let wantsTotal = 0;
  let savingsTotal = 0;
  let fixedCostsTotal = 0;
  let propertyTotal = 0;
  let taxesTotal = 0;
  let investingTotal = 0;

  const catSums = {};
  categories.forEach(c => catSums[c.id] = { id: c.id, name: c.name, type: c.type, total: 0 });

  expenses.forEach(tx => {
    const catName = getCatName(tx.categoryId).toLowerCase();
    if (catSums[tx.categoryId]) catSums[tx.categoryId].total += tx.amount;

    if (catName.includes('propert')) propertyTotal += tx.amount;
    if (catName.includes('tax')) taxesTotal += tx.amount;
    if (catName.includes('invest')) investingTotal += tx.amount;
    
    if (catName.includes('hous') || catName.includes('utilit') || catName.includes('propert') || catName.includes('subscript') || catName.includes('rent')) {
      fixedCostsTotal += tx.amount;
    }

    if (KEYWORDS.SAVINGS.some(k => catName.includes(k))) {
      savingsTotal += tx.amount;
    } else if (KEYWORDS.NEEDS.some(k => catName.includes(k))) {
      needsTotal += tx.amount;
    } else if (KEYWORDS.WANTS.some(k => catName.includes(k))) {
      wantsTotal += tx.amount;
    } else {
      wantsTotal += tx.amount;
    }
  });

  const investmentRate = totalIncome > 0 ? investingTotal / totalIncome : 0;
  const fixedCostsRatio = totalIncome > 0 ? fixedCostsTotal / totalIncome : 0;

  return {
    savingsRate,
    netCashFlow,
    investmentRate,
    fixedCostsRatio,
    totalIncome,
    totalExpense,
    needsWantsSavings: { needs: needsTotal, wants: wantsTotal, savings: savingsTotal },
    overviews: { property: propertyTotal, taxes: taxesTotal },
    catSums
  };
}
