# Synthetic statement fixtures

Every file here is invented for tests: the names, references, IBAN-like strings and amounts
belong to no real person, business or account. None comes from a real Revolut export.

| File | Layout | Basis |
|---|---|---|
| `personal-standard.csv` | Revolut account statement (Type, Product, Started Date…) | Third-party importers built on real personal exports |
| `business-utc.csv` | Revolut Business-style: UTC and local dates, ID, Payer, Orig/Payment currency, Total amount, Fee currency | Fields named in Revolut's help centre for the Business expenses CSV; the exact header wording is an assumption |
| `ro-money-in-out.csv` | Romanian names, semicolons, `DD.MM.YYYY`, comma decimals, money in / money out | Common Romanian bank CSV conventions (assumption) |
| `minimal-file-currency.csv` | Date, Description, Amount only; currency chosen for the file | Assumption |
| `reordered-quoted.csv` | Standard names in another order, BOM, CRLF, quotes, no Fee or Balance | Assumption |
| `ambiguous-dates.csv` | Slash dates that read both ways | Must ask |
| `ambiguous-decimals.csv` | Amounts like `1,250` with nothing to say which mark is the decimal | Must refuse |
| `unknown-headers.csv` | Headers InFlow doesn't know | Must ask for mapping |
| `conflicting-columns.csv` | Two amount columns | Must ask for mapping |
| `total-amount-only.csv` | Only "Total amount" | Must ask: it may include the fee |
| `malformed-rows.csv` | One bad row of each kind | Each reported by line |
