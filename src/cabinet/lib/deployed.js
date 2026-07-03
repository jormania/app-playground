// Reuses index.html's "Mon YYYY" parsing of app.deployed (see its own
// parseDeployed/latestDeployedDate) to find whichever apps shipped in the
// most recent deploy month, so the Cabinet's "New" badge is derived from the
// registry rather than a manually-set flag that could go stale.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function parseDeployed(value) {
  const [mon, yr] = (value || '').trim().split(/\s+/)
  const m = MONTHS.indexOf((mon || '').slice(0, 3).toLowerCase())
  const y = parseInt(yr, 10)
  return m < 0 || Number.isNaN(y) ? null : { y, m }
}

// Returns the app.file set for whichever apps share the newest deploy month —
// but only if that month is recent (within `withinMonths` of now). Once
// nothing's shipped for a while, the badge should disappear rather than
// stick to whatever happened to be last forever.
export function newlyDeployedFiles(apps, { now = new Date(), withinMonths = 2 } = {}) {
  let best = null
  for (const app of apps) {
    const d = parseDeployed(app.deployed)
    if (d && (!best || d.y > best.y || (d.y === best.y && d.m > best.m))) best = d
  }
  if (!best) return new Set()

  const monthsAgo = (now.getFullYear() - best.y) * 12 + (now.getMonth() - best.m)
  if (monthsAgo > withinMonths) return new Set()

  return new Set(
    apps
      .filter((app) => {
        const d = parseDeployed(app.deployed)
        return d && d.y === best.y && d.m === best.m
      })
      .map((app) => app.file)
  )
}
