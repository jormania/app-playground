/**
 * Parses a natural language string into a transaction object for the Where It Went app.
 */
// A heuristic map of common expense keywords to standard category concepts
const CATEGORY_HEURISTICS = {
  'food': ['lunch', 'dinner', 'breakfast', 'coffee', 'starbucks', 'cafe', 'restaurant', 'meal', 'pizza', 'burger', 'drink', 'beverage', 'bar', 'mcdonalds', 'kfc', 'subway'],
  'groceries': ['supermarket', 'market', 'kaufland', 'carrefour', 'lidl', 'auchan', 'mega image', 'profi', 'penny', 'water', 'milk', 'grocery'],
  'transport': ['uber', 'bolt', 'taxi', 'bus', 'train', 'metro', 'flight', 'fuel', 'gas', 'parking', 'transit'],
  'shopping': ['amazon', 'clothes', 'shoes', 'electronics', 'gift', 'mall', 'store', 'emag', 'zara', 'h&m'],
  'health': ['pharmacy', 'doctor', 'meds', 'hospital', 'dentist', 'gym', 'fitness', 'medical'],
  'entertainment': ['movie', 'cinema', 'netflix', 'spotify', 'game', 'concert', 'party', 'club'],
  'bills': ['electricity', 'internet', 'phone', 'rent', 'subscription', 'utility', 'utilities'],
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

  const stripRegex = (regex) => {
    remainingText = remainingText.replace(regex, ' ');
  };
  
  const stripString = (str) => {
    const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    remainingText = remainingText.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
  };

  // 1. Parse Amount
  const amountMatch = text.match(/\b(\d+)\b/);
  if (amountMatch) {
    tx.amount = parseInt(amountMatch[1], 10);
    remainingText = remainingText.replace(new RegExp(`\\b${amountMatch[1]}\\b`), ' ');
  } else {
    return null;
  }

  // 2. Parse Type
  const typeMatch = remainingText.match(/\b(income|salary|bonus|paycheck)\b/i);
  if (typeMatch) {
    tx.type = 'Income';
    // We intentionally do NOT strip the income keyword so the description doesn't become empty
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
    // Check for exact substring match first
    if (remainingText.toLowerCase().includes(account.name.toLowerCase())) {
      matchedAccount = account;
      stripString(account.name);
      break;
    }
    // Fallback: check if the first word of the account name is mentioned (e.g. "ING" for "ING Bank")
    const firstWord = account.name.split(' ')[0].toLowerCase();
    if (firstWord.length > 2 && new RegExp(`\\b${firstWord}\\b`, 'i').test(remainingText)) {
      matchedAccount = account;
      stripString(firstWord);
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
  
  // Phase 1: Try strict matching (the user literally typed the exact category name)
  for (const category of sortedCategories) {
    const catNameLower = category.name.toLowerCase();
    if (remainingText.toLowerCase().includes(catNameLower)) {
      tx.categoryId = category.id;
      break;
    }
  }

  // Phase 2: If strict match failed, try heuristic inference based on common keywords
  let matchedKeyword = null;
  if (!tx.categoryId) {
    for (const [concept, keywords] of Object.entries(CATEGORY_HEURISTICS)) {
      const foundKeyword = keywords.find(k => remainingText.toLowerCase().includes(k));
      if (foundKeyword) {
        // We found a hit in our heuristic map (e.g. they typed "uber", concept is "transport").
        // Now try to map this "concept" to the user's actual dynamic category array.
        // Try strict concept match first
        let inferredCategory = sortedCategories.find(c => c.name.toLowerCase().includes(concept));
        
        // If not found, try fallbacks
        if (!inferredCategory) {
          inferredCategory = sortedCategories.find(c => 
            (concept === 'transport' && c.name.toLowerCase().includes('transit')) ||
            (concept === 'food' && c.name.toLowerCase().includes('dining')) ||
            (concept === 'groceries' && c.name.toLowerCase().includes('food')) 
          );
        }

        if (inferredCategory) {
          tx.categoryId = inferredCategory.id;
          matchedKeyword = foundKeyword;
          break;
        }
      }
    }
  }

  // Also strip structural parasite words like "for", "from", "at", "to", "in", "on", "a", "the", "with"
  stripRegex(/\b(for|from|at|to|in|on|a|an|the|with)\b/gi);

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
