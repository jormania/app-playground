import { DEMO_CATEGORIES, DEMO_ACCOUNTS, DEMO_TRANSACTIONS } from '../models/demoData';

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
      description: row.properties.Description?.rich_text?.[0]?.plain_text || ''
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
}
