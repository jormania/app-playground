/**
 * AI-powered transaction parser using Claude (Anthropic API).
 */
import { toDateString, parseTxDate } from './period';
import { CURRENCIES, canConvert, fetchRate, convert, BASE_CURRENCY } from './fx';
import { pickDefaultAccount } from './accountPicker';

const MODEL = 'claude-haiku-4-5-20251001';
/** Generous, but bounded — without this a hung connection left isParsing true
 * (and the input disabled) indefinitely, with no way to cancel. */
const REQUEST_TIMEOUT_MS = 20000;

/**
 * One place for both Claude calls in this file: the request, its timeout, and
 * the response-shape guards. `askInsightsAI` used to skip the empty-response
 * guard `parseTextWithAI` had — sharing this closes that gap for both.
 */
async function callClaude(apiKey, { system, message, maxTokens, temperature }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: message }],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('The AI took too long to respond. Please try again.');
    }
    throw new Error(`Could not reach the AI service: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let errText = '';
    try {
      const errJson = await res.json();
      errText = errJson.error?.message || res.statusText;
    } catch (_e) {
      errText = res.statusText;
    }
    throw new Error(`API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rawText = data?.content?.[0]?.text;
  if (typeof rawText !== 'string') {
    throw new Error('The AI returned an empty response. Please try again.');
  }
  return rawText;
}

/**
 * Normalizes and validates a currency code against the app's registered
 * vocabulary. Notion's `Original Currency` select is closed — an unregistered
 * value rejects the *entire* atomic write, not just this field — so a code the
 * AI mis-cases ("eur") or hallucinates outright ("US Dollar") must never reach
 * that call. Returns `null` when it can't be resolved.
 */
export function normalizeCurrency(code) {
  const upper = String(code || '').trim().toUpperCase();
  return CURRENCIES.includes(upper) ? upper : null;
}

function isValidId(id, validIds) {
  return !!id && validIds.has(id);
}

/**
 * Validates and repairs the ids and currency one parsed transaction came back
 * with, and re-derives the RON amount from a live ECB rate rather than
 * trusting the model's own conversion guess (the prompt only ever asks it for
 * "your best estimate or the raw value" — the manual entry form has never
 * trusted that for real money, and this shouldn't either).
 *
 * Deliberately asymmetric about what counts as recoverable:
 *   - categoryId / tripId: a bad one is dropped, not the transaction. Showing
 *     up as "⚠️ Unknown" or with no trip is a one-tap fix; losing the whole
 *     entry over a wrong category is worse than that.
 *   - accountId: falls back to the same category-aware default the manual
 *     form uses (`pickDefaultAccount`) rather than dropping the transaction —
 *     every create needs *some* real account to post against.
 *   - originalCurrency: a value outside the registered set is stripped
 *     entirely (both currency and original amount), falling back to a plain
 *     RON transaction at the AI's own `amount` — better than a write Notion
 *     rejects outright over one bad enum value.
 *   - a Transfer's `toAccountId`: not repaired. A transfer between two
 *     fabricated (or identical) accounts isn't "mostly right" the way a wrong
 *     category is — it *is* the transaction, so an unresolvable one is
 *     dropped by `hardenTransactions` below instead of guessed at.
 */
export async function hardenTransaction(tx, { categories = [], accounts = [], trips = [] } = {}) {
  if (tx.action === 'delete') return tx;

  const categoriesById = new Map(categories.map(c => [c.id, c]));
  const validCategoryIds = new Set(categories.map(c => c.id));
  const validAccountIds = new Set(accounts.map(a => a.id));
  const validTripIds = new Set(trips.map(t => t.id));

  const next = { ...tx };

  if (next.categoryId && !isValidId(next.categoryId, validCategoryIds)) {
    next.categoryId = '';
  }

  if (!isValidId(next.accountId, validAccountIds)) {
    const category = categoriesById.get(next.categoryId) || null;
    const fallback = pickDefaultAccount(category, accounts);
    next.accountId = fallback ? fallback.id : '';
  }

  if (next.type === 'Transfer') {
    if (!isValidId(next.toAccountId, validAccountIds) || next.toAccountId === next.accountId) {
      next.toAccountId = '';
    }
  } else {
    // Meaningless outside a Transfer — Income/Expense must stay empty here per
    // the schema, regardless of whether the AI happened to hand back a real
    // account id. Keeping a "valid" one would still wrongly write a To Account
    // relation onto a row that isn't a transfer.
    next.toAccountId = '';
  }

  if (next.tripId && !isValidId(next.tripId, validTripIds)) {
    next.tripId = '';
  }

  if (next.originalCurrency) {
    const normalized = normalizeCurrency(next.originalCurrency);
    if (!normalized) {
      next.originalCurrency = '';
      next.originalAmount = null;
    } else {
      next.originalCurrency = normalized;
    }
  }

  if (next.originalCurrency && next.originalAmount != null && canConvert(next.originalCurrency)) {
    try {
      const result = await fetchRate(next.originalCurrency, BASE_CURRENCY, next.date || new Date());
      const converted = result?.rate != null ? convert(next.originalAmount, result.rate) : null;
      if (converted != null) next.amount = converted;
    } catch {
      // A missing/unavailable rate must never block recording a transaction —
      // the same rule lib/fx.js applies everywhere else. Keep the AI's figure.
    }
  }

  return next;
}

/**
 * Hardens a whole parsed batch, then drops any Transfer that still doesn't
 * resolve to two distinct real accounts — the one case above that's a reason
 * to discard the transaction rather than repair a field on it.
 */
