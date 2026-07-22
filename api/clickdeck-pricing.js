import { resolvePriceUpdate, buildPatchProperties } from './_lib/clickdeckPricing.js'
import { resolveReleaseFlip, buildWatchlistPatchProperties } from './_lib/clickdeckWatchlist.js'
import { alreadyHasThemeHighlight, dramatizeRichText } from './_lib/clickdeckDramatize.js'

// One Steam request per App ID (the multi-appid form is dead — see the loop
// below) means a few-hundred-game collection needs well over the default
// serverless budget. Vercel caps this at the plan's ceiling (300s on Pro).
export const maxDuration = 300

export default async function handler(req, res) {
  const token = process.env.CLICKDECK_NOTION_TOKEN
  const dbId = process.env.CLICKDECK_DB_ID
  const secret = process.env.CRON_SECRET
  const isTest = Boolean(req.query && (req.query.test || req.query.testSend))

  if (!token || !dbId) {
    res.status(501).json({ message: 'Click Deck pricing cron not fully configured (need CLICKDECK_NOTION_TOKEN, CLICKDECK_DB_ID).' })
    return
  }

  // Auth gate
  if (!isTest && secret) {
    const auth = req.headers.authorization || ''
    const q = (req.query && (req.query.secret || req.query.key)) || ''
    if (auth !== `Bearer ${secret}` && q !== secret) {
      res.status(401).json({ message: 'Unauthorised.' })
      return
    }
  }

  try {
    // 1. Fetch all games from Notion that have a Steam App ID.
    // We fetch ALL games because the user wants prices for everything (Backlog, Playing, Completed, Abandoned).
    // Paginated — a single page_size:100 request silently capped this at the
    // first 100 rows forever once the collection grew past that (confirmed
    // live: 121 games have a Steam App ID as of 2026-07-23, so 21 of them
    // were never being checked at all — no price, no release-flip, nothing).
    let rows = []
    let notionCursor
    do {
      const notionRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          page_size: 100,
          filter: {
            property: 'Steam App ID',
            number: { is_not_empty: true }
          },
          ...(notionCursor ? { start_cursor: notionCursor } : {})
        })
      })

      if (!notionRes.ok) {
        throw new Error(`Notion query failed (${notionRes.status}): ${await notionRes.text()}`)
      }

      const data = await notionRes.json()
      rows = rows.concat(data.results || [])
      notionCursor = data.has_more ? data.next_cursor : undefined
    } while (notionCursor)

    const gamesToUpdate = rows.map(page => ({
      pageId: page.id,
      appId: parseInt(page.properties['Steam App ID']?.number || 0, 10),
      currentPrice: page.properties['Current Price']?.number,
      initialPrice: page.properties['Initial Price']?.number,
      discountPercent: page.properties['Discount Percent']?.number,
      // Only present once a user has clicked "Patch Database for Watchlist
      // Schema" — undefined key means resolveReleaseFlip's releaseStatus
      // check below always safely no-ops for anyone who hasn't patched yet.
      releaseStatus: page.properties['Release Status']?.select?.name,
      // Only read so resolveReleaseFlip can tell "already has one" from
      // "still blank" when deciding whether to derive tags/journal/developer
      // from Steam on a flip — never written back except via that derivation.
      tags: page.properties['Tags']?.multi_select?.map(t => t.name) || [],
      journal: page.properties['Journal/Notes']?.rich_text?.map(rt => rt.plain_text).join('') || '',
      developer: page.properties['Developer/Studio']?.select?.name || ''
    })).filter(g => g.appId > 0)

    if (gamesToUpdate.length === 0) {
      res.status(200).json({ message: 'No games with Steam App IDs found to update.' })
      return
    }

    // 2. Query Steam appdetails, ONE App ID per request.
    // Steam's appdetails endpoint no longer accepts a comma-separated list of
    // appids — the multi-appid form now returns HTTP 400 (verified July 2026,
    // both with and without a filters param). It used to be batched 15 at a
    // time here; that silently broke both the nightly pricing sync AND the
    // Coming Soon -> Released auto-flip, since every chunk 400'd. A modest
    // per-request delay keeps us well under Steam's ~200-req/5-min IP limit
    // for a collection of a few hundred games; individual failures are
    // tolerated (skipped) rather than aborting the whole run.
    const results = []

    for (const game of gamesToUpdate) {
      // Widened from price_overview-only so the same call also tells us
      // whether a Coming Soon game has launched — previously "no price" and
      // "unreleased" were indistinguishable, which is exactly the ambiguity
      // the Watchlist feature's release_date.coming_soon check replaces.
      // `basic` is what makes header_image/short_description available
      // (cover + journal derivation), `genres`/`developers` are what make
      // flip-time tag/developer derivation possible — all only ever acted
      // on for Coming Soon rows (see resolveReleaseFlip), so this doesn't
      // add per-request cost for the rest of the collection.
      const steamRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appId}&cc=US&filters=basic,price_overview,release_date,genres,developers`)

      if (!steamRes.ok) {
        console.error(`Steam API failed for app ${game.appId}`)
        await new Promise(r => setTimeout(r, 250))
        continue
      }

      const steamData = await steamRes.json()
      // Steam sometimes returns an empty array [] for invalid/delisted
      // appids instead of an object — the resolvers handle that.
      const appData = steamData[game.appId.toString()]
      const update = resolvePriceUpdate(game, appData)
      const releaseFlip = resolveReleaseFlip(game, appData)
      if (update || releaseFlip) {
        results.push({ pageId: game.pageId, update, releaseFlip, flipped: Boolean(releaseFlip?.flipped) })
      }

      // polite delay between per-app requests
      await new Promise(r => setTimeout(r, 250))
    }

    // 3. Patch Notion for every game we successfully checked against Steam.
    // Price Updated At always gets stamped so StatsView's sync indicator is a
    // trustworthy "last checked" timestamp — the price/discount fields only
    // get rewritten when they actually differ, to avoid nightly no-op noise
    // on stable-priced games.
    let patched = 0
    const flippedThisRun = []
    for (const result of results) {
      // Merge the pricing patch and the watchlist patch into one PATCH per
      // page — same rate-limit budget as before this feature, just a wider
      // properties object when a game happens to need both.
      const properties = {
        ...(result.update ? buildPatchProperties(result.update) : {}),
        ...(result.releaseFlip ? buildWatchlistPatchProperties(result.releaseFlip) : {})
      }
      // Cover art is a Notion page-level field, not a property — PATCHed as
      // a sibling of `properties` in the same request. Only present on rows
      // resolveReleaseFlip actually touched (Coming Soon rows), and only
      // when Steam gave us a header image.
      const body = { properties }
      if (result.releaseFlip?.coverUrl) {
        body.cover = { type: 'external', external: { url: result.releaseFlip.coverUrl } }
      }
      const patchRes = await fetch(`https://api.notion.com/v1/pages/${result.pageId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (patchRes.ok) {
        patched++
        // Every flip is logged so the first production run (and every run
        // after) is auditable without needing to query Notion separately.
        if (result.flipped) {
          console.log(`[watchlist] Coming Soon -> Released: page ${result.pageId} (${result.releaseFlip.releaseDateString || 'no date given'})`)
          flippedThisRun.push({ pageId: result.pageId, releaseDate: result.releaseFlip.releaseDateString })
        }
      } else {
        console.error(`Failed to patch Notion for page ${result.pageId}`, await patchRes.text())
      }
      // polite delay
      await new Promise(r => setTimeout(r, 300))
    }

    // 4. Journal dramatization — a separate pass, decoupled from the Steam
    // price/release loop above: it needs no external API call, just the raw
    // Journal/Notes rich_text, and shouldn't be limited to App-ID-having
    // rows the way pricing is. Mirrors scripts/dramatize-journal.py's logic
    // exactly (see api/_lib/clickdeckDramatize.js's header comment) — this
    // used to be a manual-only maintenance script; folding it in here means
    // a freshly-written or Steam-derived journal entry gets its keyword
    // highlight automatically on the very next nightly run, no manual step
    // required. Wrapped in its own try/catch so a failure here (cosmetic)
    // never discards the pricing/release-flip results already computed above.
    let journalsDramatized = 0
    try {
      let journalRows = []
      let journalCursor
      do {
        const journalRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            page_size: 100,
            filter: { property: 'Journal/Notes', rich_text: { is_not_empty: true } },
            ...(journalCursor ? { start_cursor: journalCursor } : {})
          })
        })
        if (!journalRes.ok) throw new Error(`Journal query failed (${journalRes.status}): ${await journalRes.text()}`)
        const journalData = await journalRes.json()
        journalRows = journalRows.concat(journalData.results || [])
        journalCursor = journalData.has_more ? journalData.next_cursor : undefined
      } while (journalCursor)

      for (const page of journalRows) {
        const richTextArray = page.properties['Journal/Notes']?.rich_text || []
        if (richTextArray.length === 0 || alreadyHasThemeHighlight(richTextArray)) continue

        const { segments, highlighted } = dramatizeRichText(richTextArray)
        if (highlighted === 0) continue

        const patchRes = await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ properties: { 'Journal/Notes': { rich_text: segments } } })
        })
        if (patchRes.ok) {
          journalsDramatized++
        } else {
          console.error(`Failed to dramatize journal for page ${page.id}`, await patchRes.text())
        }
        await new Promise(r => setTimeout(r, 300))
      }
    } catch (err) {
      console.error('Journal dramatization pass failed:', err.message)
    }

    res.status(200).json({
      processed: gamesToUpdate.length,
      checked: results.length,
      priceChanges: results.filter(r => r.update?.priceChanged).length,
      releaseFlips: flippedThisRun.length,
      flippedGames: flippedThisRun,
      successfullyPatched: patched,
      journalsDramatized
    })

  } catch (err) {
    res.status(502).json({ message: err.message })
  }
}
