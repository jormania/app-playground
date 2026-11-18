// Runs the daily-refactor workflow's "Verify and merge each PR" step exactly as
// written in the YAML, under bash, with stand-ins for gh, git, npm and npx.
// This step decides what reaches production without a human reading it, and
// since 2026-11-18 it handles two PRs a run — so every path through it is
// pinned here rather than discovered on a morning.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, chmodSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const REPO = resolve(__dirname, '..')

/** The `run: |` block of the step named `name`, dedented. */
function stepBody(name) {
  const lines = readFileSync(join(REPO, '.github/workflows/daily-refactor.yml'), 'utf8').split('\n')
  let start = lines.findIndex((l) => l.trim() === `- name: ${name}`)
  while (start < lines.length && !/run: \|\s*$/.test(lines[start])) start++
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

let root
beforeAll(() => { root = mkdtempSync(join(tmpdir(), 'merge-step-')) })

const sh = (lines) => ['#!/bin/bash', ...lines, ''].join('\n')

/**
 * Run the step. `prs` maps a PR number to its head branch (and optional
 * state/base); `failVerify` lists the checkout numbers (1, 2) whose gates fail.
 */
function run({ result, prs = {}, failVerify = [], failUpdate = false }) {
  const dir = mkdtempSync(join(root, 'run-'))
  const bin = join(dir, 'bin')
  spawnSync('mkdir', ['-p', bin])
  const log = join(dir, 'calls.log')
  writeFileSync(log, '')
  writeFileSync(join(dir, 'prs.json'), JSON.stringify(prs))
  writeFileSync(join(bin, 'gh'), sh([
    `echo "gh $*" >> "${log}"`,
    'if [ "$1" = api ]; then',
    '  n="${2##*/}"',
    `  jq -e --arg n "$n" '.[$n]' "${join(dir, 'prs.json')}" >/dev/null || exit 1`,
    `  jq --arg n "$n" '.[$n] | {head: {ref: .branch, repo: {full_name: "jormania/app-playground"}}, base: {ref: (.base // "main")}, state: (.state // "open")}' "${join(dir, 'prs.json')}"`,
    '  exit 0',
    'fi',
    `if [ "$1 $2" = "pr update-branch" ]; then exit ${failUpdate ? 1 : 0}; fi`,
    'exit 0',
  ]))
  writeFileSync(join(bin, 'git'), sh([
    `echo "git $*" >> "${log}"`,
    'if [ "$1" = worktree ]; then mkdir -p "${@: -2:1}"; fi',
    'exit 0',
  ]))
  for (const tool of ['npm', 'npx']) {
    writeFileSync(join(bin, tool), sh([
      `echo "${tool} $* @ $(basename "$PWD")" >> "${log}"`,
      ...failVerify.map((k) => `[ "$(basename "$PWD")" = "verify-${k}" ] && [ "$1" = test ] && exit 1`),
      'exit 0',
    ]))
  }
  writeFileSync(join(bin, 'sleep'), sh(['exit 0']))
  for (const f of ['gh', 'git', 'npm', 'npx', 'sleep']) chmodSync(join(bin, f), 0o755)

  const resultFile = join(dir, 'refactor-result.json')
  if (result !== undefined) writeFileSync(resultFile, typeof result === 'string' ? result : JSON.stringify(result))
  const script = join(dir, 'step.sh')
  writeFileSync(script, stepBody('Verify and merge each PR').replaceAll('/tmp/refactor-result.json', resultFile))
  const summary = join(dir, 'summary.md')
  writeFileSync(summary, '')
  const r = spawnSync('bash', ['-e', script], {
    cwd: dir,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_STEP_SUMMARY: summary, RUNNER_TEMP: dir, GITHUB_REPOSITORY: 'jormania/app-playground', GH_TOKEN: 'x' },
    encoding: 'utf8',
  })
  const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean)
  return {
    status: r.status,
    stderr: r.stderr + r.stdout,
    calls,
    merged: calls.filter((c) => c.startsWith('gh pr merge')).map((c) => c.split(' ')[3]),
    updated: calls.filter((c) => c.startsWith('gh pr update-branch')).map((c) => c.split(' ')[3]),
    summary: readFileSync(summary, 'utf8'),
    resultExists: existsSync(resultFile),
  }
}

