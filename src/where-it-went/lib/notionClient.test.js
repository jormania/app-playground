import { describe, it, expect, vi, afterEach } from 'vitest';
import { NotionClient, NotionError } from './notionClient';

function jsonResponse(body, { ok = true, status = ok ? 200 : 400 } = {}) {
  return { ok, status, json: () => Promise.resolve(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NotionClient — write status handling', () => {
  it('throws on a non-2xx response instead of returning it as if it succeeded', async () => {
    // Every write method used to `return response.json()` regardless of status,
    // so a rejected write looked exactly like a successful one to the caller.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'Category is not a valid select option' }, { ok: false, status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { transactions: 'db1' });
    await expect(client.addTransaction({ description: 'x', amount: 1, date: '2026-01-01', type: 'Expense', categoryId: 'c1', accountId: 'a1', tags: [] }))
      .rejects.toThrow(NotionError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 400 is not retried
  });

  it('retries a 429 with backoff and succeeds once the server recovers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'rate limited' }, { ok: false, status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'page_1' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });

    const client = new NotionClient('secret', { transactions: 'db1' });
    const result = await client.addTransaction({ description: 'x', amount: 1, date: '2026-01-01', type: 'Expense', categoryId: 'c1', accountId: 'a1', tags: [] });

    expect(result).toEqual({ id: 'page_1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('gives up after the retry budget on a persistent 500', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'server error' }, { ok: false, status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });

    const client = new NotionClient('secret', { transactions: 'db1' });
    await expect(client.addTransaction({ description: 'x', amount: 1, date: '2026-01-01', type: 'Expense', categoryId: 'c1', accountId: 'a1', tags: [] }))
      .rejects.toThrow(NotionError);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    vi.restoreAllMocks();
  });

  it('never sends an empty relation as [{id: ""}] — Notion 400s on that shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'page_1' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { transactions: 'db1' });
    await client.addTransaction({ description: 'x', amount: 1, date: '2026-01-01', type: 'Expense', categoryId: '', accountId: 'a1', tripId: '', tags: [] });

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.body.properties.Category).toEqual({ relation: [] });
    expect(sentBody.body.properties.Trip).toEqual({ relation: [] });
  });

  it('rejects immediately with no network call when no transaction data is supplied', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new NotionClient('secret', { transactions: 'db1' });
    await expect(client.addTransaction(null)).rejects.toThrow(NotionError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('writes Original Amount / Original Currency, clearing the select when no currency is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'page_1' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { transactions: 'db1' });
    await client.addTransaction({
      description: 'Café', amount: 42, date: '2026-01-01', type: 'Expense',
      categoryId: 'c1', accountId: 'a1', tags: [],
      originalAmount: 8.5, originalCurrency: 'EUR'
    });

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.body.properties['Original Amount']).toEqual({ number: 8.5 });
    expect(sentBody.body.properties['Original Currency']).toEqual({ select: { name: 'EUR' } });
  });

  it('a Transfer with no category writes an empty relation, not a rejected write', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'page_1' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { transactions: 'db1' });
    await client.addTransaction({
      description: 'Revolut top-up', amount: 500, date: '2026-01-01', type: 'Transfer',
      categoryId: '', accountId: 'a1', tags: []
    });

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.body.properties.Type).toEqual({ select: { name: 'Transfer' } });
    expect(sentBody.body.properties.Category).toEqual({ relation: [] });
  });
});

describe('NotionClient — reads', () => {
  it('maps the Notes property and strips a timestamp Date down to YYYY-MM-DD', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      results: [{
        id: 'row1',
        properties: {
          Description: { title: [{ plain_text: 'Hotel' }] },
          Date: { date: { start: '2026-06-30T21:00:00.000Z' } },
          'Amount (RON)': { number: 600 },
          Type: { select: { name: 'Expense' } },
          Category: { relation: [{ id: 'cat1' }] },
          Account: { relation: [{ id: 'acc1' }] },
          Notes: { rich_text: [{ plain_text: 'Booked via app' }] },
          Tags: { multi_select: [] }
        }
      }],
      has_more: false
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { transactions: 'db1' });
    const [tx] = await client.fetchTransactions();
    expect(tx.date).toBe('2026-06-30');
    expect(tx.notes).toBe('Booked via app');
  });

  it('an untyped row is treated as an Expense, never guessed from the amount sign', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      results: [{
        id: 'row1',
        properties: {
          Description: { title: [{ plain_text: 'Mystery' }] },
          Date: { date: { start: '2026-01-01' } },
          'Amount (RON)': { number: 500 },
          Category: {}, Account: {}, Tags: {}
        }
      }],
      has_more: false
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { transactions: 'db1' });
    const [tx] = await client.fetchTransactions();
    expect(tx.type).toBe('Expense');
  });

  it('paginates using has_more/next_cursor and stops on a repeated cursor', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: '1', properties: { Name: { title: [{ plain_text: 'A' }] } } }], has_more: true, next_cursor: 'x' }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: '2', properties: { Name: { title: [{ plain_text: 'B' }] } } }], has_more: true, next_cursor: 'x' })); // repeated cursor
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { categories: 'db1' });
    const rows = await client.fetchCategories();
    expect(rows.map(r => r.name)).toEqual(['A', 'B']);
    expect(fetchMock).toHaveBeenCalledTimes(2); // did not loop forever on the repeated cursor
  });

  it('returns an empty list — never demo rows — when a token is set but a database id is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new NotionClient('secret', {}); // token present, no categoriesDb
    const rows = await client.fetchCategories();
    expect(rows).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to demo data only when there is no token at all', async () => {
    const client = new NotionClient('', {});
    const rows = await client.fetchCategories();
    expect(rows.length).toBeGreaterThan(0);
  });

  it('reads Original Amount / Original Currency', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      results: [{
        id: 'row1',
        properties: {
          Description: { title: [{ plain_text: 'Café' }] },
          Date: { date: { start: '2026-01-01' } },
          'Amount (RON)': { number: 42 },
          Type: { select: { name: 'Expense' } },
          Category: { relation: [{ id: 'cat1' }] },
          Account: { relation: [{ id: 'acc1' }] },
          'Original Amount': { number: 8.5 },
          'Original Currency': { select: { name: 'EUR' } },
          Tags: { multi_select: [] }
        }
      }],
      has_more: false
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { transactions: 'db1' });
    const [tx] = await client.fetchTransactions();
    expect(tx.originalAmount).toBe(8.5);
    expect(tx.originalCurrency).toBe('EUR');
  });

  it('a Transfer row round-trips its Type without being reclassified', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      results: [{
        id: 'row1',
        properties: {
          Description: { title: [{ plain_text: 'Revolut top-up' }] },
          Date: { date: { start: '2026-01-01' } },
          'Amount (RON)': { number: 500 },
          Type: { select: { name: 'Transfer' } },
          Category: {}, Account: { relation: [{ id: 'acc1' }] }, Tags: {}
        }
      }],
      has_more: false
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { transactions: 'db1' });
    const [tx] = await client.fetchTransactions();
    expect(tx.type).toBe('Transfer');
    expect(tx.categoryId).toBe('');
  });
});
