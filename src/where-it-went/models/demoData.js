import { toDateString } from '../lib/period';

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
    "budgetLimit": 800,
    "budgetRollover": true
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
    "description": "Doctors, pharmacy",
    "budgetLimit": 4800,
    "budgetPeriod": "Yearly",
    "budgetRollover": true
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
    "budgetLimit": 1500,
    "budgetPeriod": "Quarterly"
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
    "type": "Asset",
    "currency": "RON"
  },
  {
    "id": "acc_savings",
    "name": "Savings Account",
    "type": "Asset",
    "currency": "RON"
  },
  {
    "id": "acc_credit",
    "name": "Credit Card",
    "type": "Liability",
    "currency": "RON"
  },
  {
    "id": "acc_revolut",
    "name": "Revolut",
    "type": "Asset",
    "currency": "EUR"
  },
  {
    "id": "acc_cash",
    "name": "Cash",
    "type": "Asset",
    "currency": "RON"
  }
];

const RAW_SUBSCRIPTIONS = [
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

const RAW_TRIPS = [
  {
    "id": "trip_billund",
    "name": "Billund 2025",
    "destination": "Billund, Denmark",
    "currency": "DKK",
    "startDate": "2025-05-10",
    "endDate": "2025-05-15",
    "status": "Completed",
    "notes": "Legoland family trip"
  },
  {
    "id": "trip_poland",
    "name": "Poland Autumn 2026",
    "destination": "Kraków & Warsaw, Poland",
    "currency": "PLN",
    "startDate": "2026-10-05",
    "endDate": "2026-10-15",
    "status": "Planned",
    "notes": "Autumn cultural trip. Flights bought in spring, hotel booked in summer."
  },
  {
    "id": "trip_constance",
    "name": "Lake Constance 2026",
    "destination": "Lake Constance, Germany",
    "currency": "EUR",
    "startDate": "2026-07-12",
    "endDate": "2026-07-20",
    "status": "Active",
    "notes": "Summer lakeside vacation"
  },
  {
    "id": "trip_greece",
    "name": "Greece Autumn 2024",
    "destination": "Crete, Greece",
    "currency": "EUR",
    "startDate": "2024-09-18",
    "endDate": "2024-09-25",
    "status": "Completed",
    "notes": "Beach island retreat"
  }
];

const RAW_TRANSACTIONS = [
  {
    "id": "demo_tx_372",
    "description": "Starbucks",
    "date": "2026-12-28",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_374",
    "description": "Starbucks",
    "date": "2026-12-27",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_378",
    "description": "Uber/Bolt",
    "date": "2026-12-25",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
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
    "id": "demo_tx_379",
    "description": "Uber/Bolt",
    "date": "2026-12-19",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_365",
    "description": "Mega Image",
    "date": "2026-12-18",
    "amount": 218,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_364",
    "description": "Mega Image",
    "date": "2026-12-16",
    "amount": 65,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_376",
    "description": "Uber/Bolt",
    "date": "2026-12-16",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_382",
    "description": "Cinema",
    "date": "2026-12-16",
    "amount": 42,
    "type": "Expense",
    "categoryId": "cat_entertainment",
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
    "id": "demo_tx_383",
    "description": "Christmas Gifts",
    "date": "2026-12-15",
    "amount": 461,
    "type": "Expense",
    "categoryId": "cat_gift",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_381",
    "description": "Gas Station",
    "date": "2026-12-14",
    "amount": 157,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_377",
    "description": "Uber/Bolt",
    "date": "2026-12-13",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
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
    "id": "demo_tx_370",
    "description": "Starbucks",
    "date": "2026-12-11",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_358",
    "description": "Enel Electricity",
    "date": "2026-12-10",
    "amount": 250,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_384",
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
    "id": "demo_tx_369",
    "description": "Restaurant",
    "date": "2026-12-09",
    "amount": 238,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_385",
    "description": "ETF Vanguard",
    "date": "2026-12-07",
    "amount": 661,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_367",
    "description": "Restaurant",
    "date": "2026-12-06",
    "amount": 121,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_368",
    "description": "Restaurant",
    "date": "2026-12-06",
    "amount": 138,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
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
    "id": "demo_tx_380",
    "description": "Amazon",
    "date": "2026-12-05",
    "amount": 151,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_371",
    "description": "Starbucks",
    "date": "2026-12-04",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_373",
    "description": "Starbucks",
    "date": "2026-12-04",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_375",
    "description": "Starbucks",
    "date": "2026-12-04",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
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
    "id": "demo_tx_366",
    "description": "Mega Image",
    "date": "2026-12-02",
    "amount": 241,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
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
    "id": "demo_tx_386",
    "description": "Monthly Bank Fee",
    "date": "2026-12-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_340",
    "description": "Starbucks",
    "date": "2026-11-26",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_346",
    "description": "Uber/Bolt",
    "date": "2026-11-24",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_332",
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
    "id": "demo_tx_343",
    "description": "Starbucks",
    "date": "2026-11-20",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_350",
    "description": "Gas Station",
    "date": "2026-11-17",
    "amount": 184,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_336",
    "description": "Mega Image",
    "date": "2026-11-16",
    "amount": 94,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_337",
    "description": "Restaurant",
    "date": "2026-11-16",
    "amount": 101,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_342",
    "description": "Starbucks",
    "date": "2026-11-16",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_330",
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
    "description": "Starbucks",
    "date": "2026-11-14",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_349",
    "description": "Amazon",
    "date": "2026-11-13",
    "amount": 36,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_351",
    "description": "Cinema",
    "date": "2026-11-13",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_329",
    "description": "Digi Internet",
    "date": "2026-11-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_345",
    "description": "Uber/Bolt",
    "date": "2026-11-12",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_328",
    "description": "Enel Electricity",
    "date": "2026-11-10",
    "amount": 222,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_344",
    "description": "Uber/Bolt",
    "date": "2026-11-10",
    "amount": 44,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_347",
    "description": "Uber/Bolt",
    "date": "2026-11-10",
    "amount": 59,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_352",
    "description": "ETF Vanguard",
    "date": "2026-11-10",
    "amount": 597,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_335",
    "description": "Mega Image",
    "date": "2026-11-07",
    "amount": 97,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_338",
    "description": "Restaurant",
    "date": "2026-11-07",
    "amount": 141,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_331",
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
    "id": "demo_tx_339",
    "description": "Starbucks",
    "date": "2026-11-05",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_348",
    "description": "Amazon",
    "date": "2026-11-05",
    "amount": 178,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
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
    "id": "demo_tx_334",
    "description": "Mega Image",
    "date": "2026-11-03",
    "amount": 232,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_327",
    "description": "Apartment Rent",
    "date": "2026-11-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_326",
    "description": "Salary",
    "date": "2026-11-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_333",
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
    "id": "demo_tx_353",
    "description": "Property Tax",
    "date": "2026-11-01",
    "amount": 836,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_354",
    "description": "Monthly Bank Fee",
    "date": "2026-11-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_308",
    "description": "Starbucks",
    "date": "2026-10-28",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_294",
    "description": "Mega Image",
    "date": "2026-10-25",
    "amount": 300,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_300",
    "description": "Restaurant",
    "date": "2026-10-25",
    "amount": 190,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_292",
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
    "id": "demo_tx_302",
    "description": "Restaurant",
    "date": "2026-10-20",
    "amount": 214,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_305",
    "description": "Starbucks",
    "date": "2026-10-20",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_312",
    "description": "Uber/Bolt",
    "date": "2026-10-20",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_316",
    "description": "Clothing Store",
    "date": "2026-10-20",
    "amount": 489,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_323",
    "description": "ETF Vanguard",
    "date": "2026-10-19",
    "amount": 915,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_324",
    "description": "Property Maintenance",
    "date": "2026-10-17",
    "amount": 286,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_286",
    "description": "Freelance Gig",
    "date": "2026-10-15",
    "amount": 2799,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_290",
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
    "description": "Uber/Bolt",
    "date": "2026-10-15",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_304",
    "description": "Restaurant",
    "date": "2026-10-14",
    "amount": 185,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_322",
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
    "id": "demo_tx_306",
    "description": "Starbucks",
    "date": "2026-10-13",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_307",
    "description": "Starbucks",
    "date": "2026-10-13",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_289",
    "description": "Digi Internet",
    "date": "2026-10-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_295",
    "description": "Mega Image",
    "date": "2026-10-12",
    "amount": 194,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_298",
    "description": "Mega Image",
    "date": "2026-10-12",
    "amount": 278,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_315",
    "description": "Gas Station",
    "date": "2026-10-12",
    "amount": 189,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_321",
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
    "id": "demo_tx_303",
    "description": "Restaurant",
    "date": "2026-10-11",
    "amount": 97,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_288",
    "description": "Enel Electricity",
    "date": "2026-10-10",
    "amount": 159,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_320",
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
    "id": "demo_tx_313",
    "description": "Amazon",
    "date": "2026-10-09",
    "amount": 118,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_297",
    "description": "Mega Image",
    "date": "2026-10-08",
    "amount": 139,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_309",
    "description": "Uber/Bolt",
    "date": "2026-10-08",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_319",
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
    "id": "demo_tx_318",
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
    "id": "demo_tx_291",
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
    "id": "demo_tx_314",
    "description": "Amazon",
    "date": "2026-10-04",
    "amount": 191,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_317",
    "description": "Cinema",
    "date": "2026-10-04",
    "amount": 76,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_287",
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
    "description": "Mega Image",
    "date": "2026-10-02",
    "amount": 65,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_299",
    "description": "Restaurant",
    "date": "2026-10-02",
    "amount": 238,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_301",
    "description": "Restaurant",
    "date": "2026-10-02",
    "amount": 198,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_311",
    "description": "Uber/Bolt",
    "date": "2026-10-02",
    "amount": 47,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_285",
    "description": "Salary",
    "date": "2026-10-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_293",
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
    "id": "demo_tx_325",
    "description": "Monthly Bank Fee",
    "date": "2026-10-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_271",
    "description": "Uber/Bolt",
    "date": "2026-09-27",
    "amount": 39,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_270",
    "description": "Uber/Bolt",
    "date": "2026-09-26",
    "amount": 39,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_277",
    "description": "Gas Station",
    "date": "2026-09-26",
    "amount": 175,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_268",
    "description": "Starbucks",
    "date": "2026-09-25",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_261",
    "description": "Mega Image",
    "date": "2026-09-23",
    "amount": 127,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_257",
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
    "id": "demo_tx_259",
    "description": "Mega Image",
    "date": "2026-09-20",
    "amount": 253,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_275",
    "description": "Amazon",
    "date": "2026-09-18",
    "amount": 50,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_263",
    "description": "Restaurant",
    "date": "2026-09-16",
    "amount": 92,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_255",
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
    "id": "demo_tx_260",
    "description": "Mega Image",
    "date": "2026-09-14",
    "amount": 104,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_276",
    "description": "Amazon",
    "date": "2026-09-14",
    "amount": 110,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_273",
    "description": "Amazon",
    "date": "2026-09-13",
    "amount": 81,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_281",
    "description": "Online Course",
    "date": "2026-09-13",
    "amount": 206,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_254",
    "description": "Digi Internet",
    "date": "2026-09-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_266",
    "description": "Starbucks",
    "date": "2026-09-12",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_272",
    "description": "Uber/Bolt",
    "date": "2026-09-12",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_264",
    "description": "Restaurant",
    "date": "2026-09-11",
    "amount": 243,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_280",
    "description": "Pharmacy",
    "date": "2026-09-11",
    "amount": 104,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_253",
    "description": "Enel Electricity",
    "date": "2026-09-10",
    "amount": 240,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_262",
    "description": "Restaurant",
    "date": "2026-09-09",
    "amount": 86,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_279",
    "description": "Cinema",
    "date": "2026-09-09",
    "amount": 72,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_265",
    "description": "Starbucks",
    "date": "2026-09-07",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_282",
    "description": "ETF Vanguard",
    "date": "2026-09-07",
    "amount": 743,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_269",
    "description": "Starbucks",
    "date": "2026-09-06",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_256",
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
    "id": "demo_tx_284",
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
    "description": "Starbucks",
    "date": "2026-09-04",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_274",
    "description": "Amazon",
    "date": "2026-09-03",
    "amount": 114,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_278",
    "description": "Clothing Store",
    "date": "2026-09-03",
    "amount": 368,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_252",
    "description": "Apartment Rent",
    "date": "2026-09-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_251",
    "description": "Salary",
    "date": "2026-09-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_258",
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
    "id": "demo_tx_283",
    "description": "Monthly Bank Fee",
    "date": "2026-09-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_234",
    "description": "Mega Image",
    "date": "2026-08-28",
    "amount": 144,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_249",
    "description": "ETF Vanguard",
    "date": "2026-08-28",
    "amount": 931,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_237",
    "description": "Restaurant",
    "date": "2026-08-27",
    "amount": 162,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_240",
    "description": "Starbucks",
    "date": "2026-08-25",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_245",
    "description": "Amazon",
    "date": "2026-08-25",
    "amount": 111,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_247",
    "description": "Cinema",
    "date": "2026-08-25",
    "amount": 72,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_243",
    "description": "Uber/Bolt",
    "date": "2026-08-24",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_244",
    "description": "Uber/Bolt",
    "date": "2026-08-23",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_231",
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
    "id": "demo_tx_233",
    "description": "Mega Image",
    "date": "2026-08-20",
    "amount": 90,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_241",
    "description": "Starbucks",
    "date": "2026-08-17",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_229",
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
    "id": "demo_tx_228",
    "description": "Digi Internet",
    "date": "2026-08-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_246",
    "description": "Gas Station",
    "date": "2026-08-11",
    "amount": 227,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_227",
    "description": "Enel Electricity",
    "date": "2026-08-10",
    "amount": 196,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_242",
    "description": "Starbucks",
    "date": "2026-08-10",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_248",
    "description": "Pharmacy",
    "date": "2026-08-09",
    "amount": 139,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_230",
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
    "id": "demo_tx_236",
    "description": "Mega Image",
    "date": "2026-08-03",
    "amount": 201,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_226",
    "description": "Apartment Rent",
    "date": "2026-08-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_225",
    "description": "Salary",
    "date": "2026-08-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_232",
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
    "id": "demo_tx_235",
    "description": "Mega Image",
    "date": "2026-08-01",
    "amount": 206,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_238",
    "description": "Restaurant",
    "date": "2026-08-01",
    "amount": 177,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_239",
    "description": "Restaurant",
    "date": "2026-08-01",
    "amount": 213,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_250",
    "description": "Monthly Bank Fee",
    "date": "2026-08-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_214",
    "description": "Amazon",
    "date": "2026-07-24",
    "amount": 92,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_207",
    "description": "Starbucks",
    "date": "2026-07-23",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_196",
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
    "id": "demo_tx_211",
    "description": "Uber/Bolt",
    "date": "2026-07-22",
    "amount": 26,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_217",
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
    "id": "demo_tx_200",
    "description": "Mega Image",
    "date": "2026-07-21",
    "amount": 152,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_221",
    "description": "ETF Vanguard",
    "date": "2026-07-20",
    "amount": 588,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_203",
    "description": "Restaurant",
    "date": "2026-07-18",
    "amount": 222,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_213",
    "description": "Amazon",
    "date": "2026-07-18",
    "amount": 139,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_222",
    "description": "Property Maintenance",
    "date": "2026-07-18",
    "amount": 238,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_199",
    "description": "Mega Image",
    "date": "2026-07-17",
    "amount": 133,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_202",
    "description": "Restaurant",
    "date": "2026-07-17",
    "amount": 137,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_198",
    "description": "Mega Image",
    "date": "2026-07-16",
    "amount": 294,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_190",
    "description": "Freelance Gig",
    "date": "2026-07-15",
    "amount": 2605,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_194",
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
    "id": "demo_tx_216",
    "description": "Cinema",
    "date": "2026-07-15",
    "amount": 62,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_220",
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
    "id": "demo_tx_210",
    "description": "Uber/Bolt",
    "date": "2026-07-14",
    "amount": 51,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_219",
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
    "id": "demo_tx_193",
    "description": "Digi Internet",
    "date": "2026-07-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_208",
    "description": "Starbucks",
    "date": "2026-07-12",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_206",
    "description": "Starbucks",
    "date": "2026-07-11",
    "amount": 18,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_215",
    "description": "Gas Station",
    "date": "2026-07-11",
    "amount": 180,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_192",
    "description": "Enel Electricity",
    "date": "2026-07-10",
    "amount": 218,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_204",
    "description": "Restaurant",
    "date": "2026-07-08",
    "amount": 216,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_209",
    "description": "Uber/Bolt",
    "date": "2026-07-08",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_212",
    "description": "Amazon",
    "date": "2026-07-08",
    "amount": 66,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_201",
    "description": "Restaurant",
    "date": "2026-07-07",
    "amount": 239,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_195",
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
    "id": "demo_tx_224",
    "description": "Tenant Rent",
    "date": "2026-07-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_191",
    "description": "Apartment Rent",
    "date": "2026-07-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_189",
    "description": "Salary",
    "date": "2026-07-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_197",
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
    "id": "demo_tx_205",
    "description": "Starbucks",
    "date": "2026-07-01",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_218",
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
    "id": "demo_tx_223",
    "description": "Monthly Bank Fee",
    "date": "2026-07-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_180",
    "description": "Amazon",
    "date": "2026-06-27",
    "amount": 37,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_186",
    "description": "Pharmacy",
    "date": "2026-06-27",
    "amount": 96,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_175",
    "description": "Starbucks",
    "date": "2026-06-24",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_165",
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
    "id": "demo_tx_181",
    "description": "Amazon",
    "date": "2026-06-22",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_184",
    "description": "Gas Station",
    "date": "2026-06-22",
    "amount": 164,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_185",
    "description": "Clothing Store",
    "date": "2026-06-22",
    "amount": 227,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_167",
    "description": "Mega Image",
    "date": "2026-06-21",
    "amount": 72,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_182",
    "description": "Amazon",
    "date": "2026-06-20",
    "amount": 118,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_168",
    "description": "Mega Image",
    "date": "2026-06-19",
    "amount": 277,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_171",
    "description": "Restaurant",
    "date": "2026-06-19",
    "amount": 226,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_163",
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
    "id": "demo_tx_187",
    "description": "ETF Vanguard",
    "date": "2026-06-13",
    "amount": 807,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_162",
    "description": "Digi Internet",
    "date": "2026-06-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_172",
    "description": "Restaurant",
    "date": "2026-06-12",
    "amount": 184,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_176",
    "description": "Starbucks",
    "date": "2026-06-12",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_161",
    "description": "Enel Electricity",
    "date": "2026-06-10",
    "amount": 159,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_177",
    "description": "Uber/Bolt",
    "date": "2026-06-08",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_178",
    "description": "Uber/Bolt",
    "date": "2026-06-08",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_170",
    "description": "Mega Image",
    "date": "2026-06-06",
    "amount": 118,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_174",
    "description": "Starbucks",
    "date": "2026-06-06",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_164",
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
    "id": "demo_tx_173",
    "description": "Starbucks",
    "date": "2026-06-04",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_179",
    "description": "Uber/Bolt",
    "date": "2026-06-04",
    "amount": 58,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_160",
    "description": "Apartment Rent",
    "date": "2026-06-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_183",
    "description": "Amazon",
    "date": "2026-06-02",
    "amount": 178,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_159",
    "description": "Salary",
    "date": "2026-06-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_166",
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
    "id": "demo_tx_169",
    "description": "Mega Image",
    "date": "2026-06-01",
    "amount": 99,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_188",
    "description": "Monthly Bank Fee",
    "date": "2026-06-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_144",
    "description": "Starbucks",
    "date": "2026-05-28",
    "amount": 31,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_149",
    "description": "Amazon",
    "date": "2026-05-28",
    "amount": 94,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_139",
    "description": "Restaurant",
    "date": "2026-05-27",
    "amount": 219,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_141",
    "description": "Restaurant",
    "date": "2026-05-27",
    "amount": 194,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_153",
    "description": "Clothing Store",
    "date": "2026-05-24",
    "amount": 447,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_152",
    "description": "Gas Station",
    "date": "2026-05-23",
    "amount": 178,
    "type": "Expense",
    "categoryId": "cat_transport",
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
    "id": "demo_tx_138",
    "description": "Restaurant",
    "date": "2026-05-20",
    "amount": 85,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_136",
    "description": "Mega Image",
    "date": "2026-05-18",
    "amount": 193,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_140",
    "description": "Restaurant",
    "date": "2026-05-18",
    "amount": 132,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_156",
    "description": "Property Tax",
    "date": "2026-05-17",
    "amount": 896,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
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
    "id": "demo_tx_143",
    "description": "Starbucks",
    "date": "2026-05-15",
    "amount": 16,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_135",
    "description": "Mega Image",
    "date": "2026-05-14",
    "amount": 300,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
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
    "id": "demo_tx_146",
    "description": "Uber/Bolt",
    "date": "2026-05-12",
    "amount": 42,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_128",
    "description": "Enel Electricity",
    "date": "2026-05-10",
    "amount": 239,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_151",
    "description": "Amazon",
    "date": "2026-05-10",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_134",
    "description": "Mega Image",
    "date": "2026-05-09",
    "amount": 107,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_145",
    "description": "Starbucks",
    "date": "2026-05-09",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_147",
    "description": "Uber/Bolt",
    "date": "2026-05-06",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_150",
    "description": "Amazon",
    "date": "2026-05-06",
    "amount": 125,
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
    "id": "demo_tx_137",
    "description": "Mega Image",
    "date": "2026-05-05",
    "amount": 253,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_155",
    "description": "ETF Vanguard",
    "date": "2026-05-05",
    "amount": 516,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_158",
    "description": "Tenant Rent",
    "date": "2026-05-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
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
    "id": "demo_tx_148",
    "description": "Uber/Bolt",
    "date": "2026-05-02",
    "amount": 45,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_154",
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
    "id": "demo_tx_142",
    "description": "Starbucks",
    "date": "2026-05-01",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_157",
    "description": "Monthly Bank Fee",
    "date": "2026-05-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_102",
    "description": "Mega Image",
    "date": "2026-04-28",
    "amount": 237,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_124",
    "description": "Property Maintenance",
    "date": "2026-04-25",
    "amount": 254,
    "type": "Expense",
    "categoryId": "cat_property",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_106",
    "description": "Restaurant",
    "date": "2026-04-23",
    "amount": 204,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_112",
    "description": "Starbucks",
    "date": "2026-04-23",
    "amount": 19,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_99",
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
    "description": "Starbucks",
    "date": "2026-04-22",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_116",
    "description": "Uber/Bolt",
    "date": "2026-04-20",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_114",
    "description": "Uber/Bolt",
    "date": "2026-04-19",
    "amount": 44,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_117",
    "description": "Amazon",
    "date": "2026-04-19",
    "amount": 196,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_123",
    "description": "ETF Vanguard",
    "date": "2026-04-19",
    "amount": 800,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_109",
    "description": "Starbucks",
    "date": "2026-04-18",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_113",
    "description": "Starbucks",
    "date": "2026-04-16",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_115",
    "description": "Uber/Bolt",
    "date": "2026-04-16",
    "amount": 50,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_93",
    "description": "Freelance Gig",
    "date": "2026-04-15",
    "amount": 1249,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_97",
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
    "description": "Starbucks",
    "date": "2026-04-15",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_103",
    "description": "Mega Image",
    "date": "2026-04-14",
    "amount": 213,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_119",
    "description": "Amazon",
    "date": "2026-04-14",
    "amount": 101,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_108",
    "description": "Restaurant",
    "date": "2026-04-13",
    "amount": 102,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_96",
    "description": "Digi Internet",
    "date": "2026-04-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_107",
    "description": "Restaurant",
    "date": "2026-04-12",
    "amount": 168,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_105",
    "description": "Restaurant",
    "date": "2026-04-11",
    "amount": 156,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_95",
    "description": "Enel Electricity",
    "date": "2026-04-10",
    "amount": 233,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_122",
    "description": "Haircut",
    "date": "2026-04-10",
    "amount": 76,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_104",
    "description": "Mega Image",
    "date": "2026-04-09",
    "amount": 127,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_101",
    "description": "Mega Image",
    "date": "2026-04-07",
    "amount": 59,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_121",
    "description": "Clothing Store",
    "date": "2026-04-06",
    "amount": 240,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_98",
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
    "id": "demo_tx_118",
    "description": "Amazon",
    "date": "2026-04-05",
    "amount": 54,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_120",
    "description": "Gas Station",
    "date": "2026-04-03",
    "amount": 189,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_94",
    "description": "Apartment Rent",
    "date": "2026-04-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_92",
    "description": "Salary",
    "date": "2026-04-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_100",
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
    "id": "demo_tx_82",
    "description": "Starbucks",
    "date": "2026-03-27",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_78",
    "description": "Starbucks",
    "date": "2026-03-26",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_81",
    "description": "Starbucks",
    "date": "2026-03-26",
    "amount": 28,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_68",
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
    "id": "demo_tx_75",
    "description": "Restaurant",
    "date": "2026-03-21",
    "amount": 129,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_76",
    "description": "Restaurant",
    "date": "2026-03-21",
    "amount": 241,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_74",
    "description": "Restaurant",
    "date": "2026-03-19",
    "amount": 133,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_66",
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
    "id": "demo_tx_71",
    "description": "Mega Image",
    "date": "2026-03-14",
    "amount": 158,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_88",
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
    "id": "demo_tx_73",
    "description": "Mega Image",
    "date": "2026-03-13",
    "amount": 295,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_83",
    "description": "Uber/Bolt",
    "date": "2026-03-13",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_89",
    "description": "ETF Vanguard",
    "date": "2026-03-13",
    "amount": 630,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_65",
    "description": "Digi Internet",
    "date": "2026-03-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_70",
    "description": "Mega Image",
    "date": "2026-03-12",
    "amount": 216,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_64",
    "description": "Enel Electricity",
    "date": "2026-03-10",
    "amount": 233,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_85",
    "description": "Amazon",
    "date": "2026-03-10",
    "amount": 195,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_86",
    "description": "Gas Station",
    "date": "2026-03-08",
    "amount": 294,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_79",
    "description": "Starbucks",
    "date": "2026-03-06",
    "amount": 34,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_67",
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
    "id": "demo_tx_87",
    "description": "Online Course",
    "date": "2026-03-05",
    "amount": 217,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_91",
    "description": "Tenant Rent",
    "date": "2026-03-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_77",
    "description": "Restaurant",
    "date": "2026-03-04",
    "amount": 204,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_72",
    "description": "Mega Image",
    "date": "2026-03-03",
    "amount": 187,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_84",
    "description": "Uber/Bolt",
    "date": "2026-03-03",
    "amount": 36,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_63",
    "description": "Apartment Rent",
    "date": "2026-03-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_80",
    "description": "Starbucks",
    "date": "2026-03-02",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_62",
    "description": "Salary",
    "date": "2026-03-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_69",
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
    "id": "demo_tx_90",
    "description": "Monthly Bank Fee",
    "date": "2026-03-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_55",
    "description": "Uber/Bolt",
    "date": "2026-02-28",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_48",
    "description": "Starbucks",
    "date": "2026-02-26",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_59",
    "description": "Cinema",
    "date": "2026-02-26",
    "amount": 70,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_60",
    "description": "ETF Vanguard",
    "date": "2026-02-26",
    "amount": 552,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_50",
    "description": "Starbucks",
    "date": "2026-02-23",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_38",
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
    "id": "demo_tx_53",
    "description": "Starbucks",
    "date": "2026-02-22",
    "amount": 20,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_57",
    "description": "Gas Station",
    "date": "2026-02-21",
    "amount": 211,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_49",
    "description": "Starbucks",
    "date": "2026-02-18",
    "amount": 30,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_56",
    "description": "Amazon",
    "date": "2026-02-18",
    "amount": 39,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_45",
    "description": "Restaurant",
    "date": "2026-02-17",
    "amount": 211,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_54",
    "description": "Uber/Bolt",
    "date": "2026-02-17",
    "amount": 50,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_36",
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
    "date": "2026-02-14",
    "amount": 211,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_43",
    "description": "Mega Image",
    "date": "2026-02-14",
    "amount": 130,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_52",
    "description": "Starbucks",
    "date": "2026-02-13",
    "amount": 24,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_35",
    "description": "Digi Internet",
    "date": "2026-02-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_51",
    "description": "Starbucks",
    "date": "2026-02-12",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_34",
    "description": "Enel Electricity",
    "date": "2026-02-10",
    "amount": 227,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_44",
    "description": "Restaurant",
    "date": "2026-02-10",
    "amount": 207,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_47",
    "description": "Restaurant",
    "date": "2026-02-09",
    "amount": 194,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_37",
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
    "id": "demo_tx_46",
    "description": "Restaurant",
    "date": "2026-02-05",
    "amount": 92,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_42",
    "description": "Mega Image",
    "date": "2026-02-04",
    "amount": 289,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_33",
    "description": "Apartment Rent",
    "date": "2026-02-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_40",
    "description": "Mega Image",
    "date": "2026-02-02",
    "amount": 258,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_58",
    "description": "Clothing Store",
    "date": "2026-02-02",
    "amount": 161,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_32",
    "description": "Salary",
    "date": "2026-02-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_39",
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
    "id": "demo_tx_61",
    "description": "Monthly Bank Fee",
    "date": "2026-02-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_18",
    "description": "Starbucks",
    "date": "2026-01-28",
    "amount": 17,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_22",
    "description": "Uber/Bolt",
    "date": "2026-01-28",
    "amount": 23,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_12",
    "description": "Mega Image",
    "date": "2026-01-27",
    "amount": 284,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_11",
    "description": "Mega Image",
    "date": "2026-01-24",
    "amount": 75,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_13",
    "description": "Mega Image",
    "date": "2026-01-23",
    "amount": 204,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_15",
    "description": "Restaurant",
    "date": "2026-01-23",
    "amount": 183,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
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
    "id": "demo_tx_14",
    "description": "Restaurant",
    "date": "2026-01-22",
    "amount": 215,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_17",
    "description": "Starbucks",
    "date": "2026-01-18",
    "amount": 26,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_21",
    "description": "Uber/Bolt",
    "date": "2026-01-17",
    "amount": 29,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_16",
    "description": "Restaurant",
    "date": "2026-01-16",
    "amount": 170,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_2",
    "description": "Freelance Gig",
    "date": "2026-01-15",
    "amount": 1213,
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
    "id": "demo_tx_10",
    "description": "Mega Image",
    "date": "2026-01-13",
    "amount": 72,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_26",
    "description": "Amazon",
    "date": "2026-01-13",
    "amount": 131,
    "type": "Expense",
    "categoryId": "cat_shopping",
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
    "id": "demo_tx_4",
    "description": "Enel Electricity",
    "date": "2026-01-10",
    "amount": 234,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_24",
    "description": "Amazon",
    "date": "2026-01-09",
    "amount": 69,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_23",
    "description": "Uber/Bolt",
    "date": "2026-01-08",
    "amount": 33,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_19",
    "description": "Starbucks",
    "date": "2026-01-07",
    "amount": 35,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_20",
    "description": "Uber/Bolt",
    "date": "2026-01-06",
    "amount": 47,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
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
    "id": "demo_tx_25",
    "description": "Amazon",
    "date": "2026-01-05",
    "amount": 63,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_27",
    "description": "Gas Station",
    "date": "2026-01-05",
    "amount": 185,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_31",
    "description": "Tenant Rent",
    "date": "2026-01-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_28",
    "description": "ETF Vanguard",
    "date": "2026-01-03",
    "amount": 715,
    "type": "Expense",
    "categoryId": "cat_investing",
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
    "id": "demo_tx_29",
    "description": "Property Maintenance",
    "date": "2026-01-02",
    "amount": 207,
    "type": "Expense",
    "categoryId": "cat_property",
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
  },
  {
    "id": "demo_tx_30",
    "description": "Monthly Bank Fee",
    "date": "2026-01-01",
    "amount": 15,
    "type": "Expense",
    "categoryId": "cat_taxes",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_901",
    "description": "Café in Vienna",
    "date": "2026-12-20",
    "amount": 42,
    "originalAmount": 8.5,
    "originalCurrency": "EUR",
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_902",
    "description": "Revolut top-up",
    "date": "2026-12-21",
    "amount": 500,
    "type": "Transfer",
    "categoryId": "",
    "accountId": "acc_revolut",
    "tags": []
  },
  // A planted near-duplicate pair so the duplicate review has something real to
  // find in demo mode: same amount, one day apart, same account and category,
  // description differing only in case and punctuation.
  {
    "id": "demo_tx_903",
    "description": "Mega Image groceries",
    "date": "2026-12-17",
    "amount": 137.4,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_904",
    "description": "Mega Image Groceries.",
    "date": "2026-12-18",
    "amount": 137.4,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_checking",
    "tags": []
  }
];

// ---------------------------------------------------------------------------
// Rebase every fixture date onto "today", computed fresh on each module load.
//
// The raw fixture above was hand-authored against a fixed calendar year — every
// date is really just "day N of a representative 12-month cycle". Exporting it
// as-is meant most of the year read as future transactions (breaking "This
// year" / "This month" totals and historical baselines), and it would have gone
// stale entirely once the real calendar passed the fixture's year (no dated row
// would ever fall in "this month" again). Shifting the whole fixture by one
// fixed day-offset preserves every gap between transactions and each
// subscription's day-of-month exactly, while guaranteeing the most recent
// transaction always lands on "today".
// ---------------------------------------------------------------------------

function parseFixtureDate(str) {
  const [y, m, d] = String(str).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shiftDateString(str, offsetDays) {
  if (!str) return str;
  const d = parseFixtureDate(str);
  d.setDate(d.getDate() + offsetDays);
  return toDateString(d);
}

const today = new Date();
const todayStr = toDateString(today);

const fixtureMaxDate = RAW_TRANSACTIONS.reduce(
  (max, t) => { const d = parseFixtureDate(t.date); return d > max ? d : max; },
  parseFixtureDate(RAW_TRANSACTIONS[0].date)
);
const OFFSET_DAYS = Math.round((today.getTime() - fixtureMaxDate.getTime()) / 86400000);

export const DEMO_TRANSACTIONS = RAW_TRANSACTIONS.map(t => ({
  ...t,
  date: shiftDateString(t.date, OFFSET_DAYS)
}));

export const DEMO_SUBSCRIPTIONS = RAW_SUBSCRIPTIONS.map(s => ({
  ...s,
  lastProcessed: s.lastProcessed ? shiftDateString(s.lastProcessed, OFFSET_DAYS) : s.lastProcessed
}));

// Trips get their OWN offset, anchored on the fixture's "Active" trip rather than
// on the last transaction. Transactions are a ledger of things that already
// happened, so OFFSET_DAYS is deliberately chosen to push every one of them into
// the past — but a trip is allowed to be upcoming. Reusing the transaction offset
// here dragged every trip into the past along with the transactions (Poland, the
// fixture's one "Planned" trip, would always land months behind "today"),
// collapsing the demo's Planned/Active/Completed variety down to "Completed" for
// everything. Anchoring instead on the midpoint of whichever trip the fixture
// marks Active keeps that trip straddling "today" and keeps trips authored after
// it in the future — preserving the same narrative shape the fixture was written
// with, regardless of what day it's actually viewed on.
const activeTripRaw = RAW_TRIPS.find(t => t.status === 'Active' && t.startDate && t.endDate);
const TRIP_OFFSET_DAYS = activeTripRaw
  ? Math.round((today.getTime() - (parseFixtureDate(activeTripRaw.startDate).getTime() + parseFixtureDate(activeTripRaw.endDate).getTime()) / 2) / 86400000)
  : OFFSET_DAYS;

// Trip status is recomputed from the shifted dates rather than trusted from the
// fixture — a stored "Active" label would otherwise drift out of sync with
// "today" the moment the fixture ages by even a day.
export const DEMO_TRIPS = RAW_TRIPS.map(t => {
  const startDate = t.startDate ? shiftDateString(t.startDate, TRIP_OFFSET_DAYS) : null;
  const endDate = t.endDate ? shiftDateString(t.endDate, TRIP_OFFSET_DAYS) : null;
  let status = t.status;
  if (startDate && endDate) {
    if (endDate < todayStr) status = 'Completed';
    else if (startDate > todayStr) status = 'Planned';
    else status = 'Active';
  }
  return { ...t, startDate, endDate, status };
});
