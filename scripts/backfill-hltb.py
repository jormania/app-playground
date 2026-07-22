import os
import time
import json
import re
import urllib.parse
import urllib.request
import urllib.error
import ssl

# Replace these with your actual Notion token and DB ID if not set in environment
NOTION_TOKEN = os.environ.get("CLICKDECK_NOTION_TOKEN", "YOUR_NOTION_TOKEN_HERE")
DB_ID = os.environ.get("CLICKDECK_DB_ID", "YOUR_DB_ID_HERE")

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

ctx = ssl.create_default_context()

# HowLongToBeat has no official API — this mirrors api/clickdeck-hltb.js's
# reverse-engineered two-step handshake exactly (see that file's header
# comment for the full rationale and how it was found). Keep the two in sync
# if HLTB ever changes their bundle; this is the single most likely thing in
# R2 to silently start failing.
HLTB_BASE = "https://howlongtobeat.com"
HLTB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"

def get_games():
    games = []
    cursor = None
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor

        req = urllib.request.Request(
            f"https://api.notion.com/v1/databases/{DB_ID}/query",
            data=json.dumps(payload).encode('utf-8'),
            headers=headers,
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, context=ctx) as response:
                data = json.loads(response.read().decode('utf-8'))
                games.extend(data["results"])
                if data.get("has_more"):
                    cursor = data["next_cursor"]
                else:
                    break
        except urllib.error.HTTPError as e:
            print("Failed to fetch games:", e.read().decode('utf-8'))
            break
    return games

def normalize_title(name):
    # Kept in sync with src/click-deck/lib/hltbMatch.js's normalizeHltbTitle.
    if not name: return ""
    name = name.lower()
    name = name.replace('&', 'and')
    name = re.sub(r'\b(remastered|remaster|edition|director\'?s\s*cut|special|reforged|anniversary|gold|final\s*cut)\b', '', name)
    name = re.sub(r'\b\d+(st|nd|rd|th)\b', '', name)
    name = re.sub(r'\bthe\b', '', name)
    name = re.sub(r'[^a-z0-9]', '', name)
    return name

def containment_score(a, b):
    # Kept in sync with the same helper in src/click-deck/lib/hltbMatch.js.
    if not a or not b:
        return 0
    if a == b:
        return 1
    longer, shorter = (a, b) if len(a) >= len(b) else (b, a)
    if shorter not in longer:
        return 0
    return len(shorter) / len(longer)

CONFIDENCE_THRESHOLD = 0.5

def hltb_init():
    req = urllib.request.Request(
        f"{HLTB_BASE}/api/bleed/init?t={int(time.time() * 1000)}",
        headers={"User-Agent": HLTB_UA, "Referer": f"{HLTB_BASE}/"}
    )
    with urllib.request.urlopen(req, context=ctx) as response:
        data = json.loads(response.read().decode('utf-8'))
        if not data.get("token") or not data.get("hpKey"):
            raise RuntimeError("HLTB init response missing token/hpKey — their search handshake likely changed.")
        return data

def search_hltb(title):
    try:
        init = hltb_init()
        body = {
            "searchType": "games",
            "searchTerms": title.strip().split(),
            "searchPage": 1,
            "size": 20,
            "searchOptions": {
                "games": {
                    "userId": 0, "platform": "", "sortCategory": "popular", "rangeCategory": "main",
                    "rangeTime": {"min": None, "max": None},
                    "gameplay": {"perspective": "", "flow": "", "genre": "", "difficulty": ""},
                    "rangeYear": {"min": "", "max": ""},
                    "modifier": ""
                },
                "users": {"sortCategory": "postcount"},
                "lists": {"sortCategory": "follows"},
                "filter": "", "sort": 0, "randomizer": 0
            },
            "useCache": True,
            init["hpKey"]: init["hpVal"]
        }
        req = urllib.request.Request(
            f"{HLTB_BASE}/api/bleed",
            data=json.dumps(body).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "User-Agent": HLTB_UA,
                "Referer": f"{HLTB_BASE}/",
                "x-auth-token": init["token"],
                "x-hp-key": init["hpKey"],
                "x-hp-val": init["hpVal"]
            },
            method="POST"
        )
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode('utf-8'))
            # comp_plus is HLTB's "Main + Extra" stat — the app labels it
            # "Main + Sides", same number, friendlier label. A less-played or
            # newer title can have zero submissions for that specific stat
            # while still having a real "Main Story" (comp_main) number on
            # file — fall back to that rather than excluding the game
            # outright. Only skipped when NEITHER stat has any data.
            items = []
            for g in data.get("data", []):
                seconds = g.get("comp_plus", 0) or g.get("comp_main", 0)
                if seconds > 0:
                    items.append((g, seconds))
            if not items:
                return None
            target = normalize_title(title)
            best_item, best_seconds, best_score = None, 0, 0
            for item, seconds in items:
                score = containment_score(target, normalize_title(item.get("game_name", "")))
                if score > best_score:
                    best_score, best_item, best_seconds = score, item, seconds
            if best_item and best_score >= CONFIDENCE_THRESHOLD:
                return round(best_seconds / 3600, 1)
            print(f"   (no confident title match among {len(items)} results — skipping rather than guessing)")
            return None
    except Exception as e:
        print(f"Error searching HLTB for {title}: {e}")
    return None

def update_game_length(page_id, hours):
    payload = {
        "properties": {
            "Length (hrs)": {
                "number": hours
            }
        }
    }
    req = urllib.request.Request(
        f"https://api.notion.com/v1/pages/{page_id}",
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            print(f"✅ Updated {page_id} with Length {hours}h")
    except urllib.error.HTTPError as e:
        print(f"❌ Failed to update {page_id}:", e.read().decode('utf-8'))

def main():
    if NOTION_TOKEN == "YOUR_NOTION_TOKEN_HERE" or DB_ID == "YOUR_DB_ID_HERE":
        print("Please set CLICKDECK_NOTION_TOKEN and CLICKDECK_DB_ID environment variables, or hardcode them in the script.")
        return

    print("Fetching games from Notion...")
    games = get_games()
    print(f"Found {len(games)} games.")

    for page in games:
        title = "Unknown"
        if "Title" in page["properties"] and page["properties"]["Title"]["title"]:
            title = page["properties"]["Title"]["title"][0]["plain_text"]

        # Skip games that already have a length — this is a one-off fill-the-
        # blanks pass; use the Editor's FETCH HLTB button to fix a bad match.
        length_prop = page["properties"].get("Length (hrs)", {})
        if length_prop and length_prop.get("number") is not None:
            print(f"⏩ Skipping '{title}' (Already has Length: {length_prop['number']}h)")
            continue

        print(f"🔍 Searching HLTB for '{title}'...")
        hours = search_hltb(title)
        if hours is not None:
            update_game_length(page["id"], hours)
        else:
            print(f"⚠️  No HLTB match found for '{title}'")

        # polite rate limit — two HTTP round-trips (init + search) per title.
        time.sleep(1.5)

if __name__ == "__main__":
    main()
