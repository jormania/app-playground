# Lexi5 — Roadmap

The 2026-08-08 audit was cleared previously. The 2026-08-12 production audit found 32
issues across `src/lexi5`, `src/ds` and `src/shared`; all of them, plus the UX,
accessibility and code-quality recommendations from its thematic sections, have now been
implemented. One new bug was found during that work (see below).

Nothing from the audit is outstanding. What follows is what was consciously *not* done and
why, so the next person doesn't re-litigate it from scratch.

## Found while remediating

- **Every toast fired from Settings was invisible.** `.app` is `position: fixed`, which
  creates a stacking context in Chrome, so the toast's `z-index: 100` was scoped inside it
  and any modal overlay painted over the whole subtree. The curation-finished, list-cleared
  and dictionary-switched toasts had never been visible; the same bug made the new Undo
  action unclickable behind the scrim. Fixed by portalling the toast to `<body>` above the
  modal z-index range. Not in the original audit — it only surfaced when a toast finally
  had something clickable in it.

## Deliberately not done

- **Full `SelectField` adoption for the two native dropdowns.** The accessibility defects
  behind that recommendation are fixed in place (real `htmlFor`/`id` pairs,
  `aria-describedby`, a visible `:focus-visible` ring). Swapping in the DS component would
  also swap in DS field styling and lose Lexi5's compact custom chevron — a visual change
  to a design-locked app nobody asked for. Worth doing only alongside a deliberate restyle.
- **A separate `src/lexi5/theme.css`.** Every token-mapping gap is closed (all `--color-*`
  tokens Lexi5 touches are mapped in both theme blocks; tile fills carry paired ink
  tokens), so the remaining benefit is filing, not correctness. Moving ~50 lines of
  load-bearing CSS whose comments document two already-shipped bugs carries more regression
  risk than it removes.
- **Keyboard key-status memoisation.** Investigated twice now: `Keyboard` is wrapped in
  `React.memo` and its props are referentially stable across unrelated App re-renders, so
  the computation already only runs when it must. A `useMemo` would add indirection without
  changing when anything executes.
- **Square tiles on short viewports.** The board sizes from its container rather than
  `100dvh` arithmetic, so landscape went from unusable 4–8px tiles to ~66×36. When height
  is the binding constraint the grid stretches rather than holding 5:6. Playable and
  non-square beats square and invisible; a dedicated landscape layout would be better than
  either.
- **Converting Lexi5's components to TypeScript.** `src/lexi5/lib` is typed and in
  `tsconfig.json` — the stats schema, config shape, scorer, Hard Mode and undo. The
  components stay JSX, matching the repo convention for non-strict apps. The typed half is
  the half that would have caught the `highContrast`/`DEFAULT_CONFIG` mismatch.
- **Deferring the guess list separately from the answer list.** Both load before first
  render. Splitting further would mean a player could type a guess before validation was
  available, and rejecting a real word is worse than the ~39 KB gzipped it saves.

## Open by choice

- **No non-English dictionary option.** A real feature needing a source word list and a
  decision about which language(s) — not a bug fix, and not something to guess at.
