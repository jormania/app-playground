import os
import json
import urllib.request
import urllib.parse
import ssl
import re

if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                os.environ[k] = v.strip("'\"")

NOTION_TOKEN = os.environ.get("CLICKDECK_NOTION_TOKEN", "")
DB_ID = os.environ.get("CLICKDECK_DB_ID", "")

if not NOTION_TOKEN or not DB_ID:
    print("Error: CLICKDECK_NOTION_TOKEN and CLICKDECK_DB_ID must be set.")
    exit(1)

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

ctx = ssl.create_default_context()

THEMES = [
    {
        "keywords": ["horror", "terrifying", "creepy", "macabre", "murder", "death", "blood", "fear", "scare", "scary", "gruesome", "tension", "claustrophobic"],
        "format": {"color": "red", "bold": True}
    },
    {
        "keywords": ["cyberpunk", "hacking", "neon", "sci-fi", "future", "robot", "ai", "technology", "dystopian", "space", "synth", "cyber"],
        "format": {"color": "purple", "italic": True}
    },
    {
        "keywords": ["mystery", "detective", "puzzle", "clue", "enigma", "investigation", "noir", "secret", "hidden", "truth"],
        "format": {"color": "blue"}
    },
    {
        "keywords": ["classic", "masterpiece", "brilliant", "beautiful", "gorgeous", "stunning", "amazing", "incredible", "masterclass"],
        "format": {"color": "orange", "bold": True}
    },
    {
        "keywords": ["funny", "comedy", "hilarious", "humor", "satire", "sarcastic", "cynical", "laugh", "joke", "witty"],
        "format": {"color": "green", "italic": True}
    },
    {
        "keywords": ["atmospheric", "vibe", "mood", "soundtrack", "music", "art", "pixel", "isometric", "graphics", "visuals"],
        "format": {"color": "pink"}
    },
    {
        "keywords": ["story", "narrative", "plot", "writing", "characters", "dialogue", "choice", "consequence"],
        "format": {"color": "yellow", "underline": True}
    }
]

keyword_to_theme = {}
for theme in THEMES:
    for kw in theme["keywords"]:
        keyword_to_theme[kw.lower()] = theme["format"]

all_kws = list(keyword_to_theme.keys())
all_kws.sort(key=len, reverse=True)
regex_pattern = r'\b(' + '|'.join(re.escape(kw) for kw in all_kws) + r')\b'
keyword_regex = re.compile(regex_pattern, re.IGNORECASE)

def get_pages():
    pages = []
    cursor = None
    while True:
        payload = {
            "page_size": 100,
            "filter": {
                "property": "Journal/Notes",
                "rich_text": { "is_not_empty": True }
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
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode('utf-8'))
            pages.extend(data["results"])
            if data.get("has_more"):
                cursor = data["next_cursor"]
            else:
                break
    return pages

def why_not_plain_text(rich_text_array):
    # Same checks as is_plain_text, but returns a human-readable reason
    # instead of a bool, so a 0-dramatized run can actually be diagnosed
    # instead of guessed at.
    if len(rich_text_array) != 1:
        return f"has {len(rich_text_array)} rich_text runs (expected exactly 1 for untouched plain text)"
    rt = rich_text_array[0]
    if rt.get("type") != "text":
        return f"run type is {rt.get('type')!r}, not 'text' (e.g. a mention or equation)"
    annots = rt.get("annotations", {})
    active = [k for k in ("bold", "italic", "strikethrough", "underline", "code") if annots.get(k)]
    if annots.get("color") and annots.get("color") != "default":
        active.append(f"color={annots.get('color')}")
    if active:
        return f"already has formatting: {', '.join(active)}"
    return None

def is_plain_text(rich_text_array):
    return why_not_plain_text(rich_text_array) is None

# A caption-length entry can plausibly contain half a dozen theme keywords
# (praise words like "beautiful"/"brilliant"/"incredible"/"masterclass" and
# generic descriptors like "art"/"puzzle"/"characters" are common in review
# writing) — highlighting all of them turns a third of the sentence into
# colored text, which reads as noise rather than a punchy accent. Capping
# keeps it to a small number of accents per entry.
MAX_HIGHLIGHTS_PER_ENTRY = 3

def dramatize_text(text):
    segments = []
    last_end = 0
    highlighted = 0
    for match in keyword_regex.finditer(text):
        start, end = match.span()
        matched_word = match.group(1)

        if highlighted >= MAX_HIGHLIGHTS_PER_ENTRY:
            break

        if start > last_end:
            segments.append({
                "type": "text",
                "text": { "content": text[last_end:start] }
            })

        fmt = keyword_to_theme[matched_word.lower()]
        annot = {
            "bold": fmt.get("bold", False),
            "italic": fmt.get("italic", False),
            "strikethrough": False,
            "underline": fmt.get("underline", False),
            "code": False,
            "color": fmt.get("color", "default")
        }
        segments.append({
            "type": "text",
            "text": { "content": matched_word },
            "annotations": annot
        })

        last_end = end
        highlighted += 1

    if last_end < len(text):
        segments.append({
            "type": "text",
            "text": { "content": text[last_end:] }
        })

    return segments

def update_page(page_id, new_rich_text):
    payload = {
        "properties": {
            "Journal/Notes": {
                "rich_text": new_rich_text
            }
        }
    }
    req = urllib.request.Request(
        f"https://api.notion.com/v1/pages/{page_id}",
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method="PATCH"
    )
    with urllib.request.urlopen(req, context=ctx) as response:
        return response.status == 200

def main():
    print("Fetching pages...")
    pages = get_pages()
    print(f"Found {len(pages)} pages with Journal/Notes.")

    updated_count = 0
    already_styled_count = 0
    no_match_count = 0
    for page in pages:
        title = "Unknown"
        if "Title" in page["properties"] and page["properties"]["Title"]["title"]:
            title = page["properties"]["Title"]["title"][0]["plain_text"]

        rich_text_array = page["properties"]["Journal/Notes"]["rich_text"]

        skip_reason = why_not_plain_text(rich_text_array)
        if skip_reason:
            already_styled_count += 1
            print(f"⏩ Skipping '{title}': {skip_reason}")
            continue

        plain_text = rich_text_array[0]["text"]["content"]
        new_rich_text = dramatize_text(plain_text)

        if len(new_rich_text) > 1:
            print(f"Dramatizing: {title}")
            try:
                update_page(page["id"], new_rich_text)
                updated_count += 1
            except Exception as e:
                print(f"Failed to update {title}: {e}")
        else:
            no_match_count += 1
            print(f"⏩ Skipping '{title}': no theme keyword found in the text")

    print(f"\nFinished! Dramatized {updated_count} entries. ({already_styled_count} already styled, {no_match_count} had no matching keyword, {len(pages)} total)")

if __name__ == "__main__":
    main()
