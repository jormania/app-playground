import { generateInsights } from './src/where-it-went/lib/analytics.js';

const data = { categories: [], accounts: [], transactions: [] };
console.log(generateInsights(data));

const data2 = {
  categories: [{id: '1', name: 'Dining'}],
  accounts: [],
  transactions: [
    {id: '1', date: new Date().toISOString(), type: 'Expense', amount: 100, categoryId: '1'},
    {id: '2', date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(), type: 'Expense', amount: 50, categoryId: '1'},
  ]
};
console.log(generateInsights(data2));
