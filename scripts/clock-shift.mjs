// Run the test suite as though it were N days from now.
//
//   CLOCK_SHIFT_DAYS=5 NODE_OPTIONS="--no-experimental-webstorage \
//     --import file://$PWD/scripts/clock-shift.mjs" \
//     npx cross-env TZ=Europe/Bucharest npx vitest run
//
// Why this exists: R-013 turned main red for a week when the calendar walked
// past a fixture date, and the sweep for the rest of that class (R-018) needed
// an instrument the obvious approach could not provide.
//
// The obvious approach — a vitest setup file calling vi.setSystemTime — is
// WRONG here, and produces 50 failures that are all harness. A test that builds
// its expected dates at *module load* (src/where-it-went/lib/smartParser.test.js
// does, via getYesterday()) computes them under the real clock, then runs the
// subject under the injected one: expectation and subject land on different
// days and the test fails though nothing is broken.
//
// Patching Date here, through --import, happens before any test module is
// loaded, so module load and subject see the same day and that whole class of
// false failure disappears. Proven rather than assumed: a probe test asserting
// the real month passes unshifted and fails shifted, which is how we know the
// patch reaches vitest's worker processes and not just the parent.
//
// Only `new Date()` and `Date.now()` move. An explicit `new Date('2026-08-21')`
// is left exactly alone, which is the point — fixtures stay put while "now"
// walks forward.
const OFFSET_MS = Number(process.env.CLOCK_SHIFT_DAYS || 0) * 86400000

const RealDate = Date

class ShiftedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + OFFSET_MS)
    else super(...args)
  }

  static now() {
    return RealDate.now() + OFFSET_MS
  }
}

ShiftedDate.parse = RealDate.parse
ShiftedDate.UTC = RealDate.UTC

globalThis.Date = ShiftedDate
