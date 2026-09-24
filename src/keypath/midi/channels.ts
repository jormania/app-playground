/**
 * Channels the player's own keys arrive on. Measured on the PSR-E383 (S24,
 * 2026-09-24, KEYPATH.md §1): keys on 1, Split's left hand on 3; a Style's
 * drums on 9–10, bass on 11, chord/pad parts on 12–15; built-in Songs send no
 * notes. So 1–8 is the player and 9–16 the accompaniment.
 */
export const isPlayerChannel = (channel: number) => channel >= 1 && channel <= 8
