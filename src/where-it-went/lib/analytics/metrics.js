import { KEYWORDS, OBLIGATION_KEYWORDS, matchesAny } from './constants';

/** id → category, so classification isn't a linear scan per transaction. */
export function categoryIndex(categories) {
  const map = new Map();
  (categories || []).forEach(c => map.set(c.id, c));
  return map;
}

export function calculateMetrics(transactions, categories) {
  const byId = categoryIndex(categories);
  const getCatName = (id) => byId.get(id)?.name || 'Uncategorized';

  const expenses = transactions.filter(t => t.type === 'Expense');
  const incomes = transactions.filter(t => t.type === 'Income');

  const totalExpense = expenses.reduce((a, b) => a + b.amount, 0);
  const totalIncome = incomes.reduce((a, b) => a + b.amount, 0);
  const netCashFlow = totalIncome - totalExpense;

  let needsTotal = 0;
  let wantsTotal = 0;
  let unclassifiedTotal = 0;
  let investedOutflow = 0;
  let fixedCostsTotal = 0;
  let propertyTotal = 0;
  let taxesTotal = 0;
  let investingTotal = 0;

  const catSums = {};
  (categories || []).forEach(c => { catSums[c.id] = { id: c.id, name: c.name, type: c.type, total: 0 }; });

  expenses.forEach(tx => {
    const catName = getCatName(tx.categoryId).toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    const isObligation = matchesAny(desc, OBLIGATION_KEYWORDS);
    if (catSums[tx.categoryId]) catSums[tx.categoryId].total += tx.amount;

    if (matchesAny(catName, ['propert'])) propertyTotal += tx.amount;
    if (matchesAny(catName, ['=tax', '=taxes'])) taxesTotal += tx.amount;
    if (matchesAny(catName, ['invest'])) investingTotal += tx.amount;

    if (matchesAny(catName, ['hous', 'utilit', 'propert', 'subscript', 'rent', '=loan', '=tax', '=taxes']) || isObligation) {
      fixedCostsTotal += tx.amount;
    }

    if (matchesAny(catName, KEYWORDS.SAVINGS)) {
      // Money moved into savings/investments is not consumption — see savingsRate.
      investedOutflow += tx.amount;
    } else if (matchesAny(catName, KEYWORDS.NEEDS) || isObligation) {
      needsTotal += tx.amount;
    } else if (matchesAny(catName, KEYWORDS.WANTS)) {
      wantsTotal += tx.amount;
    } else {
      // Nothing matched. Still counted with Wants for the 50/30/20 bars, but tracked
      // separately so the UI can admit it guessed (it used to be silent).
      unclassifiedTotal += tx.amount;
      wantsTotal += tx.amount;
    }
  });

  // Consumption only: transfers into savings/investments are excluded, otherwise
  // putting money aside *lowered* the reported savings rate.
  const spendingExpense = totalExpense - investedOutflow;
  const savingsRate = totalIncome > 0 ? (totalIncome - spendingExpense) / totalIncome : 0;

  // Everything income didn't get consumed by: leftover cash plus explicit investing.
  const savingsBucket = totalIncome > 0 ? totalIncome - spendingExpense : investedOutflow;

  const investmentRate = totalIncome > 0 ? investingTotal / totalIncome : 0;
  const fixedCostsRatio = totalIncome > 0 ? fixedCostsTotal / totalIncome : 0;

  return {
    savingsRate,
    netCashFlow,
    investmentRate,
    fixedCostsRatio,
    totalIncome,
    totalExpense,
    spendingExpense,
    fixedCostsTotal,
    needsWantsSavings: {
      needs: needsTotal,
      wants: wantsTotal,
      savings: savingsBucket,
      unclassified: unclassifiedTotal,
      investedOutflow
    },
    overviews: { property: propertyTotal, taxes: taxesTotal },
    catSums
  };
}
