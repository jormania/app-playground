export const DEMO_CATEGORIES = [
  {
    "id": "cat_housing",
    "name": "Housing",
    "type": "Expense",
    "icon": "🏠",
    "description": "Home rent, HOA, etc"
  },
  {
    "id": "cat_utilities",
    "name": "Utilities",
    "type": "Expense",
    "icon": "💡",
    "description": "Electricity, gas, internet"
  },
  {
    "id": "cat_food",
    "name": "Food",
    "type": "Expense",
    "icon": "🛒",
    "description": "Groceries, supermarkets",
    "budgetLimit": 1500
  },
  {
    "id": "cat_dining",
    "name": "Dining",
    "type": "Expense",
    "icon": "🍽️",
    "description": "Restaurants, cafés",
    "budgetLimit": 800
  },
  {
    "id": "cat_transport",
    "name": "Transport",
    "type": "Expense",
    "icon": "🚌",
    "description": "Public transport, fuel",
    "budgetLimit": 300
  },
  {
    "id": "cat_health",
    "name": "Health",
    "type": "Expense",
    "icon": "🏥",
    "description": "Doctors, pharmacy"
  },
  {
    "id": "cat_subscriptions",
    "name": "Subscriptions",
    "type": "Expense",
    "icon": "🔁",
    "description": "Netflix, Spotify"
  },
  {
    "id": "cat_shopping",
    "name": "Shopping",
    "type": "Expense",
    "icon": "🛍️",
    "description": "Clothes, electronics",
    "budgetLimit": 500
  },
  {
    "id": "cat_entertainment",
    "name": "Entertainment",
    "type": "Expense",
    "icon": "🍿",
    "description": "Movies, concerts",
    "budgetLimit": 400
  },
  {
    "id": "cat_personal_care",
    "name": "Personal Care",
    "type": "Expense",
    "icon": "💆",
    "description": "Haircut, cosmetics"
  },
  {
    "id": "cat_education",
    "name": "Education",
    "type": "Expense",
    "icon": "📚",
    "description": "Courses, books"
  },
  {
    "id": "cat_travel",
    "name": "Travel",
    "type": "Expense",
    "icon": "✈️",
    "description": "Flights, hotels"
  },
  {
    "id": "cat_gift",
    "name": "Gifts",
    "type": "Expense",
    "icon": "🎁",
    "description": "Gifts, donations"
  },
  {
    "id": "cat_income",
    "name": "Salary",
    "type": "Income",
    "icon": "💰",
    "description": "Regular paycheck"
  },
  {
    "id": "cat_rental_income",
    "name": "Rental Income",
    "type": "Income",
    "icon": "🏢",
    "description": "Rent from tenants"
  },
  {
    "id": "cat_freelance",
    "name": "Freelance",
    "type": "Income",
    "icon": "💻",
    "description": "Side gigs"
  },
  {
    "id": "cat_investing",
    "name": "Investing",
    "type": "Expense",
    "icon": "📈",
    "description": "Stocks, crypto"
  },
  {
    "id": "cat_property",
    "name": "Property",
    "type": "Expense",
    "icon": "🏢",
    "description": "Property tax, maintenance"
  },
  {
    "id": "cat_taxes",
    "name": "Taxes & Fees",
    "type": "Expense",
    "icon": "🏛️",
    "description": "Taxes, accounting fees"
  }
];

