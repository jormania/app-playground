import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTextWithAI, askInsightsAI, hardenTransaction, hardenTransactions, normalizeCurrency } from './aiParser';
import { clearRateCache } from './fx';

const mockCategories = [
  { id: 'cat-food', name: 'Food', type: 'Expense' },
  { id: 'cat-salary', name: 'Salary', type: 'Income' },
];

const mockAccounts = [
  { id: 'acc-revolut', name: 'Revolut', currency: 'RON' },
  { id: 'acc-cash', name: 'Cash', currency: 'RON' },
];

const mockTrips = [
  { id: 'trip-poland', name: 'Poland Autumn' },
];

beforeEach(() => {
  try { localStorage.clear(); } catch (_e) { /* ignore */ }
  clearRateCache();
});

afterEach(() => {
  vi.useRealTimers();
});

function mockClaudeResponse(transactions) {
  return {
    ok: true,
    json: () => Promise.resolve({ content: [{ text: JSON.stringify({ transactions }) }] }),
  };
}

function mockFrankfurterResponse(rate) {
  return {
    ok: true,
    json: () => Promise.resolve({ date: '2026-08-01', rates: { RON: rate } }),
  };
}

/** Routes the shared fetch mock to a Claude response or a Frankfurter rate
 * response by URL, since hardenTransaction's live-rate lookup shares the same
 * global.fetch as the Claude call in these tests. */
function mockFetchByUrl({ claude, frankfurterRate }) {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('anthropic.com')) return Promise.resolve(claude);
    if (String(url).includes('frankfurter')) {
      return frankfurterRate != null
        ? Promise.resolve(mockFrankfurterResponse(frankfurterRate))
        : Promise.resolve({ ok: false });
    }
    return Promise.reject(new Error(`Unexpected fetch to ${url}`));
  });
}

