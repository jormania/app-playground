// Maps Steam signals (genres + marketing text) onto Click Deck's own curated
// Tags vocabulary (ALL_TAGS in src/click-deck/lib/seed-data.js — duplicated
// here rather than imported, same api/<->src boundary convention as every
// other twin pair in this codebase, e.g. steamMatch.js/backfill-steam-ids.py).
// Steam's own genre list is broad and generic (Adventure, Indie, RPG,
// Casual, Action, Simulation...) — only a handful of those words happen to
// match a real Click Deck tag; the rest of the signal has to come from
// scanning Steam's own description text for the same kind of specific,
// flavorful language a human curator would use (noir, psychological horror,
// choices matter, southern gothic, etc.). This is what replaced a prior,
// much weaker version that just pasted Steam's raw genre list in verbatim —
// usually only 2-3 generic words, nowhere near the collection's 5-7 tag
// policy, and now safely writable at all since all 118 ALL_TAGS entries are
// registered as real Notion multi_select options (2026-07-23 schema sync;
// before that, several of these — Folklore, Melancholy, Whodunit, Heist,
// Romance, etc. — would 400 the entire PATCH if ever written).
//
// Two tags are deliberately EXCLUDED from inference, not by oversight:
//   - Mature: Steam's own `required_age` field is a far more reliable
//     signal than guessing from marketing copy — see inferMatureTag below.
//   - Female Protagonist, LGBTQ+: identity attributes aren't something to
//     guess at from promotional text; these stay human-assigned only.

// Steam's genre strings that happen to be exact matches for a real Click
// Deck tag. Everything else Steam might return (Action, Simulation,
// Strategy, Racing, Sports, Massively Multiplayer, Free to Play, Early
// Access, ...) has no ALL_TAGS equivalent and is silently dropped rather
// than invented.
const GENRE_PASSTHROUGH = new Set(['Adventure', 'RPG', 'Indie', 'Casual'])

