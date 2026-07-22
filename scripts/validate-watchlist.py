"""
Read-only sanity check for the Click Deck Watchlist feature — the primary
safety net for the first production run and every run after. Checks every
game against the invariants the feature is designed to hold, cross-checks
Coming Soon / recently-released rows against what Steam actually reports
right now, and prints a summary. Writes nothing back to Notion.

Run this after the first nightly cron / manual refresh, and periodically
after that (a quarterly spot-check, same spirit as verify-steam-names.py).
"""
import os
import json
import re
import time
import urllib.request
import urllib.parse
import urllib.error
import ssl
from datetime import datetime, timezone, timedelta

NOTION_TOKEN = os.environ.get("CLICKDECK_NOTION_TOKEN", "YOUR_NOTION_TOKEN_HERE")
DB_ID = os.environ.get("CLICKDECK_DB_ID", "YOUR_DB_ID_HERE")

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

ctx = ssl.create_default_context()

RECENTLY_RELEASED_WINDOW_DAYS = 365
CHUNK_SIZE = 15


def get_all_games():
    games = []
    cursor = None
    while True:
        payload = {"page_size": 100}
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
            print("❌ Failed to fetch games from Notion:", e.read().decode("utf-8"))
            break
    return games


def parse_game(page):
    props = page["properties"]
    release_status_prop = props.get("Release Status")
    return {
        "id": page["id"],
        "title": (props.get("Title", {}).get("title") or [{}])[0].get("plain_text", "Untitled"),
        "app_id": props.get("Steam App ID", {}).get("number"),
        "has_watchlist_schema": release_status_prop is not None,
        "release_status": (release_status_prop or {}).get("select", {}) and release_status_prop["select"].get("name") if release_status_prop and release_status_prop.get("select") else None,
        "released_at": (props.get("Released At", {}) or {}).get("date", {}).get("start") if props.get("Released At") else None,
        "release_year": props.get("Release Year", {}).get("number")
    }


def fetch_appdetails_batch(app_ids):
    combined = {}
    for i in range(0, len(app_ids), CHUNK_SIZE):
        chunk = app_ids[i:i + CHUNK_SIZE]
        url = f"https://store.steampowered.com/api/appdetails?appids={','.join(str(a) for a in chunk)}&cc=US&filters=basic,release_date"
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, context=ctx) as response:
                data = json.loads(response.read().decode("utf-8"))
                if isinstance(data, dict):
                    combined.update(data)
        except Exception as e:
            print(f"⚠️  Failed to fetch Steam batch: {e}")
        time.sleep(1)
    return combined


def extract_year(date_str):
    if not date_str:
        return None
    match = re.search(r"\b(19|20)\d{2}\b", date_str)
    return int(match.group(0)) if match else None


