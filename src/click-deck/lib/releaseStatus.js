// Deliberately its own tiny module, not part of mcp-connector.js — App.test.jsx
// mocks that whole module (`vi.mock('./lib/mcp-connector', ...)`), and any
// export added there would silently become undefined under that mock. This
// helper is pure logic with no Notion/localStorage dependency, so it has no
// reason to ever need mocking in the first place.

// Central "what release status does this game have" reader — treats a
// missing/blank value as 'Released' (an ordinary, already-owned game), which
// covers both games that predate the Watchlist schema patch and games in a
// DB that hasn't been patched at all. Use this everywhere instead of reading
// game.releaseStatus directly.
export const readReleaseStatus = (game) => game?.releaseStatus || 'Released'
export const isComingSoon = (game) => readReleaseStatus(game) === 'Coming Soon'
