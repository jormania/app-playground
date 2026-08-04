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
const IDMAP_KEY = 'whereItWent_outbox_idmap';

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

// --- local -> Notion id map ---------------------------------------------------

/**
 * Persisted separately from the in-memory map `flushOutbox` used to build in
 * one call. Without this, a flush that posted an `add` and then hit a
 * retryable failure on the very next item threw the mapping away — the next
 * flush (next reload, or the next `online` event) started from an empty map
 * and sent a later queued `update`/`delete` for that same row straight to its
 * fake `local_tx_*` id instead of the real Notion id it had already learned.
 */
function readIdMap() {
  const map = readJson(IDMAP_KEY, {});
  return map && typeof map === 'object' ? map : {};
}

function writeIdMap(map) {
  writeJson(IDMAP_KEY, map);
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

  // Rehydrate rather than start empty: a prior call may have posted an `add`
  // and then hit a retryable failure on the very next item, and that mapping
  // is the only way a still-queued `update`/`delete` for the same row finds
  // its real Notion id instead of the fake local one.
  const idMap = readIdMap();
  let sent = 0;
  const failures = [];
  let index = 0;

  for (; index < queue.length; index++) {
    const item = queue[index];
    try {
      if (item.op === 'add') {
        const created = await client.addTransaction(item.payload);
        if (created?.id) {
          idMap[item.payload.id] = created.id;
          // Persisted immediately, not just at the end of the loop — the very
          // next item in this same batch is what a lost mapping would break.
          writeIdMap(idMap);
        }
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

  // Prune entries nothing queued or parked still needs, so this doesn't grow
  // forever across a long-lived install.
  const stillReferenced = new Set(
    [...stillQueued, ...failures].map(i => i.payload?.id).filter(Boolean)
  );
  const prunedIdMap = {};
  for (const [localId, realId] of Object.entries(idMap)) {
    if (stillReferenced.has(localId)) prunedIdMap[localId] = realId;
  }
  writeIdMap(prunedIdMap);

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

// --- workspace identity -------------------------------------------------------

/**
 * A stable fingerprint of *which* Notion workspace a config points at — never
 * the raw token itself, just enough to tell "same workspace" from "different
 * one". Demo mode is its own identity regardless of what token/db ids happen
 * to still be sitting in the fields, since it never reads or writes any of
 * them.
 */
export function workspaceIdentity(config) {
  if (!config) return '';
  if (config.demoMode) return 'demo';
  return [
    config.token, config.categoriesDb, config.accountsDb, config.transactionsDb,
    config.subscriptionsDb, config.tripsDb, config.templatesDb,
  ].map(v => v || '').join('|');
}

/**
 * Whether it's safe to switch from one workspace to another right now.
 *
 * The snapshot mirror and the outbox are not scoped per workspace — they're
 * a single mirror of "whatever's currently connected". That's fine as long
 * as switching only ever happens with nothing left to send: otherwise a
 * write queued for workspace A gets flushed straight into workspace B's
 * databases the next time the app comes online, and until then the stale
 * mirror briefly shows A's ledger while B is still loading. Blocking the
 * switch outright — rather than trying to keep two workspaces' caches side
 * by side — is the simpler, correct answer for an app one person uses on
 * one workspace at a time.
 */
export function canSwitchWorkspace(oldConfig, newConfig) {
  const changed = workspaceIdentity(oldConfig) !== workspaceIdentity(newConfig);
  if (changed && readOutbox().length > 0) {
    return {
      ok: false,
      changed,
      reason: 'You have changes that have not synced to Notion yet. Reconnect to '
        + 'the internet and let them send (or discard them, if that\'s what you '
        + 'want) before switching workspaces — otherwise they\'d be sent to the '
        + 'new one instead of where they were meant to go.',
    };
  }
  return { ok: true, changed };
}

/** Drop everything cached for the workspace being left, so none of it bleeds into the next one. */
export function clearWorkspaceCache() {
  clearSnapshot();
  writeOutbox([]);
  writeFailed([]);
  writeIdMap({});
}
