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
    "id": "demo_tx_383",
    "description": "Flight Tickets",
    "date": "2026-12-28",
    "amount": 2471,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_381",
    "description": "Gas Station",
    "date": "2026-12-24",
    "amount": 207,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_362",
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
    "id": "demo_tx_373",
    "description": "Starbucks",
    "date": "2026-12-21",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_378",
    "description": "Uber/Bolt",
    "date": "2026-12-21",
    "amount": 56,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_364",
    "description": "Mega Image",
    "date": "2026-12-20",
    "amount": 117,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_369",
    "description": "Restaurant",
    "date": "2026-12-19",
    "amount": 97,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_374",
    "description": "Starbucks",
    "date": "2026-12-19",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_377",
    "description": "Uber/Bolt",
    "date": "2026-12-18",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_360",
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
    "id": "demo_tx_380",
    "description": "Amazon",
    "date": "2026-12-15",
    "amount": 123,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_384",
    "description": "Christmas Gifts",
    "date": "2026-12-15",
    "amount": 643,
    "type": "Expense",
    "categoryId": "cat_gift",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_359",
    "description": "Digi Internet",
    "date": "2026-12-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_385",
    "description": "ETF Vanguard",
    "date": "2026-12-12",
    "amount": 681,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_358",
    "description": "Enel Electricity",
    "date": "2026-12-10",
    "amount": 169,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_376",
    "description": "Uber/Bolt",
    "date": "2026-12-10",
    "amount": 53,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_370",
    "description": "Restaurant",
    "date": "2026-12-08",
    "amount": 176,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_371",
    "description": "Restaurant",
    "date": "2026-12-08",
    "amount": 157,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_379",
    "description": "Uber/Bolt",
    "date": "2026-12-07",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_366",
    "description": "Mega Image",
    "date": "2026-12-06",
    "amount": 115,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_375",
    "description": "Starbucks",
    "date": "2026-12-06",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_361",
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
    "id": "demo_tx_365",
    "description": "Mega Image",
    "date": "2026-12-04",
    "amount": 274,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_367",
    "description": "Mega Image",
    "date": "2026-12-04",
    "amount": 109,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_368",
    "description": "Mega Image",
    "date": "2026-12-04",
    "amount": 139,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_372",
    "description": "Starbucks",
    "date": "2026-12-04",
    "amount": 16,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_382",
    "description": "Haircut",
    "date": "2026-12-03",
    "amount": 61,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_357",
    "description": "Apartment Rent",
    "date": "2026-12-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_356",
    "description": "Salary",
    "date": "2026-12-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_363",
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
    "id": "demo_tx_338",
    "description": "Restaurant",
    "date": "2026-11-27",
    "amount": 91,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_340",
    "description": "Starbucks",
    "date": "2026-11-27",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_351",
    "description": "Clothing Store",
    "date": "2026-11-26",
    "amount": 374,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_349",
    "description": "Amazon",
    "date": "2026-11-25",
    "amount": 196,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_329",
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
    "id": "demo_tx_345",
    "description": "Uber/Bolt",
    "date": "2026-11-21",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_331",
    "description": "Mega Image",
    "date": "2026-11-19",
    "amount": 194,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_339",
    "description": "Starbucks",
    "date": "2026-11-19",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_344",
    "description": "Uber/Bolt",
    "date": "2026-11-19",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_333",
    "description": "Mega Image",
    "date": "2026-11-18",
    "amount": 201,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_353",
    "description": "ETF Vanguard",
    "date": "2026-11-18",
    "amount": 660,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_337",
    "description": "Restaurant",
    "date": "2026-11-16",
    "amount": 109,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_327",
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
    "id": "demo_tx_346",
    "description": "Uber/Bolt",
    "date": "2026-11-15",
    "amount": 45,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_347",
    "description": "Uber/Bolt",
    "date": "2026-11-15",
    "amount": 26,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_335",
    "description": "Restaurant",
    "date": "2026-11-14",
    "amount": 122,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_336",
    "description": "Restaurant",
    "date": "2026-11-14",
    "amount": 104,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_342",
    "description": "Starbucks",
    "date": "2026-11-14",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_326",
    "description": "Digi Internet",
    "date": "2026-11-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_325",
    "description": "Enel Electricity",
    "date": "2026-11-10",
    "amount": 239,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_334",
    "description": "Mega Image",
    "date": "2026-11-10",
    "amount": 214,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_332",
    "description": "Mega Image",
    "date": "2026-11-08",
    "amount": 249,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_343",
    "description": "Starbucks",
    "date": "2026-11-06",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_352",
    "description": "Haircut",
    "date": "2026-11-06",
    "amount": 76,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_328",
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
    "id": "demo_tx_341",
    "description": "Starbucks",
    "date": "2026-11-05",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_354",
    "description": "Property Tax",
    "date": "2026-11-05",
    "amount": 995,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_355",
    "description": "Tenant Rent",
    "date": "2026-11-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_348",
    "description": "Amazon",
    "date": "2026-11-03",
    "amount": 42,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_350",
    "description": "Gas Station",
    "date": "2026-11-03",
    "amount": 249,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_324",
    "description": "Apartment Rent",
    "date": "2026-11-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_323",
    "description": "Salary",
    "date": "2026-11-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_330",
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
    "id": "demo_tx_307",
    "description": "Mega Image",
    "date": "2026-10-28",
    "amount": 91,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_315",
    "description": "Uber/Bolt",
    "date": "2026-10-28",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_318",
    "description": "Gas Station",
    "date": "2026-10-28",
    "amount": 207,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_312",
    "description": "Starbucks",
    "date": "2026-10-27",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_316",
    "description": "Uber/Bolt",
    "date": "2026-10-23",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_303",
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
    "id": "demo_tx_313",
    "description": "Starbucks",
    "date": "2026-10-16",
    "amount": 18,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_321",
    "description": "ETF Vanguard",
    "date": "2026-10-16",
    "amount": 737,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_297",
    "description": "Freelance Gig",
    "date": "2026-10-15",
    "amount": 2437,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_301",
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
    "id": "demo_tx_310",
    "description": "Restaurant",
    "date": "2026-10-15",
    "amount": 139,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_300",
    "description": "Digi Internet",
    "date": "2026-10-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_308",
    "description": "Restaurant",
    "date": "2026-10-12",
    "amount": 231,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_311",
    "description": "Starbucks",
    "date": "2026-10-11",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_299",
    "description": "Enel Electricity",
    "date": "2026-10-10",
    "amount": 242,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_305",
    "description": "Mega Image",
    "date": "2026-10-08",
    "amount": 280,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_314",
    "description": "Uber/Bolt",
    "date": "2026-10-08",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_320",
    "description": "Pharmacy",
    "date": "2026-10-08",
    "amount": 114,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_322",
    "description": "Property Maintenance",
    "date": "2026-10-08",
    "amount": 395,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_306",
    "description": "Mega Image",
    "date": "2026-10-06",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_302",
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
    "id": "demo_tx_309",
    "description": "Restaurant",
    "date": "2026-10-03",
    "amount": 204,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_317",
    "description": "Amazon",
    "date": "2026-10-03",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_298",
    "description": "Apartment Rent",
    "date": "2026-10-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_296",
    "description": "Salary",
    "date": "2026-10-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_304",
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
    "id": "demo_tx_319",
    "description": "Cinema",
    "date": "2026-10-01",
    "amount": 61,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_280",
    "description": "Starbucks",
    "date": "2026-09-28",
    "amount": 18,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_278",
    "description": "Starbucks",
    "date": "2026-09-26",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_271",
    "description": "Mega Image",
    "date": "2026-09-25",
    "amount": 244,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_268",
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
    "id": "demo_tx_291",
    "description": "Clothing Store",
    "date": "2026-09-20",
    "amount": 165,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_274",
    "description": "Mega Image",
    "date": "2026-09-19",
    "amount": 155,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_281",
    "description": "Starbucks",
    "date": "2026-09-19",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_287",
    "description": "Uber/Bolt",
    "date": "2026-09-19",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_270",
    "description": "Mega Image",
    "date": "2026-09-18",
    "amount": 297,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_282",
    "description": "Starbucks",
    "date": "2026-09-18",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_292",
    "description": "Cinema",
    "date": "2026-09-17",
    "amount": 62,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_266",
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
    "id": "demo_tx_283",
    "description": "Starbucks",
    "date": "2026-09-14",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_286",
    "description": "Uber/Bolt",
    "date": "2026-09-14",
    "amount": 57,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_275",
    "description": "Restaurant",
    "date": "2026-09-13",
    "amount": 179,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_277",
    "description": "Starbucks",
    "date": "2026-09-13",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_265",
    "description": "Digi Internet",
    "date": "2026-09-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_284",
    "description": "Uber/Bolt",
    "date": "2026-09-12",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_276",
    "description": "Restaurant",
    "date": "2026-09-11",
    "amount": 180,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_285",
    "description": "Uber/Bolt",
    "date": "2026-09-11",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_288",
    "description": "Amazon",
    "date": "2026-09-11",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_293",
    "description": "Online Course",
    "date": "2026-09-11",
    "amount": 465,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_264",
    "description": "Enel Electricity",
    "date": "2026-09-10",
    "amount": 218,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_290",
    "description": "Gas Station",
    "date": "2026-09-09",
    "amount": 261,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_294",
    "description": "ETF Vanguard",
    "date": "2026-09-09",
    "amount": 591,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_279",
    "description": "Starbucks",
    "date": "2026-09-08",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_267",
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
    "id": "demo_tx_273",
    "description": "Mega Image",
    "date": "2026-09-05",
    "amount": 224,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_295",
    "description": "Tenant Rent",
    "date": "2026-09-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_289",
    "description": "Amazon",
    "date": "2026-09-04",
    "amount": 149,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_272",
    "description": "Mega Image",
    "date": "2026-09-03",
    "amount": 79,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_263",
    "description": "Apartment Rent",
    "date": "2026-09-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_262",
    "description": "Salary",
    "date": "2026-09-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_269",
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
    "id": "demo_tx_250",
    "description": "Starbucks",
    "date": "2026-08-28",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_259",
    "description": "Gas Station",
    "date": "2026-08-27",
    "amount": 287,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_241",
    "description": "Mega Image",
    "date": "2026-08-26",
    "amount": 275,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_254",
    "description": "Uber/Bolt",
    "date": "2026-08-25",
    "amount": 45,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_240",
    "description": "Mega Image",
    "date": "2026-08-23",
    "amount": 181,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_237",
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
    "id": "demo_tx_246",
    "description": "Restaurant",
    "date": "2026-08-20",
    "amount": 114,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_248",
    "description": "Restaurant",
    "date": "2026-08-18",
    "amount": 149,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_257",
    "description": "Amazon",
    "date": "2026-08-18",
    "amount": 161,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_243",
    "description": "Mega Image",
    "date": "2026-08-17",
    "amount": 224,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_253",
    "description": "Uber/Bolt",
    "date": "2026-08-17",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_256",
    "description": "Amazon",
    "date": "2026-08-17",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_235",
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
    "id": "demo_tx_242",
    "description": "Mega Image",
    "date": "2026-08-13",
    "amount": 83,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_234",
    "description": "Digi Internet",
    "date": "2026-08-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_244",
    "description": "Restaurant",
    "date": "2026-08-11",
    "amount": 147,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_245",
    "description": "Restaurant",
    "date": "2026-08-11",
    "amount": 208,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_233",
    "description": "Enel Electricity",
    "date": "2026-08-10",
    "amount": 174,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_247",
    "description": "Restaurant",
    "date": "2026-08-09",
    "amount": 127,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_239",
    "description": "Mega Image",
    "date": "2026-08-08",
    "amount": 276,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_258",
    "description": "Amazon",
    "date": "2026-08-08",
    "amount": 57,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_252",
    "description": "Starbucks",
    "date": "2026-08-07",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_236",
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
    "id": "demo_tx_261",
    "description": "ETF Vanguard",
    "date": "2026-08-05",
    "amount": 739,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_251",
    "description": "Starbucks",
    "date": "2026-08-04",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_255",
    "description": "Uber/Bolt",
    "date": "2026-08-03",
    "amount": 37,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_232",
    "description": "Apartment Rent",
    "date": "2026-08-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_260",
    "description": "Clothing Store",
    "date": "2026-08-02",
    "amount": 287,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_231",
    "description": "Salary",
    "date": "2026-08-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_238",
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
    "id": "demo_tx_249",
    "description": "Starbucks",
    "date": "2026-08-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_208",
    "description": "Mega Image",
    "date": "2026-07-28",
    "amount": 53,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_217",
    "description": "Starbucks",
    "date": "2026-07-28",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_226",
    "description": "Amazon",
    "date": "2026-07-28",
    "amount": 67,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_209",
    "description": "Mega Image",
    "date": "2026-07-27",
    "amount": 144,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_210",
    "description": "Mega Image",
    "date": "2026-07-26",
    "amount": 279,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_221",
    "description": "Uber/Bolt",
    "date": "2026-07-26",
    "amount": 39,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_216",
    "description": "Starbucks",
    "date": "2026-07-24",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_228",
    "description": "ETF Vanguard",
    "date": "2026-07-24",
    "amount": 982,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_211",
    "description": "Mega Image",
    "date": "2026-07-23",
    "amount": 292,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_212",
    "description": "Restaurant",
    "date": "2026-07-23",
    "amount": 237,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_206",
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
    "id": "demo_tx_213",
    "description": "Restaurant",
    "date": "2026-07-21",
    "amount": 180,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_200",
    "description": "Freelance Gig",
    "date": "2026-07-15",
    "amount": 2232,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_204",
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
    "id": "demo_tx_222",
    "description": "Uber/Bolt",
    "date": "2026-07-15",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_203",
    "description": "Digi Internet",
    "date": "2026-07-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_202",
    "description": "Enel Electricity",
    "date": "2026-07-10",
    "amount": 230,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_218",
    "description": "Starbucks",
    "date": "2026-07-10",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_229",
    "description": "Property Maintenance",
    "date": "2026-07-08",
    "amount": 244,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_227",
    "description": "Gas Station",
    "date": "2026-07-07",
    "amount": 238,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_205",
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
    "id": "demo_tx_223",
    "description": "Uber/Bolt",
    "date": "2026-07-05",
    "amount": 59,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_230",
    "description": "Tenant Rent",
    "date": "2026-07-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_220",
    "description": "Starbucks",
    "date": "2026-07-04",
    "amount": 26,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_215",
    "description": "Restaurant",
    "date": "2026-07-03",
    "amount": 220,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_224",
    "description": "Uber/Bolt",
    "date": "2026-07-03",
    "amount": 47,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_201",
    "description": "Apartment Rent",
    "date": "2026-07-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_225",
    "description": "Uber/Bolt",
    "date": "2026-07-02",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_199",
    "description": "Salary",
    "date": "2026-07-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_207",
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
    "id": "demo_tx_214",
    "description": "Restaurant",
    "date": "2026-07-01",
    "amount": 224,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_219",
    "description": "Starbucks",
    "date": "2026-07-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_188",
    "description": "Uber/Bolt",
    "date": "2026-06-28",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_180",
    "description": "Restaurant",
    "date": "2026-06-25",
    "amount": 151,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_181",
    "description": "Restaurant",
    "date": "2026-06-24",
    "amount": 137,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_175",
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
    "id": "demo_tx_177",
    "description": "Mega Image",
    "date": "2026-06-22",
    "amount": 299,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_190",
    "description": "Amazon",
    "date": "2026-06-22",
    "amount": 136,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_178",
    "description": "Mega Image",
    "date": "2026-06-21",
    "amount": 189,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_184",
    "description": "Starbucks",
    "date": "2026-06-21",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_197",
    "description": "Flight Tickets",
    "date": "2026-06-21",
    "amount": 892,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_195",
    "description": "Cinema",
    "date": "2026-06-19",
    "amount": 66,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_196",
    "description": "Pharmacy",
    "date": "2026-06-19",
    "amount": 146,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_189",
    "description": "Amazon",
    "date": "2026-06-17",
    "amount": 197,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_198",
    "description": "ETF Vanguard",
    "date": "2026-06-17",
    "amount": 744,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_193",
    "description": "Gas Station",
    "date": "2026-06-16",
    "amount": 185,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_173",
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
    "id": "demo_tx_182",
    "description": "Starbucks",
    "date": "2026-06-14",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_191",
    "description": "Amazon",
    "date": "2026-06-14",
    "amount": 152,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_192",
    "description": "Amazon",
    "date": "2026-06-14",
    "amount": 195,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_194",
    "description": "Clothing Store",
    "date": "2026-06-13",
    "amount": 169,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_172",
    "description": "Digi Internet",
    "date": "2026-06-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_171",
    "description": "Enel Electricity",
    "date": "2026-06-10",
    "amount": 153,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_187",
    "description": "Uber/Bolt",
    "date": "2026-06-08",
    "amount": 45,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_179",
    "description": "Mega Image",
    "date": "2026-06-07",
    "amount": 177,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_174",
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
    "id": "demo_tx_186",
    "description": "Uber/Bolt",
    "date": "2026-06-04",
    "amount": 43,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_170",
    "description": "Apartment Rent",
    "date": "2026-06-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_169",
    "description": "Salary",
    "date": "2026-06-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_176",
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
    "id": "demo_tx_183",
    "description": "Starbucks",
    "date": "2026-06-01",
    "amount": 16,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_185",
    "description": "Starbucks",
    "date": "2026-06-01",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_161",
    "description": "Amazon",
    "date": "2026-05-28",
    "amount": 183,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_145",
    "description": "Mega Image",
    "date": "2026-05-27",
    "amount": 207,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_148",
    "description": "Restaurant",
    "date": "2026-05-24",
    "amount": 230,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_165",
    "description": "Haircut",
    "date": "2026-05-24",
    "amount": 94,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_160",
    "description": "Amazon",
    "date": "2026-05-23",
    "amount": 136,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_140",
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
    "id": "demo_tx_150",
    "description": "Restaurant",
    "date": "2026-05-22",
    "amount": 139,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_158",
    "description": "Uber/Bolt",
    "date": "2026-05-20",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_149",
    "description": "Restaurant",
    "date": "2026-05-19",
    "amount": 139,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_163",
    "description": "Gas Station",
    "date": "2026-05-18",
    "amount": 167,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_152",
    "description": "Starbucks",
    "date": "2026-05-16",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_138",
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
    "id": "demo_tx_159",
    "description": "Uber/Bolt",
    "date": "2026-05-15",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_155",
    "description": "Starbucks",
    "date": "2026-05-14",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_156",
    "description": "Uber/Bolt",
    "date": "2026-05-14",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_162",
    "description": "Amazon",
    "date": "2026-05-13",
    "amount": 81,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_137",
    "description": "Digi Internet",
    "date": "2026-05-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_164",
    "description": "Pharmacy",
    "date": "2026-05-12",
    "amount": 65,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_166",
    "description": "ETF Vanguard",
    "date": "2026-05-12",
    "amount": 704,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_136",
    "description": "Enel Electricity",
    "date": "2026-05-10",
    "amount": 146,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_153",
    "description": "Starbucks",
    "date": "2026-05-10",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_167",
    "description": "Property Tax",
    "date": "2026-05-10",
    "amount": 1023,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_147",
    "description": "Restaurant",
    "date": "2026-05-08",
    "amount": 145,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_143",
    "description": "Mega Image",
    "date": "2026-05-07",
    "amount": 276,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_144",
    "description": "Mega Image",
    "date": "2026-05-06",
    "amount": 282,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_146",
    "description": "Mega Image",
    "date": "2026-05-06",
    "amount": 211,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_139",
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
    "id": "demo_tx_142",
    "description": "Mega Image",
    "date": "2026-05-05",
    "amount": 269,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_151",
    "description": "Restaurant",
    "date": "2026-05-05",
    "amount": 164,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_154",
    "description": "Starbucks",
    "date": "2026-05-05",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_168",
    "description": "Tenant Rent",
    "date": "2026-05-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_135",
    "description": "Apartment Rent",
    "date": "2026-05-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_134",
    "description": "Salary",
    "date": "2026-05-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_141",
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
    "id": "demo_tx_157",
    "description": "Uber/Bolt",
    "date": "2026-05-01",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_112",
    "description": "Mega Image",
    "date": "2026-04-28",
    "amount": 257,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_118",
    "description": "Starbucks",
    "date": "2026-04-28",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_111",
    "description": "Mega Image",
    "date": "2026-04-25",
    "amount": 246,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_107",
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
    "id": "demo_tx_120",
    "description": "Uber/Bolt",
    "date": "2026-04-22",
    "amount": 46,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_110",
    "description": "Mega Image",
    "date": "2026-04-21",
    "amount": 147,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_122",
    "description": "Uber/Bolt",
    "date": "2026-04-17",
    "amount": 38,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_130",
    "description": "Pharmacy",
    "date": "2026-04-17",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_115",
    "description": "Starbucks",
    "date": "2026-04-16",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_125",
    "description": "Amazon",
    "date": "2026-04-16",
    "amount": 136,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_101",
    "description": "Freelance Gig",
    "date": "2026-04-15",
    "amount": 2060,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_105",
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
    "id": "demo_tx_114",
    "description": "Restaurant",
    "date": "2026-04-15",
    "amount": 209,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_124",
    "description": "Amazon",
    "date": "2026-04-15",
    "amount": 100,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_119",
    "description": "Uber/Bolt",
    "date": "2026-04-13",
    "amount": 52,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_104",
    "description": "Digi Internet",
    "date": "2026-04-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_131",
    "description": "Haircut",
    "date": "2026-04-11",
    "amount": 79,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_133",
    "description": "Property Maintenance",
    "date": "2026-04-11",
    "amount": 311,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_103",
    "description": "Enel Electricity",
    "date": "2026-04-10",
    "amount": 161,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_129",
    "description": "Cinema",
    "date": "2026-04-10",
    "amount": 41,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_109",
    "description": "Mega Image",
    "date": "2026-04-09",
    "amount": 222,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_121",
    "description": "Uber/Bolt",
    "date": "2026-04-08",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_126",
    "description": "Amazon",
    "date": "2026-04-08",
    "amount": 173,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_116",
    "description": "Starbucks",
    "date": "2026-04-07",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_106",
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
    "id": "demo_tx_113",
    "description": "Restaurant",
    "date": "2026-04-05",
    "amount": 230,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_123",
    "description": "Amazon",
    "date": "2026-04-05",
    "amount": 100,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_128",
    "description": "Clothing Store",
    "date": "2026-04-05",
    "amount": 435,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_132",
    "description": "ETF Vanguard",
    "date": "2026-04-04",
    "amount": 766,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_127",
    "description": "Gas Station",
    "date": "2026-04-03",
    "amount": 296,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_102",
    "description": "Apartment Rent",
    "date": "2026-04-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_100",
    "description": "Salary",
    "date": "2026-04-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_108",
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
    "id": "demo_tx_117",
    "description": "Starbucks",
    "date": "2026-04-01",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_76",
    "description": "Mega Image",
    "date": "2026-03-23",
    "amount": 131,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_73",
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
    "description": "Gas Station",
    "date": "2026-03-22",
    "amount": 247,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_75",
    "description": "Mega Image",
    "date": "2026-03-21",
    "amount": 138,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_93",
    "description": "Amazon",
    "date": "2026-03-21",
    "amount": 37,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_84",
    "description": "Starbucks",
    "date": "2026-03-19",
    "amount": 18,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_95",
    "description": "Clothing Store",
    "date": "2026-03-19",
    "amount": 171,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_96",
    "description": "Pharmacy",
    "date": "2026-03-18",
    "amount": 122,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_71",
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
    "id": "demo_tx_88",
    "description": "Uber/Bolt",
    "date": "2026-03-15",
    "amount": 58,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_70",
    "description": "Digi Internet",
    "date": "2026-03-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_78",
    "description": "Restaurant",
    "date": "2026-03-11",
    "amount": 188,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_80",
    "description": "Restaurant",
    "date": "2026-03-11",
    "amount": 104,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_81",
    "description": "Restaurant",
    "date": "2026-03-11",
    "amount": 231,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_69",
    "description": "Enel Electricity",
    "date": "2026-03-10",
    "amount": 216,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_87",
    "description": "Uber/Bolt",
    "date": "2026-03-10",
    "amount": 45,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_86",
    "description": "Starbucks",
    "date": "2026-03-09",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_82",
    "description": "Starbucks",
    "date": "2026-03-08",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_91",
    "description": "Amazon",
    "date": "2026-03-08",
    "amount": 150,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_92",
    "description": "Amazon",
    "date": "2026-03-08",
    "amount": 52,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_83",
    "description": "Starbucks",
    "date": "2026-03-07",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_77",
    "description": "Mega Image",
    "date": "2026-03-06",
    "amount": 162,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_79",
    "description": "Restaurant",
    "date": "2026-03-06",
    "amount": 222,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_97",
    "description": "Online Course",
    "date": "2026-03-06",
    "amount": 374,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_72",
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
    "id": "demo_tx_98",
    "description": "ETF Vanguard",
    "date": "2026-03-05",
    "amount": 815,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_99",
    "description": "Tenant Rent",
    "date": "2026-03-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_89",
    "description": "Uber/Bolt",
    "date": "2026-03-03",
    "amount": 52,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_90",
    "description": "Uber/Bolt",
    "date": "2026-03-03",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_68",
    "description": "Apartment Rent",
    "date": "2026-03-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_67",
    "description": "Salary",
    "date": "2026-03-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_74",
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
    "id": "demo_tx_85",
    "description": "Starbucks",
    "date": "2026-03-01",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_59",
    "description": "Amazon",
    "date": "2026-02-26",
    "amount": 186,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_47",
    "description": "Restaurant",
    "date": "2026-02-25",
    "amount": 117,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_50",
    "description": "Starbucks",
    "date": "2026-02-25",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_39",
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
    "id": "demo_tx_51",
    "description": "Starbucks",
    "date": "2026-02-22",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_45",
    "description": "Restaurant",
    "date": "2026-02-21",
    "amount": 156,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_57",
    "description": "Uber/Bolt",
    "date": "2026-02-20",
    "amount": 49,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_65",
    "description": "Haircut",
    "date": "2026-02-20",
    "amount": 112,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_46",
    "description": "Restaurant",
    "date": "2026-02-19",
    "amount": 141,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_44",
    "description": "Restaurant",
    "date": "2026-02-17",
    "amount": 125,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_37",
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
    "id": "demo_tx_41",
    "description": "Mega Image",
    "date": "2026-02-15",
    "amount": 174,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_42",
    "description": "Mega Image",
    "date": "2026-02-15",
    "amount": 243,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_54",
    "description": "Starbucks",
    "date": "2026-02-15",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_60",
    "description": "Amazon",
    "date": "2026-02-15",
    "amount": 130,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_63",
    "description": "Clothing Store",
    "date": "2026-02-15",
    "amount": 242,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_48",
    "description": "Restaurant",
    "date": "2026-02-13",
    "amount": 130,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_36",
    "description": "Digi Internet",
    "date": "2026-02-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_49",
    "description": "Restaurant",
    "date": "2026-02-12",
    "amount": 176,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_52",
    "description": "Starbucks",
    "date": "2026-02-12",
    "amount": 16,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_35",
    "description": "Enel Electricity",
    "date": "2026-02-10",
    "amount": 246,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_55",
    "description": "Uber/Bolt",
    "date": "2026-02-09",
    "amount": 36,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_64",
    "description": "Cinema",
    "date": "2026-02-09",
    "amount": 77,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_38",
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
    "id": "demo_tx_56",
    "description": "Uber/Bolt",
    "date": "2026-02-05",
    "amount": 53,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_62",
    "description": "Gas Station",
    "date": "2026-02-05",
    "amount": 222,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_53",
    "description": "Starbucks",
    "date": "2026-02-03",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_34",
    "description": "Apartment Rent",
    "date": "2026-02-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_61",
    "description": "Amazon",
    "date": "2026-02-02",
    "amount": 175,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_66",
    "description": "ETF Vanguard",
    "date": "2026-02-02",
    "amount": 849,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_33",
    "description": "Salary",
    "date": "2026-02-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_40",
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
    "id": "demo_tx_43",
    "description": "Mega Image",
    "date": "2026-02-01",
    "amount": 74,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_58",
    "description": "Amazon",
    "date": "2026-02-01",
    "amount": 197,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_21",
    "description": "Uber/Bolt",
    "date": "2026-01-25",
    "amount": 46,
    "type": "Expense",
    "categoryId": "cat_transport",
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
    "id": "demo_tx_24",
    "description": "Amazon",
    "date": "2026-01-22",
    "amount": 180,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_31",
    "description": "Property Maintenance",
    "date": "2026-01-21",
    "amount": 104,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_29",
    "description": "Cinema",
    "date": "2026-01-20",
    "amount": 44,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_30",
    "description": "ETF Vanguard",
    "date": "2026-01-19",
    "amount": 990,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_11",
    "description": "Mega Image",
    "date": "2026-01-18",
    "amount": 170,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_13",
    "description": "Restaurant",
    "date": "2026-01-18",
    "amount": 226,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_28",
    "description": "Gas Station",
    "date": "2026-01-18",
    "amount": 197,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_25",
    "description": "Amazon",
    "date": "2026-01-16",
    "amount": 112,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_2",
    "description": "Freelance Gig",
    "date": "2026-01-15",
    "amount": 2167,
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
    "id": "demo_tx_16",
    "description": "Starbucks",
    "date": "2026-01-15",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_19",
    "description": "Starbucks",
    "date": "2026-01-15",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_12",
    "description": "Mega Image",
    "date": "2026-01-13",
    "amount": 239,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_17",
    "description": "Starbucks",
    "date": "2026-01-13",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_23",
    "description": "Uber/Bolt",
    "date": "2026-01-13",
    "amount": 56,
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
    "id": "demo_tx_20",
    "description": "Uber/Bolt",
    "date": "2026-01-12",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_4",
    "description": "Enel Electricity",
    "date": "2026-01-10",
    "amount": 242,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_15",
    "description": "Restaurant",
    "date": "2026-01-08",
    "amount": 114,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_22",
    "description": "Uber/Bolt",
    "date": "2026-01-08",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_14",
    "description": "Restaurant",
    "date": "2026-01-06",
    "amount": 114,
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
    "id": "demo_tx_26",
    "description": "Amazon",
    "date": "2026-01-05",
    "amount": 130,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_27",
    "description": "Amazon",
    "date": "2026-01-05",
    "amount": 141,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_32",
    "description": "Tenant Rent",
    "date": "2026-01-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_18",
    "description": "Starbucks",
    "date": "2026-01-03",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_dining",
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
    "id": "demo_tx_10",
    "description": "Mega Image",
    "date": "2026-01-02",
    "amount": 199,
    "type": "Expense",
    "categoryId": "cat_food",
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
  }
];
