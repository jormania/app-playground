// For .github/workflows/ai-models.yml: did the latest push to a pull request
// change a file that builds a Claude request? GitHub's `paths` filter on
// pull_request looks at the whole PR, so without this every push to such a PR
// re-ran the live check (and paid for it) even when it only touched docs.
//
// Prints `needed=true|false` for $GITHUB_OUTPUT. Any doubt — the earlier commit
// can't be found (a force-push), git fails — answers true: an extra run costs a
// few cents, a skipped one can hide a broken request.
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [before, after] = process.argv.slice(2)
  let answer = true
  try {
    const watched = watchedPaths(readFileSync(new URL('../.github/workflows/ai-models.yml', import.meta.url), 'utf8'))
    const changed = execFileSync('git', ['diff', '--name-only', before, after], { encoding: 'utf8' }).split('\n').filter(Boolean)
    answer = needed(changed, watched)
    console.error(`live check: ${answer ? 'needed' : 'skipped'} — ${changed.length} file(s) changed in this push`)
  } catch (e) {
    console.error(`live check: running to be safe (${e.message.split('\n')[0]})`)
  }
  console.log(`needed=${answer}`)
}
