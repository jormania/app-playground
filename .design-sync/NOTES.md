# design-sync notes

## Scope boundary (important)

This repo also contains finished apps and static resources that are **not** part
of the design system and must never be synced — see [`../LEGACY.md`](../LEGACY.md)
for the full list (Touch Grass / Journal / Kettlebell React apps, their
almanac/guide companion pages, and the 1st-gen / variant static apps).

The design system lives **only** in `src/ds/`. That is why `config.json` pins
`"srcDir": "src/ds"`: the converter reads components and tokens from there and
never looks at `src/touch-grass`, `src/journal`, or `src/kettlebell`. Keep this
pin. Do not widen `srcDir` to `src/` or the legacy apps will be swept in.

## To fill in at first real sync

- `pkg` — package name/path for the `package` shape (the design system isn't a
  published package yet; set this when it is, or adjust the build accordingly).
- `tokensGlob` — currently relies on default discovery within `srcDir`; pin it if
  token files move out of `src/ds/`.

## Related guardrail

`src/ds/boundary.test.js` fails the test suite if any legacy app imports from
`src/ds/`, enforcing the one-way boundary in `npm test`.
