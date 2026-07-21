import os
import json
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

def update_game_price(page_id, new_price, discount=0, initial=None, price_changed=True):
    # Price Updated At is stamped on every successful Steam check, changed or
    # not — it's the "did we actually check" signal StatsView reads to show
    # the sync is alive. The price fields themselves only get rewritten when
    # they differ, so stable-priced games don't churn Notion's edit history.
    properties = {
        "Price Updated At": { "date": { "start": datetime.now(timezone.utc).isoformat() } }
    }
    if price_changed:
        if initial is None: initial = new_price
        properties["Current Price"] = { "number": new_price }
        properties["Discount Percent"] = { "number": discount / 100.0 }
        properties["Initial Price"] = { "number": initial }
    payload = { "properties": properties }
    req = urllib.request.Request(
        f"https://api.notion.com/v1/pages/{page_id}",
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            pass
    except urllib.error.HTTPError as e:
        print(f"Failed to update page {page_id}:", e.read().decode('utf-8'))

def main():
    if NOTION_TOKEN == "YOUR_NOTION_TOKEN_HERE" or DB_ID == "YOUR_DB_ID_HERE":
        print("Please set CLICKDECK_NOTION_TOKEN and CLICKDECK_DB_ID environment variables.")
        return

    print("Fetching games with Steam App IDs from Notion...")
    pages = get_games_with_app_ids()
    games_to_update = []
    
    for page in pages:
        app_id_val = page["properties"]["Steam App ID"]["number"]
        app_id = int(app_id_val) if app_id_val is not None else 0
        current_price = page["properties"].get("Current Price", {}).get("number")
        current_discount = page["properties"].get("Discount Percent", {}).get("number")
        if current_discount is not None: current_discount = int(current_discount * 100)
        else: current_discount = 0
        current_initial = page["properties"].get("Initial Price", {}).get("number")
        
        if app_id > 0:
            games_to_update.append({
                "page_id": page["id"],
                "app_id": app_id,
                "current_price": current_price,
                "current_discount": current_discount,
                "current_initial": current_initial
            })

    if not games_to_update:
        print("No games found with Steam App IDs.")
        return

    print(f"Found {len(games_to_update)} games. Querying Steam in chunks...")
    
    CHUNK_SIZE = 15
    results = []

    for i in range(0, len(games_to_update), CHUNK_SIZE):
        chunk = games_to_update[i:i + CHUNK_SIZE]
        app_ids_str = ",".join([str(g["app_id"]) for g in chunk])
        
        url = f"https://store.steampowered.com/api/appdetails?appids={app_ids_str}&cc=US&filters=price_overview"
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, context=ctx) as response:
                steam_data = json.loads(response.read().decode('utf-8'))
                
                if isinstance(steam_data, dict):
                    for game in chunk:
                        app_id_str = str(game["app_id"])
                        app_data = steam_data.get(app_id_str)
                        
                        if isinstance(app_data, dict):
                            data_obj = app_data.get("data")
                            if app_data.get("success") and isinstance(data_obj, dict) and data_obj.get("price_overview"):
                                new_price = data_obj["price_overview"]["final"] / 100.0
                                discount = data_obj["price_overview"].get("discount_percent", 0)
                                initial = data_obj["price_overview"].get("initial", data_obj["price_overview"]["final"]) / 100.0
                                price_changed = (new_price != game["current_price"] or discount != game["current_discount"] or initial != game["current_initial"])
                                results.append({
                                    "page_id": game["page_id"],
                                    "new_price": new_price,
                                    "discount": discount,
                                    "initial": initial,
                                    "price_changed": price_changed
                                })
                            elif app_data.get("success"):
                                # Free or unavailable
                                price_changed = (game["current_price"] != 0.0 or game["current_discount"] != 0)
                                results.append({"page_id": game["page_id"], "new_price": 0.0, "discount": 0, "initial": 0.0, "price_changed": price_changed})
                            else:
                                print(f"Skipping app_id {app_id_str}: success is False (delisted or region locked)")
                        else:
                            print(f"Skipping app_id {app_id_str}: app_data is not a dict (got {type(app_data)})")
        except Exception as e:
            print(f"Failed to fetch chunk from Steam: {e}")
            
        time.sleep(1) # Polite delay

    if not results:
        print("No games could be checked against Steam (all requests failed).")
        return

    changed_count = sum(1 for r in results if r["price_changed"])
    print(f"Checked {len(results)} games against Steam ({changed_count} price change(s)). Patching Notion...")

    patched = 0
    for res in results:
        update_game_price(res["page_id"], res["new_price"], res.get("discount", 0), res.get("initial", res["new_price"]), res["price_changed"])
        patched += 1
        tag = f"Price: {res['new_price']}, Discount: {res.get('discount', 0)}%" if res["price_changed"] else "date refresh only, price unchanged"
        print(f"Patched {patched}/{len(results)} ({tag})")
        time.sleep(0.3)

    print("✅ Finished updating prices!")

if __name__ == "__main__":
    main()
