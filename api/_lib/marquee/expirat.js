// Expirat Halele Carol — https://tickets.expirat.org/
//
// An iabilet.ro **whitelabel**: the same company's ticketing under the venue's
// own domain and skin. Read by `iabilet.js`, like Quantic and Cinema Europa,
// because since §9.94 there is one reader for this host and the whitelabel is
// one of its two row templates.
//
// This was the venue the generic `jsonld` reader was written against — it
// published a complete schema.org Event per listing, name, startDate, image and
// an `offers` price in RON, and for two months it was the cleanest source in
// the repo. On 2026-10-18 iabilet stopped emitting that markup on every listing
// page it serves, whitelabels included, and this became a selector read like
// everything else.
//
// **Two things are different here, and both fall out of the template rather
// than out of config.** The whitelabel card prints its hour inline
// ("duminică, 18 octombrie, ora 19:00 acces de la 20:00"), so every row arrives
// timed and `follow` skips it — Expirat costs exactly one request per scan,
// where Quantic costs one per concert. And the card prints no price at all,
// which the JSON-LD used to carry: the `offers` block is gone and nothing on
// the row replaces it, so Expirat's events now come out priceless. That is a
// loss, and it is upstream's. Recovering it would mean a hop per event — about
// twenty-two requests a scan, to a host already being asked for Quantic's — for
// a number that is on the ticket page the card already links to.
//
// `minItems` is 3 rather than Quantic's 6: Expirat is a club with quiet weeks,
// and twenty-two rows in October says nothing about February.

import iabilet from './iabilet.js'

export default {
  ...iabilet,
  id: 'expirat',
  label: 'Expirat / iabilet whitelabel',
  minItems: 3,
}