describe('parseTextWithAI', () => {
  it('throws an error if apiKey is missing', async () => {
    await expect(parseTextWithAI('15 for lunch', mockAccounts, mockCategories, [], ''))
      .rejects
      .toThrow('Claude API Key is missing');
  });

  it('correctly maps API JSON output to a transaction object', async () => {
    mockFetchByUrl({
      claude: mockClaudeResponse([{
        action: 'create',
        amount: 15,
        categoryId: 'cat-food',
        accountId: 'acc-revolut',
        description: 'Lunch',
        date: '2026-08-01',
        type: 'Expense',
        isSubscription: false,
      }]),
    });

    const result = await parseTextWithAI('15 for lunch on revolut', mockAccounts, mockCategories, [], 'fake-key');

    expect(result).toEqual([{
      amount: 15,
      originalAmount: undefined,
      originalCurrency: undefined,
      categoryId: 'cat-food',
      accountId: 'acc-revolut',
      description: 'Lunch',
      notes: undefined,
      date: '2026-08-01',
      type: 'Expense',
      toAccountId: '',
      tripId: undefined,
      action: 'create',
      id: undefined,
      isSubscription: false
    }]);

    expect(global.fetch).toHaveBeenCalled();
    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.headers['x-api-key']).toBe('fake-key');
    const body = JSON.parse(callArgs.body);
    expect(body.messages[0].content).toBe('15 for lunch on revolut');
  });

  it('strips markdown backticks if returned', async () => {
    mockFetchByUrl({
      claude: {
        ok: true,
        json: () => Promise.resolve({
          content: [{
            text: '```json\n{"transactions": [{"amount": 50, "categoryId": "cat-food", "accountId": "acc-cash", "description": "Groceries", "date": "2026-08-01", "type": "Expense"}]}\n```'
          }]
        }),
      },
    });

    const result = await parseTextWithAI('50 groceries cash', mockAccounts, mockCategories, [], 'fake-key');
    expect(result[0].amount).toBe(50);
  });

  it('returns empty array if AI indicates an error (no amount found)', async () => {
    mockFetchByUrl({ claude: mockClaudeResponse([]) });

    const result = await parseTextWithAI('just some gibberish text', mockAccounts, mockCategories, [], 'fake-key');
    expect(result).toEqual([]);
  });

  it('correctly maps update actions', async () => {
    mockFetchByUrl({
      claude: mockClaudeResponse([{
        action: 'update',
        id: 'local_tx_123',
        amount: 20,
        categoryId: 'cat-food',
        accountId: 'acc-revolut',
        description: 'Lunch',
        date: '2026-08-01',
        type: 'Expense',
      }]),
    });

    const result = await parseTextWithAI('change it to 20', mockAccounts, mockCategories, [], 'fake-key', [{ id: 'local_tx_123', amount: 15, description: 'Lunch' }]);

    expect(result[0].action).toBe('update');
    expect(result[0].id).toBe('local_tx_123');
    expect(result[0].amount).toBe(20);
  });

  it('throws a clear error when the response cannot be parsed as JSON (e.g. truncated by max_tokens)', async () => {
    mockFetchByUrl({
      claude: { ok: true, json: () => Promise.resolve({ content: [{ text: '{"transactions": [{"amount": 15, "desc' }] }) },
    });

    await expect(parseTextWithAI('15 for lunch', mockAccounts, mockCategories, [], 'fake-key'))
      .rejects.toThrow('cut off');
  });

  it('throws a clear error when the response has no content at all', async () => {
    mockFetchByUrl({
      claude: { ok: true, json: () => Promise.resolve({ content: [] }) },
    });

    await expect(parseTextWithAI('15 for lunch', mockAccounts, mockCategories, [], 'fake-key'))
      .rejects.toThrow('empty response');
  });

  it('falls back to a real account when the AI hallucinates an accountId, instead of dropping the transaction', async () => {
    mockFetchByUrl({
      claude: mockClaudeResponse([{
        action: 'create',
        amount: 15,
        categoryId: 'cat-food',
        accountId: 'acc-does-not-exist',
        description: 'Lunch',
        date: '2026-08-01',
        type: 'Expense',
      }]),
    });

    const result = await parseTextWithAI('15 for lunch', mockAccounts, mockCategories, [], 'fake-key');
    expect(result).toHaveLength(1);
    expect(mockAccounts.some(a => a.id === result[0].accountId)).toBe(true);
  });

  it('drops a hallucinated categoryId rather than the whole transaction', async () => {
    mockFetchByUrl({
      claude: mockClaudeResponse([{
        action: 'create',
        amount: 15,
        categoryId: 'cat-does-not-exist',
        accountId: 'acc-revolut',
        description: 'Lunch',
        date: '2026-08-01',
        type: 'Expense',
      }]),
    });

    const result = await parseTextWithAI('15 for lunch', mockAccounts, mockCategories, [], 'fake-key');
    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBe('');
  });

  it('drops a Transfer that cannot resolve to two distinct real accounts', async () => {
    mockFetchByUrl({
      claude: mockClaudeResponse([{
        action: 'create',
        amount: 100,
        accountId: 'acc-revolut',
        toAccountId: 'acc-revolut', // same account both ends
        description: 'Move money',
        date: '2026-08-01',
        type: 'Transfer',
      }]),
    });

    const result = await parseTextWithAI('move 100 to my own account', mockAccounts, mockCategories, [], 'fake-key');
    expect(result).toEqual([]);
  });

  it('strips an unregistered originalCurrency rather than letting it reach Notion', async () => {
    mockFetchByUrl({
      claude: mockClaudeResponse([{
        action: 'create',
        amount: 100,
        accountId: 'acc-revolut',
        categoryId: 'cat-food',
        description: 'Snack',
        date: '2026-08-01',
        type: 'Expense',
        originalAmount: 20,
        originalCurrency: 'US Dollar', // not a registered code
      }]),
    });

    const result = await parseTextWithAI('20 dollars for a snack', mockAccounts, mockCategories, [], 'fake-key');
    expect(result[0].originalCurrency).toBe('');
    expect(result[0].originalAmount).toBe(null);
  });

  it('re-derives the RON amount from a live rate instead of the AI-guessed figure', async () => {
    mockFetchByUrl({
      claude: mockClaudeResponse([{
        action: 'create',
        amount: 90, // the AI's own guess — deliberately "wrong"
        accountId: 'acc-revolut',
        categoryId: 'cat-food',
        description: 'Dinner',
        date: '2026-08-01',
        type: 'Expense',
        originalAmount: 20,
        originalCurrency: 'eur', // lower-case, should normalize too
      }]),
      frankfurterRate: 5, // 1 EUR = 5 RON
    });

    const result = await parseTextWithAI('20 eur for dinner', mockAccounts, mockCategories, [], 'fake-key');
    expect(result[0].originalCurrency).toBe('EUR');
    expect(result[0].amount).toBe(100); // 20 * 5, not the AI's guess of 90
  });

  it('keeps the AI-guessed amount when no live rate is available (BGN, or the rate fetch fails)', async () => {
    mockFetchByUrl({
      claude: mockClaudeResponse([{
        action: 'create',
        amount: 250,
        accountId: 'acc-revolut',
        categoryId: 'cat-food',
        description: 'Souvenir',
        date: '2026-08-01',
        type: 'Expense',
        originalAmount: 50,
        originalCurrency: 'BGN', // registered, but never converted (see lib/fx.js)
      }]),
      frankfurterRate: null,
    });

    const result = await parseTextWithAI('50 BGN souvenir', mockAccounts, mockCategories, [], 'fake-key');
    expect(result[0].originalCurrency).toBe('BGN');
    expect(result[0].amount).toBe(250); // unchanged — a missing rate never blocks a save
  });

  it('rejects an update/delete whose id is not one of the ones actually offered', async () => {
    mockFetchByUrl({
      claude: mockClaudeResponse([{ action: 'delete' /* no id */ }]),
    });

    const result = await parseTextWithAI('delete the last one', mockAccounts, mockCategories, [], 'fake-key', []);
    expect(result).toEqual([]);
  });

  it('times out a hung request instead of leaving it pending forever', async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn((url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        reject(err);
      });
    }));

    const promise = parseTextWithAI('15 for lunch', mockAccounts, mockCategories, [], 'fake-key');
    const assertion = expect(promise).rejects.toThrow('took too long to respond');
    await vi.advanceTimersByTimeAsync(20000);
    await assertion;
  });
});

