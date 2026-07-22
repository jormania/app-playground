"""
Manual/local twin of the release-flip half of the nightly pricing cron
(api/clickdeck-pricing.js + api/_lib/clickdeckWatchlist.js) — for triggering
a Coming Soon -> Released check without waiting for the scheduled run, same
relationship force-sync-prices.py already has to the cron's price-checking
half. Mirrors that script's structure deliberately.

Flip rules (kept in sync with api/_lib/clickdeckWatchlist.js — see that
file's header comment for the full rationale):
  - Only considers games currently Coming Soon.
  - Steam's release_date.coming_soon === False is the sole flip signal.
  - Released At is stamped only on the transition, exactly once.
  - A pull-back is never auto-reverted here (see validate-watchlist.py).
"""
import os
import json
import re
import time
import urllib.request
import urllib.parse
import urllib.error
import ssl
from datetime import datetime, timezone

NOTION_TOKEN = os.environ.get("CLICKDECK_NOTION_TOKEN", "YOUR_NOTION_TOKEN_HERE")
DB_ID = os.environ.get("CLICKDECK_DB_ID", "YOUR_DB_ID_HERE")

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

ctx = ssl.create_default_context()
CHUNK_SIZE = 15


def get_coming_soon_games():
    games = []
    cursor = None
    while True:
        payload = {
            "page_size": 100,
            "filter": {
                "property": "Release Status",
                "select": {"equals": "Coming Soon"}
            }
        }
        if cursor:
            payload["start_cursor"] = cursor
        req = urllib.request.Request(
            f"https://api.notion.com/v1/databases/{DB_ID}/query",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, context=ctx) as response:
                data = json.loads(response.read().decode("utf-8"))
                games.extend(data["results"])
                if data.get("has_more"):
                    cursor = data["next_cursor"]
                else:
                    break
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            if "is not a property that exists" in body:
                print("❌ This database doesn't have the Watchlist schema yet — run \"Patch Database for Watchlist Schema\" in the app's Settings first.")
            else:
                print("❌ Failed to fetch games from Notion:", body)
            break
    return games


def extract_year(date_str):
    if not date_str:
        return None
    match = re.search(r"\b(19|20)\d{2}\b", date_str)
    return int(match.group(0)) if match else None


def patch_game(page_id, release_date_str, year, flipped):
    properties = {
        "Release Date": {"rich_text": [{"text": {"content": release_date_str}}] if release_date_str else []}
    }
    if year is not None:
        properties["Release Year"] = {"number": year}
    if flipped:
        properties["Release Status"] = {"select": {"name": "Released"}}
        properties["Released At"] = {"date": {"start": datetime.now(timezone.utc).isoformat()}}

    req = urllib.request.Request(
        f"https://api.notion.com/v1/pages/{page_id}",
        data=json.dumps({"properties": properties}).encode("utf-8"),
        headers=headers,
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req, context=ctx):
            return True
    except urllib.error.HTTPError as e:
        print(f"❌ Failed to patch page {page_id}:", e.read().decode("utf-8"))
        return False


def main():
    if NOTION_TOKEN == "YOUR_NOTION_TOKEN_HERE" or DB_ID == "YOUR_DB_ID_HERE":
        print("Please set CLICKDECK_NOTION_TOKEN and CLICKDECK_DB_ID environment variables.")
        return

    print("Fetching Coming Soon games from Notion...")
    pages = get_coming_soon_games()
    games = []
    for page in pages:
        app_id_val = page["properties"].get("Steam App ID", {}).get("number")
        if app_id_val:
            games.append({"page_id": page["id"], "app_id": int(app_id_val),
                           "title": (page["properties"].get("Title", {}).get("title") or [{}])[0].get("plain_text", "Untitled")})

    if not games:
        print("No Coming Soon games with a Steam App ID found. Nothing to check.")
        return

    print(f"Checking {len(games)} game(s) against Steam...")
    flipped_count = 0
    checked_count = 0

    for i in range(0, len(games), CHUNK_SIZE):
        chunk = games[i:i + CHUNK_SIZE]
        app_ids_str = ",".join(str(g["app_id"]) for g in chunk)
        url = f"https://store.steampowered.com/api/appdetails?appids={app_ids_str}&cc=US&filters=price_overview,release_date"
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, context=ctx) as response:
                steam_data = json.loads(response.read().decode("utf-8"))
        except Exception as e:
            print(f"⚠️  Failed to fetch Steam chunk: {e}")
            continue

        for g in chunk:
            entry = steam_data.get(str(g["app_id"])) if isinstance(steam_data, dict) else None
            if not entry or not entry.get("success"):
                continue
            data = entry.get("data") or {}
            release_date = data.get("release_date") or {}
            coming_soon = release_date.get("coming_soon")
            date_str = release_date.get("date", "")
            year = extract_year(date_str)

            flipped = coming_soon is False
            if patch_game(g["page_id"], date_str, year, flipped):
                checked_count += 1
                if flipped:
                    flipped_count += 1
                    print(f"🎉 {g['title']} — Coming Soon -> Released ({date_str or 'no date given'})")
                else:
                    print(f"   {g['title']} — still coming soon ({date_str or 'TBA'})")
            time.sleep(0.3)

        time.sleep(1)

    print(f"\n✅ Checked {checked_count} game(s), {flipped_count} just flipped to Released.")
    if flipped_count > 0:
        print("Run scripts/validate-watchlist.py to confirm everything is consistent.")


if __name__ == "__main__":
    main()
