/**
 * Pull a Notion database/page id out of whatever a user actually pastes.
 *
 * People paste the URL — that's what Notion's own "Copy link" gives them, and
 * asking for "the ID" means explaining where to find a 32-character hex string
 * inside it. So accept all of it: a full URL (with or without a `?v=` view
 * parameter or a `#` fragment), a dashed UUID, or a bare 32-char id.
 *
 * Returns the compact lowercase 32-char id, or `''` when there's nothing
 * id-shaped in the input — never throws, so a half-typed value is just empty
 * rather than an error.
 *
 * Promoted to src/shared/ when Fit Check became the FOURTH app to need this;
 * Loom now re-exports it (its own tests prove the move was behaviour-preserving).
 * Wanderlist and Journal of Delights still carry their own older copies — see
 * this file's entry in CLAUDE.md.
 */
export function parseNotionId(input: string | null | undefined): string {
  if (!input) return ''
  const s = String(input).trim()

  // A dashed UUID anywhere in the string wins — it's unambiguous.
  const uuid = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  if (uuid) return uuid[0].replace(/-/g, '').toLowerCase()

  // Otherwise look at the path only, so a `?v=<view id>` can't be mistaken for
  // the database id — Notion URLs carry both.
  const path = s.split(/[?#]/)[0]
  if (/^[0-9a-f]{32}$/i.test(path)) return path.toLowerCase()

  // A slug URL ends `.../Some-Title-<32 hex>`; the separator before the id is a
  // dash in a slug and a slash in a bare-id URL.
  const m = path.match(/[-/]([0-9a-f]{32})\/?$/i)
  return m ? m[1].toLowerCase() : ''
}
