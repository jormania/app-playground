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

ROMAN_NUMERALS = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10,
                   "xi": 11, "xii": 12, "xiii": 13, "xiv": 14, "xv": 15, "xvi": 16, "xvii": 17, "xviii": 18, "xix": 19, "xx": 20}

def convert_roman_numerals(name):
    # Kept in sync with src/click-deck/lib/steamMatch.js's convertRomanNumerals.
    return re.sub(r'\b[ivx]+\b', lambda m: str(ROMAN_NUMERALS[m.group(0)]) if m.group(0) in ROMAN_NUMERALS else m.group(0), name)

def normalize_title(name):
    # Kept in sync with verify-steam-names.py's normalize_title — classic
    # titles are frequently re-listed on Steam with a "Remastered" / "Special
    # Edition" / "20th Anniversary Edition" / "The Final Cut" suffix, which a
    # plain string compare would treat as a non-match.
    if not name: return ""
    name = name.lower()
    name = name.replace('&', 'and')
    name = convert_roman_numerals(name)
    name = re.sub(r'\b(remastered|remaster|edition|director\'?s\s*cut|special|reforged|anniversary|gold|final\s*cut)\b', '', name)
    name = re.sub(r'\b\d+(st|nd|rd|th)\b', '', name)
    name = re.sub(r'\bthe\b', '', name)
    name = re.sub(r'[^a-z0-9]', '', name)
    return name

def containment_score(a, b):
    # How much of the longer string the shorter one actually covers. A bare
    # "one contains the other" check treats a short title like "Norco" as
    # just as confident a match against "Norcopolis Chronicles" (coincidental
    # substring) as against "Norco" itself (the real game) — this ratio is
    # what tells those two apart. 1.0 = identical after normalization.
    if not a or not b:
        return 0
    if a == b:
        return 1
    longer, shorter = (a, b) if len(a) >= len(b) else (b, a)
    if shorter not in longer:
        return 0
    return len(shorter) / len(longer)

# Below this overlap ratio, a "contains" hit is more likely a coincidental
# substring than the actual game — kept in sync with the same threshold in
# src/click-deck/lib/steamMatch.js.
CONFIDENCE_THRESHOLD = 0.5

def search_steam(title):
    try:
        encoded_title = urllib.parse.quote(title)
        req = urllib.request.Request(f"https://store.steampowered.com/api/storesearch/?term={encoded_title}&l=english&cc=US")
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode('utf-8'))
            items = data.get("items", [])
            if not items:
                return None
            # Steam's search is fuzzy-ranked, not exact — score every
            # candidate by normalized-title overlap and take the best one,
            # instead of trusting either the first result or the first one
            # that loosely "contains" the query. The latter was still capable
            # of locking onto a coincidental substring match (e.g. a short
            # title matching an unrelated, much longer listing) purely
            # because of result order.
            target = normalize_title(title)
            best_item, best_score = None, 0
            for item in items:
                score = containment_score(target, normalize_title(item.get("name", "")))
                if score > best_score:
                    best_score, best_item = score, item
            if best_item and best_score >= CONFIDENCE_THRESHOLD:
                return best_item["id"]
            print(f"   (no confident title match among {len(items)} results — skipping rather than guessing)")
            return None
    except Exception as e:
        print(f"Error searching steam for {title}: {e}")
    return None

def update_game_app_id(page_id, app_id):
    payload = {
        "properties": {
            "Steam App ID": {
                "number": app_id
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
            print(f"✅ Updated {page_id} with App ID {app_id}")
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
        
        # Check if App ID already exists
        app_id_prop = page["properties"].get("Steam App ID", {})
        if app_id_prop and app_id_prop.get("number"):
            print(f"⏩ Skipping '{title}' (Already has App ID: {app_id_prop['number']})")
            continue

        print(f"🔍 Searching Steam for '{title}'...")
        app_id = search_steam(title)
        if app_id:
            update_game_app_id(page["id"], app_id)
        else:
            print(f"⚠️  No Steam match found for '{title}'")
        
        # polite rate limit
        time.sleep(1)

if __name__ == "__main__":
    main()
