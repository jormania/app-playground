const fs = require('fs');

const categories = [
  { id: 'cat_housing', name: 'Housing', type: 'Expense', icon: '🏠', description: 'Home rent, HOA, etc' },
  { id: 'cat_utilities', name: 'Utilities', type: 'Expense', icon: '💡', description: 'Electricity, gas, internet' },
  { id: 'cat_food', name: 'Food', type: 'Expense', icon: '🛒', description: 'Groceries, supermarkets', budgetLimit: 1500 },
  { id: 'cat_dining', name: 'Dining', type: 'Expense', icon: '🍽️', description: 'Restaurants, cafés', budgetLimit: 800 },
  { id: 'cat_transport', name: 'Transport', type: 'Expense', icon: '🚌', description: 'Public transport, fuel', budgetLimit: 300 },
  { id: 'cat_health', name: 'Health', type: 'Expense', icon: '🏥', description: 'Doctors, pharmacy' },
  { id: 'cat_subscriptions', name: 'Subscriptions', type: 'Expense', icon: '🔁', description: 'Netflix, Spotify' },
  { id: 'cat_shopping', name: 'Shopping', type: 'Expense', icon: '🛍️', description: 'Clothes, electronics', budgetLimit: 500 },
  { id: 'cat_entertainment', name: 'Entertainment', type: 'Expense', icon: '🍿', description: 'Movies, concerts', budgetLimit: 400 },
  { id: 'cat_personal_care', name: 'Personal Care', type: 'Expense', icon: '💆', description: 'Haircut, cosmetics' },
  { id: 'cat_education', name: 'Education', type: 'Expense', icon: '📚', description: 'Courses, books' },
  { id: 'cat_travel', name: 'Travel', type: 'Expense', icon: '✈️', description: 'Flights, hotels' },
  { id: 'cat_gift', name: 'Gifts', type: 'Expense', icon: '🎁', description: 'Gifts, donations' },
  { id: 'cat_income', name: 'Salary', type: 'Income', icon: '💰', description: 'Regular paycheck' },
  { id: 'cat_rental_income', name: 'Rental Income', type: 'Income', icon: '🏢', description: 'Rent from tenants' },
  { id: 'cat_freelance', name: 'Freelance', type: 'Income', icon: '💻', description: 'Side gigs' },
  { id: 'cat_investing', name: 'Investing', type: 'Expense', icon: '📈', description: 'Stocks, crypto' },
  { id: 'cat_property', name: 'Property', type: 'Expense', icon: '🏢', description: 'Property tax, maintenance' },
  { id: 'cat_taxes', name: 'Taxes & Fees', type: 'Expense', icon: '🏛️', description: 'Taxes, accounting fees' },
  { id: 'cat_transfer', name: 'Transfer', type: 'Transfer', icon: '🔄', description: 'Account transfers' }
];

const accounts = [
  { id: 'acc_checking', name: 'ING Current', currency: 'RON', type: 'Checking' },
  { id: 'acc_credit', name: 'ING Credit', currency: 'RON', type: 'Credit' },
  { id: 'acc_savings', name: 'ING Savings', currency: 'RON', type: 'Savings' },
  { id: 'acc_revolut', name: 'Revolut RON', currency: 'RON', type: 'Checking' },
  { id: 'acc_revolut_eur', name: 'Revolut EUR', currency: 'EUR', type: 'Checking' },
  { id: 'acc_cash', name: 'Cash', type: 'Asset' }
];

const subscriptions = [
  { id: 'sub_1', name: 'YouTube Premium', amount: 55, type: 'Expense', dayOfMonth: 15, categoryId: 'cat_subscriptions', accountId: 'acc_checking', active: true, lastProcessed: '2026-12-31T00:00:00.000Z' },
  { id: 'sub_2', name: 'Netflix', amount: 60, type: 'Expense', dayOfMonth: 5, categoryId: 'cat_subscriptions', accountId: 'acc_revolut', active: true, lastProcessed: '2026-12-31T00:00:00.000Z' },
  { id: 'sub_3', name: 'Spotify', amount: 25, type: 'Expense', dayOfMonth: 22, categoryId: 'cat_subscriptions', accountId: 'acc_revolut', active: true, lastProcessed: '2026-12-31T00:00:00.000Z' },
  { id: 'sub_4', name: 'Gym Membership', amount: 150, type: 'Expense', dayOfMonth: 1, categoryId: 'cat_health', accountId: 'acc_credit', active: true, lastProcessed: '2026-12-31T00:00:00.000Z' },
  { id: 'sub_5', name: 'Adobe Creative Cloud', amount: 250, type: 'Expense', dayOfMonth: 10, categoryId: 'cat_subscriptions', accountId: 'acc_credit', active: false, lastProcessed: '2026-12-31T00:00:00.000Z' }
];

