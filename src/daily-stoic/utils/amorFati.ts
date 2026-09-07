/**
 * A day can hold more than one obstacle, so Lite keeps them as a short list
 * inside the one `FateInput` string, joined by a separator rather than a
 * newline: Notion stores one readable line, the Amor Fati retrospective and
 * its word cloud read it exactly as they always did, and Full's single-line
 * field round-trips a multi-entry day untouched.
 *
 * The editor always edits the LAST entry, so there is no draft state to lose:
 * "Add another" simply pushes an empty segment onto the end.
 */
export const ENTRY_SEPARATOR = ' · ';

export interface FateEntries {
  /** Entries already committed — rendered above the box. */
  previous: string[];
  /** The one the box is editing. */
  current: string;
}

export function splitEntries(fateInput: string): FateEntries {
  const parts = (fateInput || '').split(ENTRY_SEPARATOR);
  return {
    previous: parts.slice(0, -1).map((p) => p.trim()).filter(Boolean),
    current: parts[parts.length - 1] ?? '',
  };
}

/** What actually gets saved: every entry trimmed, blanks dropped (including
 *  the empty one "Add another" leaves behind when the day ends there). */
export function normalizeFateInput(fateInput: string): string {
  return (fateInput || '')
    .split(ENTRY_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(ENTRY_SEPARATOR);
}
