/**
 * AI-powered transaction parser using Claude (Anthropic API).
 */

export async function parseTextWithAI(text, accounts, categories, apiKey) {
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

  const systemPrompt = `You are a financial transaction parser. The user will provide a natural language string describing an expense, income, or transfer.
You must return a valid JSON object matching this schema exactly:
{
  "amount": Number,
  "categoryId": String,
  "accountId": String,
  "toAccountId": String,
  "type": "Expense" | "Income" | "Transfer",
  "description": String,
  "date": String
}

Available Categories:
${categoryList}

Available Accounts:
${accountList}

Rules:
1. ONLY return the raw JSON object. Do not wrap in markdown or backticks. No conversational filler.
2. "amount" MUST be a positive Number (e.g. 15, not "15"). If no amount is found, return an error object instead: {"error": "No amount found"}.
3. "description" should be clean and concise (e.g., "Uber to mall", "Lunch"). Strip off any trailing prepositions that were meant to introduce the amount.
4. "date" MUST be a string in "YYYY-MM-DD" format. Today is ${todayStr}. Interpret words like "yesterday", "last friday", or specific dates relative to today. If no date is given or implied, use today's date (${todayStr}).
5. "type" MUST be "Expense", "Income", or "Transfer". Default to "Expense".
6. "categoryId": Find the ID of the most appropriate category from the list. This is required unless type is Transfer.
7. "accountId": Find the ID of the most appropriate account from the list. If the user mentions an account name (e.g. "Revolut"), use its ID. If they don't specify, use your best judgment or default to the most generic/first account.
8. "toAccountId": ONLY provide this if type is "Transfer". It is the ID of the destination account.`;

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
      max_tokens: 150,
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

  if (parsed.error) {
    return null; // Signals to the caller that amount wasn't found or parse failed
  }

  if (!parsed.amount || !parsed.accountId) {
    return null; // Minimum viable transaction fields missing
  }

  return {
    description: parsed.description,
    amount: parsed.amount,
    date: parsed.date,
    type: parsed.type || 'Expense',
    categoryId: parsed.categoryId,
    accountId: parsed.accountId,
    toAccountId: parsed.toAccountId,
  };
}
