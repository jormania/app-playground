// The Commitments ledger — the accountability spine of the Socratic mentor.
//
// A commitment is a promise the practitioner makes in the morning ("I will…"),
// tied to a real friction they foresaw, and reckoned each evening as kept or
// broken. It is Seneca's nightly audit made concrete, and it works entirely
// offline with no AI key: the mentor (lib/mentor.ts) reads and drives *through*
// this ledger, but never owns it. Without a key the ledger is still a complete
// promise-and-reckon loop on its own.
//
// Storage is a single localStorage bucket (COMMITMENTS_KEY) holding a JSON
// array. Commitments span days — made on day X, reckoned on day Y — so they
// cannot live in the per-day reflection records the way worries and passions
// do. The pure functions here operate on plain arrays; useCommitments wraps
// persistence and cross-component reactivity around them.

export type CommitmentStatus = 'open' | 'kept' | 'broken';
export type CommitmentSource = 'self' | 'mentor';

export interface Commitment {
  id: string;
  /** The promise itself, phrased as an action ("I will…"). */
  text: string;
  /** The cycle day the promise was made on (matches the unbounded day count). */
  createdDay: number;
  createdAt: string;
  status: CommitmentStatus;
  /** The day the promise was reckoned (kept/broken). Absent while open. */
  resolvedDay?: number;
  resolvedAt?: string;
  /** Optional link to a Spheres-of-Choice worry the promise answers. */
  linkedWorryId?: string;
  /** Optional Cardinal Virtue this promise trains. */
  virtue?: string;
  /** Evening note — why it was kept or broken, or the next step. */
  note?: string;
  /** Whether the user wrote it themselves or accepted a mentor challenge. */
  source: CommitmentSource;
}

export interface CommitmentInput {
  text: string;
  createdDay: number;
  linkedWorryId?: string;
  virtue?: string;
  source?: CommitmentSource;
}

export interface LedgerStats {
  total: number;
  kept: number;
  broken: number;
  open: number;
  /** Kept as a share of *reckoned* (kept + broken) promises, 0–100. */
  keptRate: number;
}

export const COMMITMENTS_KEY = 'daily-stoic:commitments';
// Dispatched on window after any write so open ledgers in other components
// re-read (the same in-tab reactivity pattern as daily-stoic:settings-updated).
export const COMMITMENTS_EVENT = 'daily-stoic:commitments-updated';

const VALID_STATUS: CommitmentStatus[] = ['open', 'kept', 'broken'];

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Parse the stored ledger defensively — bad or partial entries are dropped
 *  rather than allowed to crash a render. Always returns a fresh array. */
export function parseCommitments(raw: string | null | undefined): Commitment[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: Commitment[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== 'string' || typeof c.text !== 'string') continue;
    const status = VALID_STATUS.includes(c.status as CommitmentStatus)
      ? (c.status as CommitmentStatus)
      : 'open';
    out.push({
      id: c.id,
      text: c.text,
      createdDay: typeof c.createdDay === 'number' ? c.createdDay : 0,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : '',
      status,
      resolvedDay: typeof c.resolvedDay === 'number' ? c.resolvedDay : undefined,
      resolvedAt: typeof c.resolvedAt === 'string' ? c.resolvedAt : undefined,
      linkedWorryId: typeof c.linkedWorryId === 'string' ? c.linkedWorryId : undefined,
      virtue: typeof c.virtue === 'string' ? c.virtue : undefined,
      note: typeof c.note === 'string' ? c.note : undefined,
      source: c.source === 'mentor' ? 'mentor' : 'self',
    });
  }
  return out;
}

export function serializeCommitments(list: Commitment[]): string {
  return JSON.stringify(list);
}

