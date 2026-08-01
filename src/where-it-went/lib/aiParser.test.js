import { describe, it, expect, vi } from 'vitest';
import { parseTextWithAI } from './aiParser';

const mockCategories = [
  { id: 'cat-food', name: 'Food', type: 'Expense' },
  { id: 'cat-salary', name: 'Salary', type: 'Income' },
];

const mockAccounts = [
  { id: 'acc-revolut', name: 'Revolut', currency: 'RON' },
  { id: 'acc-cash', name: 'Cash', currency: 'RON' },
];

describe('aiParser', () => {
  it('throws an error if apiKey is missing', async () => {
    await expect(parseTextWithAI('15 for lunch', mockAccounts, mockCategories, [], ''))
      .rejects
      .toThrow('Claude API Key is missing');
  });

  it('correctly maps API JSON output to a transaction object', async () => {
    const mockResponse = {
      content: [{
        text: JSON.stringify({
          transactions: [{
            action: 'create',
            amount: 15,
            categoryId: 'cat-food',
            accountId: 'acc-revolut-ron',
            description: 'Lunch',
            date: '2026-08-01',
            type: 'Expense',
            isSubscription: false
          }]
        })
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await parseTextWithAI('15 for lunch on revolut', mockAccounts, mockCategories, [], 'fake-key');

    expect(result).toEqual([{
      amount: 15,
      originalAmount: undefined,
      originalCurrency: undefined,
      categoryId: 'cat-food',
      accountId: 'acc-revolut-ron',
      description: 'Lunch',
      date: '2026-08-01',
      type: 'Expense',
      toAccountId: undefined,
      tripId: undefined,
      action: 'create',
      id: undefined,
      isSubscription: false
    }]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = global.fetch.mock.calls[0][1];
    expect(callArgs.headers['x-api-key']).toBe('fake-key');
    const body = JSON.parse(callArgs.body);
    expect(body.messages[0].content).toBe('15 for lunch on revolut');
  });

  it('strips markdown backticks if returned', async () => {
    const mockResponse = {
      content: [{
        text: '\`\`\`json\n{"transactions": [{"amount": 50, "categoryId": "cat-food", "accountId": "acc-cash", "description": "Groceries", "date": "2026-08-01", "type": "Expense"}]}\n\`\`\`'
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await parseTextWithAI('50 groceries cash', mockAccounts, mockCategories, [], 'fake-key');
    expect(result[0].amount).toBe(50);
  });

  it('returns empty array if AI indicates an error (no amount found)', async () => {
    const mockResponse = {
      content: [{
        text: JSON.stringify({ transactions: [] })
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await parseTextWithAI('just some gibberish text', mockAccounts, mockCategories, [], 'fake-key');
    expect(result).toEqual([]);
  });

  it('correctly maps update actions', async () => {
    const mockResponse = {
      content: [{
        text: JSON.stringify({
          transactions: [{
            action: 'update',
            id: 'local_tx_123',
            amount: 20,
            categoryId: 'cat-food',
            accountId: 'acc-revolut-ron',
            description: 'Lunch',
            date: '2026-08-01',
            type: 'Expense'
          }]
        })
      }]
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await parseTextWithAI('change it to 20', mockAccounts, mockCategories, [], 'fake-key', [{ id: 'local_tx_123', amount: 15, description: 'Lunch' }]);
    
    expect(result[0].action).toBe('update');
    expect(result[0].id).toBe('local_tx_123');
    expect(result[0].amount).toBe(20);
  });
});
