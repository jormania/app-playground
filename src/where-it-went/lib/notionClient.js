import { DEMO_CATEGORIES, DEMO_ACCOUNTS, DEMO_TRANSACTIONS, DEMO_SUBSCRIPTIONS, DEMO_TRIPS } from '../models/demoData';

const PROXY_URL = '/api/notion';

/** Notion allows ~3 requests/second. Sequential bulk work paces itself with this. */
const WRITE_SPACING_MS = 350;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export class NotionError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'NotionError';
    this.status = status;
  }
}

const relation = (id) => ({ relation: id ? [{ id }] : [] });
/**
 * Notion splits any styled text into several runs, so a note typed in Notion with
 * one bold word or a link arrives as `[{...}, {...}, ...]`. Reading `[0].plain_text`
 * truncated it at the first run — join them instead.
 */
const plainText = (runs) => (Array.isArray(runs) ? runs.map(r => r?.plain_text || '').join('') : '');
const richText = (value) => ({ rich_text: value ? [{ text: { content: String(value) } }] : [] });
const title = (value) => ({ title: [{ text: { content: String(value ?? '') } }] });

export class NotionClient {
  constructor(token, dbIds) {
    this.token = token;
    this.dbIds = dbIds;
  }

  /**
   * Every call to Notion goes through here.
   *
   * The old code only checked `response.ok` when *reading*: all ten write methods
   * returned `response.json()` regardless of a 400/401/429, so a rejected write was
   * indistinguishable from a successful one and the UI happily closed the modal.
   * Now a non-2xx throws, and 429/5xx are retried with backoff.
   */
  async _request({ path, method = 'POST', body, retries = MAX_RETRIES }) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      let response;
      try {
        response = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
          body: JSON.stringify({ path, method, body }),
        });
      } catch (e) {
        lastError = new NotionError(`Network error talking to Notion: ${e.message}`, 0);
        if (attempt < retries) { await sleep(500 * (attempt + 1)); continue; }
        throw lastError;
      }

      if (response.ok) {
        return response.json().catch(() => ({}));
      }

      const payload = await response.json().catch(() => ({}));
      lastError = new NotionError(
        payload.message || `Notion API error ${response.status}`,
        response.status,
      );

      // Rate limits and transient server errors are worth another try; 4xx is not.
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < retries) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      throw lastError;
    }

    throw lastError;
  }

  /** Fetches ALL pages from a Notion database query, handling pagination automatically. */
  async _fetchAllPages(dbId, body = {}) {
    const allResults = [];
    let cursor;
    const seenCursors = new Set();

    do {
      const queryBody = { ...body, page_size: 100 };
      if (cursor) queryBody.start_cursor = cursor;
      const data = await this._request({ path: `databases/${dbId}/query`, method: 'POST', body: queryBody });
      allResults.push(...(data.results || []));
      const next = data.has_more ? data.next_cursor : undefined;
      // Defensive: a repeated cursor would otherwise spin forever.
      if (next && seenCursors.has(next)) break;
      if (next) seenCursors.add(next);
      cursor = next;
    } while (cursor);

    return allResults;
  }

  /**
   * With no token at all we are in first-run/demo territory and serve sample data.
   * With a token but a missing database id we return nothing — quietly mixing demo
   * rows into a live workspace would be worse than an empty section.
   */
  _demoOr(dbId, demoRows) {
    if (!this.token) return { use: true, rows: [...demoRows] };
    if (!dbId) return { use: true, rows: [] };
    return { use: false, rows: null };
  }

  async fetchCategories() {
    const demo = this._demoOr(this.dbIds?.categories, DEMO_CATEGORIES);
    if (demo.use) return demo.rows;

    const rows = await this._fetchAllPages(this.dbIds.categories);
    return rows
      .map(row => ({
        id: row.id,
        name: plainText(row.properties.Name?.title),
        type: row.properties.Type?.select?.name || 'Expense',
        icon: row.icon?.type === 'emoji' ? row.icon.emoji : null,
        description: plainText(row.properties.Description?.rich_text),
        budgetLimit: row.properties['Monthly Limit (RON)']?.number || null,
        // The property keeps its original name for schema stability — renaming it
        // would break every existing database — but it now means "limit for one
        // budget period", which is monthly only when Budget Period says so.
        budgetPeriod: row.properties['Budget Period']?.select?.name || 'Monthly',
        budgetAnchor: (row.properties['Budget Anchor']?.date?.start || '').slice(0, 10) || null,
        budgetRollover: row.properties['Budget Rollover']?.checkbox === true
      }))
      .filter(c => c.name.trim() !== ''); // drop rows with a blank title
  }

  async fetchAccounts() {
    const demo = this._demoOr(this.dbIds?.accounts, DEMO_ACCOUNTS);
    if (demo.use) return demo.rows;

    const rows = await this._fetchAllPages(this.dbIds.accounts);
    return rows.map(row => ({
      id: row.id,
      name: plainText(row.properties.Name?.title),
      type: row.properties.Type?.select?.name || '',
      // Same treatment categories already get: the Notion page icon is the
      // account's identity. It does real work here too — two accounts can share
      // a name and differ only by currency.
      icon: row.icon?.type === 'emoji' ? row.icon.emoji : null,
      currency: row.properties.Currency?.select?.name || 'RON'
    })).filter(a => a.name.trim() !== '');
  }

  async fetchTransactions() {
    const demo = this._demoOr(this.dbIds?.transactions, DEMO_TRANSACTIONS);
    if (demo.use) return demo.rows;

    // Sort by Date descending for deterministic ordering across pages.
    const rows = await this._fetchAllPages(this.dbIds.transactions, {
      sorts: [{ property: 'Date', direction: 'descending' }]
    });
    return rows.map(row => ({
      id: row.id,
      description: plainText(row.properties.Description?.title),
      // Keep only the date part: rows written by older builds carry a full timestamp.
      date: (row.properties.Date?.date?.start || '').slice(0, 10),
      amount: row.properties['Amount (RON)']?.number || 0,
      // No sign-based guessing: an untyped row is an Expense. Deriving Income from a
      // positive amount silently reclassified transfers and inflated income.
      type: row.properties.Type?.select?.name || 'Expense',
      categoryId: row.properties.Category?.relation?.[0]?.id || '',
      accountId: row.properties.Account?.relation?.[0]?.id || '',
      // Transfers move money *between* two accounts. `Account` is the source and
      // `To Account` the destination; it stays empty for Income and Expense.
      toAccountId: row.properties['To Account']?.relation?.[0]?.id || '',
      tripId: row.properties.Trip?.relation?.[0]?.id || '',
      // Read by the Travel/Property/Nora classifiers — previously never fetched.
      notes: plainText(row.properties.Notes?.rich_text),
      // The RON amount stays the source of truth for every total; these two are
      // purely informational — "what did I actually pay in the card's currency" —
      // and were fetched by nobody before this.
      originalAmount: row.properties['Original Amount']?.number ?? null,
      originalCurrency: row.properties['Original Currency']?.select?.name || '',
      tags: row.properties.Tags?.multi_select?.map(t => t.name) || []
    }));
  }

  async addTransaction(tx) {
    if (!tx) throw new NotionError('No transaction data supplied.', 0);

    if (!this.token || !this.dbIds?.transactions) {
      const newTx = { tags: [], notes: '', ...tx, id: 'demo_tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) };
      DEMO_TRANSACTIONS.unshift(newTx);
      return newTx;
    }

    return this._request({
      path: 'pages',
      method: 'POST',
      body: {
        parent: { database_id: this.dbIds.transactions },
        properties: {
          'Description': title(tx.description),
          'Date': { date: { start: String(tx.date).slice(0, 10) } },
          'Amount (RON)': { number: Number(tx.amount) || 0 },
          'Type': { select: { name: tx.type || 'Expense' } },
          // Empty relations must be `[]`, not `[{ id: '' }]` — Notion 400s on the latter.
          'Category': relation(tx.categoryId),
          'Account': relation(tx.accountId),
          'To Account': relation(tx.toAccountId),
          'Trip': relation(tx.tripId),
          'Notes': richText(tx.notes),
          'Original Amount': { number: tx.originalAmount ?? null },
          'Original Currency': tx.originalCurrency ? { select: { name: tx.originalCurrency } } : { select: null },
          'Tags': { multi_select: (tx.tags || []).map(t => ({ name: t })) }
        }
      }
    });
  }

  async updateTransaction(txId, updates) {
    if (!this.token || !this.dbIds?.transactions) {
      const tx = DEMO_TRANSACTIONS.find(t => t.id === txId);
      if (tx) Object.assign(tx, updates);
      return tx;
    }

    const properties = {};
    if (updates.description !== undefined) properties['Description'] = title(updates.description);
    if (updates.date !== undefined) properties['Date'] = { date: { start: String(updates.date).slice(0, 10) } };
    if (updates.amount !== undefined) properties['Amount (RON)'] = { number: Number(updates.amount) || 0 };
    if (updates.type !== undefined) properties['Type'] = { select: { name: updates.type } };
    if (updates.categoryId !== undefined) properties['Category'] = relation(updates.categoryId);
    if (updates.accountId !== undefined) properties['Account'] = relation(updates.accountId);
    if (updates.toAccountId !== undefined) properties['To Account'] = relation(updates.toAccountId);
    if (updates.tripId !== undefined) properties['Trip'] = relation(updates.tripId);
    if (updates.notes !== undefined) properties['Notes'] = richText(updates.notes);
    if (updates.originalAmount !== undefined) properties['Original Amount'] = { number: updates.originalAmount ?? null };
    if (updates.originalCurrency !== undefined) {
      properties['Original Currency'] = updates.originalCurrency ? { select: { name: updates.originalCurrency } } : { select: null };
    }
    if (updates.tags !== undefined) properties['Tags'] = { multi_select: updates.tags.map(t => ({ name: t })) };

    return this._request({ path: `pages/${txId}`, method: 'PATCH', body: { properties } });
  }

  async deleteTransaction(txId) {
    if (!this.token || !this.dbIds?.transactions) {
      const idx = DEMO_TRANSACTIONS.findIndex(t => t.id === txId);
      if (idx !== -1) DEMO_TRANSACTIONS.splice(idx, 1);
      return;
    }
    // Notion "delete" is an archive — the page stays recoverable from the trash.
    await this._request({ path: `pages/${txId}`, method: 'PATCH', body: { archived: true } });
  }

  async updateCategoryLimit(categoryId, limit) {
    return this.updateCategoryBudget(categoryId, { budgetLimit: limit });
  }

  /**
   * Update any subset of a category's budget settings.
   *
   * Only the keys actually present are sent, so saving a limit can never blank
   * out a period or rollover flag the user set in Notion directly.
   */
  async updateCategoryBudget(categoryId, updates) {
    if (!this.token || !this.dbIds?.categories) {
      const cat = DEMO_CATEGORIES.find(c => c.id === categoryId);
      if (cat) Object.assign(cat, updates);
      return cat;
    }

    const properties = {};
    if (updates.budgetLimit !== undefined) {
      properties['Monthly Limit (RON)'] = { number: updates.budgetLimit || null };
    }
    if (updates.budgetPeriod !== undefined) {
      // Closed vocabulary: an unregistered option 400s the whole atomic patch,
      // taking the other properties in this same call down with it.
      properties['Budget Period'] = updates.budgetPeriod
        ? { select: { name: updates.budgetPeriod } }
        : { select: null };
    }
    if (updates.budgetAnchor !== undefined) {
      properties['Budget Anchor'] = updates.budgetAnchor
        ? { date: { start: String(updates.budgetAnchor).slice(0, 10) } }
        : { date: null };
    }
    if (updates.budgetRollover !== undefined) {
      properties['Budget Rollover'] = { checkbox: !!updates.budgetRollover };
    }

    return this._request({ path: `pages/${categoryId}`, method: 'PATCH', body: { properties } });
  }

  async fetchSubscriptions() {
    const demo = this._demoOr(this.dbIds?.subscriptions, DEMO_SUBSCRIPTIONS);
    if (demo.use) return demo.rows;

    const rows = await this._fetchAllPages(this.dbIds.subscriptions);
    return rows.map(row => ({
      id: row.id,
      name: plainText(row.properties.Name?.title),
      amount: row.properties.Amount?.number || 0,
      type: row.properties.Type?.select?.name || 'Expense',
      dayOfMonth: row.properties.DayOfMonth?.number || 1,
      // Blank reads as Monthly, same convention as Categories' Budget Period —
      // every subscription saved before Yearly existed has no Frequency at all.
      frequency: row.properties.Frequency?.select?.name || 'Monthly',
      monthOfYear: row.properties['Month of Year']?.number || null,
      categoryId: row.properties.Category?.relation?.[0]?.id || '',
      accountId: row.properties.Account?.relation?.[0]?.id || '',
      active: row.properties.Active?.checkbox !== false,
      lastProcessed: (row.properties.LastProcessed?.date?.start || '').slice(0, 10) || null,
      // Informational only, same as a transaction's — Amount stays the RON
      // source of truth. Lets a subscription be paid or received in another
      // currency (a EUR-denominated plan, rent collected from a foreign tenant).
      originalAmount: row.properties['Original Amount']?.number ?? null,
      originalCurrency: row.properties['Original Currency']?.select?.name || ''
    }));
  }

  async addSubscription(sub) {
    if (!this.token || !this.dbIds?.subscriptions) {
      const newSub = { ...sub, id: 'demo_sub_' + Date.now() };
      DEMO_SUBSCRIPTIONS.push(newSub);
      return newSub;
    }

    const properties = {
      'Name': title(sub.name),
      'Amount': { number: Number(sub.amount) || 0 },
      'Type': { select: { name: sub.type || 'Expense' } },
      'DayOfMonth': { number: Number(sub.dayOfMonth) || 1 },
      'Frequency': { select: { name: sub.frequency || 'Monthly' } },
      'Month of Year': { number: sub.frequency === 'Yearly' ? (Number(sub.monthOfYear) || 1) : null },
      'Category': relation(sub.categoryId),
      'Account': relation(sub.accountId),
      'Active': { checkbox: sub.active !== false },
      'Original Amount': { number: sub.originalAmount ?? null },
      'Original Currency': sub.originalCurrency ? { select: { name: sub.originalCurrency } } : { select: null }
    };
    if (sub.lastProcessed) {
      properties['LastProcessed'] = { date: { start: String(sub.lastProcessed).slice(0, 10) } };
    }

    return this._request({
      path: 'pages',
      method: 'POST',
      body: { parent: { database_id: this.dbIds.subscriptions }, properties }
    });
  }

  async updateSubscription(subId, updates) {
    if (!this.token || !this.dbIds?.subscriptions) {
      const sub = DEMO_SUBSCRIPTIONS.find(s => s.id === subId);
      if (sub) Object.assign(sub, updates);
      return sub;
    }

    const properties = {};
    if (updates.name !== undefined) properties['Name'] = title(updates.name);
    if (updates.amount !== undefined) properties['Amount'] = { number: Number(updates.amount) || 0 };
    if (updates.type !== undefined) properties['Type'] = { select: { name: updates.type } };
    if (updates.dayOfMonth !== undefined) properties['DayOfMonth'] = { number: Number(updates.dayOfMonth) || 1 };
    if (updates.frequency !== undefined) properties['Frequency'] = { select: { name: updates.frequency || 'Monthly' } };
    if (updates.monthOfYear !== undefined) {
      properties['Month of Year'] = { number: updates.frequency === 'Yearly' ? (Number(updates.monthOfYear) || 1) : null };
    }
    if (updates.categoryId !== undefined) properties['Category'] = relation(updates.categoryId);
    if (updates.accountId !== undefined) properties['Account'] = relation(updates.accountId);
    if (updates.active !== undefined) properties['Active'] = { checkbox: updates.active };
    if (updates.originalAmount !== undefined) properties['Original Amount'] = { number: updates.originalAmount ?? null };
    if (updates.originalCurrency !== undefined) {
      properties['Original Currency'] = updates.originalCurrency ? { select: { name: updates.originalCurrency } } : { select: null };
    }
    if (updates.lastProcessed !== undefined) {
      properties['LastProcessed'] = updates.lastProcessed
        ? { date: { start: String(updates.lastProcessed).slice(0, 10) } }
        : { date: null };
    }

    return this._request({ path: `pages/${subId}`, method: 'PATCH', body: { properties } });
  }

  async deleteSubscription(subId) {
    if (!this.token || !this.dbIds?.subscriptions) {
      const idx = DEMO_SUBSCRIPTIONS.findIndex(s => s.id === subId);
      if (idx !== -1) DEMO_SUBSCRIPTIONS.splice(idx, 1);
      return;
    }
    await this._request({ path: `pages/${subId}`, method: 'PATCH', body: { archived: true } });
  }

  /**
   * Archives every Transaction, Subscription and Trip in the configured databases.
   * Paced so a large ledger doesn't trip Notion's rate limit halfway through, and
   * reports progress so the UI can show something other than a frozen button.
   */
  async scrubTransactionsAndSubscriptions({ onProgress } = {}) {
    if (!this.token) return { archived: 0 };

    const jobs = [];
    if (this.dbIds?.transactions) {
      (await this.fetchTransactions()).forEach(tx => jobs.push(() => this.deleteTransaction(tx.id)));
    }
    if (this.dbIds?.subscriptions) {
      (await this.fetchSubscriptions()).forEach(sub => jobs.push(() => this.deleteSubscription(sub.id)));
    }
    if (this.dbIds?.trips) {
      (await this.fetchTrips()).forEach(trip => jobs.push(() => this.deleteTrip(trip.id)));
    }

    let done = 0;
    for (const job of jobs) {
      await job();
      done++;
      if (onProgress) onProgress(done, jobs.length);
      if (done < jobs.length) await sleep(WRITE_SPACING_MS);
    }
    return { archived: done };
  }

  async fetchTrips() {
    const demo = this._demoOr(this.dbIds?.trips, DEMO_TRIPS || []);
    if (demo.use) return demo.rows;

    const rows = await this._fetchAllPages(this.dbIds.trips);
    return rows.map(row => ({
      id: row.id,
      name: plainText(row.properties.Name?.title),
      destination: plainText(row.properties.Destination?.rich_text),
      startDate: (row.properties['Start Date']?.date?.start || '').slice(0, 10) || null,
      endDate: (row.properties['End Date']?.date?.start || '').slice(0, 10) || null,
      status: row.properties.Status?.select?.name || 'Planned',
      // Drives the transaction form's default currency: on a trip you're
      // spending the destination's money, not your account's.
      currency: row.properties.Currency?.select?.name || '',
      notes: plainText(row.properties.Notes?.rich_text)
    }));
  }

  async addTrip(trip) {
    if (!this.token || !this.dbIds?.trips) {
      const newTrip = { ...trip, id: 'demo_trip_' + Date.now() };
      if (DEMO_TRIPS) DEMO_TRIPS.push(newTrip);
      return newTrip;
    }

    const properties = {
      'Name': title(trip.name),
      'Destination': richText(trip.destination),
      'Status': { select: { name: trip.status || 'Planned' } },
      'Currency': trip.currency ? { select: { name: trip.currency } } : { select: null },
      'Notes': richText(trip.notes)
    };
    if (trip.startDate) properties['Start Date'] = { date: { start: String(trip.startDate).slice(0, 10) } };
    if (trip.endDate) properties['End Date'] = { date: { start: String(trip.endDate).slice(0, 10) } };

    return this._request({
      path: 'pages',
      method: 'POST',
      body: { parent: { database_id: this.dbIds.trips }, properties }
    });
  }

  async updateTrip(tripId, updates) {
    if (!this.token || !this.dbIds?.trips) {
      const trip = DEMO_TRIPS ? DEMO_TRIPS.find(t => t.id === tripId) : null;
      if (trip) Object.assign(trip, updates);
      return trip;
    }

    const properties = {};
    if (updates.name !== undefined) properties['Name'] = title(updates.name);
    if (updates.destination !== undefined) properties['Destination'] = richText(updates.destination);
    if (updates.status !== undefined) properties['Status'] = { select: { name: updates.status || 'Planned' } };
    if (updates.currency !== undefined) {
      properties['Currency'] = updates.currency ? { select: { name: updates.currency } } : { select: null };
    }
    if (updates.notes !== undefined) properties['Notes'] = richText(updates.notes);
    if (updates.startDate !== undefined) {
      properties['Start Date'] = updates.startDate ? { date: { start: String(updates.startDate).slice(0, 10) } } : { date: null };
    }
    if (updates.endDate !== undefined) {
      properties['End Date'] = updates.endDate ? { date: { start: String(updates.endDate).slice(0, 10) } } : { date: null };
    }

    return this._request({ path: `pages/${tripId}`, method: 'PATCH', body: { properties } });
  }

  async deleteTrip(tripId) {
    if (!this.token || !this.dbIds?.trips) {
      if (DEMO_TRIPS) {
        const idx = DEMO_TRIPS.findIndex(t => t.id === tripId);
        if (idx !== -1) DEMO_TRIPS.splice(idx, 1);
      }
      return;
    }
    await this._request({ path: `pages/${tripId}`, method: 'PATCH', body: { archived: true } });
  }
}
