/**
 * Parses a natural language string into a transaction object for the Where It Went app.
 */
export function parseSmartText(text, accounts = [], categories = []) {
  if (!text || typeof text !== 'string') return null;

  let remainingText = text;
  const lower = text.toLowerCase();
  
  const tx = {
    amount: 0,
    currency: 'RON',
    type: 'Expense',
    date: new Date().toISOString().slice(0, 10),
    accountId: '',
    categoryId: '',
    description: '',
  };

  // Helper to remove a regex match from remainingText (case insensitive)
  const stripRegex = (regex) => {
    remainingText = remainingText.replace(regex, ' ');
  };
  
  // Helper to remove a literal string from remainingText (case insensitive)
  const stripString = (str) => {
    const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    remainingText = remainingText.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
  };

  // 1. Parse Amount
  const amountMatch = text.match(/\b(\d+)\b/);
  if (amountMatch) {
    tx.amount = parseInt(amountMatch[1], 10);
    // Strip the exact matched number
    remainingText = remainingText.replace(new RegExp(`\\b${amountMatch[1]}\\b`), ' ');
  } else {
    return null;
  }

  // 2. Parse Type
  const typeMatch = remainingText.match(/\b(income|salary|bonus|paycheck)\b/i);
  if (typeMatch) {
    tx.type = 'Income';
    stripRegex(/\b(income|salary|bonus|paycheck)\b/gi);
  }

  // 3. Parse Date
  const today = new Date();
  if (/\byesterday\b/i.test(remainingText)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    tx.date = yesterday.toISOString().slice(0, 10);
    stripRegex(/\byesterday\b/gi);
  } else if (/\bday before yesterday\b/i.test(remainingText)) {
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);
    tx.date = dayBefore.toISOString().slice(0, 10);
    stripRegex(/\bday before yesterday\b/gi);
  } else if (/\btoday\b/i.test(remainingText)) {
    stripRegex(/\btoday\b/gi);
  }

  // 4. Parse Account
  const revolutAccount = accounts.find(a => a.name.toLowerCase().includes('revolut'));
  let matchedAccount = null;

  for (const account of accounts) {
    if (remainingText.toLowerCase().includes(account.name.toLowerCase())) {
      matchedAccount = account;
      stripString(account.name);
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
  const sortedCategories = [...categories].sort((a, b) => b.name.length - a.name.length);
  
  for (const category of sortedCategories) {
    const catNameLower = category.name.toLowerCase();
    if (remainingText.toLowerCase().includes(catNameLower)) {
      tx.categoryId = category.id;
      stripString(category.name);
      break;
    }
  }
  
  // Also strip structural parasite words like "for", "from", "at", "to", "in", "on", "a", "the"
  stripRegex(/\b(for|from|at|to|in|on|a|an|the)\b/gi);

  // Clean up extra spaces and punctuation left behind
  let cleanedDesc = remainingText.replace(/\s+/g, ' ').trim();
  
  // Capitalize the first letter of the description
  if (cleanedDesc.length > 0) {
    tx.description = cleanedDesc.charAt(0).toUpperCase() + cleanedDesc.slice(1);
  } else {
    tx.description = '';
  }

  return tx;
}
