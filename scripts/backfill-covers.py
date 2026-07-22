import os
import time
import json
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

def set_cover(page_id, app_id):
    payload = {
        "cover": {
            "type": "external",
            "external": { "url": f"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{app_id}/header.jpg" }
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
            return True
    except urllib.error.HTTPError as e:
        print(f"❌ Failed to update {page_id}:", e.read().decode('utf-8'))
        return False

def main():
    if NOTION_TOKEN == "YOUR_NOTION_TOKEN_HERE" or DB_ID == "YOUR_DB_ID_HERE":
        print("Please set CLICKDECK_NOTION_TOKEN and CLICKDECK_DB_ID environment variables, or hardcode them in the script.")
        return

    print("Fetching games from Notion...")
    games = get_games()
    print(f"Found {len(games)} games.")

    # coverUrl in the app comes from the Notion PAGE's cover image (page.cover),
    # a separate thing entirely from the "Steam App ID" property — a game can
    # have a fully correct App ID and still show the "NO SIGNAL" fallback if
    # its page cover was never set (added directly in Notion, added before the
    # app had a Fetch Cover button, etc). For any game that already has a
    # trusted App ID, the cover is fully deterministic — no fuzzy title search
    # needed, so there's no risk of assigning the wrong image.
    missing = []
    for page in games:
        title = "Unknown"
        if "Title" in page["properties"] and page["properties"]["Title"]["title"]:
            title = page["properties"]["Title"]["title"][0]["plain_text"]
        app_id = page["properties"].get("Steam App ID", {}).get("number")
        has_cover = bool(page.get("cover"))
        if app_id and not has_cover:
            missing.append({"page_id": page["id"], "title": title, "app_id": int(app_id)})

    if not missing:
        print("✅ Every game with a Steam App ID already has a cover set.")
        return

    print(f"Found {len(missing)} game(s) with a Steam App ID but no cover set. Patching...")
    patched = 0
    for g in missing:
        if set_cover(g["page_id"], g["app_id"]):
            print(f"✅ Set cover for '{g['title']}' (App ID {g['app_id']})")
            patched += 1
        time.sleep(0.3)

    print(f"✅ Finished — patched {patched}/{len(missing)} cover(s).")

if __name__ == "__main__":
    main()
