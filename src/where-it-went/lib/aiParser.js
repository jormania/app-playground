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
      "date": String
    }
  ]
}

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
5. "amount" MUST be a positive Number (e.g. 15). If the user mentions a foreign currency (e.g., "paid 20 EUR" but the account is RON), map the "amount" to your best estimate or the raw value, but you MUST provide "originalAmount" (Number) and "originalCurrency" (String, e.g. "EUR") so the system can calculate the real exchange rate.
6. "description" should be clean and concise (e.g., "Uber to mall", "Lunch"). Strip off any trailing prepositions that were meant to introduce the amount.
7. "date" MUST be a string in "YYYY-MM-DD" format. Today is ${todayStr}. Interpret words like "yesterday" relative to today. If no date is given, use today's date (${todayStr}).
8. "type" MUST be "Expense", "Income", or "Transfer". Default to "Expense".
9. "categoryId": Find the ID of the most appropriate category from the list. This is required unless type is Transfer.
10. "accountId": Find the ID of the most appropriate account from the list. If they mention an account (e.g. "Revolut"), use its ID. If they don't, use your best judgment or default to the most generic/first account.
11. "toAccountId": ONLY provide this if type is "Transfer".
12. "tripId": ONLY provide this if the transaction is associated with one of the Available Trips.`;

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