// [phrase(s), tag] — every phrase in the same entry maps to the same tag.
// Checked independently (not mutually exclusive / not span-consuming), so a
// description containing both "psychological horror" and "detective" adds
// both Psychological Horror and Detective — tags aren't meant to be
// exclusive genre labels. Phrases were reviewed for common false-positive
// wording ("cult classic" vs. an actual cult, "available on Android" vs.
// Automata, "AI" as a common short word) and tightened accordingly — see
// project memory for the specific cases found during design.
const KEYWORD_TAGS = [
  [['point-and-click', 'point & click', 'point and click'], 'Point & Click'],
  [['text parser'], 'Text Parser'],
  [['interactive drama'], 'Interactive Drama'],
  [['walking simulator'], 'Walking Simulator'],
  [['visual novel'], 'Visual Novel'],
  [['interactive fiction'], 'Interactive Fiction'],
  [['escape room'], 'Escape Room'],
  [['party-based', 'party based'], 'Party Based'],
  [['full motion video', 'fmv'], 'FMV'],
  [['episodic'], 'Episodic'],
  [['pixel art'], 'Pixel Art'],
  [['hand-drawn', 'hand drawn'], 'Hand-Drawn'],
  [['comic book', 'graphic novel'], 'Comic Book Style'],
  [['minimalist'], 'Minimalist'],
  [['cinematic'], 'Cinematic'],
  [['voxel'], 'Voxel'],
  [['low poly', 'low-poly'], 'Low Poly'],
  [['cel-shaded', 'cel shaded'], 'Cel-Shaded'],
  [['first-person', 'first person'], 'First-Person'],
  [['isometric'], 'Isometric'],
  [['science fiction', 'sci-fi', 'sci fi'], 'Sci-Fi'],
  [['cyberpunk'], 'Cyberpunk'],
  [['dystopian', 'dystopia'], 'Dystopian'],
  [['post-apocalyptic', 'post apocalyptic', 'post-apocalypse'], 'Post-Apocalyptic'],
  [['steampunk'], 'Steampunk'],
  [['urban fantasy'], 'Urban Fantasy'],
  [['magical realism'], 'Magical Realism'],
  [['fantasy'], 'Fantasy'],
  [['mythology', 'mythological'], 'Mythology'],
  [['psychological horror'], 'Psychological Horror'],
  [['lovecraftian', 'cosmic horror'], 'Lovecraftian'],
  [['horror'], 'Horror'],
  [['transylvania', 'vampire', 'vampires'], 'Transylvania'],
  [['detective'], 'Detective'],
  [['mystery'], 'Mystery'],
  [['thriller'], 'Thriller'],
  [['noir'], 'Noir'],
  [['southern gothic'], 'Southern Gothic'],
  [['americana'], 'Americana'],
  [['historical'], 'Historical'],
  [['medieval'], 'Medieval'],
  [['archaeology', 'archaeologist'], 'Archaeology'],
  [['politics', 'political'], 'Politics'],
  [['pirates', 'pirate'], 'Pirates'],
  [['voodoo'], 'Voodoo'],
  [['supernatural'], 'Supernatural'],
  [['afterlife'], 'Afterlife'],
  [['alien', 'aliens'], 'Alien'],
  [['automata', 'automaton', 'robots', 'robot'], 'Automata'],
  [['submarine'], 'Submarine'],
  [['time travel', 'time-travel'], 'Time Travel'],
  [['biker', 'motorcycle'], 'Biker'],
  [['exploration'], 'Exploration'],
  [['whodunit'], 'Whodunit'],
  [['heist'], 'Heist'],
  [['espionage', 'spies', 'spy'], 'Espionage'],
  [['folklore', 'folk tale', 'folktale'], 'Folklore'],
  [['cults', 'cultists'], 'Cults'],
  [['amnesia', 'memory loss'], 'Amnesia'],
  [['artificial intelligence'], 'Artificial Intelligence'],
  [['dark humor', 'dark comedy'], 'Dark Humor'],
  [['comedy', 'comedic', 'hilarious', 'humor', 'humour', 'funny'], 'Comedy'],
  [['satire', 'satirical'], 'Satire'],
  [['parody'], 'Parody'],
  [['fourth wall', 'fourth-wall'], 'Meta'],
  [['tragedy', 'tragic'], 'Tragedy'],
  [['existential', 'existentialism'], 'Existential'],
  [['psychological'], 'Psychological'],
  [['surreal', 'surrealist', 'dreamlike'], 'Surreal'],
  [['atmospheric'], 'Atmospheric'],
  [['cozy'], 'Cozy'],
  [['charming', 'whimsical'], 'Cute'],
  [['coming-of-age', 'coming of age'], 'Coming of Age'],
  [['nostalgia', 'nostalgic'], 'Nostalgia'],
  [['romance', 'romantic'], 'Romance'],
  [['philosophy', 'philosophical'], 'Philosophy'],
  [['melancholy', 'melancholic', 'bittersweet'], 'Melancholy'],
  [['wholesome'], 'Wholesome'],
  [['gothic'], 'Gothic'],
  [['story-rich', 'story rich'], 'Story Rich'],
  [['narrative-driven', 'narrative'], 'Narrative'],
  [['text-heavy', 'text heavy'], 'Text-Heavy'],
  [['dialogue-heavy', 'dialogue heavy'], 'Dialogue Heavy'],
  [['choices matter', 'your choices', 'branching narrative'], 'Choices Matter'],
  [['multiple endings'], 'Multiple Endings'],
  [['non-linear', 'nonlinear'], 'Non-Linear'],
  [['branching'], 'Branching'],
  [['time loop', 'time-loop', 'groundhog day'], 'Time Loop'],
  [['epic'], 'Epic'],
  [['classic'], 'Classic'],
  [['retro'], 'Retro'],
  [['movie tie-in', 'based on the film', 'based on the movie'], 'Movie Tie-in'],
  [['magical', 'magic'], 'Magic'],
  [['space'], 'Space'],
  [['dark'], 'Dark']
]

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const KEYWORD_PATTERNS = KEYWORD_TAGS.map(([phrases, tag]) => [
  new RegExp(`\\b(${phrases.map(escapeRegExp).join('|')})\\b`, 'i'),
  tag
])

const MAX_TAGS = 7

// `genres` is Steam appdetails' `data.genres` (array of {description}).
// `textFields` is any mix of short_description/about_the_game/
// detailed_description — HTML is stripped before matching. Returns a
// deduped array of Click Deck tags, capped at 7 (the collection's own tag
// ceiling) — genre passthrough first (most reliable), then keyword matches
// in dictionary order. May return fewer than 5; callers should NOT pad this
// out with invented tags — Analytics' existing "TAGS: Under 5" filter is
// the intended net for entries that need a human top-up.
export function inferTagsFromSteamData(genres, textFields) {
  const tags = []
  const seen = new Set()
  const add = (tag) => {
    if (!seen.has(tag)) {
      seen.add(tag)
      tags.push(tag)
    }
  }

  for (const g of genres || []) {
    const name = g?.description
    if (name && GENRE_PASSTHROUGH.has(name)) add(name)
  }

  const combinedText = (textFields || [])
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]+>/g, ' ')

  for (const [regex, tag] of KEYWORD_PATTERNS) {
    if (tags.length >= MAX_TAGS) break
    if (regex.test(combinedText)) add(tag)
  }

  return tags.slice(0, MAX_TAGS)
}

// Steam's own `required_age` is a more reliable "Mature" signal than
// guessing from marketing copy (which almost never says "mature" outright).
// Kept as a separate, tiny helper rather than folded into the keyword table
// so callers can opt in independently.
export function inferMatureTag(data) {
  return Number(data?.required_age) >= 17 ? 'Mature' : null
}
