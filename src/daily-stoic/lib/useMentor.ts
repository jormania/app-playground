import { useCallback, useEffect, useState } from 'react';
import {
  MentorPrompt,
  requestMentor,
  MENTOR_KEY_STORAGE,
  MENTOR_ENABLED_STORAGE,
} from './mentor';

export function getMentorKey(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(MENTOR_KEY_STORAGE) || '';
}

/** The mentor is available only when explicitly enabled AND a key is present —
 *  so an accidental empty key never renders the AI surfaces. */
export function isMentorEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return (
    localStorage.getItem(MENTOR_ENABLED_STORAGE) === 'true' && getMentorKey().trim().length > 0
  );
}

/** Reactive `isMentorEnabled()` — re-reads when Settings toggles the key or the
 *  switch (via the daily-stoic:settings-updated event) or another tab writes. */
export function useMentorEnabled(): boolean {
  const [enabled, setEnabled] = useState(isMentorEnabled);
  useEffect(() => {
    const refresh = () => setEnabled(isMentorEnabled());
    window.addEventListener('daily-stoic:settings-updated', refresh);
    window.addEventListener('storage', refresh);
    refresh();
    return () => {
      window.removeEventListener('daily-stoic:settings-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return enabled;
}

export interface UseMentor {
  reply: string | null;
  isPending: boolean;
  error: string | null;
  ask: (prompt: MentorPrompt) => Promise<void>;
  reset: () => void;
}

/** Ask the Socratic mentor for a reply. Ephemeral by design — the result lives
 *  only in this hook's state, never persisted; asking again replaces it. */
export function useMentor(): UseMentor {
  const [reply, setReply] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (prompt: MentorPrompt) => {
    setIsPending(true);
    setError(null);
    try {
      const text = await requestMentor(getMentorKey(), prompt);
      setReply(text);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'The mentor could not be reached.');
    } finally {
      setIsPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setReply(null);
    setError(null);
  }, []);

  return { reply, isPending, error, ask, reset };
}
