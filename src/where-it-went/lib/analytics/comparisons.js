import { TIME } from './constants';

function getTxDate(t) {
  return new Date(t.date);
}

export function getHistoricalAverages(allTransactions, categories, currentPeriodStr, now = new Date()) {
  const expenses = allTransactions.filter(t => t.type === 'Expense');
  
  // Calculate rolling 3 month average
  const averages = {};
  categories.forEach(c => averages[c.id] = { total: 0, count: 0, average: 0, monthsAssessed: TIME.HISTORICAL_MONTHS_LOOKBACK });

  if (currentPeriodStr === 'this_month') {
    // Look back 3 months
    for (let i = 1; i <= TIME.HISTORICAL_MONTHS_LOOKBACK; i++) {
      const historicalDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const hY = historicalDate.getFullYear();
      const hM = historicalDate.getMonth();
      
      const monthTx = expenses.filter(t => {
        const d = getTxDate(t);
        return d.getFullYear() === hY && d.getMonth() === hM;
      });

      categories.forEach(c => {
        const catTx = monthTx.filter(t => t.categoryId === c.id);
        const catTotal = catTx.reduce((a, b) => a + b.amount, 0);
        averages[c.id].total += catTotal;
      });
    }

    categories.forEach(c => {
      averages[c.id].average = averages[c.id].total / TIME.HISTORICAL_MONTHS_LOOKBACK;
    });
  }
  
  return averages;
}

export function getCumulativePaceByDay(allTransactions, dayOfMonth, currentPeriodStr, now = new Date()) {
  if (currentPeriodStr !== 'this_month') return null; // Pace only makes sense for current month in progress
  
  const expenses = allTransactions.filter(t => t.type === 'Expense');
  
  let historicalTotalToDay = 0;
  let historicalTotalFullMonth = 0;

  for (let i = 1; i <= TIME.HISTORICAL_MONTHS_LOOKBACK; i++) {
    const historicalDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const hY = historicalDate.getFullYear();
    const hM = historicalDate.getMonth();
    
    const monthTx = expenses.filter(t => {
      const d = getTxDate(t);
      return d.getFullYear() === hY && d.getMonth() === hM;
    });

    const fullMonthTotal = monthTx.reduce((a, b) => a + b.amount, 0);
    const toDayTotal = monthTx.filter(t => getTxDate(t).getDate() <= dayOfMonth).reduce((a, b) => a + b.amount, 0);

    historicalTotalFullMonth += fullMonthTotal;
    historicalTotalToDay += toDayTotal;
  }

  const averagePacePct = historicalTotalFullMonth > 0 ? (historicalTotalToDay / historicalTotalFullMonth) : 0;
  return averagePacePct;
}

export function getHistoricalTransactionAverages(allTransactions) {
  const expenses = allTransactions.filter(t => t.type === 'Expense');
  const catAverages = {};
  
  expenses.forEach(t => {
    if (!catAverages[t.categoryId]) {
      catAverages[t.categoryId] = { total: 0, count: 0, average: 0, max: 0 };
    }
    catAverages[t.categoryId].total += t.amount;
    catAverages[t.categoryId].count += 1;
    if (t.amount > catAverages[t.categoryId].max) {
      catAverages[t.categoryId].max = t.amount;
    }
  });

  Object.keys(catAverages).forEach(k => {
    catAverages[k].average = catAverages[k].total / catAverages[k].count;
  });

  return catAverages;
}
