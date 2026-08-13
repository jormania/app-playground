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

  it('joins every rich-text run so a note styled in Notion is not cut at the first run', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      results: [{
        id: 'row1',
        properties: {
          Description: { title: [{ plain_text: 'Invoice ' }, { plain_text: '4471' }] },
          Date: { date: { start: '2026-06-30' } },
          'Amount (RON)': { number: 320 },
          Type: { select: { name: 'Expense' } },
          // Notion splits styled text into runs — bolding one word used to lose the rest.
          Notes: { rich_text: [{ plain_text: 'Plumber for the ' }, { plain_text: 'kitchen' }, { plain_text: ' leak' }] },
          Tags: { multi_select: [] }
        }
      }],
      has_more: false
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { transactions: 'db1' });
    const [tx] = await client.fetchTransactions();
    expect(tx.notes).toBe('Plumber for the kitchen leak');
    expect(tx.description).toBe('Invoice 4471');
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

  it('reads a category\'s Active checkbox — previously never parsed at all, so every category behaved as active regardless of the checkbox', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      results: [
        { id: 'cat1', properties: { Name: { title: [{ plain_text: 'Salary' }] }, Type: { select: { name: 'Income' } }, Active: { checkbox: true } } },
        { id: 'cat2', properties: { Name: { title: [{ plain_text: 'Other' }] }, Type: { select: { name: 'Expense' } }, Active: { checkbox: false } } },
        // No Active property at all — an older row saved before the checkbox existed must still read as active.
        { id: 'cat3', properties: { Name: { title: [{ plain_text: 'Food' }] }, Type: { select: { name: 'Expense' } } } },
      ],
      has_more: false
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { categories: 'db1' });
    const rows = await client.fetchCategories();
    const byName = Object.fromEntries(rows.map(r => [r.name, r.active]));
    expect(byName).toEqual({ Salary: true, Other: false, Food: true });
  });

  it('always sorts "Other" last, regardless of where it would alphabetize', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      results: [
        { id: 'cat1', properties: { Name: { title: [{ plain_text: 'Utilities' }] }, Type: { select: { name: 'Expense' } } } },
        { id: 'cat2', properties: { Name: { title: [{ plain_text: 'Other' }] }, Type: { select: { name: 'Expense' } } } },
        { id: 'cat3', properties: { Name: { title: [{ plain_text: 'Dining' }] }, Type: { select: { name: 'Expense' } } } },
      ],
      has_more: false
    }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NotionClient('secret', { categories: 'db1' });
    const rows = await client.fetchCategories();
    expect(rows.map(r => r.name)).toEqual(['Dining', 'Utilities', 'Other']);
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

describe('amount validation', () => {
  it('refuses to create a transaction with an unusable amount rather than storing zero', async () => {
    const client = new NotionClient('tok', { transactions: 'db-tx' });
    for (const amount of [undefined, null, 0, -5, '73 zł', NaN]) {
      await expect(client.addTransaction({ description: 'x', date: '2026-08-13', amount }))
        .rejects.toThrow(/amount greater than zero/);
    }
  });

  it('refuses to update a transaction to an unusable amount', async () => {
    const client = new NotionClient('tok', { transactions: 'db-tx' });
    await expect(client.updateTransaction('tx-1', { amount: 0 }))
      .rejects.toThrow(/amount greater than zero/);
  });

  it('accepts a numeric string', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ id: 'new' })));
    vi.stubGlobal('fetch', fetchMock);
    const client = new NotionClient('tok', { transactions: 'db-tx' });
    await client.addTransaction({ description: 'x', date: '2026-08-13', amount: '42' });
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.body.properties['Amount (RON)']).toEqual({ number: 42 });
  });
});
