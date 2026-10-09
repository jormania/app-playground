// Runs the daily-refactor workflow's model-chooser step exactly as written in
// the YAML, under `bash -e` as the runner does, against a stand-in `gh`.
//
// pick-model.test.js covers the script; this covers the shell around it, which
// is where 2026-10-01's failure was: with no open PR claiming a backlog item,
// grep exits 1, and under pipefail and -e that ended the step — and the run —
// before the agent started. Every path through this step has to end in a
// `model=` line and exit 0; a failure here costs a night's run.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, chmodSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { topmostEligible, OPUS } from './pick-model.mjs'

const REPO = resolve(__dirname, '..')

/** The `run: |` block of the step containing `marker`, dedented. */
function stepBody(marker) {
  const lines = readFileSync(join(REPO, '.github/workflows/daily-refactor.yml'), 'utf8').split('\n')
  const at = lines.findIndex((l) => l.includes(marker))
  let start = at
  while (start > 0 && !/run: \|\s*$/.test(lines[start])) start--
  const body = []
  let indent = null
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') { body.push(''); continue }
    const n = line.length - line.trimStart().length
    if (indent === null) indent = n
    if (n < indent) break
    body.push(line.slice(indent))
  }
  return body.join('\n')
}

/** The chooser step, with the discovery flag filled in. */
const chooserStep = (discovery) =>
  stepBody('node scripts/pick-model.mjs').replaceAll('${{ steps.when.outputs.discovery }}', discovery)

let dir
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'chooser-'))
})

/** Run the step with `gh` printing `ghOut` and exiting `ghExit`. */
function run({ ghOut = '', ghExit = 0, discovery = 'false' }) {
  const bin = mkdtempSync(join(dir, 'bin-'))
  writeFileSync(join(bin, 'ghout'), ghOut)
  writeFileSync(join(bin, 'gh'), `#!/bin/sh\ncat "${join(bin, 'ghout')}"\nexit ${ghExit}\n`)
  chmodSync(join(bin, 'gh'), 0o755)
  const script = join(bin, 'step.sh')
  writeFileSync(script, chooserStep(discovery))
  const output = join(bin, 'github-output')
  writeFileSync(output, '')
  const r = spawnSync('bash', ['-e', script], {
    cwd: REPO,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_OUTPUT: output, GH_REPO: 'jormania/app-playground' },
    encoding: 'utf8',
  })
  const out = Object.fromEntries(
    readFileSync(output, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  )
  return { status: r.status, out, stderr: r.stderr }
}

const top = topmostEligible(readFileSync(join(REPO, 'REFACTOR_BACKLOG.md'), 'utf8'))

describe('daily-refactor model chooser step', () => {
  it('finds the step in the workflow', () => {
    expect(chooserStep('false')).toContain('pick-model.mjs --discovery "false"')
  })

  it('survives open PRs that claim nothing — the 2026-10-01 failure', () => {
    const r = run({ ghOut: 'A PR body\nwith no claim line\n' })
    expect(r.status, r.stderr).toBe(0)
    expect(r.out.model).toMatch(/^claude-/)
    expect(r.out.item).toBe(top?.id ?? '')
  })

  it('survives no open PRs at all', () => {
    const r = run({ ghOut: '' })
    expect(r.status, r.stderr).toBe(0)
    expect(r.out.model).toMatch(/^claude-/)
  })

  it('passes a claimed item on to the script, which skips it', () => {
    if (!top) return
    const r = run({ ghOut: `Some PR\nBacklog-Item: ${top.id}\n` })
    expect(r.status, r.stderr).toBe(0)
    expect(r.out.item).not.toBe(top.id)
  })

  it('stays on Opus when the open PRs cannot be read', () => {
    const r = run({ ghExit: 1 })
    expect(r.status, r.stderr).toBe(0)
    expect(r.out.model).toBe(OPUS)
  })

  it('keeps a discovery morning on Opus', () => {
    const r = run({ ghOut: '', discovery: 'true' })
    expect(r.status, r.stderr).toBe(0)
    expect(r.out.model).toBe(OPUS)
  })
})

// The "which morning" step decides discovery — every other Friday, counted from
// 2026-10-09 — by date alone. Run it as written, with `date` answering for a
// chosen Bucharest morning and passing every other call to the real one.
describe('daily-refactor discovery calendar', () => {
  function morning(iso) {
    const bin = mkdtempSync(join(dir, 'when-'))
    const day = new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
    writeFileSync(join(bin, 'date'), [
      '#!/bin/sh',
      `[ "$1" = "+%F" ] && { echo ${iso}; exit 0; }`,
      `[ "$1" = "+%A" ] && { echo ${day}; exit 0; }`,
      'exec /bin/date "$@"',
      '',
    ].join('\n'))
    chmodSync(join(bin, 'date'), 0o755)
    const script = join(bin, 'step.sh')
    writeFileSync(script, stepBody('echo "discovery=$discovery"'))
    const output = join(bin, 'github-output')
    writeFileSync(output, '')
    const r = spawnSync('bash', ['-e', script], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_OUTPUT: output },
      encoding: 'utf8',
    })
    expect(r.status, r.stderr).toBe(0)
    const out = readFileSync(output, 'utf8')
    expect(out).toContain(`date=${iso}`)
    return /discovery=(\w+)/.exec(out)?.[1]
  }

  it('makes 2026-10-09 a discovery Friday and the next one an item Friday', () => {
    expect(morning('2026-10-09')).toBe('true')
    expect(morning('2026-10-16')).toBe('false')
    expect(morning('2026-10-23')).toBe('true')
  })

  it('keeps alternating across a 53-week ISO year, where week parity would not', () => {
    // 2026 has an ISO week 53: week parity would make 2027-01-01 (W53) and
    // 2027-01-08 (W01) both odd. Counting whole weeks keeps them apart.
    expect(morning('2027-01-01')).toBe('true')
    expect(morning('2027-01-08')).toBe('false')
  })

  it('never makes another weekday a discovery morning', () => {
    expect(morning('2026-10-12')).toBe('false')
    expect(morning('2026-10-22')).toBe('false')
  })
})
