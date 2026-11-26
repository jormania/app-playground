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
| `en-GB.csv` | English headers, `14/09/2026 08:12` (day first) | App in UK English (assumed) |
| `en-US.csv` | English headers, `09/14/2026 8:12 AM` (month first, 12-hour) | App in US English (assumed) |
| `de-DE.csv` | German headers, states and types; `;`, `1.500,00`, `01.09.2026` | App in German (assumed translation) |
| `fr-FR.csv` | French headers and states; no-break spaces between thousands, U+2212 minus | App in French (the format a Revolut user reported; headers assumed) |
| `es-ES.csv` | Spanish headers, dates in words (`5 de septiembre de 2026`) | App in Spanish (assumed) |
| `nl-NL.csv` | Unsigned amounts with an Af/Bij column, currency in the header, `20260903` | A common Dutch bank layout (assumed) |
| `sv-SE-unknown.csv` | A language InFlow has no words for: amount header and state values unknown | Must ask |
| `bg-BG-headers.csv` | Cyrillic headers | Must ask, with the picker suggested from the content |
