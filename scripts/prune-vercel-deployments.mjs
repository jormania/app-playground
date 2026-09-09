#!/usr/bin/env node
/**
 * Keep only the N most recent Vercel deployments; delete the rest.
 *
 * Why this exists: Vercel Hobby includes 10 GB of Deployment Storage, and that
 * is charged per RETAINED deployment, not per push — every build ever made is
 * still sitting there. Vercel's own retention policy is expressed in time
 * ("keep previews for 1 month"), which doesn't answer "keep the last ten", so
 * this walks the list itself.
 *
 * Deleting a deployment is irreversible and it is the live site, so:
 *   - it dry-runs unless you pass --yes
 *   - it will never delete the deployment currently serving production
 *     (read from the project's own targets.production.id, not inferred)
 *   - it will never delete a deployment that is still BUILDING or QUEUED
 *
 * Usage:
 *   VERCEL_TOKEN=… node scripts/prune-vercel-deployments.mjs            # dry run
 *   VERCEL_TOKEN=… node scripts/prune-vercel-deployments.mjs --yes      # delete
 *   VERCEL_TOKEN=… node scripts/prune-vercel-deployments.mjs --keep 20 --yes
 *
 * Create the token at https://vercel.com/account/settings/tokens (scope it to
 * the coneofcold team). It is read from the environment and never written down.
 */

const TEAM_ID = 'team_ClRA6xtmwaY0eDzQqORxy2JU'
const PROJECT_ID = 'prj_zi4hllDxjBMmvDZYyPRLySoyouVk'
const API = 'https://api.vercel.com'

const token = process.env.VERCEL_TOKEN
if (!token) {
  console.error('VERCEL_TOKEN is not set. See the usage note at the top of this file.')
  process.exit(1)
}

const args = process.argv.slice(2)
const apply = args.includes('--yes')
const keepArg = args.indexOf('--keep')
const KEEP = keepArg === -1 ? 10 : Number(args[keepArg + 1])
if (!Number.isInteger(KEEP) || KEEP < 1) {
  console.error('--keep must be a positive integer')
  process.exit(1)
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${await res.text()}`)
  return res.json()
}

/** Every deployment, newest first. The list endpoint pages backwards in time. */
async function allDeployments() {
  const out = []
  let until
  for (;;) {
    const qs = new URLSearchParams({ projectId: PROJECT_ID, teamId: TEAM_ID, limit: '100' })
    if (until) qs.set('until', String(until))
    const { deployments, pagination } = await api(`/v6/deployments?${qs}`)
    if (!deployments?.length) break
    out.push(...deployments)
    if (!pagination?.next) break
    until = pagination.next
  }
  return out.sort((a, b) => b.created - a.created)
}

const project = await api(`/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`)
const liveProductionId = project?.targets?.production?.id ?? null

const deployments = await allDeployments()
const keep = new Set(deployments.slice(0, KEEP).map((d) => d.uid))

// Protected for reasons other than recency — spelled out so the log can say why.
const protectedReason = (d) => {
  if (keep.has(d.uid)) return null
  if (d.uid === liveProductionId) return 'live production'
  if (d.state === 'BUILDING' || d.state === 'QUEUED') return `in flight (${d.state})`
  return null
}

const doomed = []
const spared = []
for (const d of deployments.slice(KEEP)) {
  const reason = protectedReason(d)
  if (reason) spared.push([d, reason])
  else doomed.push(d)
}

const when = (d) => new Date(d.created).toISOString().replace('T', ' ').slice(0, 16)
const label = (d) => `${when(d)}  ${d.target === 'production' ? 'prod   ' : 'preview'}  ${d.uid}`

console.log(`${deployments.length} deployments; keeping the newest ${KEEP}.`)
if (liveProductionId) console.log(`Live production: ${liveProductionId}`)
for (const [d, reason] of spared) console.log(`  keep (${reason})  ${label(d)}`)
console.log(`${doomed.length} to delete.`)

if (!apply) {
  for (const d of doomed.slice(0, 10)) console.log(`  would delete  ${label(d)}`)
  if (doomed.length > 10) console.log(`  … and ${doomed.length - 10} more`)
  console.log('\nDry run. Re-run with --yes to actually delete.')
  process.exit(0)
}

let deleted = 0
let failed = 0
for (const d of doomed) {
  try {
    await api(`/v13/deployments/${d.uid}?teamId=${TEAM_ID}`, { method: 'DELETE' })
    deleted++
    if (deleted % 25 === 0) console.log(`  … ${deleted}/${doomed.length}`)
  } catch (err) {
    failed++
    console.error(`  failed  ${label(d)}: ${err.message}`)
  }
}
console.log(`Deleted ${deleted}${failed ? `, ${failed} failed` : ''}.`)
