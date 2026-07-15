import { useCallback, useEffect, useState } from 'react';
import {
  Commitment,
  CommitmentInput,
  COMMITMENTS_KEY,
  COMMITMENTS_EVENT,
  addCommitment,
  parseCommitments,
  removeCommitment,
  reopenCommitment,
  resolveCommitment,
  serializeCommitments,
} from './commitments';

function read(): Commitment[] {
  if (typeof localStorage === 'undefined') return [];
  return parseCommitments(localStorage.getItem(COMMITMENTS_KEY));
}

function write(next: Commitment[]): void {
  localStorage.setItem(COMMITMENTS_KEY, serializeCommitments(next));
  // Notify sibling components in this tab (storage events only fire cross-tab).
  window.dispatchEvent(new Event(COMMITMENTS_EVENT));
}

export interface UseCommitments {
  commitments: Commitment[];
  add: (input: CommitmentInput) => Commitment[];
  resolve: (id: string, status: 'kept' | 'broken', resolvedDay: number, note?: string) => void;
  reopen: (id: string) => void;
  remove: (id: string) => void;
}

/** Live view over the Commitments ledger. Reads once, then stays in sync with
 *  every writer — sibling components in this tab (via COMMITMENTS_EVENT) and
 *  other tabs (via the native storage event). */
export function useCommitments(): UseCommitments {
  const [commitments, setCommitments] = useState<Commitment[]>(read);

  useEffect(() => {
    const refresh = () => setCommitments(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === COMMITMENTS_KEY || e.key === null) refresh();
    };
    window.addEventListener(COMMITMENTS_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    // Re-read on mount in case another component wrote before this one subscribed.
    refresh();
    return () => {
      window.removeEventListener(COMMITMENTS_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const add = useCallback((input: CommitmentInput) => {
    const next = addCommitment(read(), input);
    write(next);
    setCommitments(next);
    return next;
  }, []);

  const resolve = useCallback(
    (id: string, status: 'kept' | 'broken', resolvedDay: number, note?: string) => {
      const next = resolveCommitment(read(), id, status, resolvedDay, note);
      write(next);
      setCommitments(next);
    },
    [],
  );

  const reopen = useCallback((id: string) => {
    const next = reopenCommitment(read(), id);
    write(next);
    setCommitments(next);
  }, []);

  const remove = useCallback((id: string) => {
    const next = removeCommitment(read(), id);
    write(next);
    setCommitments(next);
  }, []);

  return { commitments, add, resolve, reopen, remove };
}