const trips = [
  { id: 'trip_billund', name: 'Billund 2025', destination: 'Billund, Denmark', startDate: '2025-05-10', endDate: '2025-05-15', status: 'Completed', notes: 'Legoland family trip' },
  { id: 'trip_poland', name: 'Poland Autumn 2026', destination: 'Kraków & Warsaw, Poland', startDate: '2026-10-05', endDate: '2026-10-15', status: 'Planned', notes: 'Autumn cultural trip. Flights bought in spring, hotel booked in summer.' },
  { id: 'trip_constance', name: 'Lake Constance 2026', destination: 'Lake Constance, Germany', startDate: '2026-07-12', endDate: '2026-07-20', status: 'Active', notes: 'Summer lakeside vacation' },
  { id: 'trip_greece', name: 'Greece Autumn 2024', destination: 'Crete, Greece', startDate: '2024-09-18', endDate: '2024-09-25', status: 'Completed', notes: 'Beach island retreat' }
];

const transactions = [];
let txId = 1;

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

for (let month = 0; month < 12; month++) {
  const m = String(month + 1).padStart(2, '0');
  transactions.push({ id: 'demo_tx_' + txId++, description: 'Salary', date: `2026-${m}-01`, amount: 9500, type: 'Income', categoryId: 'cat_income', accountId: 'acc_checking', tags: [] });
  if (month % 3 === 0) transactions.push({ id: 'demo_tx_' + txId++, description: 'Freelance Gig', date: `2026-${m}-15`, amount: rand(1000, 3000), type: 'Income', categoryId: 'cat_freelance', accountId: 'acc_revolut', tags: [] });

  transactions.push({ id: 'demo_tx_' + txId++, description: 'Apartment Rent', date: `2026-${m}-02`, amount: 2500, type: 'Expense', categoryId: 'cat_housing', accountId: 'acc_checking', tags: [] });
  transactions.push({ id: 'demo_tx_' + txId++, description: 'Enel Electricity', date: `2026-${m}-10`, amount: rand(120, 250), type: 'Expense', categoryId: 'cat_utilities', accountId: 'acc_checking', tags: [] });
  transactions.push({ id: 'demo_tx_' + txId++, description: 'Digi Internet', date: `2026-${m}-12`, amount: 40, type: 'Expense', categoryId: 'cat_utilities', accountId: 'acc_checking', tags: [] });

  // Generate historical subscriptions natively
  subscriptions.filter(s => s.active).forEach(sub => {
    transactions.push({ 
      id: 'demo_tx_' + txId++, 
      description: sub.name, 
      date: `2026-${m}-${String(sub.dayOfMonth).padStart(2, '0')}`, 
      amount: sub.amount, 
      type: sub.type, 
      categoryId: sub.categoryId, 
      accountId: sub.accountId, 
      tags: ['Subscription'] 
    });
  });

  const groceries = ['Mega Image', 'Profi', 'Carrefour', 'Kaufland'];
  for(let i = 0; i < rand(3, 5); i++) {
    const desc = groceries[rand(0, groceries.length - 1)];
    transactions.push({ id: 'demo_tx_' + txId++, description: desc, date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(50, 300), type: 'Expense', categoryId: 'cat_food', accountId: 'acc_revolut', tags: [] });
  }

  const restaurants = ['Simbio', 'Shift Pub', 'Energiea', 'Dianei 4'];
  for(let i = 0; i < rand(2, 6); i++) {
    const desc = restaurants[rand(0, restaurants.length - 1)];
    transactions.push({ id: 'demo_tx_' + txId++, description: desc, date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(80, 250), type: 'Expense', categoryId: 'cat_dining', accountId: 'acc_credit', tags: [] });
  }

  const cafes = ['Beans & Dots', 'Origo', 'M60', 'Starbucks'];
  for(let i = 0; i < rand(3, 7); i++) {
    const desc = cafes[rand(0, cafes.length - 1)];
    transactions.push({ id: 'demo_tx_' + txId++, description: desc, date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(15, 35), type: 'Expense', categoryId: 'cat_dining', accountId: 'acc_revolut', tags: [] });
  }

  const rides = ['Uber', 'Bolt', 'Metrorex', 'STB'];
  for(let i = 0; i < rand(2, 5); i++) {
    const desc = rides[rand(0, rides.length - 1)];
    transactions.push({ id: 'demo_tx_' + txId++, description: desc, date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(20, 60), type: 'Expense', categoryId: 'cat_transport', accountId: 'acc_revolut', tags: [] });
  }

  const shopping = ['Emag', 'Carturesti', 'Zara', 'H&M'];
  for(let i = 0; i < rand(1, 4); i++) {
    const desc = shopping[rand(0, shopping.length - 1)];
    transactions.push({ id: 'demo_tx_' + txId++, description: desc, date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(30, 200), type: 'Expense', categoryId: 'cat_shopping', accountId: 'acc_credit', tags: [] });
  }

  transactions.push({ id: 'demo_tx_' + txId++, description: 'OMV Gas Station', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(150, 300), type: 'Expense', categoryId: 'cat_transport', accountId: 'acc_credit', tags: [] });

  if (rand(0, 1)) transactions.push({ id: 'demo_tx_' + txId++, description: 'World Class Romania', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(100, 500), type: 'Expense', categoryId: 'cat_health', accountId: 'acc_credit', tags: [] });
  if (rand(0, 1)) transactions.push({ id: 'demo_tx_' + txId++, description: 'Therme Bucuresti', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(80, 250), type: 'Expense', categoryId: 'cat_entertainment', accountId: 'acc_revolut', tags: [] });
  if (rand(0, 1)) transactions.push({ id: 'demo_tx_' + txId++, description: 'Tinder Gold', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: 75, type: 'Expense', categoryId: 'cat_subscriptions', accountId: 'acc_revolut', tags: [] });
  if (rand(0, 1)) transactions.push({ id: 'demo_tx_' + txId++, description: 'Eden', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(40, 120), type: 'Expense', categoryId: 'cat_entertainment', accountId: 'acc_revolut', tags: [] });
  
  if (rand(0, 3) === 0) transactions.push({ id: 'demo_tx_' + txId++, description: 'Pharmacy', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(30, 150), type: 'Expense', categoryId: 'cat_health', accountId: 'acc_credit', tags: [] });
  if (rand(0, 2) === 0) transactions.push({ id: 'demo_tx_' + txId++, description: 'Haircut', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(60, 120), type: 'Expense', categoryId: 'cat_personal_care', accountId: 'acc_checking', tags: [] });
  if (rand(0, 4) === 0) transactions.push({ id: 'demo_tx_' + txId++, description: 'Transfer to Revolut', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(100, 500), type: 'Transfer', categoryId: 'cat_transfer', accountId: 'acc_checking', tags: [], toAccountId: 'acc_revolut' });
  if (month === 2 || month === 8) transactions.push({ id: 'demo_tx_' + txId++, description: 'Online Course', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(200, 500), type: 'Expense', categoryId: 'cat_education', accountId: 'acc_credit', tags: [] });
  
  // Specific trip scenario: Poland Autumn 2026 (trip in October, month === 9)
  // Plane tickets bought in spring (March, month === 2)
  if (month === 2) {
    transactions.push({ id: 'demo_tx_' + txId++, description: 'LOT Polish Airlines - Flights to Kraków', date: `2026-03-14`, amount: 1250, type: 'Expense', categoryId: 'cat_travel', accountId: 'acc_credit', tags: ['Flight'], tripId: 'trip_poland' });
  }
  // Hotel booked in summer (July, month === 6)
  if (month === 6) {
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Booking.com - Warsaw Hotel Reservation', date: `2026-07-22`, amount: 2100, type: 'Expense', categoryId: 'cat_travel', accountId: 'acc_credit', tags: ['Hotel'], tripId: 'trip_poland' });
    // Also Lake Constance vacation in July
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Lufthansa - Flights to Munich', date: `2026-07-01`, amount: 1400, type: 'Expense', categoryId: 'cat_travel', accountId: 'acc_credit', tags: ['Flight'], tripId: 'trip_constance' });
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Constance Resort Lodge', date: `2026-07-13`, amount: 3200, type: 'Expense', categoryId: 'cat_travel', accountId: 'acc_credit', tags: ['Hotel'], tripId: 'trip_constance' });
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Lakeside Seafood Restaurant', date: `2026-07-15`, amount: 350, type: 'Expense', categoryId: 'cat_dining', accountId: 'acc_revolut', tags: [], tripId: 'trip_constance' });
  }
  // The actual Poland trip took place in autumn (October, month === 9)
  if (month === 9) {
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Kraków Old Town Restaurant', date: `2026-10-07`, amount: 240, type: 'Expense', categoryId: 'cat_dining', accountId: 'acc_revolut', tags: [], tripId: 'trip_poland' });
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Wawel Castle Museum Tickets', date: `2026-10-08`, amount: 110, type: 'Expense', categoryId: 'cat_travel', accountId: 'acc_revolut', tags: ['Museum', 'Ticket'], tripId: 'trip_poland' });
    transactions.push({ id: 'demo_tx_' + txId++, description: 'PKP Intercity Train Kraków to Warsaw', date: `2026-10-10`, amount: 180, type: 'Expense', categoryId: 'cat_travel', accountId: 'acc_revolut', tags: ['Train'], tripId: 'trip_poland' });
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Warsaw Bistro Dinner', date: `2026-10-12`, amount: 310, type: 'Expense', categoryId: 'cat_dining', accountId: 'acc_revolut', tags: [], tripId: 'trip_poland' });
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Polish Pottery Souvenirs', date: `2026-10-14`, amount: 450, type: 'Expense', categoryId: 'cat_shopping', accountId: 'acc_credit', tags: ['Souvenir'], tripId: 'trip_poland' });
  }

  // Generic travel tickets that remain unassigned (Unassigned Travel test case)
  if (month === 4) {
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Weekend Train Tickets to Brasov', date: `2026-05-02`, amount: 160, type: 'Expense', categoryId: 'cat_travel', accountId: 'acc_revolut', tags: ['Train'] });
  }
  if (month === 11) {
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Christmas Gifts', date: `2026-${m}-15`, amount: rand(400, 1000), type: 'Expense', categoryId: 'cat_gift', accountId: 'acc_credit', tags: [] });
    transactions.push({ id: 'demo_tx_' + txId++, description: 'Hotel Booking for New Years Eve', date: `2026-12-10`, amount: 1500, type: 'Expense', categoryId: 'cat_travel', accountId: 'acc_credit', tags: ['Hotel'] }); // Also unassigned travel
  }
  
  transactions.push({ id: 'demo_tx_' + txId++, description: 'ETF Vanguard', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(500, 1000), type: 'Expense', categoryId: 'cat_investing', accountId: 'acc_checking', tags: [] });
  
  // Property and Taxes
  if (month % 3 === 0) transactions.push({ id: 'demo_tx_' + txId++, description: 'Property Maintenance', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(100, 400), type: 'Expense', categoryId: 'cat_property', accountId: 'acc_checking', tags: [] });
  if (month === 4 || month === 10) transactions.push({ id: 'demo_tx_' + txId++, description: 'Property Tax', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(800, 1200), type: 'Expense', categoryId: 'cat_taxes', accountId: 'acc_checking', tags: [] });
  if (month === 12) transactions.push({ id: 'demo_tx_' + txId++, description: 'Accountant Fees', date: `2026-${m}-${String(rand(1, 28)).padStart(2, '0')}`, amount: rand(300, 500), type: 'Expense', categoryId: 'cat_taxes', accountId: 'acc_checking', tags: [] });
  transactions.push({ id: 'demo_tx_' + txId++, description: 'Monthly Bank Fee', date: `2026-${m}-01`, amount: 15, type: 'Expense', categoryId: 'cat_taxes', accountId: 'acc_checking', tags: [] });

  if (month % 2 === 0) transactions.push({ id: 'demo_tx_' + txId++, description: 'Tenant Rent', date: `2026-${m}-05`, amount: 1500, type: 'Income', categoryId: 'cat_rental_income', accountId: 'acc_checking', tags: [] });
}

// Sort by date descending
transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

const templates = [
  { id: 'demo_tpl_1', description: 'Coffee', amount: 15, categoryId: 'cat_dining', accountId: 'acc_revolut', type: 'Expense' },
  { id: 'demo_tpl_2', description: 'STB Ticket', amount: 3, categoryId: 'cat_transport', accountId: 'acc_revolut', type: 'Expense' },
  { id: 'demo_tpl_3', description: 'Lunch', amount: 45, categoryId: 'cat_dining', accountId: 'acc_revolut', type: 'Expense' }
];

const content = `export const DEMO_CATEGORIES = ${JSON.stringify(categories, null, 2)};\n\nexport const DEMO_ACCOUNTS = ${JSON.stringify(accounts, null, 2)};\n\nexport const DEMO_SUBSCRIPTIONS = ${JSON.stringify(subscriptions, null, 2)};\n\nexport const DEMO_TRIPS = ${JSON.stringify(trips, null, 2)};\n\nexport const DEMO_TRANSACTIONS = ${JSON.stringify(transactions, null, 2)};\n\nexport const DEMO_TEMPLATES = ${JSON.stringify(templates, null, 2)};\n`;

fs.writeFileSync('src/where-it-went/models/demoData.js', content);
