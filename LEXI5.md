# Lexi5

**[coneofcold.vercel.app/lexi5-react.html](https://coneofcold.vercel.app/lexi5-react.html)**

A daily 5-letter word challenge built with React and Vite, featuring multiple curated dictionaries, comprehensive statistics, and a clean interface using the shared design system.

## Data & Curation
The game uses three dictionaries that can be switched in Settings for new games:
- **Standard**: The official original 2,309 word answers.
- **Expanded**: The 5,757 words from the Stanford GraphBase frequency list.
- **Expert**: The official list of 13,106 allowed guesses (including obscure words).

The dictionaries are generated via `scripts/curate-lexi5-dictionary.mjs`.

## Game State
State is entirely local to the device and tracked via `localStorage` keys:
- `lexi5_stats`: Lifetime statistics (played, won, streaks, guess distribution).
- `lexi5_game`: The current active game state, keyed to the current date and dictionary.
- `lexi5_config`: User preferences (theme, difficulty, dictionary).

Because the repo is at its Vercel serverless limit, Lexi5 is 100% client-side. The daily word is generated deterministically by hashing the local date.

## Features & Polish
- **Crown Mode vs Infinite**: The first game played each day is the "Crown" word, which tracks its own special streak separate from infinite practice mode.
- **Smart Keyboard**: An optional setting that adds positional memory (small dots) to yellow keys, reminding you which positions you've already tried a letter in.
- **High-Fidelity Social Sharing**: Instead of simple text emojis, the "Share" button utilizes `html2canvas` and the Web Share API to generate and share a clean, beautiful image of your game board.
- **Animations & Haptics**: Full NYT-style animations including tile pops, invalid word shake, and a staggered victory dance. Includes mobile `navigator.vibrate` haptics and a confetti celebration upon beating the Crown word.
- **Hard Mode**: Revealed hints must be used in subsequent guesses.
- **PWA**: Fully installable as an offline-first app, registered in The Cabinet.
