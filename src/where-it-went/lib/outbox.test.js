/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveSnapshot, readSnapshot, clearSnapshot,
  enqueue, readOutbox, writeOutbox, readFailed, writeFailed,
  flushOutbox, applyLocally, isRetryable, isLocalId, newLocalId,
  discardFailed, retryFailed, createOfflineClient,
} from './outbox';
import { NotionClient, NotionError } from './notionClient';

beforeEach(() => {
  localStorage.clear();
});

const tx = (over = {}) => ({
  id: 't1', description: 'Milk', amount: 12, date: '2026-07-15',
  type: 'Expense', categoryId: 'c1', accountId: 'a1', ...over,
});

describe('local ids', () => {
  it('are recognisable and unique', () => {
    const a = newLocalId();
    const b = newLocalId();
    expect(isLocalId(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(isLocalId('abc-real-notion-id')).toBe(false);
    expect(isLocalId(undefined)).toBe(false);
  });
});

describe('snapshot', () => {
  it('round-trips the last good load', () => {
    saveSnapshot({ transactions: [tx()], categories: [] });
    const snap = readSnapshot();
    expect(snap.data.transactions).toHaveLength(1);
    expect(typeof snap.savedAt).toBe('number');
  });

  it('is null before anything has ever loaded', () => {
    expect(readSnapshot()).toBeNull();
  });

  it('can be cleared', () => {
    saveSnapshot({ transactions: [] });
    clearSnapshot();
    expect(readSnapshot()).toBeNull();
  });

  it('survives a corrupted value rather than throwing', () => {
    localStorage.setItem('whereItWent_snapshot', '{not json');
    expect(readSnapshot()).toBeNull();
  });
});

describe('enqueue / readOutbox', () => {
  it('preserves the order writes were made in', () => {
    enqueue('add', tx({ id: 'a' }));
    enqueue('update', { id: 'a', updates: { amount: 5 } });
    enqueue('delete', { id: 'a' });
    expect(readOutbox().map(i => i.op)).toEqual(['add', 'update', 'delete']);
  });
});

describe('applyLocally', () => {
  it('puts an added transaction at the top, marked pending', () => {
    const out = applyLocally([tx({ id: 'old' })], { op: 'add', payload: tx({ id: 'local_tx_1' }) });
    expect(out[0].id).toBe('local_tx_1');
    expect(out[0].pending).toBe(true);
  });

  it('merges an update into the matching row', () => {
    const out = applyLocally([tx({ id: 't1', amount: 12 })], { op: 'update', payload: { id: 't1', updates: { amount: 99 } } });
    expect(out[0].amount).toBe(99);
    expect(out[0].pending).toBe(true);
  });

  it('removes a deleted row', () => {
    const out = applyLocally([tx({ id: 't1' }), tx({ id: 't2' })], { op: 'delete', payload: { id: 't1' } });
    expect(out.map(t => t.id)).toEqual(['t2']);
  });
});

describe('isRetryable', () => {
  it('retries network-level and transient failures', () => {
    expect(isRetryable(new Error('offline'))).toBe(true);
    expect(isRetryable(new NotionError('net', 0))).toBe(true);
    expect(isRetryable(new NotionError('rate limited', 429))).toBe(true);
    expect(isRetryable(new NotionError('server', 503))).toBe(true);
  });

  it('does not retry a request Notion rejected outright', () => {
    expect(isRetryable(new NotionError('bad property', 400))).toBe(false);
    expect(isRetryable(new NotionError('unauthorized', 401))).toBe(false);
  });
});

describe('flushOutbox', () => {
  const makeClient = () => ({
    addTransaction: vi.fn().mockResolvedValue({ id: 'notion-1' }),
    updateTransaction: vi.fn().mockResolvedValue({}),
    deleteTransaction: vi.fn().mockResolvedValue({}),
  });

  it('does nothing on an empty queue', async () => {
    const client = makeClient();
    expect(await flushOutbox(client)).toMatchObject({ sent: 0, remaining: 0 });
    expect(client.addTransaction).not.toHaveBeenCalled();
  });

  it('sends everything in order and empties the queue', async () => {
    const client = makeClient();
    enqueue('add', tx({ id: 'local_tx_1' }));
    enqueue('delete', { id: 't9' });

    const result = await flushOutbox(client);
    expect(result.sent).toBe(2);
    expect(readOutbox()).toEqual([]);
    expect(client.addTransaction).toHaveBeenCalledTimes(1);
    expect(client.deleteTransaction).toHaveBeenCalledTimes(1);
  });

  it('maps a temp id onto the real Notion id for later jobs', async () => {
    const client = makeClient();
    enqueue('add', tx({ id: 'local_tx_1' }));
    enqueue('update', { id: 'local_tx_1', updates: { amount: 20 } });

    const result = await flushOutbox(client);
    expect(result.idMap).toEqual({ 'local_tx_1': 'notion-1' });
    expect(client.updateTransaction).toHaveBeenCalledWith('notion-1', { amount: 20 });
  });

  it('stops at the first retryable failure instead of skipping ahead', async () => {
    // Reordering writes can resurrect a deleted row or edit something that
    // doesn't exist yet, so everything after a failure has to wait its turn.
    const client = makeClient();
    client.updateTransaction.mockRejectedValueOnce(new NotionError('offline', 0));
    enqueue('add', tx({ id: 'local_tx_1' }));
    enqueue('update', { id: 'local_tx_1', updates: { amount: 20 } });
    enqueue('delete', { id: 'other' });

    const result = await flushOutbox(client);
    expect(result.sent).toBe(1);
    expect(result.remaining).toBe(2);
    expect(client.deleteTransaction).not.toHaveBeenCalled();
    expect(readOutbox().map(i => i.op)).toEqual(['update', 'delete']);
  });

  it('parks a permanently-rejected job and carries on with the rest', async () => {
    const client = makeClient();
    client.addTransaction.mockRejectedValueOnce(new NotionError('bad property', 400));
    enqueue('add', tx({ id: 'local_tx_1' }));
    enqueue('delete', { id: 'other' });

    const result = await flushOutbox(client);
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
    expect(readOutbox()).toEqual([]);
    // Nothing is dropped silently — the real reason is kept for the UI.
    expect(readFailed()[0].lastError).toMatch(/bad property/);
  });

  it('reports progress as it goes', async () => {
    const client = makeClient();
    enqueue('delete', { id: 'a' });
    enqueue('delete', { id: 'b' });
    const onProgress = vi.fn();
    await flushOutbox(client, { onProgress });
    expect(onProgress).toHaveBeenCalledTimes(2);
  });
});

describe('createOfflineClient', () => {
  const setOnline = (value) => {
    Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  };

  beforeEach(() => setOnline(true));

  it('passes methods it does not override straight through to the real client', async () => {
    // Object.create keeps the prototype chain — a spread would have dropped
    // every class method and silently broken all the fetches.
    const real = new NotionClient('', {});
    const wrapped = createOfflineClient(real);
    expect(typeof wrapped.fetchTransactions).toBe('function');
    expect(typeof wrapped.scrubTransactionsAndSubscriptions).toBe('function');
    expect(wrapped.fetchCategories).toBe(real.fetchCategories);
  });

  it('writes straight through when online and the call succeeds', async () => {
    const client = { addTransaction: vi.fn().mockResolvedValue({ id: 'notion-1' }) };
    const wrapped = createOfflineClient(client);
    const result = await wrapped.addTransaction(tx());
    expect(result).toEqual({ id: 'notion-1' });
    expect(readOutbox()).toEqual([]);
  });

  it('queues an add while offline and hands back a local id', async () => {
    setOnline(false);
    const client = { addTransaction: vi.fn() };
    const wrapped = createOfflineClient(client);

    const result = await wrapped.addTransaction(tx());
    expect(client.addTransaction).not.toHaveBeenCalled();
    expect(isLocalId(result.id)).toBe(true);
    expect(readOutbox()).toHaveLength(1);
    expect(readOutbox()[0].payload.id).toBe(result.id);
  });

  it('queues a write that failed for a retryable reason', async () => {
    const client = { updateTransaction: vi.fn().mockRejectedValue(new NotionError('gateway', 502)) };
    const wrapped = createOfflineClient(client);
    await wrapped.updateTransaction('t1', { amount: 5 });
    expect(readOutbox()).toHaveLength(1);
  });

  it('still throws when Notion actively rejects the request', async () => {
    // Queuing a genuinely malformed write would retry it forever and hide the
    // real error from the form.
    const client = { deleteTransaction: vi.fn().mockRejectedValue(new NotionError('not found', 404)) };
    const wrapped = createOfflineClient(client);
    await expect(wrapped.deleteTransaction('t1')).rejects.toThrow('not found');
    expect(readOutbox()).toEqual([]);
  });
});

describe('failed jobs', () => {
  it('can be discarded', () => {
    writeFailed([{ id: 'j1' }, { id: 'j2' }]);
    discardFailed('j1');
    expect(readFailed().map(j => j.id)).toEqual(['j2']);
  });

  it('can be requeued at the front', () => {
    writeOutbox([{ id: 'j9', op: 'delete', payload: { id: 'x' } }]);
    writeFailed([{ id: 'j1', op: 'add', payload: {}, attempts: 1 }]);
    expect(retryFailed('j1')).toBe(true);
    expect(readOutbox().map(j => j.id)).toEqual(['j1', 'j9']);
    expect(readOutbox()[0].attempts).toBe(2);
    expect(readFailed()).toEqual([]);
  });

  it('reports when there is nothing to retry', () => {
    expect(retryFailed('nope')).toBe(false);
  });
});
