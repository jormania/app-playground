export const DEMO_CATEGORIES = [
  { id: 'cat_income_1', name: 'Salary', type: 'Income' },
  { id: 'cat_income_2', name: 'Freelance', type: 'Income' },
  { id: 'cat_expense_1', name: 'Groceries', type: 'Expense' },
  { id: 'cat_expense_2', name: 'Rent', type: 'Expense' },
  { id: 'cat_expense_3', name: 'Utilities', type: 'Expense' },
  { id: 'cat_expense_4', name: 'Dining Out', type: 'Expense' },
  { id: 'cat_expense_5', name: 'Entertainment', type: 'Expense' },
];

export const DEMO_ACCOUNTS = [
  { id: 'acc_1', name: 'Checking', type: 'Bank', currency: 'RON' },
  { id: 'acc_2', name: 'Revolut', type: 'Fintech', currency: 'RON' },
  { id: 'acc_3', name: 'Cash', type: 'Cash', currency: 'RON' },
];

export const DEMO_TRANSACTIONS = [
  {
    id: 'tx_1',
    description: 'Monthly Salary',
    date: new Date().toISOString().split('T')[0], // today
    amount: 8500,
    type: 'Income',
    categoryId: 'cat_income_1',
    accountId: 'acc_1',
    tags: ['payroll'],
  },
  {
    id: 'tx_2',
    description: 'Mega Image',
    date: new Date().toISOString().split('T')[0],
    amount: 125.50,
    type: 'Expense',
    categoryId: 'cat_expense_1',
    accountId: 'acc_2',
    tags: ['food', 'groceries'],
  },
  {
    id: 'tx_3',
    description: 'Apartment Rent',
    date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    amount: 2500,
    type: 'Expense',
    categoryId: 'cat_expense_2',
    accountId: 'acc_1',
    tags: ['housing'],
  },
  {
    id: 'tx_4',
    description: 'Netflix Subscription',
    date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    amount: 60,
    type: 'Expense',
    categoryId: 'cat_expense_5',
    accountId: 'acc_2',
    tags: ['subscription'],
  }
];
