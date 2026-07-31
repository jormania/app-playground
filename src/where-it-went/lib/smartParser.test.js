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
  { id: 'cat-food', name: 'Food & Dining' },
  { id: 'cat-transit', name: 'Transit' },
  { id: 'cat-shopping', name: 'Shopping' },
  { id: 'cat-groceries', name: 'Groceries' },
  { id: 'cat-health', name: 'Health & Medical' },
  { id: 'cat-entertainment', name: 'Entertainment' },
  { id: 'cat-bills', name: 'Bills & Utilities' },
];

describe('smartParser 30-sample robust test suite', () => {
  const getToday = () => new Date().toISOString().slice(0, 10);
  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const samples = [
    // 1. Basic Expense
    { prompt: '15 for lunch', amount: 15, date: getToday(), account: 'acc-revolut', category: 'cat-food', desc: 'Lunch' },
    // 2. Specific Account Mentioned
    { prompt: '30 for coffee from Cash', amount: 30, date: getToday(), account: 'acc-cash', category: 'cat-food', desc: 'Coffee' },
    // 3. Yesterday Keyword
    { prompt: '100 shopping yesterday', amount: 100, date: getYesterday(), account: 'acc-revolut', category: 'cat-shopping', desc: 'Shopping' },
    // 4. Heuristics Mapping (uber -> transport -> Transit)
    { prompt: '25 uber to the mall', amount: 25, date: getToday(), account: 'acc-revolut', category: 'cat-transit', desc: 'Uber mall' },
    // 5. Income Keyword
    { prompt: '5000 salary', amount: 5000, date: getToday(), account: 'acc-revolut', category: '', desc: 'Salary' }, // Income type should be tested separately but we test basic fields here
    // 6. Natural phrased purchase
    { prompt: 'bought a pizza for 45 lei', amount: 45, date: getToday(), account: 'acc-revolut', category: 'cat-food', desc: 'Bought pizza lei' },
    // 7. Store keyword (Lidl -> groceries)
    { prompt: '300 for groceries at lidl', amount: 300, date: getToday(), account: 'acc-revolut', category: 'cat-groceries', desc: 'Groceries lidl' },
    // 8. Service keyword (Netflix -> Entertainment)
    { prompt: 'netflix subscription 55', amount: 55, date: getToday(), account: 'acc-revolut', category: 'cat-entertainment', desc: 'Netflix subscription' },
    // 9. Bills
    { prompt: '200 electricity bill', amount: 200, date: getToday(), account: 'acc-revolut', category: 'cat-bills', desc: 'Electricity bill' },
    // 10. Medical
    { prompt: 'dentist appointment 350', amount: 350, date: getToday(), account: 'acc-revolut', category: 'cat-health', desc: 'Dentist appointment' },
    // 11. Fuel -> Transit
    { prompt: '120 gas for the car', amount: 120, date: getToday(), account: 'acc-revolut', category: 'cat-transit', desc: 'Gas car' },
    // 12. Dining with context
    { prompt: 'dinner with friends 150', amount: 150, date: getToday(), account: 'acc-revolut', category: 'cat-food', desc: 'Dinner friends' },
    // 13. Entertainment
    { prompt: 'movie tickets 60', amount: 60, date: getToday(), account: 'acc-revolut', category: 'cat-entertainment', desc: 'Movie tickets' },
    // 14. Shopping with context
    { prompt: 'amazon gift for mom 250', amount: 250, date: getToday(), account: 'acc-revolut', category: 'cat-shopping', desc: 'Amazon gift mom' },
    // 15. Minimal grocery
    { prompt: '10 for water', amount: 10, date: getToday(), account: 'acc-revolut', category: 'cat-groceries', desc: 'Water' },
    // 16. Specific Account + keyword
    { prompt: 'gym membership 150 from ING', amount: 150, date: getToday(), account: 'acc-ing', category: 'cat-health', desc: 'Gym membership' },
    // 17. Pharmacy
    { prompt: 'pharmacy meds 80', amount: 80, date: getToday(), account: 'acc-revolut', category: 'cat-health', desc: 'Pharmacy meds' },
    // 18. Transit minimal
    { prompt: 'metro ticket 10', amount: 10, date: getToday(), account: 'acc-revolut', category: 'cat-transit', desc: 'Metro ticket' },
    // 19. Rent
    { prompt: 'rent 2000', amount: 2000, date: getToday(), account: 'acc-revolut', category: 'cat-bills', desc: 'Rent' },
    // 20. App subscription
    { prompt: 'spotify 50', amount: 50, date: getToday(), account: 'acc-revolut', category: 'cat-entertainment', desc: 'Spotify' },
  ];

  samples.forEach((sample, i) => {
    it(`Sample ${i + 1}: parses "${sample.prompt}"`, () => {
      const tx = parseSmartText(sample.prompt, mockAccounts, mockCategories);
      expect(tx).not.toBeNull();
      expect(tx.amount).toBe(sample.amount);
      expect(tx.date).toBe(sample.date);
      expect(tx.accountId).toBe(sample.account);
      expect(tx.categoryId).toBe(sample.category);
      expect(tx.description).toBe(sample.desc);
    });
  });

  it('detects income correctly', () => {
    const tx = parseSmartText('5000 salary', mockAccounts, mockCategories);
    expect(tx.amount).toBe(5000);
    expect(tx.type).toBe('Income');
    expect(tx.description).toBe('Salary');
  });

  it('returns null if no integer is found', () => {
    const tx = parseSmartText('just text no number', mockAccounts, mockCategories);
    expect(tx).toBeNull();
  });
});
