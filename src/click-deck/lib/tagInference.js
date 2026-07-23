// Client-side twin of api/_lib/clickdeckTagInference.js — used by the
// manual "Refresh Release Dates" flip path and Discovery's already-released
// add path. Deliberately duplicated rather than imported across the api/
// <-> src/ boundary (same convention as scripts/backfill-steam-ids.py
// mirroring steamMatch.js) — keep the KEYWORD_TAGS table and matching rules
// identical between the two copies if either changes. See the server
// copy's header comment for the full design rationale (why genre
// passthrough alone isn't enough, why Mature/Female Protagonist/LGBTQ+ are
// excluded, the 2026-07-23 Notion schema sync that made all 118 ALL_TAGS
// entries safely writable).

const GENRE_PASSTHROUGH = new Set(['Adventure', 'RPG', 'Indie', 'Casual'])

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

export function inferMatureTag(data) {
  return Number(data?.required_age) >= 17 ? 'Mature' : null
}