def main():
    if NOTION_TOKEN == "YOUR_NOTION_TOKEN_HERE" or DB_ID == "YOUR_DB_ID_HERE":
        print("Please set CLICKDECK_NOTION_TOKEN and CLICKDECK_DB_ID environment variables.")
        return

    print("Fetching full collection from Notion...")
    pages = get_all_games()
    games = [parse_game(p) for p in pages]
    print(f"Loaded {len(games)} games.")

    if not any(g["has_watchlist_schema"] for g in games):
        print("ℹ️  No game carries a Release Status property yet — the Watchlist schema patch hasn't been applied (or the collection is empty). Nothing to validate.")
        return

    coming_soon = [g for g in games if g["release_status"] == "Coming Soon"]
    released_with_stamp = [g for g in games if g["release_status"] == "Released" and g["released_at"]]

    # --- Invariant: every Coming Soon game has a Steam App ID ---
    missing_app_id = [g for g in coming_soon if not g["app_id"]]
    if missing_app_id:
        print(f"\n❌ {len(missing_app_id)} Coming Soon game(s) missing a Steam App ID (violates the 'must already have an App ID' rule):")
        for g in missing_app_id:
            print(f"   - {g['title']}")

    # --- Contradiction scan: Released At set but status still Coming Soon ---
    contradictions = [g for g in coming_soon if g["released_at"]]
    if contradictions:
        print(f"\n❌ {len(contradictions)} game(s) have a Released At timestamp but are still marked Coming Soon (contradiction — should have flipped to Released):")
        for g in contradictions:
            print(f"   - {g['title']} (Released At: {g['released_at']})")

    # --- Live Steam cross-check for anything with an App ID we care about ---
    checkable = [g for g in coming_soon + released_with_stamp if g["app_id"]]
    steam_data = fetch_appdetails_batch([g["app_id"] for g in checkable]) if checkable else {}

    missed_flips = []
    pull_backs = []
    backfill_suspects = []

    now = datetime.now(timezone.utc)

    for g in checkable:
        entry = steam_data.get(str(g["app_id"]))
        if not entry or not entry.get("success"):
            continue
        data = entry.get("data") or {}
        coming_soon_flag = (data.get("release_date") or {}).get("coming_soon")
        steam_date_str = (data.get("release_date") or {}).get("date", "")

        if g["release_status"] == "Coming Soon" and coming_soon_flag is False:
            missed_flips.append((g, steam_date_str))

        if g["release_status"] == "Released" and g["released_at"] and coming_soon_flag is True:
            pull_backs.append((g, steam_date_str))

        # Finding-#1 detector: a Released row stamped ~today (within the
        # last 2 days, generous for cron/timezone skew) whose Steam date is
        # clearly from a much earlier year — would indicate a direct-add
        # incorrectly backfilling Released At instead of leaving it null.
        if g["release_status"] == "Released" and g["released_at"]:
            try:
                stamped = datetime.fromisoformat(g["released_at"].replace("Z", "+00:00"))
                stamped_recently = (now - stamped) <= timedelta(days=2)
            except ValueError:
                stamped_recently = False
            steam_year = extract_year(steam_date_str)
            if stamped_recently and steam_year and steam_year < now.year - 1:
                backfill_suspects.append((g, steam_date_str))

    if missed_flips:
        print(f"\n⚠️  {len(missed_flips)} Coming Soon game(s) Steam already reports as released (missed flip — the cron or a manual refresh should catch these on the next run):")
        for g, date_str in missed_flips:
            print(f"   - {g['title']} (Steam says: {date_str})")

    if pull_backs:
        print(f"\n⚠️  {len(pull_backs)} game(s) marked Released now show coming_soon: true again on Steam (pull-back — flagged for manual review, never auto-reverted):")
        for g, date_str in pull_backs:
            print(f"   - {g['title']} (Released At: {g['released_at']}, Steam now says: {date_str})")

    if backfill_suspects:
        print(f"\n❌ {len(backfill_suspects)} game(s) stamped Released At very recently but Steam's own release date looks much older (possible direct-add incorrectly backfilling Released At — see api/_lib/clickdeckWatchlist.js):")
        for g, date_str in backfill_suspects:
            print(f"   - {g['title']} (Released At: {g['released_at']}, Steam says: {date_str})")

    # --- Stale entries: Coming Soon for a long time with no sign of Steam data changing ---
    stale = [g for g in coming_soon if g["release_year"] and g["release_year"] < now.year - 1]
    if stale:
        print(f"\nℹ️  {len(stale)} Coming Soon game(s) have a Release Year well in the past — worth a manual look (delayed indefinitely? cancelled?):")
        for g in stale:
            print(f"   - {g['title']} (Release Year: {g['release_year']})")

    recently_released_count = sum(
        1 for g in released_with_stamp
        if g["released_at"] and (now - datetime.fromisoformat(g["released_at"].replace("Z", "+00:00"))) <= timedelta(days=RECENTLY_RELEASED_WINDOW_DAYS)
    )

    print("\n--- Summary ---")
    print(f"Coming Soon: {len(coming_soon)}")
    print(f"Recently released (last {RECENTLY_RELEASED_WINDOW_DAYS} days): {recently_released_count}")
    print(f"Stale (>1yr past Release Year, still Coming Soon): {len(stale)}")
    issues = len(missing_app_id) + len(contradictions) + len(missed_flips) + len(pull_backs) + len(backfill_suspects)
    if issues == 0:
        print("✅ No issues found.")
    else:
        print(f"⚠️  {issues} item(s) flagged above for review.")


if __name__ == "__main__":
    main()
