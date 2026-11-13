# Google Health (Fitbit) — one link, three uses

Reads the owner's Fitbit Inspire 3 data through the **Google Health API** (v4, the
successor to the Fitbit Web API, launched 2026-03-24; the old Fitbit Web API and its
OAuth endpoints were switched off on 2026-11-02). Read-only, one Google account.

| Use | Where | What it reads |
|---|---|---|
| Claude connector (MCP) | `api/_lib/googleHealth/mcp.js` | everything below, on request |
| Yoru — nights & sleep | `src/yoru/lib/nights.js`, `sleepMatch.js`, `components/SleepNights.jsx` | sleep sessions |
| Touch Grass — the walk | `src/touch-grass/walkStats.js` | steps, distance, floors, heart rate for the walk |

All three go through **one** serverless function, `api/google-health.js` (function 10
of 12, see DEPLOY.md), and the browser apps through `src/shared/googleHealth.ts`.
The one-time link happens on `public/google-health.html`.

## Why it's shaped this way

- **Web apps can't use Health Connect.** On Android the Google Health app also writes
  to Health Connect, but that store is reachable only from a native Android app. A
  PWA has the cloud API or nothing.
- **The refresh token is the only thing stored server-side** (KV key
  `google-health:auth`, the same Upstash store Wanderlist uses). Readings are fetched
  live on each request and returned with `Cache-Control: no-store`. Yoru's night log
  is local to the device; Touch Grass keeps a walk's numbers on its relic, locally.
- **Two keys, not one.** `GOOGLE_HEALTH_APP_KEY` is what the browsers send
  (`x-health-key`); `GOOGLE_HEALTH_MCP_KEY` is the last segment of the connector URL.
  Either can be rotated without breaking the other. Both are compared in constant
  time, and an unset key matches nothing.
- **The MCP server is stateless and SDK-free**: one JSON-RPC message per POST, JSON
  back, 202 for notifications, 405 for GET. Seven read-only tools. A custom connector
  for one person with no OAuth server of its own authenticates by the secret path,
  so that URL is a password.
- **Scopes are the three read-only groups the code reads**: activity & fitness,
  sleep, health metrics. No location, ECG, IRN or reproductive health.

## Setup (once)

1. **Google Cloud project.** Create one, then enable the API:
   `gcloud services enable health.googleapis.com`. This is also the test of whether
   Google is taking new projects: some guides in mid-2026 quoted the docs as "not
   onboarding new projects at this time". If enabling fails, that's the reason, and
   nothing below will work until Google opens access.
2. **OAuth consent screen** (Google Auth Platform): External; add your own Google
   account as a test user; add the three scopes listed in `client.js` (`SCOPES`).
3. **Publishing status.** In *Testing*, Google's refresh tokens expire after **7 days**,
   so every reading stops weekly until you reconnect. For a one-person app, switch
   to *In production* without submitting for verification: you'll see the
   "unverified app" warning at consent (Advanced → Go to …), and you're far below
   the 100-user cap that applies to unverified apps. If Google won't let you publish,
   stay in Testing: the link page shows when the connection lapsed, and Reconnect
   takes ten seconds.
4. **OAuth client**: type *Web application*, authorised redirect URI
   `https://coneofcold.vercel.app/api/google-health/callback` (`vercel.json`
   rewrites it to `?mode=callback`).
5. **Vercel → Environment Variables** (Production):
   - `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET`
   - `GOOGLE_HEALTH_APP_KEY`, `GOOGLE_HEALTH_MCP_KEY`: two different long random
     strings, e.g. `openssl rand -hex 24`
   - KV is already there (`KV_REST_API_URL` / `KV_REST_API_TOKEN`).
6. **Open the Google Health app on the phone** with the same account at least once.
   Otherwise every call fails with `ACCOUNT_NOT_LINKED`.
7. **Link**: open `/google-health.html`, paste the app key, *Save on this device*,
   then *Connect Google Health*. Repeat only the Save on each other browser.
8. **Claude**: Settings → Connectors → Add custom connector, URL
   `https://coneofcold.vercel.app/api/health-mcp/<GOOGLE_HEALTH_MCP_KEY>`, no OAuth.

## The API, as used here

From the discovery document (`https://health.googleapis.com/$discovery/rest?version=v4`):

- `users/me/dataTypes/{type}/dataPoints` (list) with an AIP-160 `filter`. The field
  prefix is the type in snake_case, and each kind has its own civil-time field:
  `daily_*.date`, `steps.interval.civil_start_time`,
  `heart_rate.sample_time.civil_time`, `sleep.interval.civil_end_time`.
  `normalize.js` → `timeFilter` holds the map. Sleep and exercise pages hold 25.
- `…:rollUp` (physical windows, `windowSize: "<n>s"`; heart rate ≤ 14 days, the rest
  ≤ 90) and `…:dailyRollUp` (civil days, ≤ 90 per page).
- int64 values arrive as strings; dates as `{year, month, day}`.
- **Data arrives only when the phone syncs.** A walk read the moment you return is
  often empty, so Touch Grass re-asks for recent empty relics when it opens
  (`walkStats.js`, "Late syncs").

## Endpoint modes

`connect` (POST form) · `callback` · `status` · `disconnect` (POST) · `sleep`
(`from`, `to`) · `window` (`start`, `end`, ≤ 24 h) · `daily` (`from`, `to`) · `mcp`
(POST). The header of `api/google-health.js` is the authoritative list.
`api/_tests/google-health.test.js` pins the gating between them.

## Not done, on purpose

- **No writing back.** The API can write a mindfulness session, so Yoru could log
  each wind-down to Google Health. It would need a write scope and adds nothing to the
  comparison, so it waits until wanted.
- **No webhooks.** The API can notify on new data, but nothing here needs a push:
  every read is on demand.
