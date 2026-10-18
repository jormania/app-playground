// Quantic — https://www.iabilet.ro/bilete-quantic-venue-1705/
//
// An iabilet.ro venue page, read by `iabilet.js` like Cinema Europa's. This
// file is now a name, a label and a floor.
//
// It did not start that way, and the history is worth keeping because it is the
// shape of this whole host's drift. Quantic began as a bare alias of the
// generic JSON-LD reader, outgrew it when iabilet turned out to publish
// `startDate` as a bare date (§9.87) and grew its own hop for the hour. Cinema
// Europa then needed the same hop for the same reason (§9.91), so `startTimeOf`
// moved into iabilet.js and the two files sat side by side doing nearly the
// same thing for nearly the same reason.
//
// What finally merged them was iabilet dropping its listing JSON-LD entirely
// (§9.94). Both readers had to be rebuilt on the row markup, and rebuilt they
// were the same reader: read the rows, follow a multi-day row for its tariffs
// and an hourless single-day row for its hour. The difference between these two
// venues is now a count — Quantic lists concerts, Europa lists weekends — and a
// count is a config, not a module.
//
// **Still its own entry rather than a registry alias** because `minItems` is a
// per-venue judgement: six is the floor below which a 24-row club programme has
// plainly failed to read, and it is the number that would catch the next
// template change here the way the gate caught this one.

import iabilet, { startTimeOf } from './iabilet.js'

/** Re-exported from iabilet.js, where it lives: it reads an iabilet.ro event
 *  page, and more than one venue on this host needs it. The path is kept so the
 *  tests written against it keep proving the move was behaviour-preserving. */
export { startTimeOf }

export default {
  ...iabilet,
  id: 'quantic',
  label: 'Quantic / iabilet.ro venue page',
  minItems: 6,
}
