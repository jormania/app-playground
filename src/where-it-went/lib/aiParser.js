/**
 * AI-powered transaction parser using Claude (Anthropic API).
 */

export async function parseTextWithAI(text, accounts, categories, trips, apiKey, recentTransactions = []) {
  if (!apiKey) {
    throw new Error('Claude API Key is missing. Please add it in Settings.');
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const categoryList = (categories || [])
    .filter(c => c.active !== false && c.id && c.name)
    .map(c => `- ${c.name} (Type: ${c.type}, ID: ${c.id})`)
    .join('\n');

  const accountList = (accounts || [])
    .filter(a => a.active !== false && a.id && a.name)
    .map(a => `- ${a.name} (Currency: ${a.currency || 'RON'}, ID: ${a.id})`)
    .join('\n');

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const tripList = (trips || [])
    .filter(t => {
      if (!t.id || !t.name) return false;
      if (t.endDate && new Date(t.endDate) < sixtyDaysAgo) return false;
      return true;
    })
    .map(t => `- ${t.name} (ID: ${t.id})`)
    .join('\n');

  const recentList = recentTransactions
    .map(t => `- [ID: ${t.id}] ${t.date}: ${t.description} (${t.amount} ${t.currency || 'RON'})`)
    .join('\n');

  const systemPrompt = `You are a financial transaction parser. The user will provide a natural language string describing one or more expenses, incomes, or transfers.
You can CREATE new transactions, or UPDATE/DELETE existing ones from the Recent Transactions context.
You must return a valid JSON object matching this schema exactly:
{
  "transactions": [
    {
      "action": "create" | "update" | "delete",
      "id": String, // REQUIRED ONLY if action is update or delete (must match an ID from Recent Transactions)
      "isSubscription": Boolean, // true ONLY if it sounds like a recurring bill (e.g. Netflix, Spotify, Rent)
      "amount": Number,
      "originalAmount": Number,
      "originalCurrency": String,
      "categoryId": String,
      "accountId": String,
      "toAccountId": String,
      "tripId": String,
      "type": "Expense" | "Income" | "Transfer",
      "description": String,
      "notes": String,
      "date": String
    }
  ]
}

Examples:
- Input: "paid 50 RON on card for lunch at japanos"
  Output JSON: {"transactions": [{"action": "create", "amount": 50, "description": "Lunch at Japanos", "date": "${todayStr}", "type": "Expense", "categoryId": "<ID for Dining>"}]}
- Input: "bought milk, eggs, and bread at e-mag for 200"
  Output JSON: {"transactions": [{"action": "create", "amount": 200, "description": "Groceries at eMAG", "notes": "milk, eggs, and bread", "date": "${todayStr}", "type": "Expense", "categoryId": "<ID for Groceries>"}]}

Available Categories:
${categoryList}

Available Accounts:
${accountList}

Available Trips:
${tripList || 'None'}

Recent Transactions (for context/updates):
${recentList || 'None'}

Rules:
1. ONLY return the raw JSON object. Do not wrap in markdown or backticks. No conversational filler.
2. The user might describe multiple transactions in one message. Create a discrete object for each one in the "transactions" array.
3. If the user mentions a SPLIT expense (e.g., "Paid 100 for dinner but John owes me 50"), return TWO transactions: one Expense for 100 on "Dining" (or similar), and one Income/Transfer for 50 representing the debt to be received.
4. "action" defaults to "create". If the user wants to edit or delete a past transaction (e.g., "change that to 20", "delete the lunch expense"), use "update" or "delete" and provide the "id" from Recent Transactions.
5. "amount" MUST be a positive Number (e.g. 15). By default, all values are in RON unless stated otherwise. If the user mentions a foreign currency (e.g., "paid 20 EUR"), map the "amount" to your best estimate or the raw value, but you MUST provide "originalAmount" (Number) and "originalCurrency" (String, e.g. "EUR").
6. "description" should be clean and concise. Always format it in Title Case. Standardize merchant names to their official brand names (e.g., convert 'McD' to 'McDonald's', 'Mega' to 'Mega Image'). Strip out filler verbs ('spent', 'paid', 'bought') and payment methods ('on card', 'in cash'). Extract only the core essence of the transaction.
7. "description" format: Whenever possible, format it as "<action/item> at/from <venue>" (e.g., "Dinner at McDonald's"). If the user lists multiple items from a single store (e.g., 'milk and eggs at Mega Image'), summarize the description as '[Category] at [Venue]' (e.g., 'Groceries at Mega Image') and move the detailed list of items into the "notes" field. If the expense is for Nora and categorized as such, DO NOT include phrases like "for Nora" or "with Nora" in the description.
8. "date" MUST be a string in "YYYY-MM-DD" format. Today is ${todayStr}. Interpret words like "yesterday" relative to today. If no date is given, use today's date (${todayStr}).
9. "type" MUST be "Expense", "Income", or "Transfer". Default to "Expense".
10. "categoryId": Find the ID of the most appropriate category from the list. Use your broad knowledge of Romanian vendors and chains to accurately classify merchants:
   - Utilities (e.g., PPC, Enel, Engie, E.ON, Digi, Orange, Vodafone)
   - Groceries (e.g., Mega Image, Kaufland, Lidl, Carrefour, Auchan, Sezamo, Freshful)
   - Pharmacies/Health (e.g., Catena, Dr. Max, Help Net, Dona)
   - Shopping/Retail (e.g., eMAG, Altex, Dedeman, IKEA, Zara, H&M)
   - Entertainment/Dining (e.g., Cinema City, local restaurants, museums, Glovo, Tazz)
   - Transport (e.g., Uber, Bolt, CFR)
   This mapping is required unless type is Transfer.
11. "accountId": Find the ID of the most appropriate account from the list. By default, use the plain "Revolut" account (NOT Revolut EUR). Only use a different account if the user explicitly asks for it (e.g. "cash", "BCR", "Revolut EUR").
12. "toAccountId": ONLY provide this if type is "Transfer".
13. "tripId": ONLY provide this if the transaction is associated with one of the Available Trips.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: text,
        },
      ],
    }),
  });

  if (!res.ok) {
    let errText = '';
    try {
      const errJson = await res.json();
      errText = errJson.error?.message || res.statusText;
    } catch (e) {
      errText = res.statusText;
    }
    throw new Error(`API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  let responseText = data.content[0].text.trim();

  // Strip potential markdown wrappers just in case
  if (responseText.startsWith('\`\`\`')) {
    responseText = responseText.replace(/^\`\`\`(json)?\n/, '').replace(/\n\`\`\`$/, '');
  }

  const parsed = JSON.parse(responseText);

  if (!parsed.transactions || !Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
    return []; // No valid transactions found
  }

  return parsed.transactions.map(t => ({
    action: t.action || 'create',
    id: t.id,
    isSubscription: !!t.isSubscription,
    description: t.description,
    notes: t.notes,
    amount: t.amount,
    originalAmount: t.originalAmount,
    originalCurrency: t.originalCurrency,
    date: t.date,
    type: t.type || 'Expense',
    categoryId: t.categoryId,
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    tripId: t.tripId,
  })).filter(t => (t.action === 'delete' && t.id) || (t.amount && (t.accountId || t.action === 'update'))); // Strip out completely invalid ones
}


export async function askInsightsAI(question, transactions, categories, apiKey) {
  if (!apiKey) {
    throw new Error('Claude API Key is missing. Please add it in Settings.');
  }

  const categoryList = (categories || [])
    .filter(c => c.active !== false && c.id && c.name)
    .map(c => `- ${c.name} (Type: ${c.type})`)
    .join('\n');

  // To keep tokens low and relevant, we pass a compressed JSON representation
  // of the transactions provided.
  const compressedTxs = transactions.map(t => ({
    d: t.date,
    desc: t.description,
    amt: t.amount,
    cat: categories?.find(c => c.id === t.categoryId)?.name || 'Unknown',
    t: t.type
  }));

  const systemPrompt = `You are a helpful, analytical financial assistant. 
You are answering a question about the user's spending data for a specific period.
The user's categories are:
${categoryList}

Here is the JSON data of their transactions for the period in question:
${JSON.stringify(compressedTxs)}

Rules for your response:
1. Answer the user's question accurately based ONLY on the provided data.
2. Keep your answer extremely concise, short, and snappy (1-3 sentences max).
3. Do NOT "roast" the user or be judgmental. Be encouraging and analytical.
4. Use basic markdown for formatting (bolding numbers, etc.) but do not output a code block.
5. If the data provided does not contain the answer, say so politely.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: question,
        },
      ],
    }),
  });

  if (!res.ok) {
    let errText = '';
    try {
      const errJson = await res.json();
      errText = errJson.error?.message || res.statusText;
    } catch (e) {
      errText = res.statusText;
    }
    throw new Error(`API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.content[0].text.trim();
}