/** Build a new open commitment. `now`/`id` are injectable for deterministic tests. */
export function createCommitment(
  input: CommitmentInput,
  now: Date = new Date(),
  id: string = genId(),
): Commitment {
  return {
    id,
    text: input.text.trim(),
    createdDay: input.createdDay,
    createdAt: now.toISOString(),
    status: 'open',
    linkedWorryId: input.linkedWorryId,
    virtue: input.virtue,
    source: input.source ?? 'self',
  };
}

/** Prepend a new commitment (newest-first, matching the worries list). */
export function addCommitment(
  list: Commitment[],
  input: CommitmentInput,
  now: Date = new Date(),
  id: string = genId(),
): Commitment[] {
  const text = input.text.trim();
  if (!text) return list;
  return [createCommitment({ ...input, text }, now, id), ...list];
}

export function updateCommitment(
  list: Commitment[],
  id: string,
  patch: Partial<Commitment>,
): Commitment[] {
  return list.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c));
}

/** Reckon a promise as kept or broken on a given day. */
export function resolveCommitment(
  list: Commitment[],
  id: string,
  status: 'kept' | 'broken',
  resolvedDay: number,
  note?: string,
  now: Date = new Date(),
): Commitment[] {
  return list.map((c) =>
    c.id === id
      ? {
          ...c,
          status,
          resolvedDay,
          resolvedAt: now.toISOString(),
          note: note !== undefined ? note : c.note,
        }
      : c,
  );
}

/** Send a reckoned promise back to open (undo a kept/broken tap). */
export function reopenCommitment(list: Commitment[], id: string): Commitment[] {
  return list.map((c) =>
    c.id === id
      ? { ...c, status: 'open', resolvedDay: undefined, resolvedAt: undefined }
      : c,
  );
}

export function removeCommitment(list: Commitment[], id: string): Commitment[] {
  return list.filter((c) => c.id !== id);
}

export function openCommitments(list: Commitment[]): Commitment[] {
  return list.filter((c) => c.status === 'open');
}

/** Open promises whose day has come or passed — the debts due for reckoning. */
export function dueCommitments(list: Commitment[], day: number): Commitment[] {
  return list.filter((c) => c.status === 'open' && c.createdDay <= day);
}

export function commitmentsCreatedOn(list: Commitment[], day: number): Commitment[] {
  return list.filter((c) => c.createdDay === day);
}

export function commitmentsResolvedOn(list: Commitment[], day: number): Commitment[] {
  return list.filter((c) => c.resolvedDay === day);
}

/** Commitments made within an inclusive absolute-day-number range — the unit the
 *  cycle-aware period filter (utils/insightPeriod) works in. */
export function commitmentsInDayRange(
  list: Commitment[],
  startDay: number,
  endDay: number,
): Commitment[] {
  return list.filter((c) => c.createdDay >= startDay && c.createdDay <= endDay);
}

/** Consecutive kept promises, counting back from the most recently reckoned one.
 *  A broken promise ends the run; still-open promises are skipped (not yet failed). */
export function keptStreak(list: Commitment[]): number {
  const reckoned = list
    .filter((c) => c.status === 'kept' || c.status === 'broken')
    .sort((a, b) => (b.resolvedDay ?? 0) - (a.resolvedDay ?? 0));
  let streak = 0;
  for (const c of reckoned) {
    if (c.status === 'kept') streak += 1;
    else break;
  }
  return streak;
}

/** Ledger tallies, optionally scoped to a subset (e.g. one cycle's range). */
export function ledgerStats(
  list: Commitment[],
  predicate?: (c: Commitment) => boolean,
): LedgerStats {
  const scoped = predicate ? list.filter(predicate) : list;
  const kept = scoped.filter((c) => c.status === 'kept').length;
  const broken = scoped.filter((c) => c.status === 'broken').length;
  const open = scoped.filter((c) => c.status === 'open').length;
  const reckoned = kept + broken;
  return {
    total: scoped.length,
    kept,
    broken,
    open,
    keptRate: reckoned === 0 ? 0 : Math.round((kept / reckoned) * 100),
  };
}
