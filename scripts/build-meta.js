// Pure helpers behind the footer's build line (see buildMetaPlugin in
// vite.config.js). They live here rather than inline in the config so the two
// counts that carry real consequence can be tested: the serverless-function
// gauge is an early warning for a deploy failure that has already happened
// twice, and a gauge that silently under-reports is worse than no gauge.
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

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
 * Total bytes of every file under `dir`, recursively.
 *
 * The second Vercel ceiling this repo has hit: Deployment Storage is 10 GB on
 * Hobby and charged per RETAINED deployment, so the one-week retention policy
 * only keeps the quota clear while a single build stays small. It filled once
 * already (2026-09-09), both times because one accidental asset — a bare
 * `@fontsource` import, a dependency's `new URL(…, import.meta.url)` — landed
 * in `dist/` and nothing on any surface said so.
 *
 * Regular files only: directories recurse, symlinks are skipped rather than
 * followed, so nothing is double-counted and a loop cannot hang the build.
 *
 * @param {string} dir absolute or cwd-relative path to a directory
 * @returns {number} bytes
 */
export function directorySizeBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += directorySizeBytes(path);
    else if (entry.isFile()) total += statSync(path).size;
  }
  return total;
}

// The tag every page built through buildMetaPlugin carries, and the only one
// guaranteed present — the rest are best-effort and drop out when git is not
// available. Used as the anchor to stamp against, so a `public/*.html` file
// copied through verbatim is left alone.
const DEPLOY_DATE_META = /<meta name="deploy-date" content="[^"]*">/;

/**
 * Add the built size to an already-emitted HTML page.
 *
 * Unlike every other value on the build line, this one is not knowable from
 * `transformIndexHtml` — that hook runs while the bundle is still being made,
 * and the whole point of the number is the bundle's finished weight. So it is
 * stamped afterwards, from `closeBundle`, straight into the written file. (The
 * repo already rewrites emitted HTML at that point for the stray Sol Odyssey
 * manifest; see `vite.config.js`.)
 *
 * Returns the input unchanged when the page is not one of ours, or already
 * carries the tag — so running twice is the same as running once, and the
 * count can never be stamped on top of itself.
 *
 * @param {string} html contents of an emitted HTML file
 * @param {number} bytes measured size of the build output
 * @returns {string}
 */
export function withBuildSizeMeta(html, bytes) {
  if (!DEPLOY_DATE_META.test(html)) return html;
  if (html.includes('<meta name="build-size"')) return html;
  return html.replace(
    DEPLOY_DATE_META,
    (tag) => `${tag}\n  <meta name="build-size" content="${Math.round(bytes)}">`,
  );
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
