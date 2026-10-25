# KeyPath — rules for working here

Moved from the root `CLAUDE.md`'s app map on 2026-10-25; loads when work touches
`src/keypath/`. Read [`KEYPATH.md`](../../KEYPATH.md) first; what comes next, ranked,
is [`KEYPATH_ROADMAP.md`](../../KEYPATH_ROADMAP.md).

- **Strict TS, DS. A piano tutor taster, in progress.** The hardware probe passed on
  the S24 (KEYPATH.md §1; Nora's Poco F3 still to check) and now lives at
  Settings → Diagnostics.
- The tutor is designed in [`KEYPATH_TUTOR.md`](../../KEYPATH_TUTOR.md) and built in
  steps: engine `engine/`, shell `app/`, the Songs door `app/songs/`, the Journey
  `app/journey/`, Challenges `app/challenges/`, Studio `app/studio/`, the parent's
  Progress view `app/progress/`, the keyboard connection wizard `app/connect/`.
- An installable PWA, listed in the registry (front page and Cabinet) since step 5,
  still `noindex`.
- **`midi/` and `engine/` must stay free of React.**
- **No music files in the repo, ever** — `content-boundary.test.js` enforces it.
