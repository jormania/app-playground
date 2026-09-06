import { useState, useEffect } from 'react';

export type JournalMode = 'full' | 'lite';

export const JOURNAL_MODE_KEY = 'daily-stoic:mode';

/** Per-day escape hatch: Lite is on, but this one day was opened in Full.
 *  Day-scoped so it lapses on its own — no settings trip to undo it. */
export function fullDayKey(dayOfYear: number): string {
  return `daily-stoic:full-day-${dayOfYear}`;
}

/** Routes whose dashboards Lite starves of input — the worries list, the
 *  passions multi-select, the commitments ledger and the mentor's Council all
 *  come from steps Lite doesn't render. They stay in the code (and come back
 *  whole with Full); Lite just doesn't offer a door to a dashboard that can
 *  only get emptier. Memento Mori, the Enchiridion, Amor Fati, the Digest and
 *  Stats all still have Lite's own entries to draw on, so they stay. */
export const LITE_HIDDEN_ROUTES = ['dichotomy', 'passions', 'commitments', 'council'] as const;

/** Accepts either form the app uses — `'/dichotomy'` (a route) or
 *  `'dichotomy'` (a tab value). */
export function isHiddenInLite(route: string): boolean {
  return (LITE_HIDDEN_ROUTES as readonly string[]).includes(route.replace(/^\//, ''));
}

export function readFullForDay(dayOfYear: number): boolean {
  return localStorage.getItem(fullDayKey(dayOfYear)) === 'true';
}

export function readJournalMode(): JournalMode {
  return localStorage.getItem(JOURNAL_MODE_KEY) === 'lite' ? 'lite' : 'full';
}

/** Which journal the daily screen renders (Settings toggle, default Full so
 *  nothing changes for anyone who never flips it). Purely presentational —
 *  both modes read and write the same record through the same save path. */
export function useJournalMode(): JournalMode {
  const [mode, setMode] = useState<JournalMode>(() => readJournalMode());

  useEffect(() => {
    const handleUpdate = () => setMode(readJournalMode());
    window.addEventListener('daily-stoic:settings-updated', handleUpdate);
    return () => window.removeEventListener('daily-stoic:settings-updated', handleUpdate);
  }, []);

  return mode;
}

/** Whether Lite is what the user is actually looking at right now: the setting
 *  is on AND this day hasn't been opened in Full through the escape hatch.
 *  Both the journal screen and the app chrome read this, so the nav and the
 *  journal can never disagree about which mode is showing. */
export function useLiteActive(dayOfYear: number): boolean {
  const read = () => readJournalMode() === 'lite' && !readFullForDay(dayOfYear);
  const [active, setActive] = useState<boolean>(read);

  useEffect(() => {
    const update = () => setActive(read());
    update();
    window.addEventListener('daily-stoic:settings-updated', update);
    return () => window.removeEventListener('daily-stoic:settings-updated', update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOfYear]);

  return active;
}
