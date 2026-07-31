/**
 * Parses a natural language string into a transaction object for the Where It Went app.
 */
// A heuristic map of common expense keywords to standard category concepts
// Maps to: Freelance, Other, Investing, Taxes & Fees, Property, Health, Shopping, Leisure, Nora, Travel, Transport, Dining, Food, Utilities, Housing, Loan, Gift, Rent, Salary
const CATEGORY_HEURISTICS = {
  'food': ['lunch', 'breakfast', 'coffee', 'starbucks', 'cafe', 'restaurant', 'meal', 'pizza', 'burger', 'drink', 'beverage', 'bar', 'mcdonalds', 'kfc', 'subway', 'supermarket', 'market', 'kaufland', 'carrefour', 'lidl', 'auchan', 'mega image', 'profi', 'penny', 'water', 'milk', 'grocery', 'groceries'],
  'dining': ['dinner', 'date'],
  'transport': ['uber', 'bolt', 'taxi', 'bus', 'train', 'metro', 'flight', 'fuel', 'gas', 'parking', 'transit'],
  'shopping': ['amazon', 'clothes', 'shoes', 'electronics', 'mall', 'store', 'emag', 'zara', 'h&m'],
  'health': ['pharmacy', 'doctor', 'meds', 'hospital', 'dentist', 'gym', 'fitness', 'medical'],
  'leisure': ['movie', 'cinema', 'netflix', 'spotify', 'game', 'concert', 'party', 'club', 'entertainment', 'hobby'],
  'utilities': ['electricity', 'internet', 'phone', 'subscription', 'utility', 'bills', 'water bill', 'gas bill'],
  'gift': ['present', 'gift'],
  'travel': ['hotel', 'airbnb', 'flight', 'vacation', 'holiday'],
  'nora': ['nora'],
};

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

  // Helper to remove an exact regex match
  const stripRegex = (regex) => {
    remainingText = remainingText.replace(regex, ' ');
  };
  
  // Helper to remove an exact string match
  const stripString = (str) => {
    const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    remainingText = remainingText.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
  };

  // 0. Pre-clean structural action words and explicit currency
  stripRegex(/\b(bought a|bought|paid for|paid|spent|cost|charged|sent to|sent|transferred to|transferred|gave)\b/gi);
  stripRegex(/\b(lei|ron|bucks|dollars|euro|euros)\b/gi);

  // 1. Parse Amount (swallow optional decimals so they don't linger, e.g. 25.50)
  const amountMatch = text.match(/\b(\d+)(?:[.,]\d+)?\b/);
  if (amountMatch) {
    tx.amount = parseInt(amountMatch[1], 10);
    remainingText = remainingText.replace(amountMatch[0], ' ');
  } else {
    return null;
  }

  // 2. Parse Type
  const typeMatch = remainingText.match(/\b(income|salary|bonus|paycheck)\b/i);
  if (typeMatch) {
    tx.type = 'Income';
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
    const accName = account.name;
    const accFirstWord = accName.split(' ')[0];
    
    // Create regexes that optionally swallow the preposition that points to the account
    const exactRegex = new RegExp(`\\b(?:from|using|with|to)?\\s*${accName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const firstWordRegex = new RegExp(`\\b(?:from|using|with|to)?\\s*${accFirstWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');

    if (remainingText.toLowerCase().includes(accName.toLowerCase())) {
      matchedAccount = account;
      stripRegex(exactRegex);
      break;
    }
    if (accFirstWord.length > 2 && new RegExp(`\\b${accFirstWord}\\b`, 'i').test(remainingText)) {
      matchedAccount = account;
      stripRegex(firstWordRegex);
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

  // 5. Parse Category (Strict & Heuristic Inference)
  const sortedCategories = [...categories].sort((a, b) => b.name.length - a.name.length);
  
  for (const category of sortedCategories) {
    const catNameLower = category.name.toLowerCase();
    if (remainingText.toLowerCase().includes(catNameLower)) {
      tx.categoryId = category.id;
      break;
    }
  }

  if (!tx.categoryId) {
    for (const [concept, keywords] of Object.entries(CATEGORY_HEURISTICS)) {
      const foundKeyword = keywords.find(k => remainingText.toLowerCase().includes(k));
      if (foundKeyword) {
        let inferredCategory = sortedCategories.find(c => c.name.toLowerCase().includes(concept));
        if (!inferredCategory) {
          inferredCategory = sortedCategories.find(c => 
            (concept === 'food' && c.name.toLowerCase().includes('dining')) ||
            (concept === 'dining' && c.name.toLowerCase().includes('food'))
          );
        }
        if (inferredCategory) {
          tx.categoryId = inferredCategory.id;
          break;
        }
      }
    }
  }

  // 6. Contextual Cleanup for Description
  // Clean up extra spaces
  let cleanedDesc = remainingText.replace(/\s+/g, ' ').trim();
  
  // Clean up stray punctuation
  cleanedDesc = cleanedDesc.replace(/[.,;:]/g, '');

  // Strip dangling preposition/article combinations from the START
  let previous;
  do {
    previous = cleanedDesc;
    cleanedDesc = cleanedDesc.replace(/^(for|from|at|to|in|on|with|a|an|the)\s+/i, '').trim();
  } while (cleanedDesc !== previous);

  // Strip dangling preposition/article combinations from the END
  do {
    previous = cleanedDesc;
    cleanedDesc = cleanedDesc.replace(/\s+(for|from|at|to|in|on|with|a|an|the)$/i, '').trim();
  } while (cleanedDesc !== previous);

  // Final trim
  cleanedDesc = cleanedDesc.trim();

  // Capitalize the first letter of the description
  if (cleanedDesc.length > 0) {
    tx.description = cleanedDesc.charAt(0).toUpperCase() + cleanedDesc.slice(1);
  } else {
    // Fallback if description is empty
    if (tx.categoryId) {
      const cat = categories.find(c => c.id === tx.categoryId);
      tx.description = cat ? cat.name : 'Expense';
    } else {
      tx.description = 'Expense';
    }
  }

  return tx;
}