describe('normalizeCurrency', () => {
  it('accepts a registered code regardless of case', () => {
    expect(normalizeCurrency('eur')).toBe('EUR');
    expect(normalizeCurrency('Usd')).toBe('USD');
  });

  it('rejects anything not in the registered vocabulary', () => {
    expect(normalizeCurrency('US Dollar')).toBe(null);
    expect(normalizeCurrency('')).toBe(null);
    expect(normalizeCurrency(undefined)).toBe(null);
  });
});

describe('hardenTransaction', () => {
  const context = { categories: mockCategories, accounts: mockAccounts, trips: mockTrips };

  it('passes a delete through untouched — it only needs an id', async () => {
    const tx = { action: 'delete', id: 'tx-1' };
    expect(await hardenTransaction(tx, context)).toEqual(tx);
  });

  it('drops an invalid tripId', async () => {
    const tx = { action: 'create', type: 'Expense', accountId: 'acc-revolut', tripId: 'trip-nonexistent' };
    const result = await hardenTransaction(tx, context);
    expect(result.tripId).toBe('');
  });

  it('keeps a valid tripId', async () => {
    const tx = { action: 'create', type: 'Expense', accountId: 'acc-revolut', tripId: 'trip-poland' };
    const result = await hardenTransaction(tx, context);
    expect(result.tripId).toBe('trip-poland');
  });

  it('clears toAccountId for a non-Transfer even if the AI supplied one', async () => {
    const tx = { action: 'create', type: 'Expense', accountId: 'acc-revolut', toAccountId: 'acc-cash' };
    const result = await hardenTransaction(tx, context);
    expect(result.toAccountId).toBe('');
  });
});

describe('hardenTransactions', () => {
  it('keeps valid non-Transfer transactions and drops unresolvable Transfers', async () => {
    const txs = [
      { action: 'create', type: 'Expense', accountId: 'acc-revolut', categoryId: 'cat-food' },
      { action: 'create', type: 'Transfer', accountId: 'acc-revolut', toAccountId: 'acc-cash' },
      { action: 'create', type: 'Transfer', accountId: 'acc-revolut', toAccountId: 'acc-revolut' },
    ];
    const result = await hardenTransactions(txs, { categories: mockCategories, accounts: mockAccounts, trips: mockTrips });
    expect(result).toHaveLength(2);
    expect(result.map(t => t.type)).toEqual(['Expense', 'Transfer']);
  });
});

describe('askInsightsAI', () => {
  it('throws when the apiKey is missing', async () => {
    await expect(askInsightsAI('what did I spend?', [], mockCategories, ''))
      .rejects.toThrow('Claude API Key is missing');
  });

  it('returns the trimmed answer text', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: '  You spent 100 L.  ' }] }),
    });

    const result = await askInsightsAI('what did I spend?', [], mockCategories, 'fake-key');
    expect(result).toBe('You spent 100 L.');
  });

  it('throws a clear error on an empty response instead of crashing on content[0]', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [] }),
    });

    await expect(askInsightsAI('what did I spend?', [], mockCategories, 'fake-key'))
      .rejects.toThrow('empty response');
  });
});
