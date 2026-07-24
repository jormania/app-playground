import { DEMO_CATEGORIES, DEMO_ACCOUNTS, DEMO_TRANSACTIONS, DEMO_SUBSCRIPTIONS } from '../models/demoData';

const PROXY_URL = '/api/notion';

export class NotionClient {
  constructor(token, dbIds) {
    this.token = token;
    this.dbIds = dbIds;
  }

  async fetchCategories() {
    if (!this.token || !this.dbIds?.categories) {
      return [...DEMO_CATEGORIES];
    }
    
    // In a real scenario, this would query the Notion DB for Categories
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `databases/${this.dbIds.categories}/query`,
        method: 'POST'
      })
    });
    const data = await response.json();
    return data.results.map(row => ({
      id: row.id,
      name: row.properties.Name?.title?.[0]?.plain_text || '',
      type: row.properties.Type?.select?.name || 'Expense',
      icon: row.icon?.type === 'emoji' ? row.icon.emoji : null,
      description: row.properties.Description?.rich_text?.[0]?.plain_text || '',
      budgetLimit: row.properties['Monthly Limit (RON)']?.number || null
    }));
  }

  async fetchAccounts() {
    if (!this.token || !this.dbIds?.accounts) {
      return [...DEMO_ACCOUNTS];
    }
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `databases/${this.dbIds.accounts}/query`,
        method: 'POST'
      })
    });
    const data = await response.json();
    return data.results.map(row => ({
      id: row.id,
      name: row.properties.Name?.title?.[0]?.plain_text || '',
      type: row.properties.Type?.select?.name || '',
      currency: row.properties.Currency?.select?.name || 'RON'
    }));
  }

  async fetchTransactions() {
    if (!this.token || !this.dbIds?.transactions) {
      return [...DEMO_TRANSACTIONS];
    }
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `databases/${this.dbIds.transactions}/query`,
        method: 'POST'
      })
    });
    const data = await response.json();
    return data.results.map(row => ({
      id: row.id,
      description: row.properties.Description?.title?.[0]?.plain_text || '',
      date: row.properties.Date?.date?.start || '',
      amount: row.properties['Amount (RON)']?.number || 0,
      type: row.properties.Type?.select?.name || 'Expense',
      categoryId: row.properties.Category?.relation?.[0]?.id || '',
      accountId: row.properties.Account?.relation?.[0]?.id || '',
      tags: row.properties.Tags?.multi_select?.map(t => t.name) || []
    }));
  }

  async addTransaction(tx) {
    if (!this.token || !this.dbIds?.transactions) {
      const newTx = { ...tx, id: 'demo_tx_' + Date.now() };
      DEMO_TRANSACTIONS.push(newTx);
      return newTx;
    }
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `pages`,
        method: 'POST',
        body: {
          parent: { database_id: this.dbIds.transactions },
          properties: {
            'Description': { title: [{ text: { content: tx.description } }] },
            'Date': { date: { start: tx.date } },
            'Amount (RON)': { number: tx.amount },
            'Type': { select: { name: tx.type } },
            'Category': { relation: [{ id: tx.categoryId }] },
            'Account': { relation: [{ id: tx.accountId }] },
            'Tags': { multi_select: tx.tags.map(t => ({ name: t })) }
          }
        }
      })
    });
    return response.json();
  }

  async updateTransaction(txId, updates) {
    if (!this.token || !this.dbIds?.transactions) {
      const tx = DEMO_TRANSACTIONS.find(t => t.id === txId);
      if (tx) Object.assign(tx, updates);
      return tx;
    }
    
    const properties = {};
    if (updates.description !== undefined) properties['Description'] = { title: [{ text: { content: updates.description } }] };
    if (updates.date !== undefined) properties['Date'] = { date: { start: updates.date } };
    if (updates.amount !== undefined) properties['Amount (RON)'] = { number: updates.amount };
    if (updates.type !== undefined) properties['Type'] = { select: { name: updates.type } };
    if (updates.categoryId !== undefined) properties['Category'] = { relation: [{ id: updates.categoryId }] };
    if (updates.accountId !== undefined) properties['Account'] = { relation: [{ id: updates.accountId }] };
    if (updates.tags !== undefined) properties['Tags'] = { multi_select: updates.tags.map(t => ({ name: t })) };

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `pages/${txId}`,
        method: 'PATCH',
        body: { properties }
      })
    });
    return response.json();
  }

  async deleteTransaction(txId) {
    if (!this.token || !this.dbIds?.transactions) {
      const idx = DEMO_TRANSACTIONS.findIndex(t => t.id === txId);
      if (idx !== -1) DEMO_TRANSACTIONS.splice(idx, 1);
      return;
    }
    
    await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `pages/${txId}`,
        method: 'PATCH',
        body: { archived: true }
      })
    });
  }

  async updateCategoryLimit(categoryId, limit) {
    if (!this.token || !this.dbIds?.categories) {
      const cat = DEMO_CATEGORIES.find(c => c.id === categoryId);
      if (cat) cat.budgetLimit = limit;
      return cat;
    }
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `pages/${categoryId}`,
        method: 'PATCH',
        body: {
          properties: {
            'Monthly Limit (RON)': { number: limit || null }
          }
        }
      })
    });
    return response.json();
  }

  async fetchSubscriptions() {
    if (!this.token || !this.dbIds?.subscriptions) {
      return [...DEMO_SUBSCRIPTIONS];
    }
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `databases/${this.dbIds.subscriptions}/query`,
        method: 'POST'
      })
    });
    const data = await response.json();
    return data.results.map(row => ({
      id: row.id,
      name: row.properties.Name?.title?.[0]?.plain_text || '',
      amount: row.properties.Amount?.number || 0,
      type: row.properties.Type?.select?.name || 'Expense',
      dayOfMonth: row.properties.DayOfMonth?.number || 1,
      categoryId: row.properties.Category?.relation?.[0]?.id || '',
      accountId: row.properties.Account?.relation?.[0]?.id || '',
      active: row.properties.Active?.checkbox !== false,
      lastProcessed: row.properties.LastProcessed?.date?.start || null
    }));
  }

  async addSubscription(sub) {
    if (!this.token || !this.dbIds?.subscriptions) {
      const newSub = { ...sub, id: 'demo_sub_' + Date.now() };
      DEMO_SUBSCRIPTIONS.push(newSub);
      return newSub;
    }
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `pages`,
        method: 'POST',
        body: {
          parent: { database_id: this.dbIds.subscriptions },
          properties: {
            'Name': { title: [{ text: { content: sub.name } }] },
            'Amount': { number: sub.amount },
            'Type': { select: { name: sub.type } },
            'DayOfMonth': { number: sub.dayOfMonth },
            'Category': { relation: sub.categoryId ? [{ id: sub.categoryId }] : [] },
            'Account': { relation: sub.accountId ? [{ id: sub.accountId }] : [] },
            'Active': { checkbox: sub.active },
            'LastProcessed': sub.lastProcessed ? { date: { start: sub.lastProcessed } } : null
          }
        }
      })
    });
    return response.json();
  }

  async updateSubscription(subId, updates) {
    if (!this.token || !this.dbIds?.subscriptions) {
      const sub = DEMO_SUBSCRIPTIONS.find(s => s.id === subId);
      if (sub) Object.assign(sub, updates);
      return sub;
    }
    
    const properties = {};
    if (updates.name !== undefined) properties['Name'] = { title: [{ text: { content: updates.name } }] };
    if (updates.amount !== undefined) properties['Amount'] = { number: updates.amount };
    if (updates.type !== undefined) properties['Type'] = { select: { name: updates.type } };
    if (updates.dayOfMonth !== undefined) properties['DayOfMonth'] = { number: updates.dayOfMonth };
    if (updates.categoryId !== undefined) properties['Category'] = { relation: updates.categoryId ? [{ id: updates.categoryId }] : [] };
    if (updates.accountId !== undefined) properties['Account'] = { relation: updates.accountId ? [{ id: updates.accountId }] : [] };
    if (updates.active !== undefined) properties['Active'] = { checkbox: updates.active };
    if (updates.lastProcessed !== undefined) properties['LastProcessed'] = updates.lastProcessed ? { date: { start: updates.lastProcessed } } : null;

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `pages/${subId}`,
        method: 'PATCH',
        body: { properties }
      })
    });
    return response.json();
  }

  async deleteSubscription(subId) {
    if (!this.token || !this.dbIds?.subscriptions) {
      const idx = DEMO_SUBSCRIPTIONS.findIndex(s => s.id === subId);
      if (idx !== -1) DEMO_SUBSCRIPTIONS.splice(idx, 1);
      return;
    }
    
    // Notion API deletes pages by setting archived to true
    await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-notion-token': this.token },
      body: JSON.stringify({
        path: `pages/${subId}`,
        method: 'PATCH',
        body: { archived: true }
      })
    });
  }
}