const two = (classA, classB) => ({
  outcome: 'shipped',
  items: [
    { branch: 'claude/refactor-2026-11-20', class: classA, pr: 301 },
    { branch: 'claude/refactor-2026-11-20-2', class: classB, pr: 302 },
  ],
})
const prs = { 301: { branch: 'claude/refactor-2026-11-20' }, 302: { branch: 'claude/refactor-2026-11-20-2' } }

describe('daily-refactor: verify and merge each PR', () => {
  it('finds the step in the workflow', () => {
    expect(stepBody('Verify and merge each PR')).toContain('gh pr merge')
  })

  it('merges two self-merging PRs in order, bringing the second up to date first', () => {
    const r = run({ result: two('refactor', 'modernise'), prs })
    expect(r.status, r.stderr).toBe(0)
    expect(r.merged).toEqual(['301', '302'])
    expect(r.updated).toEqual(['302'])
    // The second PR is brought up to date before it is checked, not after.
    const upd = r.calls.findIndex((c) => c.startsWith('gh pr update-branch'))
    const verify2 = r.calls.findIndex((c) => c.includes('@ verify-2'))
    expect(upd).toBeLessThan(verify2)
  })

  it('leaves a qol or visual PR for review, and merges the refactor after it without an update', () => {
    const r = run({ result: two('visual', 'refactor'), prs })
    expect(r.status, r.stderr).toBe(0)
    expect(r.merged).toEqual(['302'])
    expect(r.updated).toEqual([])
    expect(r.summary).toMatch(/#301 is class `visual`/)
  })

  it('does not merge a PR whose clean checkout fails, and still handles the next', () => {
    const r = run({ result: two('refactor', 'refactor'), prs, failVerify: [1] })
    expect(r.status, r.stderr).toBe(0)
    expect(r.merged).toEqual(['302'])
    expect(r.updated).toEqual([])
    expect(r.summary).toMatch(/#301 failed the independent check/)
  })

  it('leaves the second PR open when it cannot be brought up to date', () => {
    const r = run({ result: two('refactor', 'refactor'), prs, failUpdate: true })
    expect(r.merged).toEqual(['301'])
    expect(r.summary).toMatch(/#302 could not be brought up to date/)
  })

  it('refuses a PR number that is not this run’s branch', () => {
    const r = run({ result: two('refactor', 'refactor'), prs: { 301: { branch: 'someone-else' }, 302: prs[302] } })
    expect(r.merged).toEqual(['302'])
  })

  it('refuses a branch outside claude/refactor-*', () => {
    const r = run({ result: { outcome: 'shipped', items: [{ branch: 'main', class: 'refactor', pr: 301 }] }, prs })
    expect(r.merged).toEqual([])
  })

  it('still reads the one-item result shape', () => {
    const r = run({ result: { branch: 'claude/refactor-2026-11-20', class: 'modernise', pr: 301, outcome: 'shipped' }, prs })
    expect(r.status, r.stderr).toBe(0)
    expect(r.merged).toEqual(['301'])
  })

  it('merges nothing, and stays green, with no result file or an unreadable one', () => {
    for (const result of [undefined, 'not json']) {
      const r = run({ result, prs })
      expect(r.status, r.stderr).toBe(0)
      expect(r.merged).toEqual([])
      expect(r.summary).toMatch(/No result file/)
    }
  })

  it('merges nothing for a run that opened no PR', () => {
    const r = run({ result: { outcome: 'nothing-eligible', items: [] }, prs })
    expect(r.status, r.stderr).toBe(0)
    expect(r.merged).toEqual([])
  })
})
