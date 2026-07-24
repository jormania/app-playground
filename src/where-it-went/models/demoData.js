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
    "id": "demo_tx_370",
    "description": "Uber/Bolt",
    "date": "2026-12-28",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_374",
    "description": "Amazon",
    "date": "2026-12-26",
    "amount": 63,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_367",
    "description": "Starbucks",
    "date": "2026-12-24",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_355",
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
    "id": "demo_tx_361",
    "description": "Restaurant",
    "date": "2026-12-20",
    "amount": 128,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_365",
    "description": "Starbucks",
    "date": "2026-12-20",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_358",
    "description": "Mega Image",
    "date": "2026-12-19",
    "amount": 247,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_363",
    "description": "Restaurant",
    "date": "2026-12-19",
    "amount": 129,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_375",
    "description": "Amazon",
    "date": "2026-12-19",
    "amount": 90,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_364",
    "description": "Starbucks",
    "date": "2026-12-17",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_380",
    "description": "ETF Vanguard",
    "date": "2026-12-17",
    "amount": 789,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_353",
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
    "id": "demo_tx_376",
    "description": "Gas Station",
    "date": "2026-12-15",
    "amount": 199,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_379",
    "description": "Christmas Gifts",
    "date": "2026-12-15",
    "amount": 985,
    "type": "Expense",
    "categoryId": "cat_gift",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_369",
    "description": "Uber/Bolt",
    "date": "2026-12-14",
    "amount": 46,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_378",
    "description": "Flight Tickets",
    "date": "2026-12-14",
    "amount": 919,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_357",
    "description": "Mega Image",
    "date": "2026-12-13",
    "amount": 131,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_360",
    "description": "Mega Image",
    "date": "2026-12-13",
    "amount": 296,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_352",
    "description": "Digi Internet",
    "date": "2026-12-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_377",
    "description": "Clothing Store",
    "date": "2026-12-12",
    "amount": 114,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_351",
    "description": "Enel Electricity",
    "date": "2026-12-10",
    "amount": 243,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_368",
    "description": "Starbucks",
    "date": "2026-12-09",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_372",
    "description": "Uber/Bolt",
    "date": "2026-12-09",
    "amount": 41,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_354",
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
    "id": "demo_tx_359",
    "description": "Mega Image",
    "date": "2026-12-05",
    "amount": 147,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_366",
    "description": "Starbucks",
    "date": "2026-12-05",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_371",
    "description": "Uber/Bolt",
    "date": "2026-12-04",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_350",
    "description": "Apartment Rent",
    "date": "2026-12-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_362",
    "description": "Restaurant",
    "date": "2026-12-02",
    "amount": 95,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_349",
    "description": "Salary",
    "date": "2026-12-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_356",
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
    "id": "demo_tx_373",
    "description": "Amazon",
    "date": "2026-12-01",
    "amount": 121,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_381",
    "description": "Monthly Bank Fee",
    "date": "2026-12-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_329",
    "description": "Starbucks",
    "date": "2026-11-27",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_331",
    "description": "Starbucks",
    "date": "2026-11-27",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_344",
    "description": "Pharmacy",
    "date": "2026-11-27",
    "amount": 95,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_320",
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
    "id": "demo_tx_326",
    "description": "Restaurant",
    "date": "2026-11-22",
    "amount": 250,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_337",
    "description": "Amazon",
    "date": "2026-11-21",
    "amount": 161,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_338",
    "description": "Amazon",
    "date": "2026-11-21",
    "amount": 85,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_330",
    "description": "Starbucks",
    "date": "2026-11-20",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_322",
    "description": "Mega Image",
    "date": "2026-11-18",
    "amount": 192,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_341",
    "description": "Gas Station",
    "date": "2026-11-18",
    "amount": 179,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_324",
    "description": "Mega Image",
    "date": "2026-11-16",
    "amount": 190,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_318",
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
    "id": "demo_tx_328",
    "description": "Restaurant",
    "date": "2026-11-15",
    "amount": 201,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_333",
    "description": "Starbucks",
    "date": "2026-11-14",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_327",
    "description": "Restaurant",
    "date": "2026-11-13",
    "amount": 151,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_317",
    "description": "Digi Internet",
    "date": "2026-11-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_342",
    "description": "Clothing Store",
    "date": "2026-11-12",
    "amount": 254,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_346",
    "description": "Property Tax",
    "date": "2026-11-11",
    "amount": 1065,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_316",
    "description": "Enel Electricity",
    "date": "2026-11-10",
    "amount": 131,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_323",
    "description": "Mega Image",
    "date": "2026-11-10",
    "amount": 254,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_343",
    "description": "Cinema",
    "date": "2026-11-10",
    "amount": 69,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_335",
    "description": "Uber/Bolt",
    "date": "2026-11-08",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_345",
    "description": "ETF Vanguard",
    "date": "2026-11-08",
    "amount": 996,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_336",
    "description": "Uber/Bolt",
    "date": "2026-11-07",
    "amount": 57,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_325",
    "description": "Restaurant",
    "date": "2026-11-06",
    "amount": 228,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_339",
    "description": "Amazon",
    "date": "2026-11-06",
    "amount": 191,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_319",
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
    "id": "demo_tx_334",
    "description": "Uber/Bolt",
    "date": "2026-11-05",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_348",
    "description": "Tenant Rent",
    "date": "2026-11-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_332",
    "description": "Starbucks",
    "date": "2026-11-04",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_340",
    "description": "Amazon",
    "date": "2026-11-04",
    "amount": 36,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_315",
    "description": "Apartment Rent",
    "date": "2026-11-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_314",
    "description": "Salary",
    "date": "2026-11-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_321",
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
    "id": "demo_tx_347",
    "description": "Monthly Bank Fee",
    "date": "2026-11-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_307",
    "description": "Gas Station",
    "date": "2026-10-28",
    "amount": 273,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_303",
    "description": "Uber/Bolt",
    "date": "2026-10-27",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_300",
    "description": "Starbucks",
    "date": "2026-10-23",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_291",
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
    "id": "demo_tx_299",
    "description": "Starbucks",
    "date": "2026-10-21",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_311",
    "description": "ETF Vanguard",
    "date": "2026-10-20",
    "amount": 730,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_296",
    "description": "Restaurant",
    "date": "2026-10-18",
    "amount": 239,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_298",
    "description": "Starbucks",
    "date": "2026-10-18",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_308",
    "description": "Clothing Store",
    "date": "2026-10-17",
    "amount": 156,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_310",
    "description": "Haircut",
    "date": "2026-10-16",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_285",
    "description": "Freelance Gig",
    "date": "2026-10-15",
    "amount": 2965,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_289",
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
    "id": "demo_tx_312",
    "description": "Property Maintenance",
    "date": "2026-10-15",
    "amount": 119,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_288",
    "description": "Digi Internet",
    "date": "2026-10-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_293",
    "description": "Mega Image",
    "date": "2026-10-12",
    "amount": 243,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_297",
    "description": "Restaurant",
    "date": "2026-10-12",
    "amount": 138,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_301",
    "description": "Starbucks",
    "date": "2026-10-11",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_305",
    "description": "Amazon",
    "date": "2026-10-11",
    "amount": 200,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_287",
    "description": "Enel Electricity",
    "date": "2026-10-10",
    "amount": 189,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_294",
    "description": "Mega Image",
    "date": "2026-10-10",
    "amount": 146,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_309",
    "description": "Pharmacy",
    "date": "2026-10-08",
    "amount": 78,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_295",
    "description": "Mega Image",
    "date": "2026-10-07",
    "amount": 241,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_302",
    "description": "Uber/Bolt",
    "date": "2026-10-07",
    "amount": 54,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_290",
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
    "id": "demo_tx_306",
    "description": "Amazon",
    "date": "2026-10-04",
    "amount": 163,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_304",
    "description": "Amazon",
    "date": "2026-10-03",
    "amount": 151,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_286",
    "description": "Apartment Rent",
    "date": "2026-10-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_284",
    "description": "Salary",
    "date": "2026-10-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_292",
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
    "id": "demo_tx_313",
    "description": "Monthly Bank Fee",
    "date": "2026-10-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_266",
    "description": "Restaurant",
    "date": "2026-09-26",
    "amount": 167,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_281",
    "description": "ETF Vanguard",
    "date": "2026-09-26",
    "amount": 733,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_278",
    "description": "Gas Station",
    "date": "2026-09-24",
    "amount": 208,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_261",
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
    "id": "demo_tx_275",
    "description": "Uber/Bolt",
    "date": "2026-09-20",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_269",
    "description": "Starbucks",
    "date": "2026-09-19",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_270",
    "description": "Starbucks",
    "date": "2026-09-19",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_271",
    "description": "Starbucks",
    "date": "2026-09-19",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_277",
    "description": "Amazon",
    "date": "2026-09-18",
    "amount": 111,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_264",
    "description": "Mega Image",
    "date": "2026-09-16",
    "amount": 95,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_259",
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
    "id": "demo_tx_279",
    "description": "Cinema",
    "date": "2026-09-13",
    "amount": 69,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_258",
    "description": "Digi Internet",
    "date": "2026-09-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_257",
    "description": "Enel Electricity",
    "date": "2026-09-10",
    "amount": 193,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_280",
    "description": "Online Course",
    "date": "2026-09-09",
    "amount": 341,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_263",
    "description": "Mega Image",
    "date": "2026-09-08",
    "amount": 223,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_274",
    "description": "Uber/Bolt",
    "date": "2026-09-08",
    "amount": 38,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_265",
    "description": "Mega Image",
    "date": "2026-09-07",
    "amount": 259,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_268",
    "description": "Starbucks",
    "date": "2026-09-07",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_276",
    "description": "Uber/Bolt",
    "date": "2026-09-07",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_260",
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
    "id": "demo_tx_272",
    "description": "Starbucks",
    "date": "2026-09-05",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_273",
    "description": "Starbucks",
    "date": "2026-09-05",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_283",
    "description": "Tenant Rent",
    "date": "2026-09-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_267",
    "description": "Restaurant",
    "date": "2026-09-04",
    "amount": 213,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_256",
    "description": "Apartment Rent",
    "date": "2026-09-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_255",
    "description": "Salary",
    "date": "2026-09-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_262",
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
    "id": "demo_tx_282",
    "description": "Monthly Bank Fee",
    "date": "2026-09-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_239",
    "description": "Restaurant",
    "date": "2026-08-28",
    "amount": 220,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_238",
    "description": "Restaurant",
    "date": "2026-08-27",
    "amount": 127,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_236",
    "description": "Mega Image",
    "date": "2026-08-26",
    "amount": 79,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_246",
    "description": "Uber/Bolt",
    "date": "2026-08-25",
    "amount": 54,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_252",
    "description": "Cinema",
    "date": "2026-08-25",
    "amount": 45,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_253",
    "description": "ETF Vanguard",
    "date": "2026-08-25",
    "amount": 808,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_249",
    "description": "Amazon",
    "date": "2026-08-23",
    "amount": 158,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_232",
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
    "id": "demo_tx_240",
    "description": "Restaurant",
    "date": "2026-08-20",
    "amount": 213,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_244",
    "description": "Starbucks",
    "date": "2026-08-20",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_245",
    "description": "Starbucks",
    "date": "2026-08-19",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_230",
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
    "id": "demo_tx_237",
    "description": "Restaurant",
    "date": "2026-08-15",
    "amount": 99,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_251",
    "description": "Clothing Store",
    "date": "2026-08-15",
    "amount": 206,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_229",
    "description": "Digi Internet",
    "date": "2026-08-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_247",
    "description": "Uber/Bolt",
    "date": "2026-08-11",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_228",
    "description": "Enel Electricity",
    "date": "2026-08-10",
    "amount": 142,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_250",
    "description": "Gas Station",
    "date": "2026-08-10",
    "amount": 230,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_234",
    "description": "Mega Image",
    "date": "2026-08-09",
    "amount": 251,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_248",
    "description": "Uber/Bolt",
    "date": "2026-08-09",
    "amount": 49,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_241",
    "description": "Restaurant",
    "date": "2026-08-07",
    "amount": 165,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_231",
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
    "id": "demo_tx_242",
    "description": "Starbucks",
    "date": "2026-08-03",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_243",
    "description": "Starbucks",
    "date": "2026-08-03",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_227",
    "description": "Apartment Rent",
    "date": "2026-08-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_235",
    "description": "Mega Image",
    "date": "2026-08-02",
    "amount": 67,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_226",
    "description": "Salary",
    "date": "2026-08-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_233",
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
    "id": "demo_tx_254",
    "description": "Monthly Bank Fee",
    "date": "2026-08-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_217",
    "description": "Uber/Bolt",
    "date": "2026-07-28",
    "amount": 42,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_213",
    "description": "Starbucks",
    "date": "2026-07-27",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_205",
    "description": "Mega Image",
    "date": "2026-07-26",
    "amount": 257,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_206",
    "description": "Mega Image",
    "date": "2026-07-26",
    "amount": 146,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_220",
    "description": "Gas Station",
    "date": "2026-07-26",
    "amount": 236,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_201",
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
    "id": "demo_tx_214",
    "description": "Starbucks",
    "date": "2026-07-22",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_218",
    "description": "Amazon",
    "date": "2026-07-22",
    "amount": 116,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_211",
    "description": "Starbucks",
    "date": "2026-07-16",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_195",
    "description": "Freelance Gig",
    "date": "2026-07-15",
    "amount": 1167,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_199",
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
    "id": "demo_tx_210",
    "description": "Starbucks",
    "date": "2026-07-14",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_219",
    "description": "Amazon",
    "date": "2026-07-13",
    "amount": 151,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_198",
    "description": "Digi Internet",
    "date": "2026-07-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_207",
    "description": "Restaurant",
    "date": "2026-07-12",
    "amount": 226,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_221",
    "description": "Clothing Store",
    "date": "2026-07-11",
    "amount": 420,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_197",
    "description": "Enel Electricity",
    "date": "2026-07-10",
    "amount": 198,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_204",
    "description": "Mega Image",
    "date": "2026-07-09",
    "amount": 297,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_208",
    "description": "Restaurant",
    "date": "2026-07-09",
    "amount": 91,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_216",
    "description": "Uber/Bolt",
    "date": "2026-07-09",
    "amount": 47,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_223",
    "description": "Property Maintenance",
    "date": "2026-07-09",
    "amount": 303,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_215",
    "description": "Uber/Bolt",
    "date": "2026-07-08",
    "amount": 39,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_209",
    "description": "Restaurant",
    "date": "2026-07-07",
    "amount": 201,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_200",
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
    "id": "demo_tx_225",
    "description": "Tenant Rent",
    "date": "2026-07-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_212",
    "description": "Starbucks",
    "date": "2026-07-04",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_196",
    "description": "Apartment Rent",
    "date": "2026-07-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_194",
    "description": "Salary",
    "date": "2026-07-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_202",
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
    "id": "demo_tx_203",
    "description": "Mega Image",
    "date": "2026-07-01",
    "amount": 286,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_222",
    "description": "ETF Vanguard",
    "date": "2026-07-01",
    "amount": 614,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_224",
    "description": "Monthly Bank Fee",
    "date": "2026-07-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_187",
    "description": "Amazon",
    "date": "2026-06-28",
    "amount": 143,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_181",
    "description": "Starbucks",
    "date": "2026-06-27",
    "amount": 18,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_179",
    "description": "Starbucks",
    "date": "2026-06-26",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_168",
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
    "id": "demo_tx_173",
    "description": "Restaurant",
    "date": "2026-06-20",
    "amount": 214,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_180",
    "description": "Starbucks",
    "date": "2026-06-20",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_183",
    "description": "Uber/Bolt",
    "date": "2026-06-20",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_190",
    "description": "Cinema",
    "date": "2026-06-19",
    "amount": 46,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_188",
    "description": "Amazon",
    "date": "2026-06-17",
    "amount": 175,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_166",
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
    "id": "demo_tx_192",
    "description": "ETF Vanguard",
    "date": "2026-06-15",
    "amount": 739,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_176",
    "description": "Restaurant",
    "date": "2026-06-13",
    "amount": 161,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_165",
    "description": "Digi Internet",
    "date": "2026-06-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_182",
    "description": "Starbucks",
    "date": "2026-06-12",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_170",
    "description": "Mega Image",
    "date": "2026-06-11",
    "amount": 165,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_184",
    "description": "Uber/Bolt",
    "date": "2026-06-11",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_164",
    "description": "Enel Electricity",
    "date": "2026-06-10",
    "amount": 140,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_177",
    "description": "Restaurant",
    "date": "2026-06-10",
    "amount": 217,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_185",
    "description": "Uber/Bolt",
    "date": "2026-06-10",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_186",
    "description": "Uber/Bolt",
    "date": "2026-06-10",
    "amount": 46,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_175",
    "description": "Restaurant",
    "date": "2026-06-09",
    "amount": 157,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_178",
    "description": "Starbucks",
    "date": "2026-06-08",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_171",
    "description": "Mega Image",
    "date": "2026-06-07",
    "amount": 106,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_167",
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
    "id": "demo_tx_163",
    "description": "Apartment Rent",
    "date": "2026-06-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_172",
    "description": "Mega Image",
    "date": "2026-06-02",
    "amount": 264,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_189",
    "description": "Gas Station",
    "date": "2026-06-02",
    "amount": 188,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_191",
    "description": "Flight Tickets",
    "date": "2026-06-02",
    "amount": 1306,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_162",
    "description": "Salary",
    "date": "2026-06-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_169",
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
    "id": "demo_tx_174",
    "description": "Restaurant",
    "date": "2026-06-01",
    "amount": 250,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_193",
    "description": "Monthly Bank Fee",
    "date": "2026-06-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_134",
    "description": "Mega Image",
    "date": "2026-05-28",
    "amount": 182,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_159",
    "description": "Property Tax",
    "date": "2026-05-27",
    "amount": 1132,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_144",
    "description": "Starbucks",
    "date": "2026-05-25",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_140",
    "description": "Restaurant",
    "date": "2026-05-23",
    "amount": 89,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_143",
    "description": "Starbucks",
    "date": "2026-05-23",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_152",
    "description": "Amazon",
    "date": "2026-05-23",
    "amount": 184,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_132",
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
    "id": "demo_tx_147",
    "description": "Starbucks",
    "date": "2026-05-20",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_156",
    "description": "Cinema",
    "date": "2026-05-20",
    "amount": 41,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_141",
    "description": "Restaurant",
    "date": "2026-05-19",
    "amount": 169,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_158",
    "description": "ETF Vanguard",
    "date": "2026-05-19",
    "amount": 929,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_145",
    "description": "Starbucks",
    "date": "2026-05-17",
    "amount": 16,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_146",
    "description": "Starbucks",
    "date": "2026-05-16",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_148",
    "description": "Starbucks",
    "date": "2026-05-16",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_130",
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
    "id": "demo_tx_136",
    "description": "Mega Image",
    "date": "2026-05-15",
    "amount": 193,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_157",
    "description": "Pharmacy",
    "date": "2026-05-14",
    "amount": 133,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_151",
    "description": "Amazon",
    "date": "2026-05-13",
    "amount": 122,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_129",
    "description": "Digi Internet",
    "date": "2026-05-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_149",
    "description": "Uber/Bolt",
    "date": "2026-05-12",
    "amount": 48,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_128",
    "description": "Enel Electricity",
    "date": "2026-05-10",
    "amount": 203,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_150",
    "description": "Uber/Bolt",
    "date": "2026-05-10",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_135",
    "description": "Mega Image",
    "date": "2026-05-07",
    "amount": 97,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_137",
    "description": "Restaurant",
    "date": "2026-05-07",
    "amount": 188,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_138",
    "description": "Restaurant",
    "date": "2026-05-07",
    "amount": 203,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_153",
    "description": "Amazon",
    "date": "2026-05-07",
    "amount": 157,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_131",
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
    "id": "demo_tx_161",
    "description": "Tenant Rent",
    "date": "2026-05-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_139",
    "description": "Restaurant",
    "date": "2026-05-04",
    "amount": 124,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_154",
    "description": "Gas Station",
    "date": "2026-05-03",
    "amount": 241,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_127",
    "description": "Apartment Rent",
    "date": "2026-05-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_142",
    "description": "Starbucks",
    "date": "2026-05-02",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_126",
    "description": "Salary",
    "date": "2026-05-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_133",
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
    "id": "demo_tx_155",
    "description": "Clothing Store",
    "date": "2026-05-01",
    "amount": 332,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_160",
    "description": "Monthly Bank Fee",
    "date": "2026-05-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_110",
    "description": "Restaurant",
    "date": "2026-04-28",
    "amount": 134,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_113",
    "description": "Starbucks",
    "date": "2026-04-25",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_104",
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
    "id": "demo_tx_115",
    "description": "Uber/Bolt",
    "date": "2026-04-22",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_119",
    "description": "Amazon",
    "date": "2026-04-22",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_120",
    "description": "Amazon",
    "date": "2026-04-21",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_122",
    "description": "Pharmacy",
    "date": "2026-04-21",
    "amount": 111,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_118",
    "description": "Uber/Bolt",
    "date": "2026-04-17",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_98",
    "description": "Freelance Gig",
    "date": "2026-04-15",
    "amount": 2763,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_102",
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
    "id": "demo_tx_112",
    "description": "Starbucks",
    "date": "2026-04-15",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_101",
    "description": "Digi Internet",
    "date": "2026-04-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_116",
    "description": "Uber/Bolt",
    "date": "2026-04-11",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_124",
    "description": "Property Maintenance",
    "date": "2026-04-11",
    "amount": 280,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_100",
    "description": "Enel Electricity",
    "date": "2026-04-10",
    "amount": 141,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_106",
    "description": "Mega Image",
    "date": "2026-04-08",
    "amount": 152,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_121",
    "description": "Gas Station",
    "date": "2026-04-08",
    "amount": 165,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_108",
    "description": "Mega Image",
    "date": "2026-04-07",
    "amount": 175,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_109",
    "description": "Restaurant",
    "date": "2026-04-07",
    "amount": 131,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_111",
    "description": "Restaurant",
    "date": "2026-04-06",
    "amount": 224,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_103",
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
    "id": "demo_tx_107",
    "description": "Mega Image",
    "date": "2026-04-05",
    "amount": 172,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_117",
    "description": "Uber/Bolt",
    "date": "2026-04-04",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_123",
    "description": "ETF Vanguard",
    "date": "2026-04-04",
    "amount": 706,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_99",
    "description": "Apartment Rent",
    "date": "2026-04-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_97",
    "description": "Salary",
    "date": "2026-04-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_105",
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
    "id": "demo_tx_114",
    "description": "Starbucks",
    "date": "2026-04-01",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_125",
    "description": "Monthly Bank Fee",
    "date": "2026-04-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_84",
    "description": "Starbucks",
    "date": "2026-03-24",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_92",
    "description": "Haircut",
    "date": "2026-03-24",
    "amount": 87,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_83",
    "description": "Starbucks",
    "date": "2026-03-23",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_70",
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
    "id": "demo_tx_94",
    "description": "ETF Vanguard",
    "date": "2026-03-20",
    "amount": 824,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_91",
    "description": "Clothing Store",
    "date": "2026-03-19",
    "amount": 491,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_90",
    "description": "Gas Station",
    "date": "2026-03-18",
    "amount": 288,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_73",
    "description": "Mega Image",
    "date": "2026-03-17",
    "amount": 223,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_68",
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
    "id": "demo_tx_75",
    "description": "Mega Image",
    "date": "2026-03-15",
    "amount": 283,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_76",
    "description": "Mega Image",
    "date": "2026-03-15",
    "amount": 256,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_87",
    "description": "Uber/Bolt",
    "date": "2026-03-15",
    "amount": 36,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_93",
    "description": "Online Course",
    "date": "2026-03-13",
    "amount": 438,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_67",
    "description": "Digi Internet",
    "date": "2026-03-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_74",
    "description": "Mega Image",
    "date": "2026-03-12",
    "amount": 141,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_79",
    "description": "Starbucks",
    "date": "2026-03-12",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_81",
    "description": "Starbucks",
    "date": "2026-03-12",
    "amount": 18,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_80",
    "description": "Starbucks",
    "date": "2026-03-11",
    "amount": 16,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_66",
    "description": "Enel Electricity",
    "date": "2026-03-10",
    "amount": 209,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_72",
    "description": "Mega Image",
    "date": "2026-03-09",
    "amount": 264,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_77",
    "description": "Restaurant",
    "date": "2026-03-06",
    "amount": 216,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_69",
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
    "id": "demo_tx_82",
    "description": "Starbucks",
    "date": "2026-03-05",
    "amount": 26,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_85",
    "description": "Uber/Bolt",
    "date": "2026-03-05",
    "amount": 41,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_86",
    "description": "Uber/Bolt",
    "date": "2026-03-05",
    "amount": 50,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_96",
    "description": "Tenant Rent",
    "date": "2026-03-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_78",
    "description": "Restaurant",
    "date": "2026-03-04",
    "amount": 215,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_88",
    "description": "Amazon",
    "date": "2026-03-04",
    "amount": 155,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_65",
    "description": "Apartment Rent",
    "date": "2026-03-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_89",
    "description": "Amazon",
    "date": "2026-03-02",
    "amount": 166,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_64",
    "description": "Salary",
    "date": "2026-03-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_71",
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
    "id": "demo_tx_95",
    "description": "Monthly Bank Fee",
    "date": "2026-03-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_46",
    "description": "Restaurant",
    "date": "2026-02-24",
    "amount": 196,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_59",
    "description": "Gas Station",
    "date": "2026-02-24",
    "amount": 280,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_42",
    "description": "Mega Image",
    "date": "2026-02-23",
    "amount": 147,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_57",
    "description": "Amazon",
    "date": "2026-02-23",
    "amount": 62,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_40",
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
    "id": "demo_tx_45",
    "description": "Mega Image",
    "date": "2026-02-22",
    "amount": 81,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_48",
    "description": "Restaurant",
    "date": "2026-02-22",
    "amount": 198,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_51",
    "description": "Starbucks",
    "date": "2026-02-21",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_62",
    "description": "ETF Vanguard",
    "date": "2026-02-21",
    "amount": 635,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_52",
    "description": "Uber/Bolt",
    "date": "2026-02-18",
    "amount": 44,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_60",
    "description": "Clothing Store",
    "date": "2026-02-16",
    "amount": 488,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_61",
    "description": "Cinema",
    "date": "2026-02-16",
    "amount": 71,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_38",
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
    "id": "demo_tx_37",
    "description": "Digi Internet",
    "date": "2026-02-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_56",
    "description": "Amazon",
    "date": "2026-02-12",
    "amount": 154,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_49",
    "description": "Starbucks",
    "date": "2026-02-11",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_36",
    "description": "Enel Electricity",
    "date": "2026-02-10",
    "amount": 147,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_55",
    "description": "Uber/Bolt",
    "date": "2026-02-07",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_50",
    "description": "Starbucks",
    "date": "2026-02-06",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_39",
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
    "id": "demo_tx_43",
    "description": "Mega Image",
    "date": "2026-02-05",
    "amount": 132,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_58",
    "description": "Amazon",
    "date": "2026-02-04",
    "amount": 188,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_44",
    "description": "Mega Image",
    "date": "2026-02-03",
    "amount": 282,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_35",
    "description": "Apartment Rent",
    "date": "2026-02-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_47",
    "description": "Restaurant",
    "date": "2026-02-02",
    "amount": 236,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_53",
    "description": "Uber/Bolt",
    "date": "2026-02-02",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_54",
    "description": "Uber/Bolt",
    "date": "2026-02-02",
    "amount": 57,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_34",
    "description": "Salary",
    "date": "2026-02-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_41",
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
    "id": "demo_tx_63",
    "description": "Monthly Bank Fee",
    "date": "2026-02-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_26",
    "description": "Amazon",
    "date": "2026-01-27",
    "amount": 199,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_16",
    "description": "Restaurant",
    "date": "2026-01-26",
    "amount": 90,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_12",
    "description": "Mega Image",
    "date": "2026-01-24",
    "amount": 287,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_15",
    "description": "Restaurant",
    "date": "2026-01-24",
    "amount": 231,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_21",
    "description": "Starbucks",
    "date": "2026-01-24",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
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
    "id": "demo_tx_18",
    "description": "Starbucks",
    "date": "2026-01-20",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_27",
    "description": "Gas Station",
    "date": "2026-01-20",
    "amount": 170,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_24",
    "description": "Uber/Bolt",
    "date": "2026-01-19",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_31",
    "description": "Property Maintenance",
    "date": "2026-01-19",
    "amount": 169,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_28",
    "description": "Clothing Store",
    "date": "2026-01-18",
    "amount": 296,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_30",
    "description": "ETF Vanguard",
    "date": "2026-01-17",
    "amount": 905,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_2",
    "description": "Freelance Gig",
    "date": "2026-01-15",
    "amount": 1686,
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
    "id": "demo_tx_29",
    "description": "Cinema",
    "date": "2026-01-13",
    "amount": 63,
    "type": "Expense",
    "categoryId": "cat_entertainment",
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
    "id": "demo_tx_19",
    "description": "Starbucks",
    "date": "2026-01-12",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_4",
    "description": "Enel Electricity",
    "date": "2026-01-10",
    "amount": 232,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_23",
    "description": "Uber/Bolt",
    "date": "2026-01-09",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_11",
    "description": "Mega Image",
    "date": "2026-01-07",
    "amount": 135,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_14",
    "description": "Restaurant",
    "date": "2026-01-06",
    "amount": 128,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
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
    "id": "demo_tx_13",
    "description": "Mega Image",
    "date": "2026-01-05",
    "amount": 255,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_33",
    "description": "Tenant Rent",
    "date": "2026-01-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_22",
    "description": "Uber/Bolt",
    "date": "2026-01-04",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
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
    "id": "demo_tx_20",
    "description": "Starbucks",
    "date": "2026-01-02",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
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
  },
  {
    "id": "demo_tx_10",
    "description": "Mega Image",
    "date": "2026-01-01",
    "amount": 246,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_17",
    "description": "Restaurant",
    "date": "2026-01-01",
    "amount": 180,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_25",
    "description": "Amazon",
    "date": "2026-01-01",
    "amount": 37,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_32",
    "description": "Monthly Bank Fee",
    "date": "2026-01-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  }
];
