// The curation check, against the real API: `ANTHROPIC_API_KEY=… npm run check:curation`.
// Never in CI, never in `npm test` (vitest.curation.config.js is its only
// config). Writes the report to long-listen-curation.md (git-ignored) and
// prints it. See curationCheck.ts for what it runs and why.
//
// Sent through the Batch API by default: half the price, answers in minutes
// rather than seconds (at most 24 hours). CURATION_DIRECT=1 sends each request
// on its own, at full price, for when the answer is wanted now.
import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { anthropicSender, promptVersions } from './curator'
import { batchSender } from './batchSender'
import { PROFILES, curationReport, runCurationCheck } from './curationCheck'

const KEY = process.env.ANTHROPIC_API_KEY ?? ''

it.skipIf(!KEY)('curation check — four listener profiles through the real prompts', async () => {
  const send = process.env.CURATION_DIRECT === '1'
    ? anthropicSender(KEY)
    : batchSender(KEY, { log: (line) => console.log(`curation check: ${line}`) })
  const results = await runCurationCheck(send, PROFILES)
  const report = curationReport(results, promptVersions())
  writeFileSync('long-listen-curation.md', report)
  console.log(report)
}, 3 * 60 * 60_000)
