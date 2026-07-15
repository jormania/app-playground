import { useState } from 'react';
import { InsightPeriod } from '../utils/insightPeriod';

const STORAGE_KEY = 'daily-stoic:insight-period';
const VALID_PERIODS: InsightPeriod[] = ['cycle', 'quarter', 'year', 'all'];

function readStoredPeriod(): InsightPeriod {
  const saved = localStorage.getItem(STORAGE_KEY);
  return (VALID_PERIODS as string[]).includes(saved || '') ? (saved as InsightPeriod) : 'cycle';
}

/** The Stats/Amor Fati/Passions & Judgments/Spheres of Choice period filter
 *  is one shared, persisted choice — change it on any of those screens and
 *  it stays picked on the others too. Defaults to "cycle". */
export function useInsightPeriod(): [InsightPeriod, (period: InsightPeriod) => void] {
  const [period, setPeriodState] = useState<InsightPeriod>(readStoredPeriod);

  const setPeriod = (next: InsightPeriod) => {
    setPeriodState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return [period, setPeriod];
}
