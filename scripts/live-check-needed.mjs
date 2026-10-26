// For .github/workflows/ai-models.yml: did this push to main change a file that
// builds a Claude request, and whose? The live check then sends only those
// apps' requests: a change to The Long Listen's prompts pays for The Long
// Listen's, not every app's. A file every app shares (models.js, anthropic.ts,
// the live test itself, the workflow) means all of them.
//
// Prints `needed=true|false` and `apps=<comma list>|all` for $GITHUB_OUTPUT.
// Any doubt — the earlier commit can't be found, git fails — answers needed
// and all: an extra run costs a few cents, a skipped one can hide a broken
// request.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** The files listed under `paths:` in the workflow. */
export function watchedPaths(workflowText) {
  const after = workflowText.slice(workflowText.indexOf('paths:'))
  const block = after.slice(0, after.search(/\n\S/) === -1 ? undefined : after.search(/\n\S/))
  return [...block.matchAll(/^\s+- (\S+)\s*$/gm)].map((m) => m[1])
}

export function needed(changed, watched) {
  const set = new Set(watched)
  return changed.some((f) => set.has(f))
}

/**
 * Which app's live cases a changed file calls for, by its directory. The names
 * are the prefixes of the case names in scripts/anthropic.live.test.js
 * ("The Long Listen — themes"); live-check-needed.test.js checks each has one.
 */
export const APP_DIRS = {
  'src/daily-stoic/': 'Daily Stoic',
  'src/lexi5/': 'Lexi5',
  'src/law-of-the-day/': 'Law of the Day',
  'src/long-listen/': 'The Long Listen',
  'src/keypath/': 'KeyPath',
  'src/silva/': 'Silva',
  'src/fit-check/': 'Fit Check',
  'src/where-it-went/': 'WhereItWent',
  'src/sol-odyssey/': 'Sol Odyssey',
  'src/touch-grass/': 'Touch Grass',
}

/** The apps whose requests the watched files in `changed` touch: a list, or 'all'. */
export function appsFor(changed, watched) {
  const set = new Set(watched)
  const apps = new Set()
  for (const f of changed.filter((x) => set.has(x))) {
    const dir = Object.keys(APP_DIRS).find((d) => f.startsWith(d))
    if (!dir) return 'all'
    apps.add(APP_DIRS[dir])
  }
  return [...apps].sort().join(',')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [before, after] = process.argv.slice(2)
  let answer = true
  let apps = 'all'
  try {
    const watched = watchedPaths(readFileSync(new URL('../.github/workflows/ai-models.yml', import.meta.url), 'utf8'))
    const changed = execFileSync('git', ['diff', '--name-only', before, after], { encoding: 'utf8' }).split('\n').filter(Boolean)
    answer = needed(changed, watched)
    if (answer) apps = appsFor(changed, watched)
    console.error(`live check: ${answer ? `needed for ${apps}` : 'skipped'} — ${changed.length} file(s) changed in this push`)
  } catch (e) {
    console.error(`live check: running everything to be safe (${e.message.split('\n')[0]})`)
  }
  console.log(`needed=${answer}`)
  console.log(`apps=${apps}`)
}
