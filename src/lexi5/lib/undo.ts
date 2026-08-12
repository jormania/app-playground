import { readJson, writeJson, removeJson } from '../../shared/storage'

/**
 * One-step undo for the three destructive actions.
 *
 * Reset Statistics, Clear List and Refresh Word List each destroy unrecoverable local
 * state behind a single confirmation — and Refresh silently discards the current list's
 * cycle progress along with it. Everything they destroy already lives in `localStorage`,
 * so snapshotting the affected keys before the write costs almost nothing and turns three
 * one-way doors into recoverable actions.
 *
 * Deliberately a single slot: this backs the "Undo" affordance on the toast that already
 * fires, which is only reachable until that toast clears. A stack would imply a history
 * the UI doesn't offer.
 */

const UNDO_KEY = 'lexi5_undo'

/** Keys each undoable action is responsible for restoring. */
export type UndoScope = 'stats' | 'customList'

interface UndoRecord {
  scope: UndoScope
  label: string
  values: Record<string, unknown>
  at: number
}

export const UNDO_SCOPES: Record<UndoScope, string[]> = {
  stats: ['lexi5_stats'],
  customList: [
    'lexi5_custom_dict',
    'lexi5_custom_dict_epoch',
    'lexi5_custom_dict_theme',
  ],
}

/**
 * Snapshots the keys in `scope` so the action about to run can be reversed.
 * @param label what the player will be offered — e.g. "Statistics reset"
 */
export function snapshot(scope: UndoScope, label: string): void {
  const keys = UNDO_SCOPES[scope]
  if (!keys) return
  const values: Record<string, unknown> = {}
  for (const key of keys) {
    // null is a meaningful value here: it records "this key did not exist", so undoing a
    // first-ever curation removes the list rather than leaving it in place.
    values[key] = readJson(key, null)
  }
  writeJson(UNDO_KEY, { scope, label, values, at: Date.now() })
}

/** The pending undo, or null. */
export function peekUndo(): UndoRecord | null {
  const stored = readJson<UndoRecord | null>(UNDO_KEY, null)
  if (!stored || !stored.scope || !UNDO_SCOPES[stored.scope]) return null
  return stored
}

/**
 * Restores the last snapshot.
 * @returns what was restored, or null if nothing was pending
 */
export function applyUndo(): { scope: UndoScope; label: string } | null {
  const stored = peekUndo()
  if (!stored) return null
  for (const [key, value] of Object.entries(stored.values)) {
    if (value === null) removeJson(key)
    else writeJson(key, value)
  }
  removeJson(UNDO_KEY)
  return { scope: stored.scope, label: stored.label }
}

/** Drops the pending snapshot — call once its offer has expired. */
export function clearUndo(): void {
  removeJson(UNDO_KEY)
}