export const DEMO_ACCOUNTS = [
  {
    "id": "acc_checking",
    "name": "Checking Account",
    "type": "Asset"
  },
  {
    "id": "acc_savings",
    "name": "Savings Account",
    "type": "Asset"
  },
  {
    "id": "acc_credit",
    "name": "Credit Card",
    "type": "Liability"
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

export const DEMO_SUBSCRIPTIONS = [
  {
    "id": "sub_1",
    "name": "YouTube Premium",
    "amount": 55,
    "type": "Expense",
    "dayOfMonth": 15,
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "active": true,
    "lastProcessed": "2026-12-31T00:00:00.000Z"
  },
  {
    "id": "sub_2",
    "name": "Netflix",
    "amount": 60,
    "type": "Expense",
    "dayOfMonth": 5,
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "active": true,
    "lastProcessed": "2026-12-31T00:00:00.000Z"
  },
  {
    "id": "sub_3",
    "name": "Spotify",
    "amount": 25,
    "type": "Expense",
    "dayOfMonth": 22,
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "active": true,
    "lastProcessed": "2026-12-31T00:00:00.000Z"
  },
  {
    "id": "sub_4",
    "name": "Gym Membership",
    "amount": 150,
    "type": "Expense",
    "dayOfMonth": 1,
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "active": true,
    "lastProcessed": "2026-12-31T00:00:00.000Z"
  },
  {
    "id": "sub_5",
    "name": "Adobe Creative Cloud",
    "amount": 250,
    "type": "Expense",
    "dayOfMonth": 10,
    "categoryId": "cat_subscriptions",
    "accountId": "acc_credit",
    "active": false,
    "lastProcessed": "2026-12-31T00:00:00.000Z"
  }
];

export const DEMO_TRANSACTIONS = [
  {
    "id": "demo_tx_260",
    "description": "Flight Tickets",
    "date": "2026-12-28",
    "amount": 1067,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_248",
    "description": "Mega Image",
    "date": "2026-12-24",
    "amount": 82,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_254",
    "description": "Restaurant",
    "date": "2026-12-23",
    "amount": 237,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_256",
    "description": "Gas Station",
    "date": "2026-12-23",
    "amount": 174,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_246",
    "description": "Spotify",
    "date": "2026-12-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_251",
    "description": "Mega Image",
    "date": "2026-12-21",
    "amount": 156,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_257",
    "description": "Clothing Store",
    "date": "2026-12-19",
    "amount": 447,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_255",
    "description": "Uber/Bolt",
    "date": "2026-12-16",
    "amount": 50,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_244",
    "description": "YouTube Premium",
    "date": "2026-12-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_261",
    "description": "Christmas Gifts",
    "date": "2026-12-15",
    "amount": 792,
    "type": "Expense",
    "categoryId": "cat_gift",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_262",
    "description": "ETF Vanguard",
    "date": "2026-12-15",
    "amount": 994,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_243",
    "description": "Digi Internet",
    "date": "2026-12-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_242",
    "description": "Enel Electricity",
    "date": "2026-12-10",
    "amount": 141,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_250",
    "description": "Mega Image",
    "date": "2026-12-06",
    "amount": 290,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_245",
    "description": "Netflix",
    "date": "2026-12-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_252",
    "description": "Restaurant",
    "date": "2026-12-04",
    "amount": 82,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_253",
    "description": "Restaurant",
    "date": "2026-12-04",
    "amount": 212,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_241",
    "description": "Apartment Rent",
    "date": "2026-12-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_258",
    "description": "Cinema",
    "date": "2026-12-02",
    "amount": 63,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_259",
    "description": "Pharmacy",
    "date": "2026-12-02",
    "amount": 125,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_240",
    "description": "Salary",
    "date": "2026-12-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_247",
    "description": "Gym Membership",
    "date": "2026-12-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_249",
    "description": "Mega Image",
    "date": "2026-12-01",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_236",
    "description": "Haircut",
    "date": "2026-11-25",
    "amount": 65,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_237",
    "description": "ETF Vanguard",
    "date": "2026-11-25",
    "amount": 876,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_223",
    "description": "Mega Image",
    "date": "2026-11-24",
    "amount": 262,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_235",
    "description": "Pharmacy",
    "date": "2026-11-23",
    "amount": 96,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_221",
    "description": "Spotify",
    "date": "2026-11-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_232",
    "description": "Uber/Bolt",
    "date": "2026-11-20",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_224",
    "description": "Mega Image",
    "date": "2026-11-19",
    "amount": 96,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_225",
    "description": "Mega Image",
    "date": "2026-11-18",
    "amount": 253,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_226",
    "description": "Mega Image",
    "date": "2026-11-17",
    "amount": 100,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_238",
    "description": "Property Tax",
    "date": "2026-11-17",
    "amount": 809,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_219",
    "description": "YouTube Premium",
    "date": "2026-11-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_218",
    "description": "Digi Internet",
    "date": "2026-11-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_230",
    "description": "Restaurant",
    "date": "2026-11-11",
    "amount": 85,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_217",
    "description": "Enel Electricity",
    "date": "2026-11-10",
    "amount": 152,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_233",
    "description": "Gas Station",
    "date": "2026-11-07",
    "amount": 237,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_234",
    "description": "Clothing Store",
    "date": "2026-11-06",
    "amount": 298,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_220",
    "description": "Netflix",
    "date": "2026-11-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_231",
    "description": "Restaurant",
    "date": "2026-11-05",
    "amount": 125,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_239",
    "description": "Tenant Rent",
    "date": "2026-11-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_228",
    "description": "Restaurant",
    "date": "2026-11-03",
    "amount": 211,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_229",
    "description": "Restaurant",
    "date": "2026-11-03",
    "amount": 212,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_216",
    "description": "Apartment Rent",
    "date": "2026-11-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_215",
    "description": "Salary",
    "date": "2026-11-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_222",
    "description": "Gym Membership",
    "date": "2026-11-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_227",
    "description": "Mega Image",
    "date": "2026-11-01",
    "amount": 289,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_207",
    "description": "Restaurant",
    "date": "2026-10-24",
    "amount": 148,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_202",
    "description": "Spotify",
    "date": "2026-10-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_213",
    "description": "ETF Vanguard",
    "date": "2026-10-22",
    "amount": 873,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_214",
    "description": "Property Maintenance",
    "date": "2026-10-19",
    "amount": 380,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_209",
    "description": "Uber/Bolt",
    "date": "2026-10-17",
    "amount": 50,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_205",
    "description": "Mega Image",
    "date": "2026-10-16",
    "amount": 152,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_211",
    "description": "Pharmacy",
    "date": "2026-10-16",
    "amount": 87,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_196",
    "description": "Freelance Gig",
    "date": "2026-10-15",
    "amount": 2820,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_200",
    "description": "YouTube Premium",
    "date": "2026-10-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_204",
    "description": "Mega Image",
    "date": "2026-10-14",
    "amount": 239,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_210",
    "description": "Gas Station",
    "date": "2026-10-13",
    "amount": 223,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_199",
    "description": "Digi Internet",
    "date": "2026-10-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_198",
    "description": "Enel Electricity",
    "date": "2026-10-10",
    "amount": 198,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_206",
    "description": "Mega Image",
    "date": "2026-10-10",
    "amount": 132,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_212",
    "description": "Haircut",
    "date": "2026-10-09",
    "amount": 85,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_201",
    "description": "Netflix",
    "date": "2026-10-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_197",
    "description": "Apartment Rent",
    "date": "2026-10-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_195",
    "description": "Salary",
    "date": "2026-10-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_203",
    "description": "Gym Membership",
    "date": "2026-10-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_208",
    "description": "Restaurant",
    "date": "2026-10-01",
    "amount": 162,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_185",
    "description": "Mega Image",
    "date": "2026-09-28",
    "amount": 289,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_192",
    "description": "Online Course",
    "date": "2026-09-27",
    "amount": 275,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_188",
    "description": "Restaurant",
    "date": "2026-09-23",
    "amount": 145,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_190",
    "description": "Gas Station",
    "date": "2026-09-23",
    "amount": 170,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_180",
    "description": "Spotify",
    "date": "2026-09-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_186",
    "description": "Restaurant",
    "date": "2026-09-22",
    "amount": 242,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_184",
    "description": "Mega Image",
    "date": "2026-09-21",
    "amount": 119,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_189",
    "description": "Uber/Bolt",
    "date": "2026-09-18",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_178",
    "description": "YouTube Premium",
    "date": "2026-09-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_177",
    "description": "Digi Internet",
    "date": "2026-09-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_182",
    "description": "Mega Image",
    "date": "2026-09-12",
    "amount": 290,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_176",
    "description": "Enel Electricity",
    "date": "2026-09-10",
    "amount": 120,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_183",
    "description": "Mega Image",
    "date": "2026-09-08",
    "amount": 109,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_193",
    "description": "ETF Vanguard",
    "date": "2026-09-06",
    "amount": 649,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_179",
    "description": "Netflix",
    "date": "2026-09-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_194",
    "description": "Tenant Rent",
    "date": "2026-09-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_187",
    "description": "Restaurant",
    "date": "2026-09-04",
    "amount": 82,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_191",
    "description": "Cinema",
    "date": "2026-09-03",
    "amount": 54,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_175",
    "description": "Apartment Rent",
    "date": "2026-09-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_174",
    "description": "Salary",
    "date": "2026-09-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_181",
    "description": "Gym Membership",
    "date": "2026-09-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_161",
    "description": "Spotify",
    "date": "2026-08-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_164",
    "description": "Mega Image",
    "date": "2026-08-22",
    "amount": 69,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_166",
    "description": "Mega Image",
    "date": "2026-08-22",
    "amount": 245,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_167",
    "description": "Restaurant",
    "date": "2026-08-18",
    "amount": 104,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_169",
    "description": "Uber/Bolt",
    "date": "2026-08-17",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_159",
    "description": "YouTube Premium",
    "date": "2026-08-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_158",
    "description": "Digi Internet",
    "date": "2026-08-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_168",
    "description": "Restaurant",
    "date": "2026-08-11",
    "amount": 101,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_172",
    "description": "Cinema",
    "date": "2026-08-11",
    "amount": 59,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_157",
    "description": "Enel Electricity",
    "date": "2026-08-10",
    "amount": 250,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_163",
    "description": "Mega Image",
    "date": "2026-08-10",
    "amount": 133,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_173",
    "description": "ETF Vanguard",
    "date": "2026-08-10",
    "amount": 904,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_165",
    "description": "Mega Image",
    "date": "2026-08-06",
    "amount": 202,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_160",
    "description": "Netflix",
    "date": "2026-08-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_170",
    "description": "Gas Station",
    "date": "2026-08-05",
    "amount": 276,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_156",
    "description": "Apartment Rent",
    "date": "2026-08-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_155",
    "description": "Salary",
    "date": "2026-08-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_162",
    "description": "Gym Membership",
    "date": "2026-08-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_171",
    "description": "Clothing Store",
    "date": "2026-08-01",
    "amount": 307,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_146",
    "description": "Restaurant",
    "date": "2026-07-27",
    "amount": 144,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_145",
    "description": "Mega Image",
    "date": "2026-07-25",
    "amount": 227,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_148",
    "description": "Uber/Bolt",
    "date": "2026-07-25",
    "amount": 57,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_147",
    "description": "Restaurant",
    "date": "2026-07-23",
    "amount": 235,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_141",
    "description": "Spotify",
    "date": "2026-07-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_153",
    "description": "Property Maintenance",
    "date": "2026-07-22",
    "amount": 190,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_152",
    "description": "ETF Vanguard",
    "date": "2026-07-21",
    "amount": 555,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_150",
    "description": "Clothing Store",
    "date": "2026-07-20",
    "amount": 256,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_135",
    "description": "Freelance Gig",
    "date": "2026-07-15",
    "amount": 2107,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_139",
    "description": "YouTube Premium",
    "date": "2026-07-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_138",
    "description": "Digi Internet",
    "date": "2026-07-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_143",
    "description": "Mega Image",
    "date": "2026-07-12",
    "amount": 203,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_137",
    "description": "Enel Electricity",
    "date": "2026-07-10",
    "amount": 220,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_144",
    "description": "Mega Image",
    "date": "2026-07-08",
    "amount": 137,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_151",
    "description": "Pharmacy",
    "date": "2026-07-08",
    "amount": 120,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_140",
    "description": "Netflix",
    "date": "2026-07-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_154",
    "description": "Tenant Rent",
    "date": "2026-07-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_136",
    "description": "Apartment Rent",
    "date": "2026-07-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_149",
    "description": "Gas Station",
    "date": "2026-07-02",
    "amount": 151,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_134",
    "description": "Salary",
    "date": "2026-07-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_142",
    "description": "Gym Membership",
    "date": "2026-07-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_129",
    "description": "Cinema",
    "date": "2026-06-23",
    "amount": 64,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_119",
    "description": "Spotify",
    "date": "2026-06-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_123",
    "description": "Mega Image",
    "date": "2026-06-22",
    "amount": 206,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_128",
    "description": "Gas Station",
    "date": "2026-06-21",
    "amount": 231,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_132",
    "description": "Flight Tickets",
    "date": "2026-06-21",
    "amount": 1976,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_117",
    "description": "YouTube Premium",
    "date": "2026-06-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_121",
    "description": "Mega Image",
    "date": "2026-06-14",
    "amount": 160,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_127",
    "description": "Uber/Bolt",
    "date": "2026-06-14",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_125",
    "description": "Restaurant",
    "date": "2026-06-13",
    "amount": 123,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_116",
    "description": "Digi Internet",
    "date": "2026-06-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_124",
    "description": "Mega Image",
    "date": "2026-06-12",
    "amount": 131,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_122",
    "description": "Mega Image",
    "date": "2026-06-11",
    "amount": 173,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_126",
    "description": "Restaurant",
    "date": "2026-06-11",
    "amount": 216,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_115",
    "description": "Enel Electricity",
    "date": "2026-06-10",
    "amount": 238,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_133",
    "description": "ETF Vanguard",
    "date": "2026-06-07",
    "amount": 649,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_130",
    "description": "Pharmacy",
    "date": "2026-06-06",
    "amount": 131,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_118",
    "description": "Netflix",
    "date": "2026-06-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_114",
    "description": "Apartment Rent",
    "date": "2026-06-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_131",
    "description": "Haircut",
    "date": "2026-06-02",
    "amount": 88,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_113",
    "description": "Salary",
    "date": "2026-06-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_120",
    "description": "Gym Membership",
    "date": "2026-06-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_100",
    "description": "Mega Image",
    "date": "2026-05-27",
    "amount": 255,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_111",
    "description": "Property Tax",
    "date": "2026-05-27",
    "amount": 1112,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_98",
    "description": "Spotify",
    "date": "2026-05-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_101",
    "description": "Mega Image",
    "date": "2026-05-21",
    "amount": 173,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_104",
    "description": "Restaurant",
    "date": "2026-05-17",
    "amount": 244,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_106",
    "description": "Uber/Bolt",
    "date": "2026-05-17",
    "amount": 52,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_110",
    "description": "ETF Vanguard",
    "date": "2026-05-17",
    "amount": 631,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_96",
    "description": "YouTube Premium",
    "date": "2026-05-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_107",
    "description": "Gas Station",
    "date": "2026-05-14",
    "amount": 225,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_95",
    "description": "Digi Internet",
    "date": "2026-05-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_94",
    "description": "Enel Electricity",
    "date": "2026-05-10",
    "amount": 244,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_103",
    "description": "Restaurant",
    "date": "2026-05-08",
    "amount": 224,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_102",
    "description": "Mega Image",
    "date": "2026-05-07",
    "amount": 178,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_97",
    "description": "Netflix",
    "date": "2026-05-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_105",
    "description": "Restaurant",
    "date": "2026-05-05",
    "amount": 104,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_112",
    "description": "Tenant Rent",
    "date": "2026-05-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_109",
    "description": "Haircut",
    "date": "2026-05-04",
    "amount": 98,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_93",
    "description": "Apartment Rent",
    "date": "2026-05-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_92",
    "description": "Salary",
    "date": "2026-05-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_99",
    "description": "Gym Membership",
    "date": "2026-05-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_108",
    "description": "Clothing Store",
    "date": "2026-05-01",
    "amount": 407,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_90",
    "description": "ETF Vanguard",
    "date": "2026-04-27",
    "amount": 776,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_78",
    "description": "Spotify",
    "date": "2026-04-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_83",
    "description": "Restaurant",
    "date": "2026-04-21",
    "amount": 177,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_81",
    "description": "Mega Image",
    "date": "2026-04-19",
    "amount": 184,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_89",
    "description": "Cinema",
    "date": "2026-04-18",
    "amount": 45,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_91",
    "description": "Property Maintenance",
    "date": "2026-04-16",
    "amount": 292,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_72",
    "description": "Freelance Gig",
    "date": "2026-04-15",
    "amount": 2880,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_76",
    "description": "YouTube Premium",
    "date": "2026-04-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_80",
    "description": "Mega Image",
    "date": "2026-04-15",
    "amount": 67,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_85",
    "description": "Restaurant",
    "date": "2026-04-15",
    "amount": 87,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_87",
    "description": "Uber/Bolt",
    "date": "2026-04-15",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_75",
    "description": "Digi Internet",
    "date": "2026-04-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_74",
    "description": "Enel Electricity",
    "date": "2026-04-10",
    "amount": 207,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_82",
    "description": "Mega Image",
    "date": "2026-04-08",
    "amount": 69,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_88",
    "description": "Gas Station",
    "date": "2026-04-08",
    "amount": 223,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_84",
    "description": "Restaurant",
    "date": "2026-04-06",
    "amount": 172,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_86",
    "description": "Restaurant",
    "date": "2026-04-06",
    "amount": 89,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_77",
    "description": "Netflix",
    "date": "2026-04-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_73",
    "description": "Apartment Rent",
    "date": "2026-04-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_71",
    "description": "Salary",
    "date": "2026-04-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_79",
    "description": "Gym Membership",
    "date": "2026-04-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_58",
    "description": "Mega Image",
    "date": "2026-03-28",
    "amount": 226,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_62",
    "description": "Restaurant",
    "date": "2026-03-28",
    "amount": 85,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_68",
    "description": "Online Course",
    "date": "2026-03-26",
    "amount": 262,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_56",
    "description": "Mega Image",
    "date": "2026-03-24",
    "amount": 102,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_60",
    "description": "Restaurant",
    "date": "2026-03-23",
    "amount": 242,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_54",
    "description": "Spotify",
    "date": "2026-03-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_64",
    "description": "Uber/Bolt",
    "date": "2026-03-19",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_57",
    "description": "Mega Image",
    "date": "2026-03-16",
    "amount": 128,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_61",
    "description": "Restaurant",
    "date": "2026-03-16",
    "amount": 162,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_63",
    "description": "Restaurant",
    "date": "2026-03-16",
    "amount": 102,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_52",
    "description": "YouTube Premium",
    "date": "2026-03-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_65",
    "description": "Gas Station",
    "date": "2026-03-14",
    "amount": 165,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_69",
    "description": "ETF Vanguard",
    "date": "2026-03-14",
    "amount": 968,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_51",
    "description": "Digi Internet",
    "date": "2026-03-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_50",
    "description": "Enel Electricity",
    "date": "2026-03-10",
    "amount": 240,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_66",
    "description": "Cinema",
    "date": "2026-03-09",
    "amount": 65,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_53",
    "description": "Netflix",
    "date": "2026-03-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_59",
    "description": "Restaurant",
    "date": "2026-03-05",
    "amount": 89,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_70",
    "description": "Tenant Rent",
    "date": "2026-03-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_49",
    "description": "Apartment Rent",
    "date": "2026-03-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_48",
    "description": "Salary",
    "date": "2026-03-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_55",
    "description": "Gym Membership",
    "date": "2026-03-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_67",
    "description": "Pharmacy",
    "date": "2026-03-01",
    "amount": 142,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_36",
    "description": "Mega Image",
    "date": "2026-02-24",
    "amount": 200,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_46",
    "description": "Clothing Store",
    "date": "2026-02-24",
    "amount": 273,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_33",
    "description": "Spotify",
    "date": "2026-02-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_38",
    "description": "Mega Image",
    "date": "2026-02-22",
    "amount": 176,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_41",
    "description": "Restaurant",
    "date": "2026-02-22",
    "amount": 188,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_43",
    "description": "Restaurant",
    "date": "2026-02-18",
    "amount": 247,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_45",
    "description": "Gas Station",
    "date": "2026-02-17",
    "amount": 192,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_35",
    "description": "Mega Image",
    "date": "2026-02-16",
    "amount": 252,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_31",
    "description": "YouTube Premium",
    "date": "2026-02-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_39",
    "description": "Restaurant",
    "date": "2026-02-15",
    "amount": 201,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_40",
    "description": "Restaurant",
    "date": "2026-02-15",
    "amount": 82,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_30",
    "description": "Digi Internet",
    "date": "2026-02-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_42",
    "description": "Restaurant",
    "date": "2026-02-12",
    "amount": 142,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_29",
    "description": "Enel Electricity",
    "date": "2026-02-10",
    "amount": 219,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_47",
    "description": "ETF Vanguard",
    "date": "2026-02-09",
    "amount": 533,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_44",
    "description": "Uber/Bolt",
    "date": "2026-02-07",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_32",
    "description": "Netflix",
    "date": "2026-02-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_28",
    "description": "Apartment Rent",
    "date": "2026-02-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_37",
    "description": "Mega Image",
    "date": "2026-02-02",
    "amount": 141,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_27",
    "description": "Salary",
    "date": "2026-02-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_34",
    "description": "Gym Membership",
    "date": "2026-02-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_11",
    "description": "Mega Image",
    "date": "2026-01-26",
    "amount": 124,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_17",
    "description": "Restaurant",
    "date": "2026-01-25",
    "amount": 95,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_10",
    "description": "Mega Image",
    "date": "2026-01-23",
    "amount": 76,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_13",
    "description": "Mega Image",
    "date": "2026-01-23",
    "amount": 189,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_8",
    "description": "Spotify",
    "date": "2026-01-22",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_23",
    "description": "Pharmacy",
    "date": "2026-01-22",
    "amount": 79,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_15",
    "description": "Restaurant",
    "date": "2026-01-21",
    "amount": 208,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_24",
    "description": "ETF Vanguard",
    "date": "2026-01-21",
    "amount": 664,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_18",
    "description": "Restaurant",
    "date": "2026-01-20",
    "amount": 155,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_12",
    "description": "Mega Image",
    "date": "2026-01-17",
    "amount": 172,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_21",
    "description": "Gas Station",
    "date": "2026-01-17",
    "amount": 270,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_22",
    "description": "Cinema",
    "date": "2026-01-17",
    "amount": 43,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_2",
    "description": "Freelance Gig",
    "date": "2026-01-15",
    "amount": 2508,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_6",
    "description": "YouTube Premium",
    "date": "2026-01-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_checking",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_14",
    "description": "Mega Image",
    "date": "2026-01-15",
    "amount": 275,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_16",
    "description": "Restaurant",
    "date": "2026-01-14",
    "amount": 145,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_20",
    "description": "Uber/Bolt",
    "date": "2026-01-13",
    "amount": 52,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_5",
    "description": "Digi Internet",
    "date": "2026-01-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_4",
    "description": "Enel Electricity",
    "date": "2026-01-10",
    "amount": 231,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_25",
    "description": "Property Maintenance",
    "date": "2026-01-07",
    "amount": 118,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_7",
    "description": "Netflix",
    "date": "2026-01-05",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": [
      "Subscription"
    ]
  },
  {
    "id": "demo_tx_19",
    "description": "Restaurant",
    "date": "2026-01-05",
    "amount": 202,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_26",
    "description": "Tenant Rent",
    "date": "2026-01-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_3",
    "description": "Apartment Rent",
    "date": "2026-01-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_1",
    "description": "Salary",
    "date": "2026-01-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_9",
    "description": "Gym Membership",
    "date": "2026-01-01",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": [
      "Subscription"
    ]
  }
];
