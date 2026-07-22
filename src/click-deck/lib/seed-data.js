// Steam header art for the demo seed. Same CDN pattern the Editor's "Fetch Steam"
// button and the pricing cron use, so covers render identically to live entries.
const cover = (appId) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`

// A small, curated demo dataset used ONLY when the app runs without a Notion
// connection (the local-storage fallback the Onboarding Wizard seeds). Once a
// Notion token + database are configured the app reads canonical data straight
// from Notion and this list is never touched. App IDs are verified against the
// live collection, so their box art resolves correctly.
export const PIVOT_TITLES = [
  {
    title: 'Loom', year: 1990, developer: 'LucasArts', status: 'Playing', rating: 4,
    appId: 32340, coverUrl: cover(32340),
    tags: ['SCUMM', 'Fantasy', 'Puzzle-Heavy', 'Atmospheric', 'Classic'],
    journal: "A weaver's apprentice conducts reality with a musical staff. No inventory, no dead ends — just **melody as magic**. Short, strange and quietly *devastating*."
  },
  {
    title: 'The Curse of Monkey Island', year: 1997, developer: 'LucasArts', status: 'Completed', rating: 5,
    appId: 730820, coverUrl: cover(730820),
    tags: ['SCUMM', 'Comedy', 'Pirates', 'Hand-Drawn', 'Classic'],
    journal: "The **hand-drawn** high point of the series. Insult sword-fighting becomes insult *arm-wrestling*, and it somehow works. Peak LucasArts warmth."
  },
  {
    title: 'Sanitarium', year: 1998, developer: 'DreamForge Intertainment', status: 'Completed', rating: 5,
    appId: 284050, coverUrl: cover(284050),
    tags: ['Point & Click', 'Horror', 'Psychological', 'Classic', 'Surreal'],
    journal: "Wake up bandaged in an asylum and it only gets *worse*. A **nightmare** in isometric — deformed children, a comet cult, and dread you can taste."
  },
  {
    title: 'Blade Runner', year: 1997, developer: 'Westwood Studios', status: 'Backlog', rating: null,
    appId: 1678420, coverUrl: cover(1678420),
    tags: ['Sci-Fi', 'Mystery', 'Cyberpunk', 'Point & Click', 'Classic'],
    journal: "Real-time detective work in a rain-soaked **cyberpunk** city, with randomised replicants so no two playthroughs match. Ahead of its time by decades."
  },
  {
    title: 'Machinarium', year: 2009, developer: 'Amanita Design', status: 'Abandoned', rating: null,
    appId: 40700, coverUrl: cover(40700),
    tags: ['Puzzle-Heavy', 'Hand-Drawn', 'Sci-Fi', 'Point & Click', 'Cute'],
    journal: "A tiny rusted robot, a wordless world, and puzzles that occasionally cross into ~~fair~~ *moon logic*. Gorgeous, but I stalled and never returned."
  },
  {
    title: 'Broken Age', year: 2014, developer: 'Double Fine', status: 'Completed', rating: 3,
    appId: 232790, coverUrl: cover(232790),
    tags: ['Sci-Fi', 'Fantasy', 'Comedy', 'Coming of Age', 'Point & Click'],
    journal: "Two teenagers, two worlds, one *gorgeous* storybook look. The first half sings; the second leans on a **tree-swap** puzzle that badly overstays its welcome."
  },
  {
    title: 'Firewatch', year: 2016, developer: 'Campo Santo', status: 'Completed', rating: 4,
    appId: 383870, coverUrl: cover(383870),
    tags: ['Walking Simulator', 'Mystery', 'Narrative', 'Atmospheric', 'First-Person'],
    journal: "A summer alone in a fire tower, a radio, and a voice you fall for. The mystery fizzles, but the **loneliness** lands like a punch."
  },
  {
    title: 'Oxenfree', year: 2016, developer: 'Night School Studio', status: 'Completed', rating: 5,
    appId: 433430, coverUrl: cover(433430),
    tags: ['Supernatural', 'Narrative', 'Coming of Age', 'Dialogue Heavy', 'Mystery'],
    journal: "Teens, a radio, and a **haunted** island time-loop. The overlapping dialogue feels *genuinely* like being seventeen. A modern classic."
  },
  {
    title: 'The Wolf Among Us', year: 2013, developer: 'Telltale Games', status: 'Completed', rating: 4,
    appId: 250320, coverUrl: cover(250320),
    tags: ['Point & Click', 'Noir', 'Episodic', 'Mature', 'Mystery'],
    journal: "Fairy-tale **noir** where the Big Bad Wolf is your sheriff. Telltale at its stylish peak — before the choices stopped *mattering*."
  },
  {
    title: 'Pentiment', year: 2022, developer: 'Obsidian Entertainment', status: 'Completed', rating: 5,
    appId: 1205520, coverUrl: cover(1205520),
    tags: ['Narrative', 'Historical', 'Choices Matter', 'Mystery', 'RPG'],
    journal: "A murder mystery drawn like an illuminated **manuscript**, spanning decades of a Bavarian town. Every dialect and dropped letter is *deliberate*. A masterclass."
  }
]

// Canonical tag universe — kept in sync with the Notion "Tags" multi-select so
// the Editor's tag picker can offer every genre and vibe the collection uses
// (the previous list was missing the most common ones, e.g. "Point & Click").
export const ALL_TAGS = [
  // Formats & interaction
  'Point & Click', 'SCUMM', 'SCUMM-like', 'Text Parser', 'Interactive Drama',
  'Walking Simulator', 'Puzzle', 'Puzzle-Heavy', 'Moon Logic Puzzles',
  'Quick Time Events', 'RPG', 'Party Based', 'FMV', 'Episodic', 'Visual Novel',
  'Interactive Fiction', 'Escape Room',
  // Perspective & art
  '2D', '3D', 'Isometric', 'First-Person', 'Pixel Art', 'Pixel Graphics',
  'Hand-Drawn', 'Comic Book Style', 'Minimalist', 'Cinematic', 'Tank Controls',
  'Voxel', 'Low Poly', 'Cel-Shaded',
  // Genres & settings
  'Sci-Fi', 'Space', 'Cyberpunk', 'Dystopian', 'Post-Apocalyptic', 'Steampunk', 'Fantasy',
  'Urban Fantasy', 'Magical Realism', 'Mythology', 'Horror', 'Psychological Horror',
  'Lovecraftian', 'Transylvania', 'Mystery', 'Detective', 'Thriller', 'Noir', 'Southern Gothic',
  'Americana', 'Historical', 'History', 'Medieval', 'Archaeology', 'Politics', 'Pirates', 'Voodoo',
  'Supernatural', 'Afterlife', 'Alien', 'Automata', 'Submarine', 'Time Travel',
  'Biker', 'Action-Adventure', 'Adventure', 'Exploration', 'Whodunit', 'Heist',
  'Espionage', 'Folklore', 'Cults', 'Amnesia', 'Artificial Intelligence',
  // Tone & themes
  'Comedy', 'Satire', 'Parody', 'Dark Humor', 'Meta', 'Serious', 'Dark', 'Mature', 'Tragedy',
  'Existential', 'Psychological', 'Surreal', 'Atmospheric', 'Cozy', 'Cute',
  'Coming of Age', 'Nostalgia', 'LGBTQ+', 'Music', 'Romance', 'Philosophy',
  'Melancholy', 'Wholesome', 'Gothic',
  // Narrative shape
  'Narrative', 'Story Rich', 'Text-Heavy', 'Dialogue Heavy', 'Choices Matter',
  'Multiple Endings', 'Linear', 'Short', 'Epic', 'Time Loop', 'Non-Linear',
  'Branching',
  // Meta / catalogue
  'Classic', 'Retro', 'Indie', 'Casual', 'Movie Tie-in', 'Magic',
  'Female Protagonist'
]
