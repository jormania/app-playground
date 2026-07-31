/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { parseSmartText } from './smartParser';

const mockAccounts = [
  { id: 'acc-revolut', name: 'Revolut' },
  { id: 'acc-cash', name: 'Cash' },
  { id: 'acc-ing', name: 'ING Bank' },
];

const mockCategories = [
  { id: 'cat-food', name: 'Food' },
  { id: 'cat-transit', name: 'Transit' },
  { id: 'cat-shopping', name: 'Shopping' },
];

describe('smartParser', () => {
  it('parses a basic expense with Revolut default and today date', () => {
    const tx = parseSmartText('15 for lunch', mockAccounts, mockCategories);
    expect(tx.amount).toBe(15);
    expect(tx.currency).toBe('RON');
    expect(tx.type).toBe('Expense');
    expect(tx.accountId).toBe('acc-revolut');
    expect(tx.categoryId).toBe('');
    expect(tx.description).toBe('lunch');
    expect(tx.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it('detects a specific account if mentioned', () => {
    const tx = parseSmartText('30 for coffee from Cash', mockAccounts, mockCategories);
    expect(tx.amount).toBe(30);
    expect(tx.accountId).toBe('acc-cash');
    expect(tx.description).toBe('coffee');
  });

  it('detects yesterday', () => {
    const tx = parseSmartText('100 shopping yesterday', mockAccounts, mockCategories);
    expect(tx.amount).toBe(100);
    
    const today = new Date();
    today.setDate(today.getDate() - 1);
    expect(tx.date).toBe(today.toISOString().slice(0, 10));
    expect(tx.categoryId).toBe('cat-shopping');
    expect(tx.description).toBe('');
  });

  it('detects income', () => {
    const tx = parseSmartText('5000 salary', mockAccounts, mockCategories);
    expect(tx.amount).toBe(5000);
    expect(tx.type).toBe('Income');
    expect(tx.description).toBe('');
  });

  it('returns null if no integer is found', () => {
    const tx = parseSmartText('just text no number', mockAccounts, mockCategories);
    expect(tx).toBeNull();
  });
});
