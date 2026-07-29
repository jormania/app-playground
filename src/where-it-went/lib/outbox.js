/**
 * Offline reads and optimistic writes.
 *
 * Before this, the service worker cached the app shell but every `/api/notion`
 * call is a POST and none of them are cached, so opening the app offline showed
 * the shell and then the error card — the ledger you already downloaded a
 * minute ago was simply gone.
 *
 * Two halves:
 *   - a mirror of the last successful load, so the app can paint immediately
 *     and survive a failed refresh;
 *   - a FIFO outbox of writes, applied locally at once and flushed to Notion
 *     when it's reachable.
 *
 * Nothing here touches the service worker. It stays cache-first for assets with
 * its production-only registration guard, exactly as CLAUDE.md requires.
 */
import { readJson, writeJson } from './storage';

const SNAPSHOT_KEY = 'whereItWent_snapshot';
const OUTBOX_KEY = 'whereItWent_outbox';
const FAILED_KEY = 'whereItWent_outbox_failed';

/** Temp ids are recognisable so the UI can mark a row as not-yet-synced. */
export const LOCAL_ID_PREFIX = 'local_tx_';

export function isLocalId(id) {
  return typeof id === 'string' && id.startsWith(LOCAL_ID_PREFIX);
}

export function newLocalId() {
  return `${LOCAL_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- snapshot ---------------------------------------------------------------

/** Mirror the last good load so a later launch has something to show. */
export function saveSnapshot(data) {
  if (!data) return;
  writeJson(SNAPSHOT_KEY, { savedAt: Date.now(), data });
}

/** The mirrored data, or null if there's never been a successful load. */
export function readSnapshot() {
  const raw = readJson(SNAPSHOT_KEY, null);
  if (!raw || !raw.data) return null;
  return { savedAt: raw.savedAt || null, data: raw.data };
}

export function clearSnapshot() {
  writeJson(SNAPSHOT_KEY, null);
}

// --- outbox -----------------------------------------------------------------

export function readOutbox() {
  const items = readJson(OUTBOX_KEY, []);
  return Array.isArray(items) ? items : [];
}

export function writeOutbox(items) {
  writeJson(OUTBOX_KEY, items);
}

export function readFailed() {
  const items = readJson(FAILED_KEY, []);
  return Array.isArray(items) ? items : [];
}

export function writeFailed(items) {
  writeJson(FAILED_KEY, items);
}

/** Queue one write. Order is preserved — it's the whole point. */
export function enqueue(op, payload) {
  const items = readOutbox();
  const item = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    op,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  writeOutbox([...items, item]);
  return item;
}

/**
 * Apply a queued write to an in-memory transaction list, so the UI reflects it
 * before Notion has heard about it.
 */
export function applyLocally(transactions, item) {
  const list = [...(transactions || [])];
  if (item.op === 'add') {
    return [{ ...item.payload, id: item.payload.id, pending: true }, ...list];
  }
  if (item.op === 'update') {
    return list.map(t => (t.id === item.payload.id ? { ...t, ...item.payload.updates, pending: true } : t));
  }
  if (item.op === 'delete') {
    return list.filter(t => t.id !== item.payload.id);
  }
  return list;
}

/** Is this failure worth retrying, or is the request itself wrong? */
export function isRetryable(error) {
  const status = error?.status;
  if (status === undefined || status === null) return true; // network-level
  if (status === 0) return true;
  if (status === 429 || status >= 500) return true;
  return false; // a 4xx won't fix itself by being sent again
}

/**
 * Send queued writes to Notion, oldest first.
 *
 * **Stops at the first retryable failure** rather than skipping ahead. Writes
 * were queued in the order they were made, and reordering them can resurrect a
 * deleted row or apply an edit to something that doesn't exist yet — the same
 * policy the subscriptions engine already uses when a charge fails to post.
 *
 * Returns a summary; never throws.
 */
export async function flushOutbox(client, { onProgress } = {}) {
  const queue = readOutbox();
  if (queue.length === 0) return { sent: 0, failed: 0, remaining: 0, idMap: {} };

  const idMap = {};
  let sent = 0;
  const failures = [];
  let index = 0;

  for (; index < queue.length; index++) {
    const item = queue[index];
    try {
      if (item.op === 'add') {
        const created = await client.addTransaction(item.payload);
        if (created?.id) idMap[item.payload.id] = created.id;
      } else if (item.op === 'update') {
        const realId = idMap[item.payload.id] || item.payload.id;
        await client.updateTransaction(realId, item.payload.updates);
      } else if (item.op === 'delete') {
        const realId = idMap[item.payload.id] || item.payload.id;
        await client.deleteTransaction(realId);
      }
      sent++;
      if (onProgress) onProgress(sent, queue.length);
    } catch (error) {
      if (isRetryable(error)) {
        // Leave this and everything after it queued, in order.
        break;
      }
      // Permanently rejected: park it where the user can see the real reason
      // rather than dropping it silently.
      failures.push({ ...item, lastError: error?.message || 'Rejected by Notion' });
      continue;
    }
  }

  // Everything from the first retryable failure onwards stays queued, in order.
  // Items already parked as failures sit before `index`, so they're excluded.
  const stillQueued = queue.slice(index);
  writeOutbox(stillQueued);
  if (failures.length > 0) writeFailed([...readFailed(), ...failures]);

  return { sent, failed: failures.length, remaining: stillQueued.length, idMap };
}

/** Drop a permanently-failed job the user has decided to abandon. */
export function discardFailed(jobId) {
  writeFailed(readFailed().filter(j => j.id !== jobId));
}

/** Put a failed job back at the front of the queue for another go. */
export function retryFailed(jobId) {
  const failed = readFailed();
  const job = failed.find(j => j.id === jobId);
  if (!job) return false;
  writeFailed(failed.filter(j => j.id !== jobId));
  writeOutbox([{ ...job, attempts: (job.attempts || 0) + 1, lastError: undefined }, ...readOutbox()]);
  return true;
}

/** Are we currently able to reach the network at all? */
export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * Wrap a NotionClient so transaction writes fall back to the outbox.
 *
 * Built with `Object.create` rather than a spread: NotionClient is a class, so
 * its methods live on the prototype and a spread would copy none of them. This
 * way every other method (fetches, subscriptions, trips, scrub) passes straight
 * through, and every existing call site gets offline support without changing.
 *
 * A write is queued when the device is offline, or when a send fails for a
 * reason that could plausibly succeed later. A request Notion actively rejects
 * still throws, so the form shows the real error instead of pretending to save.
 */
export function createOfflineClient(client) {
  const wrapper = Object.create(client);

  const attempt = async (direct, queueOp, queuePayload, result) => {
    if (isOnline()) {
      try {
        return await direct();
      } catch (error) {
        if (!isRetryable(error)) throw error;
      }
    }
    enqueue(queueOp, queuePayload);
    return result;
  };

  wrapper.addTransaction = async (tx) => {
    const localId = newLocalId();
    return attempt(
      () => client.addTransaction(tx),
      'add',
      { ...tx, id: localId },
      { id: localId, pending: true },
    );
  };

  wrapper.updateTransaction = async (txId, updates) =>
    attempt(
      () => client.updateTransaction(txId, updates),
      'update',
      { id: txId, updates },
      { id: txId, pending: true },
    );

  wrapper.deleteTransaction = async (txId) =>
    attempt(
      () => client.deleteTransaction(txId),
      'delete',
      { id: txId },
      { id: txId, pending: true },
    );

  return wrapper;
}
