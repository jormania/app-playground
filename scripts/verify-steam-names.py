import os
import json
import time
import urllib.request
import urllib.parse
import urllib.error
import ssl
import re

NOTION_TOKEN = os.environ.get("CLICKDECK_NOTION_TOKEN", "YOUR_NOTION_TOKEN_HERE")
DB_ID = os.environ.get("CLICKDECK_DB_ID", "YOUR_DB_ID_HERE")

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

ctx = ssl.create_default_context()

def get_games_with_app_ids():
    games = []
    cursor = None
    while True:
        payload = {
            "page_size": 100,
            "filter": {
                "property": "Steam App ID",
                "number": { "is_not_empty": True }
            }
        }
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
            print("Failed to fetch games from Notion:", e.read().decode('utf-8'))
            break
    return games

def normalize_name(name):
    if not name: return ""
    name = name.lower()
    # remove all non-alphanumeric characters
    name = re.sub(r'[^a-z0-9]', '', name)
    # remove common suffixes
    name = re.sub(r'edition$', '', name)
    name = re.sub(r'directorscut$', '', name)
    name = re.sub(r'^the', '', name)
    return name

def is_similar(notion_name, steam_name):
    norm_notion = normalize_name(notion_name)
    norm_steam = normalize_name(steam_name)
    if not norm_notion or not norm_steam:
        return False
    # If one contains the other entirely, it's probably fine
    if norm_notion in norm_steam or norm_steam in norm_notion:
        return True
    return False

def main():
    if NOTION_TOKEN == "YOUR_NOTION_TOKEN_HERE" or DB_ID == "YOUR_DB_ID_HERE":
        print("Please set CLICKDECK_NOTION_TOKEN and CLICKDECK_DB_ID environment variables.")
        return

    print("Fetching games with Steam App IDs from Notion...")
    pages = get_games_with_app_ids()
    games_to_verify = []
    
    for page in pages:
        app_id_val = page["properties"]["Steam App ID"]["number"]
        app_id = int(app_id_val) if app_id_val is not None else 0
        # In Notion, title is in the "Name" property, which is a title array
        try:
            title_arr = page["properties"]["Name"]["title"]
            notion_name = "".join([t["plain_text"] for t in title_arr])
        except KeyError:
            notion_name = "Unknown"

        if app_id > 0:
            games_to_verify.append({
                "notion_name": notion_name,
                "app_id": app_id,
                "page_id": page["id"]
            })

    if not games_to_verify:
        print("No games found with Steam App IDs.")
        return

    print(f"Verifying {len(games_to_verify)} games against Steam...\n")
    
    CHUNK_SIZE = 15
    mismatches = []

    for i in range(0, len(games_to_verify), CHUNK_SIZE):
        chunk = games_to_verify[i:i + CHUNK_SIZE]
        app_ids_str = ",".join([str(g["app_id"]) for g in chunk])
        
        url = f"https://store.steampowered.com/api/appdetails?appids={app_ids_str}&cc=US&filters=basic"
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, context=ctx) as response:
                steam_data = json.loads(response.read().decode('utf-8'))
                
                if isinstance(steam_data, dict):
                    for game in chunk:
                        app_id_str = str(int(game["app_id"]))
                        app_data = steam_data.get(app_id_str)
                        
                        if isinstance(app_data, dict) and app_data.get("success"):
                            data_obj = app_data.get("data", {})
                            if isinstance(data_obj, dict):
                                steam_name = data_obj.get("name", "")
                                
                                if steam_name and not is_similar(game["notion_name"], steam_name):
                                    mismatches.append({
                                        "notion": game["notion_name"],
                                        "steam": steam_name,
                                        "app_id": game["app_id"]
                                    })
                        elif isinstance(app_data, dict) and not app_data.get("success"):
                            print(f"[!] App ID {game['app_id']} ({game['notion_name']}) returned success: false on Steam (Delisted?)")
        except Exception as e:
            print(f"Failed to fetch chunk from Steam: {e}")
            
        time.sleep(1)

    print("\n--- Verification Complete ---")
    if mismatches:
        print(f"Found {len(mismatches)} potential mismatches:")
        for m in mismatches:
            print(f"❌ Notion: '{m['notion']}'  -->  Steam: '{m['steam']}' (ID: {m['app_id']})")
    else:
        print("All games seem to match reasonably well!")

if __name__ == "__main__":
    main()
