import { useState, useEffect } from 'react';

export type JournalMode = 'full' | 'lite';

export const JOURNAL_MODE_KEY = 'daily-stoic:mode';

/** Per-day escape hatch: Lite is on, but this one day was opened in Full.
 *  Day-scoped so it lapses on its own — no settings trip to undo it. */
export function fullDayKey(dayOfYear: number): string {
  return `daily-stoic:full-day-${dayOfYear}`;
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