export async function hardenTransactions(txs, context) {
  const resolved = await Promise.all(txs.map(tx => hardenTransaction(tx, context)));
  return resolved.filter(t => {
    if (t.type !== 'Transfer') return true;
    if (t.action === 'delete') return true;
    return !!t.toAccountId && t.toAccountId !== t.accountId;
  });
}

export async function parseTextWithAI(text, accounts, categories, trips, apiKey, recentTransactions = []) {
  if (!apiKey) {
    throw new Error('Claude API Key is missing. Please add it in Settings.');
  }

  // Local date, not toISOString() — which is UTC and hands the AI the wrong
  // "today" for anyone east of UTC between local midnight and UTC midnight,
  // throwing off every relative date ("yesterday") it resolves.
  const todayStr = toDateString(new Date());

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
      const end = t.endDate ? parseTxDate(t.endDate) : null;
      if (end && end < sixtyDaysAgo) return false;
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
4. "action" defaults to "create". If the user wants to edit or delete a past transaction (e.g., "change that to 20", "delete the lunch expense"), use "update" or "delete" and provide the "id" from Recent Transactions. ONLY use an "id" that appears verbatim in Recent Transactions above — never invent one. If you cannot find a confident match for what the user wants to edit or delete, prefer "create" instead of guessing at an id.
5. "categoryId" and "accountId" MUST be an ID copied verbatim from the Available Categories / Available Accounts lists above — never invent, abbreviate, or guess at one. If nothing in the list is a good fit, omit the field rather than picking an unrelated one.
6. "amount" MUST be a positive Number (e.g. 15). By default, all values are in RON unless stated otherwise. If the user mentions a foreign currency (e.g., "paid 20 EUR"), set "amount" to your best estimate in RON, but you MUST also provide "originalAmount" (Number, the foreign figure) and "originalCurrency" as one of exactly these codes: ${CURRENCIES.join(', ')}. Your RON estimate is a placeholder only — it is replaced with a live exchange rate after parsing, so accuracy there matters less than getting originalAmount/originalCurrency right.
7. "description" should be clean and concise. Always format it in Title Case. Standardize merchant names to their official brand names (e.g., convert 'McD' to 'McDonald's', 'Mega' to 'Mega Image'). Strip out filler verbs ('spent', 'paid', 'bought') and payment methods ('on card', 'in cash'). Extract only the core essence of the transaction.
8. "description" format: Whenever possible, format it as "<action/item> at/from <venue>" (e.g., "Dinner at McDonald's"). If the user lists multiple items from a single store (e.g., 'milk and eggs at Mega Image'), summarize the description as '[Category] at [Venue]' (e.g., 'Groceries at Mega Image') and move the detailed list of items into the "notes" field. If the expense is for Nora and categorized as such, DO NOT include phrases like "for Nora" or "with Nora" in the description.
9. "date" MUST be a string in "YYYY-MM-DD" format. Today is ${todayStr}. Interpret words like "yesterday" relative to today. If no date is given, use today's date (${todayStr}).
10. "type" MUST be "Expense", "Income", or "Transfer". Default to "Expense".
11. "categoryId": Find the ID of the most appropriate category from the list. Use your broad knowledge of Romanian vendors and chains to accurately classify merchants:
   - Utilities (e.g., PPC, Enel, Engie, E.ON, Digi, Orange, Vodafone)
   - Groceries (e.g., Mega Image, Kaufland, Lidl, Carrefour, Auchan, Sezamo, Freshful)
   - Pharmacies/Health (e.g., Catena, Dr. Max, Help Net, Dona)
   - Shopping/Retail (e.g., eMAG, Altex, Dedeman, IKEA, Zara, H&M)
   - Entertainment/Dining (e.g., Cinema City, local restaurants, museums, Glovo, Tazz)
   - Transport (e.g., Uber, Bolt, CFR)
   This mapping is required unless type is Transfer.
12. "accountId": Find the ID of the most appropriate account from the list. By default, use the plain "Revolut" account (NOT Revolut EUR). Only use a different account if the user explicitly asks for it (e.g. "cash", "BCR", "Revolut EUR").
13. "toAccountId": ONLY provide this if type is "Transfer", and it MUST be a different account ID than "accountId" — a transfer needs two distinct real accounts, not the same one twice.
14. "tripId": ONLY provide this if the transaction is associated with one of the Available Trips, using its ID verbatim.`;

  const rawText = await callClaude(apiKey, {
    system: systemPrompt,
    message: text,
    maxTokens: 1000,
    temperature: 0.1,
  });

  let responseText = rawText.trim();

  // Strip potential markdown wrappers just in case
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```(json)?\n/, '').replace(/\n```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    // A max_tokens truncation (batch mode emits one object per transaction) or
    // any other malformed reply must read as a normal, retryable failure — not
    // an uncaught SyntaxError.
    throw new Error('Could not understand the AI response — it may have been cut off. Try a shorter description.');
  }

  if (!parsed.transactions || !Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
    return []; // No valid transactions found
  }

  const mapped = parsed.transactions.map(t => ({
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
  })).filter(t => {
    // Strip out completely invalid ones. An update/delete needs an id to act
    // on. A create just needs an amount — accountId is no longer a reason to
    // drop it here, since hardenTransactions below always resolves it to a
    // real account (falling back to the same default the manual form uses)
    // rather than losing the whole transaction over one bad or missing id.
    if (t.action === 'delete') return !!t.id;
    if (t.action === 'update') return !!t.id;
    return !!t.amount;
  });

  return hardenTransactions(mapped, { categories, accounts, trips });
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

  const rawText = await callClaude(apiKey, {
    system: systemPrompt,
    message: question,
    maxTokens: 500,
    temperature: 0.2,
  });

  return rawText.trim();
}
