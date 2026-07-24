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
    "lastProcessed": null
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
    "lastProcessed": null
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
    "lastProcessed": null
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
    "lastProcessed": null
  }
];

export const DEMO_TRANSACTIONS = [
  {
    "id": "demo_tx_211",
    "description": "ETF Vanguard",
    "date": "2026-12-27",
    "amount": 696,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_200",
    "description": "Mega Image",
    "date": "2026-12-23",
    "amount": 157,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_202",
    "description": "Mega Image",
    "date": "2026-12-23",
    "amount": 104,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_206",
    "description": "Uber/Bolt",
    "date": "2026-12-20",
    "amount": 25,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_204",
    "description": "Restaurant",
    "date": "2026-12-16",
    "amount": 149,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_207",
    "description": "Gas Station",
    "date": "2026-12-16",
    "amount": 218,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_210",
    "description": "Christmas Gifts",
    "date": "2026-12-15",
    "amount": 759,
    "type": "Expense",
    "categoryId": "cat_gift",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_201",
    "description": "Mega Image",
    "date": "2026-12-13",
    "amount": 185,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_198",
    "description": "Digi Internet",
    "date": "2026-12-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_197",
    "description": "Enel Electricity",
    "date": "2026-12-10",
    "amount": 140,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_199",
    "description": "Mega Image",
    "date": "2026-12-09",
    "amount": 287,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_209",
    "description": "Flight Tickets",
    "date": "2026-12-06",
    "amount": 2446,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_203",
    "description": "Restaurant",
    "date": "2026-12-04",
    "amount": 106,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_205",
    "description": "Restaurant",
    "date": "2026-12-04",
    "amount": 81,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_208",
    "description": "Pharmacy",
    "date": "2026-12-04",
    "amount": 61,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_196",
    "description": "Apartment Rent",
    "date": "2026-12-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_195",
    "description": "Salary",
    "date": "2026-12-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_190",
    "description": "Uber/Bolt",
    "date": "2026-11-28",
    "amount": 27,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_183",
    "description": "Mega Image",
    "date": "2026-11-26",
    "amount": 214,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_187",
    "description": "Mega Image",
    "date": "2026-11-26",
    "amount": 152,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_184",
    "description": "Mega Image",
    "date": "2026-11-24",
    "amount": 134,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_185",
    "description": "Mega Image",
    "date": "2026-11-22",
    "amount": 176,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_188",
    "description": "Restaurant",
    "date": "2026-11-21",
    "amount": 141,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_191",
    "description": "Gas Station",
    "date": "2026-11-19",
    "amount": 210,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_192",
    "description": "Clothing Store",
    "date": "2026-11-13",
    "amount": 174,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_182",
    "description": "Digi Internet",
    "date": "2026-11-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_181",
    "description": "Enel Electricity",
    "date": "2026-11-10",
    "amount": 234,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_186",
    "description": "Mega Image",
    "date": "2026-11-08",
    "amount": 145,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_189",
    "description": "Restaurant",
    "date": "2026-11-06",
    "amount": 116,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_194",
    "description": "Tenant Rent",
    "date": "2026-11-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_193",
    "description": "ETF Vanguard",
    "date": "2026-11-03",
    "amount": 560,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_180",
    "description": "Apartment Rent",
    "date": "2026-11-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_179",
    "description": "Salary",
    "date": "2026-11-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_164",
    "description": "Mega Image",
    "date": "2026-10-28",
    "amount": 135,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_176",
    "description": "Pharmacy",
    "date": "2026-10-27",
    "amount": 79,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_168",
    "description": "Restaurant",
    "date": "2026-10-25",
    "amount": 132,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_166",
    "description": "Mega Image",
    "date": "2026-10-23",
    "amount": 202,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_174",
    "description": "Clothing Store",
    "date": "2026-10-22",
    "amount": 377,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_165",
    "description": "Mega Image",
    "date": "2026-10-20",
    "amount": 138,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_175",
    "description": "Cinema",
    "date": "2026-10-20",
    "amount": 59,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_169",
    "description": "Restaurant",
    "date": "2026-10-19",
    "amount": 186,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_172",
    "description": "Uber/Bolt",
    "date": "2026-10-18",
    "amount": 47,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_170",
    "description": "Restaurant",
    "date": "2026-10-16",
    "amount": 185,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_160",
    "description": "Freelance Gig",
    "date": "2026-10-15",
    "amount": 2782,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_171",
    "description": "Restaurant",
    "date": "2026-10-15",
    "amount": 245,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_163",
    "description": "Digi Internet",
    "date": "2026-10-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_162",
    "description": "Enel Electricity",
    "date": "2026-10-10",
    "amount": 214,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_177",
    "description": "Haircut",
    "date": "2026-10-09",
    "amount": 91,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_167",
    "description": "Restaurant",
    "date": "2026-10-04",
    "amount": 197,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_173",
    "description": "Gas Station",
    "date": "2026-10-03",
    "amount": 290,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_178",
    "description": "ETF Vanguard",
    "date": "2026-10-03",
    "amount": 600,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_161",
    "description": "Apartment Rent",
    "date": "2026-10-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_159",
    "description": "Salary",
    "date": "2026-10-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_145",
    "description": "Mega Image",
    "date": "2026-09-28",
    "amount": 80,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_154",
    "description": "Cinema",
    "date": "2026-09-28",
    "amount": 61,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_144",
    "description": "Mega Image",
    "date": "2026-09-26",
    "amount": 110,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_152",
    "description": "Gas Station",
    "date": "2026-09-25",
    "amount": 300,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_151",
    "description": "Uber/Bolt",
    "date": "2026-09-21",
    "amount": 21,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_143",
    "description": "Mega Image",
    "date": "2026-09-18",
    "amount": 96,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_153",
    "description": "Clothing Store",
    "date": "2026-09-16",
    "amount": 131,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_146",
    "description": "Mega Image",
    "date": "2026-09-14",
    "amount": 181,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_148",
    "description": "Restaurant",
    "date": "2026-09-14",
    "amount": 202,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_156",
    "description": "Online Course",
    "date": "2026-09-14",
    "amount": 242,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_142",
    "description": "Digi Internet",
    "date": "2026-09-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_141",
    "description": "Enel Electricity",
    "date": "2026-09-10",
    "amount": 198,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_155",
    "description": "Pharmacy",
    "date": "2026-09-09",
    "amount": 48,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_150",
    "description": "Restaurant",
    "date": "2026-09-06",
    "amount": 93,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_158",
    "description": "Tenant Rent",
    "date": "2026-09-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_147",
    "description": "Restaurant",
    "date": "2026-09-04",
    "amount": 221,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_149",
    "description": "Restaurant",
    "date": "2026-09-03",
    "amount": 197,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_140",
    "description": "Apartment Rent",
    "date": "2026-09-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_139",
    "description": "Salary",
    "date": "2026-09-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_157",
    "description": "ETF Vanguard",
    "date": "2026-09-01",
    "amount": 679,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_129",
    "description": "Mega Image",
    "date": "2026-08-28",
    "amount": 283,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_136",
    "description": "Cinema",
    "date": "2026-08-27",
    "amount": 73,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_133",
    "description": "Uber/Bolt",
    "date": "2026-08-26",
    "amount": 52,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_134",
    "description": "Gas Station",
    "date": "2026-08-24",
    "amount": 265,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_128",
    "description": "Mega Image",
    "date": "2026-08-21",
    "amount": 148,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_132",
    "description": "Restaurant",
    "date": "2026-08-18",
    "amount": 173,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_138",
    "description": "ETF Vanguard",
    "date": "2026-08-18",
    "amount": 885,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_131",
    "description": "Restaurant",
    "date": "2026-08-17",
    "amount": 181,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_135",
    "description": "Clothing Store",
    "date": "2026-08-15",
    "amount": 109,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_127",
    "description": "Mega Image",
    "date": "2026-08-13",
    "amount": 209,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_126",
    "description": "Digi Internet",
    "date": "2026-08-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_130",
    "description": "Restaurant",
    "date": "2026-08-12",
    "amount": 123,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_125",
    "description": "Enel Electricity",
    "date": "2026-08-10",
    "amount": 232,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_124",
    "description": "Apartment Rent",
    "date": "2026-08-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_123",
    "description": "Salary",
    "date": "2026-08-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_137",
    "description": "Haircut",
    "date": "2026-08-01",
    "amount": 120,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_116",
    "description": "Restaurant",
    "date": "2026-07-27",
    "amount": 125,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_117",
    "description": "Restaurant",
    "date": "2026-07-26",
    "amount": 145,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_113",
    "description": "Mega Image",
    "date": "2026-07-25",
    "amount": 199,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_112",
    "description": "Mega Image",
    "date": "2026-07-24",
    "amount": 296,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_111",
    "description": "Mega Image",
    "date": "2026-07-21",
    "amount": 112,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_107",
    "description": "Freelance Gig",
    "date": "2026-07-15",
    "amount": 1543,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_121",
    "description": "ETF Vanguard",
    "date": "2026-07-13",
    "amount": 582,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_110",
    "description": "Digi Internet",
    "date": "2026-07-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_118",
    "description": "Uber/Bolt",
    "date": "2026-07-12",
    "amount": 60,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_115",
    "description": "Restaurant",
    "date": "2026-07-11",
    "amount": 195,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_109",
    "description": "Enel Electricity",
    "date": "2026-07-10",
    "amount": 191,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_114",
    "description": "Mega Image",
    "date": "2026-07-10",
    "amount": 126,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_119",
    "description": "Gas Station",
    "date": "2026-07-10",
    "amount": 202,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_122",
    "description": "Tenant Rent",
    "date": "2026-07-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_108",
    "description": "Apartment Rent",
    "date": "2026-07-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_120",
    "description": "Haircut",
    "date": "2026-07-02",
    "amount": 89,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_106",
    "description": "Salary",
    "date": "2026-07-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_94",
    "description": "Mega Image",
    "date": "2026-06-27",
    "amount": 213,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_95",
    "description": "Mega Image",
    "date": "2026-06-26",
    "amount": 231,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_102",
    "description": "Uber/Bolt",
    "date": "2026-06-26",
    "amount": 59,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_104",
    "description": "Flight Tickets",
    "date": "2026-06-21",
    "amount": 1441,
    "type": "Expense",
    "categoryId": "cat_travel",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_103",
    "description": "Gas Station",
    "date": "2026-06-20",
    "amount": 245,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_101",
    "description": "Restaurant",
    "date": "2026-06-15",
    "amount": 116,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_92",
    "description": "Digi Internet",
    "date": "2026-06-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_91",
    "description": "Enel Electricity",
    "date": "2026-06-10",
    "amount": 152,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_93",
    "description": "Mega Image",
    "date": "2026-06-08",
    "amount": 146,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_105",
    "description": "ETF Vanguard",
    "date": "2026-06-07",
    "amount": 530,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_96",
    "description": "Restaurant",
    "date": "2026-06-06",
    "amount": 220,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_97",
    "description": "Restaurant",
    "date": "2026-06-03",
    "amount": 214,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_98",
    "description": "Restaurant",
    "date": "2026-06-03",
    "amount": 85,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_90",
    "description": "Apartment Rent",
    "date": "2026-06-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_89",
    "description": "Salary",
    "date": "2026-06-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_99",
    "description": "Restaurant",
    "date": "2026-06-01",
    "amount": 151,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_100",
    "description": "Restaurant",
    "date": "2026-06-01",
    "amount": 217,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_83",
    "description": "Gas Station",
    "date": "2026-05-25",
    "amount": 226,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_84",
    "description": "Clothing Store",
    "date": "2026-05-25",
    "amount": 255,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_86",
    "description": "Haircut",
    "date": "2026-05-23",
    "amount": 88,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_75",
    "description": "Mega Image",
    "date": "2026-05-20",
    "amount": 254,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_85",
    "description": "Pharmacy",
    "date": "2026-05-20",
    "amount": 97,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_87",
    "description": "ETF Vanguard",
    "date": "2026-05-19",
    "amount": 772,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_77",
    "description": "Mega Image",
    "date": "2026-05-16",
    "amount": 277,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_74",
    "description": "Digi Internet",
    "date": "2026-05-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_73",
    "description": "Enel Electricity",
    "date": "2026-05-10",
    "amount": 161,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_79",
    "description": "Restaurant",
    "date": "2026-05-05",
    "amount": 178,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_88",
    "description": "Tenant Rent",
    "date": "2026-05-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_78",
    "description": "Mega Image",
    "date": "2026-05-04",
    "amount": 241,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_80",
    "description": "Restaurant",
    "date": "2026-05-04",
    "amount": 80,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_81",
    "description": "Restaurant",
    "date": "2026-05-04",
    "amount": 199,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_72",
    "description": "Apartment Rent",
    "date": "2026-05-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_76",
    "description": "Mega Image",
    "date": "2026-05-02",
    "amount": 218,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_82",
    "description": "Uber/Bolt",
    "date": "2026-05-02",
    "amount": 41,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_71",
    "description": "Salary",
    "date": "2026-05-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_63",
    "description": "Restaurant",
    "date": "2026-04-26",
    "amount": 188,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_68",
    "description": "Pharmacy",
    "date": "2026-04-25",
    "amount": 134,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_66",
    "description": "Gas Station",
    "date": "2026-04-24",
    "amount": 205,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_59",
    "description": "Mega Image",
    "date": "2026-04-23",
    "amount": 127,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_64",
    "description": "Restaurant",
    "date": "2026-04-20",
    "amount": 171,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_65",
    "description": "Uber/Bolt",
    "date": "2026-04-17",
    "amount": 57,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_53",
    "description": "Freelance Gig",
    "date": "2026-04-15",
    "amount": 1602,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_61",
    "description": "Mega Image",
    "date": "2026-04-14",
    "amount": 281,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_62",
    "description": "Restaurant",
    "date": "2026-04-14",
    "amount": 172,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_67",
    "description": "Cinema",
    "date": "2026-04-13",
    "amount": 79,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_56",
    "description": "Digi Internet",
    "date": "2026-04-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_60",
    "description": "Mega Image",
    "date": "2026-04-12",
    "amount": 93,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_55",
    "description": "Enel Electricity",
    "date": "2026-04-10",
    "amount": 222,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_58",
    "description": "Mega Image",
    "date": "2026-04-06",
    "amount": 155,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_70",
    "description": "ETF Vanguard",
    "date": "2026-04-05",
    "amount": 771,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_57",
    "description": "Mega Image",
    "date": "2026-04-03",
    "amount": 121,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_54",
    "description": "Apartment Rent",
    "date": "2026-04-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_52",
    "description": "Salary",
    "date": "2026-04-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_69",
    "description": "Haircut",
    "date": "2026-04-01",
    "amount": 95,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_43",
    "description": "Restaurant",
    "date": "2026-03-28",
    "amount": 145,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_39",
    "description": "Mega Image",
    "date": "2026-03-27",
    "amount": 248,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_42",
    "description": "Restaurant",
    "date": "2026-03-26",
    "amount": 215,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_46",
    "description": "Gas Station",
    "date": "2026-03-26",
    "amount": 264,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_47",
    "description": "Clothing Store",
    "date": "2026-03-26",
    "amount": 399,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_44",
    "description": "Restaurant",
    "date": "2026-03-17",
    "amount": 124,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_49",
    "description": "Online Course",
    "date": "2026-03-16",
    "amount": 241,
    "type": "Expense",
    "categoryId": "cat_education",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_41",
    "description": "Mega Image",
    "date": "2026-03-13",
    "amount": 62,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_38",
    "description": "Digi Internet",
    "date": "2026-03-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_37",
    "description": "Enel Electricity",
    "date": "2026-03-10",
    "amount": 240,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_45",
    "description": "Uber/Bolt",
    "date": "2026-03-09",
    "amount": 46,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_40",
    "description": "Mega Image",
    "date": "2026-03-08",
    "amount": 201,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_50",
    "description": "ETF Vanguard",
    "date": "2026-03-08",
    "amount": 590,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_51",
    "description": "Tenant Rent",
    "date": "2026-03-05",
    "amount": 1500,
    "type": "Income",
    "categoryId": "cat_rental_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_36",
    "description": "Apartment Rent",
    "date": "2026-03-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_35",
    "description": "Salary",
    "date": "2026-03-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_48",
    "description": "Haircut",
    "date": "2026-03-01",
    "amount": 111,
    "type": "Expense",
    "categoryId": "cat_personal_care",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_28",
    "description": "Restaurant",
    "date": "2026-02-27",
    "amount": 213,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_31",
    "description": "Uber/Bolt",
    "date": "2026-02-26",
    "amount": 22,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_24",
    "description": "Mega Image",
    "date": "2026-02-18",
    "amount": 68,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_30",
    "description": "Restaurant",
    "date": "2026-02-17",
    "amount": 206,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_32",
    "description": "Gas Station",
    "date": "2026-02-14",
    "amount": 266,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_34",
    "description": "ETF Vanguard",
    "date": "2026-02-14",
    "amount": 976,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_23",
    "description": "Digi Internet",
    "date": "2026-02-12",
    "amount": 40,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_27",
    "description": "Mega Image",
    "date": "2026-02-12",
    "amount": 204,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_22",
    "description": "Enel Electricity",
    "date": "2026-02-10",
    "amount": 201,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_26",
    "description": "Mega Image",
    "date": "2026-02-07",
    "amount": 94,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_21",
    "description": "Apartment Rent",
    "date": "2026-02-02",
    "amount": 2500,
    "type": "Expense",
    "categoryId": "cat_housing",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_33",
    "description": "Clothing Store",
    "date": "2026-02-02",
    "amount": 278,
    "type": "Expense",
    "categoryId": "cat_shopping",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_20",
    "description": "Salary",
    "date": "2026-02-01",
    "amount": 9500,
    "type": "Income",
    "categoryId": "cat_income",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_25",
    "description": "Mega Image",
    "date": "2026-02-01",
    "amount": 153,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_29",
    "description": "Restaurant",
    "date": "2026-02-01",
    "amount": 102,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_11",
    "description": "Restaurant",
    "date": "2026-01-28",
    "amount": 224,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_12",
    "description": "Restaurant",
    "date": "2026-01-28",
    "amount": 152,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_16",
    "description": "Cinema",
    "date": "2026-01-27",
    "amount": 65,
    "type": "Expense",
    "categoryId": "cat_entertainment",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_13",
    "description": "Restaurant",
    "date": "2026-01-24",
    "amount": 232,
    "type": "Expense",
    "categoryId": "cat_dining",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_6",
    "description": "Mega Image",
    "date": "2026-01-22",
    "amount": 63,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_10",
    "description": "Mega Image",
    "date": "2026-01-22",
    "amount": 278,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_17",
    "description": "Pharmacy",
    "date": "2026-01-22",
    "amount": 32,
    "type": "Expense",
    "categoryId": "cat_health",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_9",
    "description": "Mega Image",
    "date": "2026-01-20",
    "amount": 55,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_7",
    "description": "Mega Image",
    "date": "2026-01-18",
    "amount": 86,
    "type": "Expense",
    "categoryId": "cat_food",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_2",
    "description": "Freelance Gig",
    "date": "2026-01-15",
    "amount": 1981,
    "type": "Income",
    "categoryId": "cat_freelance",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_8",
    "description": "Mega Image",
    "date": "2026-01-13",
    "amount": 99,
    "type": "Expense",
    "categoryId": "cat_food",
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
    "amount": 156,
    "type": "Expense",
    "categoryId": "cat_utilities",
    "accountId": "acc_checking",
    "tags": []
  },
  {
    "id": "demo_tx_15",
    "description": "Gas Station",
    "date": "2026-01-10",
    "amount": 196,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_credit",
    "tags": []
  },
  {
    "id": "demo_tx_14",
    "description": "Uber/Bolt",
    "date": "2026-01-06",
    "amount": 44,
    "type": "Expense",
    "categoryId": "cat_transport",
    "accountId": "acc_revolut",
    "tags": []
  },
  {
    "id": "demo_tx_19",
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
    "id": "demo_tx_18",
    "description": "ETF Vanguard",
    "date": "2026-01-01",
    "amount": 670,
    "type": "Expense",
    "categoryId": "cat_investing",
    "accountId": "acc_checking",
    "tags": []
  }
];
