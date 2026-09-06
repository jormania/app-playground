import { ReflectionRecord } from '../services/NotionService';

// Lite has no dashboards to visit, so the one worthwhile look backwards comes
// to the user instead: after saving, the obstacle they logged 30, 90 or 365
// days ago — the same "trivialized obstacles" idea as the Amor Fati
// retrospective, narrowed to a single card.
export const LITE_LOOKBACKS = [30, 90, 365] as const;

export interface LiteRetrospective {
  record: ReflectionRecord;
  daysAgo: number;
}

/** Nearest lookback first. Only records with something written in FateInput
 *  qualify — an empty obstacle is not worth surfacing. `dayOfYear` is the
 *  app's unbounded cycle day, which is also the Notion QuoteID. */
export function pickLiteRetrospective(
  reflections: ReflectionRecord[],
  dayOfYear: number
): LiteRetrospective | null {
  for (const daysAgo of LITE_LOOKBACKS) {
    const target = dayOfYear - daysAgo;
    if (target < 1) continue;
    const record = reflections.find(
      (r) => r.quoteId === target && (r.fateInput || '').trim().length > 0
    );
    if (record) return { record, daysAgo };
  }
  return null;
}
