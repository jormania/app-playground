# The Long Listen — rules for working here

Moved from the root `CLAUDE.md`'s app map on 2026-10-25; loads when work touches
`src/long-listen/`. The app's full doc is [`LONG_LISTEN.md`](../../LONG_LISTEN.md),
and what comes after release one is [`LONG_LISTEN_ROADMAP.md`](../../LONG_LISTEN_ROADMAP.md).

- **Strict TS, DS.** An orchestral curator. BYO Anthropic key in Settings; Claude is
  called from the browser like every app (`curator/`, prompts versioned). The
  primary DB is IndexedDB; Notion is a one-way mirror through the shared relay. The
  user guide is a Claude Docs doc, like KeyPath's.
- **Read before touching:** LONG_LISTEN.md's "facts vs curation", and the rule that a
  returning theme expands, never restarts.
- **Release two** added concerts (a POST share target in its manifest and worker),
  "Live in Bucharest" through Marquee's one endpoint (no function of its own), and
  `npm run check:curation` — four listener profiles through the real prompts on the
  owner's key, **never in CI**.
- **Release three** (stamped 14 October 2026) added a sitting for tonight, the season
  in review (`#/season/<n>`, written only on request) and soloists placed per concert
  work (`domain/concertSoloists.ts`).
- **Release four** (§21) added your earlier hearing, words on tap (a closed term
  list, `domain/glossary.ts`), before and after a concert ("I'm going" on Live in
  Bucharest, `#/before/<key>`) and composer pages (`#/composer/<name>`).
- **The QoL audit** (23 October 2026, §26–§30) added performer pages
  (`#/performer/<name>`), a masthead way back to the work playing, and Library views.
  Read §26 before touching backup, waits or the listening view.
- **The stabilisation pass** (§31) sets the vocabulary (a *direction*, *left open*,
  *how it landed*) and caps the curator at two references to the listener a
  programme. Read it before changing a prompt or the taste profile's shape.
