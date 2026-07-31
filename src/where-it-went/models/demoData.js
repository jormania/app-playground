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
  },
  {
    "id": "cat_transfer",
    "name": "Transfer",
    "type": "Transfer",
    "icon": "🔄",
    "description": "Account transfers"
  }
];

export const DEMO_ACCOUNTS = [
  {
    "id": "acc_checking",
    "name": "ING Current",
    "currency": "RON",
    "type": "Checking"
  },
  {
    "id": "acc_credit",
    "name": "ING Credit",
    "currency": "RON",
    "type": "Credit"
  },
  {
    "id": "acc_savings",
    "name": "ING Savings",
    "currency": "RON",
    "type": "Savings"
  },
  {
    "id": "acc_revolut",
    "name": "Revolut RON",
    "currency": "RON",
    "type": "Checking"
  },
  {
    "id": "acc_revolut_eur",
    "name": "Revolut EUR",
    "currency": "EUR",
    "type": "Checking"
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

export const DEMO_TRIPS = [
  {
    "id": "trip_billund",
    "name": "Billund 2025",
    "destination": "Billund, Denmark",
    "startDate": "2025-05-10",
    "endDate": "2025-05-15",
    "status": "Completed",
    "notes": "Legoland family trip"
  },
  {
    "id": "trip_poland",
    "name": "Poland Autumn 2026",
    "destination": "Kraków & Warsaw, Poland",
    "startDate": "2026-10-05",
    "endDate": "2026-10-15",
    "status": "Planned",
    "notes": "Autumn cultural trip. Flights bought in spring, hotel booked in summer."
  },
  {
    "id": "trip_constance",
    "name": "Lake Constance 2026",
    "destination": "Lake Constance, Germany",
    "startDate": "2026-07-12",
    "endDate": "2026-07-20",
    "status": "Active",
    "notes": "Summer lakeside vacation"
  },
  {
    "id": "trip_greece",
    "name": "Greece Autumn 2024",
    "destination": "Crete, Greece",
    "startDate": "2024-09-18",
    "endDate": "2024-09-25",
    "status": "Completed",
    "notes": "Beach island retreat"
  }
];

export const DEMO_TRANSACTIONS = [
  {
    "id": "demo_tx_375",
    "description": "Mega Image",
    "date": "2026-12-28",
    "amount": 236,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_378",
    "description": "Mega Image",
    "date": "2026-12-28",
    "amount": 253,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_391",
    "description": "H&M",
    "date": "2026-12-28",
    "amount": 87,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_390",
    "description": "Carturesti",
    "date": "2026-12-25",
    "amount": 93,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_373",
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
    "id": "demo_tx_381",
    "description": "Dianei 4",
    "date": "2026-12-22",
    "amount": 91,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_380",
    "description": "Dianei 4",
    "date": "2026-12-21",
    "amount": 84,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_386",
    "description": "Bolt",
    "date": "2026-12-16",
    "amount": 59,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_371",
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
    "id": "demo_tx_396",
    "description": "Christmas Gifts",
    "date": "2026-12-15",
    "amount": 864,
    "type": "Expense",
    "categoryId": "cat_gift",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_398",
    "description": "ETF Vanguard",
    "date": "2026-12-15",
    "amount": 926,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_389",
    "description": "Zara",
    "date": "2026-12-14",
    "amount": 116,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_376",
    "description": "Carrefour",
    "date": "2026-12-13",
    "amount": 207,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_393",
    "description": "World Class Romania",
    "date": "2026-12-13",
    "amount": 219,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_370",
    "description": "Digi Internet",
    "date": "2026-12-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_392",
    "description": "OMV Gas Station",
    "date": "2026-12-12",
    "amount": 184,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_377",
    "description": "Profi",
    "date": "2026-12-11",
    "amount": 159,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_387",
    "description": "Uber",
    "date": "2026-12-11",
    "amount": 53,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_369",
    "description": "Enel Electricity",
    "date": "2026-12-10",
    "amount": 220,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_384",
    "description": "Beans & Dots",
    "date": "2026-12-10",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_395",
    "description": "Transfer to Revolut",
    "date": "2026-12-10",
    "amount": 266,
    "type": "Transfer",
    "categoryId": "cat_transfer",
    "accountId": "acc_checking",
    "tags": [],
    "toAccountId": "acc_revolut"
  },
  {
    "id": "demo_tx_397",
    "description": "Hotel Booking for New Years Eve",
    "date": "2026-12-10",
    "amount": 1500,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": [
      "Hotel"
    ]
  },
  {
    "id": "demo_tx_372",
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
    "id": "demo_tx_379",
    "description": "Simbio",
    "date": "2026-12-05",
    "amount": 154,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_383",
    "description": "Origo",
    "date": "2026-12-05",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_394",
    "description": "Eden",
    "date": "2026-12-03",
    "amount": 113,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_368",
    "description": "Apartment Rent",
    "date": "2026-12-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_382",
    "description": "M60",
    "date": "2026-12-02",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_385",
    "description": "Metrorex",
    "date": "2026-12-02",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_388",
    "description": "Uber",
    "date": "2026-12-02",
    "amount": 57,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_367",
    "description": "Salary",
    "date": "2026-12-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_374",
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
    "id": "demo_tx_399",
    "description": "Monthly Bank Fee",
    "date": "2026-12-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_354",
    "description": "Origo",
    "date": "2026-11-27",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_356",
    "description": "Metrorex",
    "date": "2026-11-27",
    "amount": 52,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_353",
    "description": "Starbucks",
    "date": "2026-11-25",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_363",
    "description": "ETF Vanguard",
    "date": "2026-11-25",
    "amount": 994,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_355",
    "description": "M60",
    "date": "2026-11-23",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_344",
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
    "id": "demo_tx_346",
    "description": "Profi",
    "date": "2026-11-22",
    "amount": 56,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_351",
    "description": "Shift Pub",
    "date": "2026-11-22",
    "amount": 162,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_350",
    "description": "Dianei 4",
    "date": "2026-11-20",
    "amount": 214,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_352",
    "description": "Beans & Dots",
    "date": "2026-11-20",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_360",
    "description": "H&M",
    "date": "2026-11-18",
    "amount": 161,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_342",
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
    "id": "demo_tx_341",
    "description": "Digi Internet",
    "date": "2026-11-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_361",
    "description": "OMV Gas Station",
    "date": "2026-11-12",
    "amount": 295,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_364",
    "description": "Property Tax",
    "date": "2026-11-12",
    "amount": 863,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_349",
    "description": "Profi",
    "date": "2026-11-11",
    "amount": 175,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_362",
    "description": "Therme Bucuresti",
    "date": "2026-11-11",
    "amount": 118,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_340",
    "description": "Enel Electricity",
    "date": "2026-11-10",
    "amount": 170,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_357",
    "description": "Metrorex",
    "date": "2026-11-10",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_358",
    "description": "STB",
    "date": "2026-11-10",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_348",
    "description": "Profi",
    "date": "2026-11-06",
    "amount": 152,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_343",
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
    "id": "demo_tx_366",
    "description": "Tenant Rent",
    "date": "2026-11-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_359",
    "description": "Bolt",
    "date": "2026-11-04",
    "amount": 37,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_347",
    "description": "Carrefour",
    "date": "2026-11-03",
    "amount": 64,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_339",
    "description": "Apartment Rent",
    "date": "2026-11-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_338",
    "description": "Salary",
    "date": "2026-11-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_345",
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
    "id": "demo_tx_365",
    "description": "Monthly Bank Fee",
    "date": "2026-11-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_315",
    "description": "M60",
    "date": "2026-10-24",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_322",
    "description": "Carturesti",
    "date": "2026-10-24",
    "amount": 121,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_323",
    "description": "Emag",
    "date": "2026-10-23",
    "amount": 186,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_305",
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
    "id": "demo_tx_311",
    "description": "Mega Image",
    "date": "2026-10-22",
    "amount": 265,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_307",
    "description": "Kaufland",
    "date": "2026-10-18",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_327",
    "description": "Eden",
    "date": "2026-10-18",
    "amount": 91,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_308",
    "description": "Profi",
    "date": "2026-10-16",
    "amount": 87,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_320",
    "description": "Uber",
    "date": "2026-10-16",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_299",
    "description": "Freelance Gig",
    "date": "2026-10-15",
    "amount": 2748,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_303",
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
    "description": "Mega Image",
    "date": "2026-10-15",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_317",
    "description": "Origo",
    "date": "2026-10-15",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_334",
    "description": "Polish Pottery Souvenirs",
    "date": "2026-10-14",
    "amount": 450,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": [
      "Souvenir"
    ],
    "tripId": "trip_poland"
  },
  {
    "id": "demo_tx_302",
    "description": "Digi Internet",
    "date": "2026-10-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_313",
    "description": "Dianei 4",
    "date": "2026-10-12",
    "amount": 204,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_316",
    "description": "Beans & Dots",
    "date": "2026-10-12",
    "amount": 18,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_325",
    "description": "World Class Romania",
    "date": "2026-10-12",
    "amount": 165,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_333",
    "description": "Warsaw Bistro Dinner",
    "date": "2026-10-12",
    "amount": 310,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": [],
    "tripId": "trip_poland"
  },
  {
    "id": "demo_tx_314",
    "description": "Starbucks",
    "date": "2026-10-11",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_319",
    "description": "Uber",
    "date": "2026-10-11",
    "amount": 46,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_321",
    "description": "STB",
    "date": "2026-10-11",
    "amount": 56,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_301",
    "description": "Enel Electricity",
    "date": "2026-10-10",
    "amount": 159,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_324",
    "description": "OMV Gas Station",
    "date": "2026-10-10",
    "amount": 223,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_329",
    "description": "Haircut",
    "date": "2026-10-10",
    "amount": 108,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_332",
    "description": "PKP Intercity Train Kraków to Warsaw",
    "date": "2026-10-10",
    "amount": 180,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_revolut",
    "tags": [
      "Train"
    ],
    "tripId": "trip_poland"
  },
  {
    "id": "demo_tx_336",
    "description": "Property Maintenance",
    "date": "2026-10-10",
    "amount": 359,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_326",
    "description": "Therme Bucuresti",
    "date": "2026-10-09",
    "amount": 211,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_309",
    "description": "Mega Image",
    "date": "2026-10-08",
    "amount": 117,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_331",
    "description": "Wawel Castle Museum Tickets",
    "date": "2026-10-08",
    "amount": 110,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_revolut",
    "tags": [
      "Museum",
      "Ticket"
    ],
    "tripId": "trip_poland"
  },
  {
    "id": "demo_tx_330",
    "description": "Kraków Old Town Restaurant",
    "date": "2026-10-07",
    "amount": 240,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": [],
    "tripId": "trip_poland"
  },
  {
    "id": "demo_tx_335",
    "description": "ETF Vanguard",
    "date": "2026-10-07",
    "amount": 659,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_312",
    "description": "Dianei 4",
    "date": "2026-10-06",
    "amount": 136,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_318",
    "description": "STB",
    "date": "2026-10-06",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_304",
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
    "id": "demo_tx_328",
    "description": "Pharmacy",
    "date": "2026-10-05",
    "amount": 106,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_300",
    "description": "Apartment Rent",
    "date": "2026-10-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_298",
    "description": "Salary",
    "date": "2026-10-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_306",
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
    "id": "demo_tx_337",
    "description": "Monthly Bank Fee",
    "date": "2026-10-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_295",
    "description": "ETF Vanguard",
    "date": "2026-09-27",
    "amount": 987,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_273",
    "description": "Profi",
    "date": "2026-09-26",
    "amount": 144,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_293",
    "description": "Haircut",
    "date": "2026-09-26",
    "amount": 74,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_292",
    "description": "Tinder Gold",
    "date": "2026-09-25",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_291",
    "description": "World Class Romania",
    "date": "2026-09-23",
    "amount": 173,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_269",
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
    "id": "demo_tx_274",
    "description": "Mega Image",
    "date": "2026-09-19",
    "amount": 283,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_294",
    "description": "Online Course",
    "date": "2026-09-18",
    "amount": 473,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_271",
    "description": "Profi",
    "date": "2026-09-16",
    "amount": 141,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_267",
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
    "id": "demo_tx_288",
    "description": "Emag",
    "date": "2026-09-14",
    "amount": 94,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_290",
    "description": "OMV Gas Station",
    "date": "2026-09-13",
    "amount": 241,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_266",
    "description": "Digi Internet",
    "date": "2026-09-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_275",
    "description": "Profi",
    "date": "2026-09-12",
    "amount": 95,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_276",
    "description": "Shift Pub",
    "date": "2026-09-12",
    "amount": 182,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_280",
    "description": "Origo",
    "date": "2026-09-12",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_277",
    "description": "Energiea",
    "date": "2026-09-11",
    "amount": 226,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_279",
    "description": "Origo",
    "date": "2026-09-11",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_265",
    "description": "Enel Electricity",
    "date": "2026-09-10",
    "amount": 199,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_272",
    "description": "Profi",
    "date": "2026-09-10",
    "amount": 155,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_286",
    "description": "Uber",
    "date": "2026-09-10",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_278",
    "description": "Energiea",
    "date": "2026-09-08",
    "amount": 147,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_281",
    "description": "M60",
    "date": "2026-09-07",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_282",
    "description": "Beans & Dots",
    "date": "2026-09-07",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_283",
    "description": "Beans & Dots",
    "date": "2026-09-06",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_287",
    "description": "Bolt",
    "date": "2026-09-06",
    "amount": 38,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_289",
    "description": "H&M",
    "date": "2026-09-06",
    "amount": 169,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_268",
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
    "id": "demo_tx_285",
    "description": "Metrorex",
    "date": "2026-09-05",
    "amount": 48,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_297",
    "description": "Tenant Rent",
    "date": "2026-09-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_284",
    "description": "Beans & Dots",
    "date": "2026-09-03",
    "amount": 18,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_264",
    "description": "Apartment Rent",
    "date": "2026-09-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_263",
    "description": "Salary",
    "date": "2026-09-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_270",
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
    "id": "demo_tx_296",
    "description": "Monthly Bank Fee",
    "date": "2026-09-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_244",
    "description": "Shift Pub",
    "date": "2026-08-24",
    "amount": 118,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_257",
    "description": "Therme Bucuresti",
    "date": "2026-08-24",
    "amount": 198,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_251",
    "description": "Metrorex",
    "date": "2026-08-23",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_239",
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
    "id": "demo_tx_250",
    "description": "Uber",
    "date": "2026-08-21",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_243",
    "description": "Mega Image",
    "date": "2026-08-20",
    "amount": 239,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_252",
    "description": "Bolt",
    "date": "2026-08-18",
    "amount": 53,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_254",
    "description": "Carturesti",
    "date": "2026-08-17",
    "amount": 108,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_255",
    "description": "OMV Gas Station",
    "date": "2026-08-17",
    "amount": 206,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_241",
    "description": "Mega Image",
    "date": "2026-08-16",
    "amount": 298,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_237",
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
    "id": "demo_tx_236",
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
    "description": "M60",
    "date": "2026-08-12",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_260",
    "description": "Transfer to Revolut",
    "date": "2026-08-12",
    "amount": 216,
    "type": "Transfer",
    "categoryId": "cat_transfer",
    "accountId": "acc_checking",
    "tags": [],
    "toAccountId": "acc_revolut"
  },
  {
    "id": "demo_tx_248",
    "description": "Starbucks",
    "date": "2026-08-11",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_235",
    "description": "Enel Electricity",
    "date": "2026-08-10",
    "amount": 186,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_249",
    "description": "M60",
    "date": "2026-08-09",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_253",
    "description": "Bolt",
    "date": "2026-08-08",
    "amount": 48,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_245",
    "description": "Simbio",
    "date": "2026-08-07",
    "amount": 173,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_238",
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
    "amount": 677,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_256",
    "description": "World Class Romania",
    "date": "2026-08-03",
    "amount": 108,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_258",
    "description": "Tinder Gold",
    "date": "2026-08-03",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_234",
    "description": "Apartment Rent",
    "date": "2026-08-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_233",
    "description": "Salary",
    "date": "2026-08-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_240",
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
    "id": "demo_tx_242",
    "description": "Mega Image",
    "date": "2026-08-01",
    "amount": 210,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_246",
    "description": "Energiea",
    "date": "2026-08-01",
    "amount": 182,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_259",
    "description": "Eden",
    "date": "2026-08-01",
    "amount": 65,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_262",
    "description": "Monthly Bank Fee",
    "date": "2026-08-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_206",
    "description": "Carrefour",
    "date": "2026-07-25",
    "amount": 121,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_208",
    "description": "Profi",
    "date": "2026-07-24",
    "amount": 63,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_221",
    "description": "OMV Gas Station",
    "date": "2026-07-24",
    "amount": 292,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_223",
    "description": "Tinder Gold",
    "date": "2026-07-23",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_203",
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
    "id": "demo_tx_225",
    "description": "Booking.com - Warsaw Hotel Reservation",
    "date": "2026-07-22",
    "amount": 2100,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": [
      "Hotel"
    ],
    "tripId": "trip_poland"
  },
  {
    "id": "demo_tx_205",
    "description": "Mega Image",
    "date": "2026-07-19",
    "amount": 59,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_218",
    "description": "Bolt",
    "date": "2026-07-16",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_197",
    "description": "Freelance Gig",
    "date": "2026-07-15",
    "amount": 1571,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_201",
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
    "id": "demo_tx_228",
    "description": "Lakeside Seafood Restaurant",
    "date": "2026-07-15",
    "amount": 350,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": [],
    "tripId": "trip_constance"
  },
  {
    "id": "demo_tx_224",
    "description": "Pharmacy",
    "date": "2026-07-14",
    "amount": 141,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_227",
    "description": "Constance Resort Lodge",
    "date": "2026-07-13",
    "amount": 3200,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": [
      "Hotel"
    ],
    "tripId": "trip_constance"
  },
  {
    "id": "demo_tx_200",
    "description": "Digi Internet",
    "date": "2026-07-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_199",
    "description": "Enel Electricity",
    "date": "2026-07-10",
    "amount": 198,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_207",
    "description": "Carrefour",
    "date": "2026-07-10",
    "amount": 211,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_222",
    "description": "World Class Romania",
    "date": "2026-07-09",
    "amount": 139,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_210",
    "description": "Simbio",
    "date": "2026-07-07",
    "amount": 82,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_213",
    "description": "Shift Pub",
    "date": "2026-07-07",
    "amount": 143,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_230",
    "description": "Property Maintenance",
    "date": "2026-07-07",
    "amount": 352,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_202",
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
    "id": "demo_tx_209",
    "description": "Shift Pub",
    "date": "2026-07-05",
    "amount": 90,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_214",
    "description": "M60",
    "date": "2026-07-05",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_216",
    "description": "Beans & Dots",
    "date": "2026-07-05",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_219",
    "description": "Bolt",
    "date": "2026-07-05",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_232",
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
    "description": "Shift Pub",
    "date": "2026-07-04",
    "amount": 204,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_198",
    "description": "Apartment Rent",
    "date": "2026-07-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_215",
    "description": "M60",
    "date": "2026-07-02",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_217",
    "description": "Beans & Dots",
    "date": "2026-07-02",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_196",
    "description": "Salary",
    "date": "2026-07-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_204",
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
    "id": "demo_tx_211",
    "description": "Dianei 4",
    "date": "2026-07-01",
    "amount": 240,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_220",
    "description": "H&M",
    "date": "2026-07-01",
    "amount": 146,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_226",
    "description": "Lufthansa - Flights to Munich",
    "date": "2026-07-01",
    "amount": 1400,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": [
      "Flight"
    ],
    "tripId": "trip_constance"
  },
  {
    "id": "demo_tx_229",
    "description": "ETF Vanguard",
    "date": "2026-07-01",
    "amount": 552,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_231",
    "description": "Monthly Bank Fee",
    "date": "2026-07-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_183",
    "description": "Metrorex",
    "date": "2026-06-28",
    "amount": 56,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_194",
    "description": "ETF Vanguard",
    "date": "2026-06-28",
    "amount": 577,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_177",
    "description": "Dianei 4",
    "date": "2026-06-26",
    "amount": 129,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_178",
    "description": "M60",
    "date": "2026-06-25",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_190",
    "description": "OMV Gas Station",
    "date": "2026-06-25",
    "amount": 218,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_170",
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
    "id": "demo_tx_182",
    "description": "M60",
    "date": "2026-06-22",
    "amount": 18,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_179",
    "description": "M60",
    "date": "2026-06-21",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_191",
    "description": "Tinder Gold",
    "date": "2026-06-21",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_174",
    "description": "Profi",
    "date": "2026-06-18",
    "amount": 167,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_187",
    "description": "Zara",
    "date": "2026-06-17",
    "amount": 90,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_189",
    "description": "Zara",
    "date": "2026-06-17",
    "amount": 65,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_168",
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
    "id": "demo_tx_184",
    "description": "Uber",
    "date": "2026-06-14",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_188",
    "description": "Emag",
    "date": "2026-06-14",
    "amount": 139,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_167",
    "description": "Digi Internet",
    "date": "2026-06-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_186",
    "description": "Bolt",
    "date": "2026-06-12",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_193",
    "description": "Transfer to Revolut",
    "date": "2026-06-12",
    "amount": 199,
    "type": "Transfer",
    "categoryId": "cat_transfer",
    "accountId": "acc_checking",
    "tags": [],
    "toAccountId": "acc_revolut"
  },
  {
    "id": "demo_tx_181",
    "description": "M60",
    "date": "2026-06-11",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_166",
    "description": "Enel Electricity",
    "date": "2026-06-10",
    "amount": 170,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_175",
    "description": "Carrefour",
    "date": "2026-06-10",
    "amount": 182,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_173",
    "description": "Mega Image",
    "date": "2026-06-06",
    "amount": 99,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_169",
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
    "id": "demo_tx_185",
    "description": "Uber",
    "date": "2026-06-04",
    "amount": 43,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_180",
    "description": "Starbucks",
    "date": "2026-06-03",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_165",
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
    "description": "Kaufland",
    "date": "2026-06-02",
    "amount": 146,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_164",
    "description": "Salary",
    "date": "2026-06-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_171",
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
    "id": "demo_tx_176",
    "description": "Energiea",
    "date": "2026-06-01",
    "amount": 97,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_192",
    "description": "Haircut",
    "date": "2026-06-01",
    "amount": 80,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_195",
    "description": "Monthly Bank Fee",
    "date": "2026-06-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_150",
    "description": "Starbucks",
    "date": "2026-05-28",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_153",
    "description": "STB",
    "date": "2026-05-27",
    "amount": 59,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_146",
    "description": "Simbio",
    "date": "2026-05-23",
    "amount": 109,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_155",
    "description": "Carturesti",
    "date": "2026-05-23",
    "amount": 197,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_139",
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
    "id": "demo_tx_154",
    "description": "Emag",
    "date": "2026-05-22",
    "amount": 171,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_143",
    "description": "Mega Image",
    "date": "2026-05-19",
    "amount": 111,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_157",
    "description": "World Class Romania",
    "date": "2026-05-17",
    "amount": 304,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_160",
    "description": "ETF Vanguard",
    "date": "2026-05-17",
    "amount": 946,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_137",
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
    "id": "demo_tx_151",
    "description": "M60",
    "date": "2026-05-15",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_161",
    "description": "Property Tax",
    "date": "2026-05-15",
    "amount": 977,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_145",
    "description": "Dianei 4",
    "date": "2026-05-14",
    "amount": 131,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_158",
    "description": "Tinder Gold",
    "date": "2026-05-14",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_136",
    "description": "Digi Internet",
    "date": "2026-05-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_141",
    "description": "Profi",
    "date": "2026-05-12",
    "amount": 245,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_144",
    "description": "Carrefour",
    "date": "2026-05-12",
    "amount": 58,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_152",
    "description": "Metrorex",
    "date": "2026-05-12",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_135",
    "description": "Enel Electricity",
    "date": "2026-05-10",
    "amount": 241,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_156",
    "description": "OMV Gas Station",
    "date": "2026-05-09",
    "amount": 226,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_147",
    "description": "Simbio",
    "date": "2026-05-07",
    "amount": 80,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_142",
    "description": "Mega Image",
    "date": "2026-05-06",
    "amount": 155,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_138",
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
    "id": "demo_tx_163",
    "description": "Tenant Rent",
    "date": "2026-05-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_148",
    "description": "Starbucks",
    "date": "2026-05-04",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_149",
    "description": "Starbucks",
    "date": "2026-05-04",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_134",
    "description": "Apartment Rent",
    "date": "2026-05-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_159",
    "description": "Weekend Train Tickets to Brasov",
    "date": "2026-05-02",
    "amount": 160,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_revolut",
    "tags": [
      "Train"
    ]
  },
  {
    "id": "demo_tx_133",
    "description": "Salary",
    "date": "2026-05-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_140",
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
    "id": "demo_tx_162",
    "description": "Monthly Bank Fee",
    "date": "2026-05-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_125",
    "description": "Carturesti",
    "date": "2026-04-26",
    "amount": 86,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_130",
    "description": "ETF Vanguard",
    "date": "2026-04-26",
    "amount": 896,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_131",
    "description": "Property Maintenance",
    "date": "2026-04-26",
    "amount": 217,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_127",
    "description": "OMV Gas Station",
    "date": "2026-04-23",
    "amount": 161,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_108",
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
    "id": "demo_tx_110",
    "description": "Carrefour",
    "date": "2026-04-22",
    "amount": 271,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_122",
    "description": "STB",
    "date": "2026-04-21",
    "amount": 42,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_113",
    "description": "Simbio",
    "date": "2026-04-20",
    "amount": 129,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_123",
    "description": "STB",
    "date": "2026-04-19",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_128",
    "description": "Tinder Gold",
    "date": "2026-04-19",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_112",
    "description": "Kaufland",
    "date": "2026-04-17",
    "amount": 166,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_121",
    "description": "Metrorex",
    "date": "2026-04-17",
    "amount": 37,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_115",
    "description": "Energiea",
    "date": "2026-04-16",
    "amount": 243,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_119",
    "description": "Origo",
    "date": "2026-04-16",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_102",
    "description": "Freelance Gig",
    "date": "2026-04-15",
    "amount": 2858,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_106",
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
    "id": "demo_tx_111",
    "description": "Profi",
    "date": "2026-04-15",
    "amount": 253,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_105",
    "description": "Digi Internet",
    "date": "2026-04-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_114",
    "description": "Energiea",
    "date": "2026-04-12",
    "amount": 202,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_120",
    "description": "Beans & Dots",
    "date": "2026-04-12",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_126",
    "description": "Zara",
    "date": "2026-04-11",
    "amount": 122,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_104",
    "description": "Enel Electricity",
    "date": "2026-04-10",
    "amount": 180,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_118",
    "description": "M60",
    "date": "2026-04-09",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_107",
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
    "id": "demo_tx_116",
    "description": "Dianei 4",
    "date": "2026-04-04",
    "amount": 217,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_117",
    "description": "M60",
    "date": "2026-04-04",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_129",
    "description": "Haircut",
    "date": "2026-04-04",
    "amount": 112,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_103",
    "description": "Apartment Rent",
    "date": "2026-04-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_124",
    "description": "Carturesti",
    "date": "2026-04-02",
    "amount": 53,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_101",
    "description": "Salary",
    "date": "2026-04-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_109",
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
    "id": "demo_tx_132",
    "description": "Monthly Bank Fee",
    "date": "2026-04-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_93",
    "description": "Therme Bucuresti",
    "date": "2026-03-28",
    "amount": 100,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_95",
    "description": "Eden",
    "date": "2026-03-28",
    "amount": 98,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_75",
    "description": "Profi",
    "date": "2026-03-26",
    "amount": 169,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_76",
    "description": "Simbio",
    "date": "2026-03-26",
    "amount": 205,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_80",
    "description": "Energiea",
    "date": "2026-03-25",
    "amount": 82,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_72",
    "description": "Carrefour",
    "date": "2026-03-24",
    "amount": 168,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_92",
    "description": "World Class Romania",
    "date": "2026-03-24",
    "amount": 469,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_82",
    "description": "Starbucks",
    "date": "2026-03-23",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_86",
    "description": "STB",
    "date": "2026-03-23",
    "amount": 48,
    "type": "Expense",
    "categoryId": "cat_transport",
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
    "id": "demo_tx_85",
    "description": "Metrorex",
    "date": "2026-03-22",
    "amount": 57,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_88",
    "description": "Bolt",
    "date": "2026-03-21",
    "amount": 38,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_90",
    "description": "H&M",
    "date": "2026-03-21",
    "amount": 108,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_83",
    "description": "Starbucks",
    "date": "2026-03-20",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_96",
    "description": "Online Course",
    "date": "2026-03-18",
    "amount": 254,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
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
    "id": "demo_tx_79",
    "description": "Energiea",
    "date": "2026-03-14",
    "amount": 230,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_97",
    "description": "LOT Polish Airlines - Flights to Kraków",
    "date": "2026-03-14",
    "amount": 1250,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": [
      "Flight"
    ],
    "tripId": "trip_poland"
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
    "id": "demo_tx_77",
    "description": "Energiea",
    "date": "2026-03-12",
    "amount": 237,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_66",
    "description": "Enel Electricity",
    "date": "2026-03-10",
    "amount": 250,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_78",
    "description": "Dianei 4",
    "date": "2026-03-10",
    "amount": 118,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_89",
    "description": "H&M",
    "date": "2026-03-07",
    "amount": 62,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_73",
    "description": "Carrefour",
    "date": "2026-03-06",
    "amount": 152,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_74",
    "description": "Profi",
    "date": "2026-03-06",
    "amount": 191,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_91",
    "description": "OMV Gas Station",
    "date": "2026-03-06",
    "amount": 280,
    "type": "Expense",
    "categoryId": "cat_transport",
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
    "id": "demo_tx_81",
    "description": "Starbucks",
    "date": "2026-03-05",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_100",
    "description": "Tenant Rent",
    "date": "2026-03-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_84",
    "description": "Origo",
    "date": "2026-03-04",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_94",
    "description": "Tinder Gold",
    "date": "2026-03-04",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
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
    "id": "demo_tx_87",
    "description": "STB",
    "date": "2026-03-02",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_98",
    "description": "ETF Vanguard",
    "date": "2026-03-02",
    "amount": 689,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
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
    "id": "demo_tx_99",
    "description": "Monthly Bank Fee",
    "date": "2026-03-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_61",
    "description": "Eden",
    "date": "2026-02-27",
    "amount": 95,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_47",
    "description": "Mega Image",
    "date": "2026-02-26",
    "amount": 79,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_46",
    "description": "Mega Image",
    "date": "2026-02-24",
    "amount": 269,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_53",
    "description": "Origo",
    "date": "2026-02-24",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_55",
    "description": "Metrorex",
    "date": "2026-02-24",
    "amount": 56,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_58",
    "description": "Emag",
    "date": "2026-02-23",
    "amount": 47,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_44",
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
    "id": "demo_tx_57",
    "description": "Emag",
    "date": "2026-02-19",
    "amount": 139,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_56",
    "description": "Metrorex",
    "date": "2026-02-17",
    "amount": 36,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_50",
    "description": "Shift Pub",
    "date": "2026-02-16",
    "amount": 138,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_42",
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
    "id": "demo_tx_49",
    "description": "Energiea",
    "date": "2026-02-15",
    "amount": 149,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_41",
    "description": "Digi Internet",
    "date": "2026-02-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_52",
    "description": "Beans & Dots",
    "date": "2026-02-12",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_60",
    "description": "Therme Bucuresti",
    "date": "2026-02-11",
    "amount": 125,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_40",
    "description": "Enel Electricity",
    "date": "2026-02-10",
    "amount": 126,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_48",
    "description": "Kaufland",
    "date": "2026-02-08",
    "amount": 159,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_51",
    "description": "M60",
    "date": "2026-02-07",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_43",
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
    "id": "demo_tx_54",
    "description": "Metrorex",
    "date": "2026-02-04",
    "amount": 42,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_59",
    "description": "OMV Gas Station",
    "date": "2026-02-03",
    "amount": 291,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_39",
    "description": "Apartment Rent",
    "date": "2026-02-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_38",
    "description": "Salary",
    "date": "2026-02-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_45",
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
    "id": "demo_tx_62",
    "description": "ETF Vanguard",
    "date": "2026-02-01",
    "amount": 735,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
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
    "id": "demo_tx_29",
    "description": "OMV Gas Station",
    "date": "2026-01-28",
    "amount": 248,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_20",
    "description": "Beans & Dots",
    "date": "2026-01-27",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_21",
    "description": "Origo",
    "date": "2026-01-27",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_27",
    "description": "Emag",
    "date": "2026-01-27",
    "amount": 146,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_31",
    "description": "Tinder Gold",
    "date": "2026-01-27",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_subscriptions",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_32",
    "description": "Eden",
    "date": "2026-01-27",
    "amount": 100,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_10",
    "description": "Mega Image",
    "date": "2026-01-24",
    "amount": 231,
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
    "id": "demo_tx_24",
    "description": "Metrorex",
    "date": "2026-01-22",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_19",
    "description": "Starbucks",
    "date": "2026-01-20",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_15",
    "description": "Dianei 4",
    "date": "2026-01-18",
    "amount": 196,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_11",
    "description": "Profi",
    "date": "2026-01-17",
    "amount": 63,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_17",
    "description": "M60",
    "date": "2026-01-17",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_30",
    "description": "World Class Romania",
    "date": "2026-01-16",
    "amount": 217,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_2",
    "description": "Freelance Gig",
    "date": "2026-01-15",
    "amount": 1573,
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
    "id": "demo_tx_22",
    "description": "Metrorex",
    "date": "2026-01-15",
    "amount": 57,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_13",
    "description": "Energiea",
    "date": "2026-01-14",
    "amount": 225,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
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
    "id": "demo_tx_23",
    "description": "Metrorex",
    "date": "2026-01-12",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_4",
    "description": "Enel Electricity",
    "date": "2026-01-10",
    "amount": 186,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_28",
    "description": "Emag",
    "date": "2026-01-09",
    "amount": 176,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_35",
    "description": "Property Maintenance",
    "date": "2026-01-07",
    "amount": 244,
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
    "id": "demo_tx_37",
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
    "description": "Beans & Dots",
    "date": "2026-01-04",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_26",
    "description": "H&M",
    "date": "2026-01-04",
    "amount": 199,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_25",
    "description": "H&M",
    "date": "2026-01-03",
    "amount": 133,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
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
    "id": "demo_tx_12",
    "description": "Mega Image",
    "date": "2026-01-02",
    "amount": 76,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_14",
    "description": "Shift Pub",
    "date": "2026-01-02",
    "amount": 194,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_16",
    "description": "Shift Pub",
    "date": "2026-01-02",
    "amount": 198,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_33",
    "description": "Pharmacy",
    "date": "2026-01-02",
    "amount": 146,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
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
    "id": "demo_tx_34",
    "description": "ETF Vanguard",
    "date": "2026-01-01",
    "amount": 964,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_36",
    "description": "Monthly Bank Fee",
    "date": "2026-01-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  }
];

export const DEMO_TEMPLATES = [
  {
    "id": "demo_tpl_1",
    "description": "Coffee",
    "amount": 15,
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "type": "Expense"
  },
  {
    "id": "demo_tpl_2",
    "description": "STB Ticket",
    "amount": 3,
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "type": "Expense"
  },
  {
    "id": "demo_tpl_3",
    "description": "Lunch",
    "amount": 45,
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "type": "Expense"
  }
];
