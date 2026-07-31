/**
 * Parses a natural language string into a transaction object for the Where It Went app.
 */
export function parseSmartText(text, accounts = [], categories = []) {
  if (!text || typeof text !== 'string') return null;

  const lower = text.toLowerCase();
  const tx = {
    amount: 0,
    currency: 'RON',
    type: 'Expense',
    date: new Date().toISOString().slice(0, 10),
    accountId: '',
    categoryId: '',
    description: text.trim(), // Keep raw prompt as requested to preserve context
  };

  // 1. Parse Amount
  // Matches any integer number. e.g. 15, 200
  const amountMatch = text.match(/\b(\d+)\b/);
  if (amountMatch) {
    tx.amount = parseInt(amountMatch[1], 10);
  } else {
    // If we absolutely cannot find a number, we can't create a transaction.
    return null;
  }

  // 2. Parse Type
  if (/\b(income|salary|bonus|paycheck)\b/.test(lower)) {
    tx.type = 'Income';
  }

  // 3. Parse Date
  const today = new Date();
  if (/\byesterday\b/.test(lower)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    tx.date = yesterday.toISOString().slice(0, 10);
  } else if (/\bday before yesterday\b/.test(lower)) {
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);
    tx.date = dayBefore.toISOString().slice(0, 10);
  }

  // 4. Parse Account
  // The user explicitly requested to default to Revolut.
  const revolutAccount = accounts.find(a => a.name.toLowerCase().includes('revolut'));
  let matchedAccount = null;

  // Check if they explicitly mentioned any account name
  for (const account of accounts) {
    if (lower.includes(account.name.toLowerCase())) {
      matchedAccount = account;
      break;
    }
  }

  if (matchedAccount) {
    tx.accountId = matchedAccount.id;
  } else if (revolutAccount) {
    tx.accountId = revolutAccount.id;
  } else if (accounts.length > 0) {
    tx.accountId = accounts[0].id;
  }

  // 5. Parse Category
  // We sort categories by descending length so "Eating Out" matches before "Eating"
  const sortedCategories = [...categories].sort((a, b) => b.name.length - a.name.length);
  
  for (const category of sortedCategories) {
    const catNameLower = category.name.toLowerCase();
    // Allow fuzzy substring matching for category names
    if (lower.includes(catNameLower)) {
      tx.categoryId = category.id;
      break;
    }
  }

  return tx;
}
