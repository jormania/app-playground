export const DEMO_CATEGORIES = [
  {
    "id": "cat_housing",
    "name": "Housing",
    "type": "Expense",
    "icon": "🏠",
    "description": "Home rent, HOA, furniture, appliances, home improvements, household maintenance"
  },
  {
    "id": "cat_utilities",
    "name": "Utilities",
    "type": "Expense",
    "icon": "💡",
    "description": "Electricity, gas, water, internet, mobile phone, streaming utilities if billed with services"
  },
  {
    "id": "cat_food",
    "name": "Food",
    "type": "Expense",
    "icon": "🛒",
    "description": "Groceries, supermarkets, markets, food and coffee bought for home"
  },
  {
    "id": "cat_dining",
    "name": "Dining",
    "type": "Expense",
    "icon": "🍽️",
    "description": "Restaurants, cafés, take-away, food delivery"
  },
  {
    "id": "cat_transport",
    "name": "Transport",
    "type": "Expense",
    "icon": "🚌",
    "description": "Public transport, taxi, Uber/Bolt, car rental, fuel, car maintenance"
  },
  {
    "id": "cat_health",
    "name": "Health",
    "type": "Expense",
    "icon": "🏥",
    "description": "Doctors, dentists, pharmacy, medical tests, health insurance"
  },
  {
    "id": "cat_entertainment",
    "name": "Entertainment",
    "type": "Expense",
    "icon": "🎭",
    "description": "Cinema, theater, concerts, games, subscriptions (Netflix, Spotify etc), books, hobbies"
  },
  {
    "id": "cat_shopping",
    "name": "Shopping",
    "type": "Expense",
    "icon": "👕",
    "description": "Clothing, shoes, electronics, gifts, personal care, cosmetics"
  },
  {
    "id": "cat_travel",
    "name": "Travel",
    "type": "Expense",
    "icon": "✈️",
    "description": "Flights, accommodation, holiday expenses, travel insurance"
  },
  {
    "id": "cat_education",
    "name": "Education",
    "type": "Expense",
    "icon": "🎓",
    "description": "Courses, training, books for learning, educational subscriptions"
  },
  {
    "id": "cat_income",
    "name": "Income",
    "type": "Income",
    "icon": "💼",
    "description": "Salary, bonuses, freelance work, interest, gifts received"
  },
  {
    "id": "cat_rental_income",
    "name": "Rental Income",
    "type": "Income",
    "icon": "🏢",
    "description": "Income from rented properties"
  },
  {
    "id": "cat_investing",
    "name": "Investing",
    "type": "Expense",
    "icon": "📈",
    "description": "Investimental, stocks, bonds, crypto"
  }
];

export const DEMO_ACCOUNTS = [
  {
    "id": "acc_checking",
    "name": "Checking",
    "type": "Asset"
  },
  {
    "id": "acc_revolut",
    "name": "Revolut",
    "type": "Asset"
  },
  {
    "id": "acc_cash",
    "name": "Cash",
    "type": "Asset"
  }
];

export const DEMO_TRANSACTIONS = [
  {
    "id": "demo_tx_1",
    "description": "Salary",
    "date": "2026-06-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_2",
    "description": "Rent Income",
    "date": "2026-06-05",
    "amount": 2000,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_3",
    "description": "Apartment Rent",
    "date": "2026-06-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_4",
    "description": "Enel Electricity",
    "date": "2026-06-10",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_5",
    "description": "Digi Internet",
    "date": "2026-06-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_6",
    "description": "Netflix",
    "date": "2026-06-15",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_7",
    "description": "Spotify",
    "date": "2026-06-16",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_8",
    "description": "Mega Image",
    "date": "2026-06-04",
    "amount": 120,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_9",
    "description": "Kaufland",
    "date": "2026-06-18",
    "amount": 350,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_10",
    "description": "Uber",
    "date": "2026-06-05",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_11",
    "description": "Uber",
    "date": "2026-06-22",
    "amount": 45,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_12",
    "description": "Restaurant La Mama",
    "date": "2026-06-08",
    "amount": 200,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_13",
    "description": "Starbucks",
    "date": "2026-06-09",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_14",
    "description": "Pharmacy",
    "date": "2026-06-14",
    "amount": 80,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_15",
    "description": "Weekend Trip Flight",
    "date": "2026-06-20",
    "amount": 450,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_16",
    "description": "Salary",
    "date": "2026-07-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_17",
    "description": "Apartment Rent",
    "date": "2026-07-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_18",
    "description": "Apartment Maintenance",
    "date": "2026-07-03",
    "amount": 400,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_19",
    "description": "Enel Electricity",
    "date": "2026-07-10",
    "amount": 160,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_20",
    "description": "Digi Internet",
    "date": "2026-07-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_21",
    "description": "Netflix",
    "date": "2026-07-15",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_22",
    "description": "Spotify",
    "date": "2026-07-16",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_23",
    "description": "Mega Image",
    "date": "2026-07-04",
    "amount": 180,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_24",
    "description": "Lidl",
    "date": "2026-07-11",
    "amount": 220,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_25",
    "description": "Kaufland",
    "date": "2026-07-21",
    "amount": 310,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_26",
    "description": "Restaurant La Mama",
    "date": "2026-07-07",
    "amount": 250,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_27",
    "description": "Sushi Terra",
    "date": "2026-07-13",
    "amount": 300,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_28",
    "description": "Starbucks",
    "date": "2026-07-02",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_29",
    "description": "Starbucks",
    "date": "2026-07-15",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_30",
    "description": "Uber",
    "date": "2026-07-01",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_31",
    "description": "Uber",
    "date": "2026-07-18",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_32",
    "description": "Weekend Trip Hotel",
    "date": "2026-07-05",
    "amount": 600,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_revolut",
    "tags": []
  }
];
