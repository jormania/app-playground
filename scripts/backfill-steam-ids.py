import os
import time
import json
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

def search_steam(title):
    try:
        encoded_title = urllib.parse.quote(title)
        req = urllib.request.Request(f"https://store.steampowered.com/api/storesearch/?term={encoded_title}&l=english&cc=US")
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get("total", 0) > 0:
                # Return the exact or closest match appid
                return data["items"][0]["id"]
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
