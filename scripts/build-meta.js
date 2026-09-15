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

/**
 * Prepare a commit subject for the footer's build line.
 *
 * Strips the characters that would need escaping inside an attribute value,
 * then shortens to `max` — cutting back to a word boundary and marking the
 * elision, so a shortened subject reads as shortened. A bare mid-word cut
 * looks like a complete sentence that simply stops, which invites doubt about
 * everything else on the line.
 *
 * The boundary is only honoured when it leaves most of the budget used;
 * otherwise a single long token would collapse the subject to almost nothing,
 * and a hard cut carries more than that.
 *
 * @param {string} subject raw commit subject (first line only)
 * @param {number} max maximum characters, ellipsis included
 * @returns {string}
 */
export function cleanCommitSubject(subject, max) {
  const text = String(subject).replace(/[<>"]/g, '').trim();
  if (text.length <= max) return text;

  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return body.replace(/[\s,;:.\u2014-]+$/, '') + '\u2026';
}
