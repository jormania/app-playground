// The curation check, against the real API: `ANTHROPIC_API_KEY=… npm run check:curation`.
// Never in CI, never in `npm test` (vitest.curation.config.js is its only
// config). Writes the report to long-listen-curation.md (git-ignored) and
// prints it. See curationCheck.ts for what it runs and why.
import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { anthropicSender, promptVersions } from './curator'
import { PROFILES, curationReport, runCurationCheck } from './curationCheck'

const KEY = process.env.ANTHROPIC_API_KEY ?? ''

it.skipIf(!KEY)('curation check — four listener profiles through the real prompts', async () => {
  const results = await runCurationCheck(anthropicSender(KEY), PROFILES)
  const report = curationReport(results, promptVersions())
  writeFileSync('long-listen-curation.md', report)
  console.log(report)
}, 15 * 60_000)
