// Demo threads for Loom's offline mode — what you see before connecting Notion.
// Generated relative to the current week so the Weekly view always has threads
// landing on real days, and pitched to show off the heatmap (a deliberately
// overloaded Monday with a cold grey tail) and both groupings. The flavour is a
// gentle wink at the Guild of Weavers without pretending to be anyone's real to-do.
import { weekDays } from './model.js'

export function demoThreads(now = new Date()) {
  const d = weekDays(now).map(x => x.key) // [Mon..Sun]
  let n = 0
  const id = () => `demo-${++n}`
  // order values are spaced so the seed already reads top→bottom as authored.
  const mk = (title, skein, day, order, done = false) => ({ id: id(), title, skein, day, order, done })

  return [
    // ── Weaving — a full, hot Monday (shows the ember→grey heat tail) ──────────
    mk('Warp the new pattern', 'Weaving', d[0], 0),
    mk('Dye a skein of ember thread', 'Weaving', d[0], 1000),
    mk('Sketch the tapestry border', 'Weaving', d[0], 2000),
    mk('Re-string the small distaff', 'Weaving', d[0], 3000),
    mk('Sort the bobbin drawer', 'Weaving', d[0], 4000),
    mk('Oil the treadle', 'Weaving', d[0], 5000),
    mk('Sweep the loom room', 'Weaving', d[0], 6000),   // past the cap → cold tail
    mk('Wind spare weft', 'Weaving', d[0], 7000),        // past the cap → cold tail
    mk('Finish the midnight panel', 'Weaving', d[2], 1000),
    mk('Block the finished cloth', 'Weaving', d[4], 1000),

    // ── Guild dues — the admin skein, spread lightly across the week ───────────
    mk('Answer the elders’ letter', 'Guild dues', d[1], 1000),
    mk('Renew the loom licence', 'Guild dues', d[3], 1000),
    mk('Tally the month’s spindles', 'Guild dues', d[3], 2000, true),

    // ── Hearth — home & errands ────────────────────────────────────────────────
    mk('Mend the grey cloak', 'Hearth', d[1], 1000),
    mk('Gather firewood before dusk', 'Hearth', d[4], 1000),
    mk('Bake for the weekend', 'Hearth', d[5], 1000),

    // ── Loose & backlog threads (unspun — no day yet) ──────────────────────────
    mk('Learn the Opening draft', 'Weaving', null, 1000),
    mk('Trade for indigo at market', 'Hearth', null, 2000),
    mk('Read the pattern of the swans', null, null, 3000),
  ]
}
