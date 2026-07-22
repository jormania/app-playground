import { resolvePriceUpdate, buildPatchProperties } from './_lib/clickdeckPricing.js'
import { resolveReleaseFlip, buildWatchlistPatchProperties } from './_lib/clickdeckWatchlist.js'

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
    // 1. Fetch all games from Notion that have a Steam App ID
    // We fetch ALL games because the user wants prices for everything (Backlog, Playing, Completed, Abandoned)
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
        }
      })
    })

    if (!notionRes.ok) {
      throw new Error(`Notion query failed (${notionRes.status}): ${await notionRes.text()}`)
    }

    const data = await notionRes.json()
    const rows = data.results || []

    const gamesToUpdate = rows.map(page => ({
      pageId: page.id,
      appId: parseInt(page.properties['Steam App ID']?.number || 0, 10),
      currentPrice: page.properties['Current Price']?.number,
      initialPrice: page.properties['Initial Price']?.number,
      discountPercent: page.properties['Discount Percent']?.number,
      // Only present once a user has clicked "Patch Database for Watchlist
      // Schema" — undefined key means resolveReleaseFlip's releaseStatus
      // check below always safely no-ops for anyone who hasn't patched yet.
      releaseStatus: page.properties['Release Status']?.select?.name
    })).filter(g => g.appId > 0)

    if (gamesToUpdate.length === 0) {
      res.status(200).json({ message: 'No games with Steam App IDs found to update.' })
      return
    }

    // 2. Batch query Steam API
    // The Steam API accepts a comma-separated list of appids.
    // However, it can occasionally fail if we ask for too many at once, so we'll chunk into 15.
    const CHUNK_SIZE = 15
    const results = []

    for (let i = 0; i < gamesToUpdate.length; i += CHUNK_SIZE) {
      const chunk = gamesToUpdate.slice(i, i + CHUNK_SIZE)
      const appIdsStr = chunk.map(g => g.appId).join(',')

      // Widened from price_overview-only so the same call also tells us
      // whether a Coming Soon game has launched — previously "no price" and
      // "unreleased" were indistinguishable, which is exactly the ambiguity
      // the Watchlist feature's release_date.coming_soon check replaces.
      const steamRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appIdsStr}&cc=US&filters=price_overview,release_date`)

      if (!steamRes.ok) {
        console.error(`Steam API failed for chunk ${appIdsStr}`)
        continue
      }

      const steamData = await steamRes.json()

      for (const game of chunk) {
        // Steam sometimes returns an empty array [] for invalid/delisted
        // appids instead of an object — resolvePriceUpdate handles that.
        const appData = steamData[game.appId.toString()]
        const update = resolvePriceUpdate(game, appData)
        const releaseFlip = resolveReleaseFlip(game, appData)
        if (update || releaseFlip) {
          results.push({ pageId: game.pageId, update, releaseFlip, flipped: Boolean(releaseFlip?.flipped) })
        }
      }

      // polite delay
      await new Promise(r => setTimeout(r, 1000))
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
      const patchRes = await fetch(`https://api.notion.com/v1/pages/${result.pageId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ properties })
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

    res.status(200).json({
      processed: gamesToUpdate.length,
      checked: results.length,
      priceChanges: results.filter(r => r.update?.priceChanged).length,
      releaseFlips: flippedThisRun.length,
      flippedGames: flippedThisRun,
      successfullyPatched: patched
    })

  } catch (err) {
    res.status(502).json({ message: err.message })
  }
}
