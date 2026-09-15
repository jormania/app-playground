// Pure helpers behind the footer's build line (see buildMetaPlugin in
// vite.config.js). They live here rather than inline in the config so the two
// counts that carry real consequence can be tested: the serverless-function
// gauge is an early warning for a deploy failure that has already happened
// twice, and a gauge that silently under-reports is worse than no gauge.
import { readdirSync } from 'fs';

/**
 * Count the files Vercel bills as serverless functions for one deployment.
 *
 * The rule (CLAUDE.md, learned the hard way): every top-level `api/*.js` is
 * one function; anything under `api/_*` is not; and a `.test.js` sitting
 * directly in `api/` counts too, which is why tests for top-level handlers
 * belong in `api/_tests/`. Hobby caps this at 12 per deployment and the
 * thirteenth fails the build outright.
 *
 * @param {string} apiDir absolute path to the repo's `api/` directory
 * @returns {number} functions this deployment would claim
 */
export function countServerlessFunctions(apiDir) {
  return readdirSync(apiDir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.js') && !e.name.startsWith('_'))
    .length;
}

/**
 * Count backlog items by state, from REFACTOR_BACKLOG.md's own headers.
 *
 * Headers look like: `## R-010 — some title · \`refactor\` · \`open\``
 * `open` is what the weekday run draws from; `proposed` is the agent's own
 * ideas, parked until a human moves one up. Anchored to `^## ` so the prose
 * and the class table above the list never count.
 *
 * @param {string} md raw REFACTOR_BACKLOG.md contents
 * @returns {{ open: number, proposed: number }}
 */
export function parseBacklogCounts(md) {
  const count = (state) =>
    (md.match(new RegExp('^##\\s.+`' + state + '`\\s*$', 'gm')) || []).length;
  return { open: count('open'), proposed: count('proposed') };
}
