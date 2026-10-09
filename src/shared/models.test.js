import { describe, it, expect } from 'vitest'
import * as models from './models.js'
import { MODEL_HAIKU, MODEL_SONNET, noThinking } from './models.js'

const ids = Object.entries(models).filter(([k]) => k.startsWith('MODEL_')).map(([, v]) => v)

describe('models', () => {
  it('knows how to keep every exported model from thinking', () => {
    for (const id of ids) expect(() => noThinking(id)).not.toThrow()
  })

  it('turns thinking off on Haiku 5.5 and sends between_tools to Sonnet 5.5', () => {
    expect(noThinking(MODEL_HAIKU)).toEqual({ thinking: { type: 'disabled' } })
    expect(noThinking(MODEL_SONNET)).toEqual({ thinking: { type: 'between_tools' } })
  })

  it('refuses a model it has no entry for rather than guessing', () => {
    expect(() => noThinking('claude-sonnet-9')).toThrow(/no entry for claude-sonnet-9/)
  })

  it('hands out a copy, so a caller editing its body cannot change the next one', () => {
    noThinking(MODEL_SONNET).thinking.type = 'disabled'
    expect(noThinking(MODEL_SONNET)).toEqual({ thinking: { type: 'between_tools' } })
  })

  // `disabled` is a 400 on Sonnet 5.5 (and Opus 5.5), but Haiku 5.5 accepts it at
  // its default effort — which no Haiku caller changes.
  it('never sends disabled to a model that rejects it', () => {
    for (const id of ids) {
      const t = noThinking(id).thinking
      if (t && !id.startsWith('claude-haiku-5')) expect(t.type).not.toBe('disabled')
    }
  })
})

describe('one home for model ids', () => {
  // A model id written out anywhere else is one the next upgrade will miss.
  // Tests may pin ids; the static pages in public/ are hand-authored and
  // outside this (AI_MODELS.md says so).
  it('names no Claude model outside src/shared/models.js', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const { join, resolve } = await import('node:path')
    const root = resolve(__dirname, '../..')
    const offenders = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue }
        if (!/\.(js|jsx|ts|tsx|mjs)$/.test(e.name) || /\.test\.|\.live\./.test(e.name)) continue
        if (p.endsWith(join('src', 'shared', 'models.js'))) continue
        if (/['"`]claude-(haiku|sonnet|opus|fable)-/.test(readFileSync(p, 'utf8'))) offenders.push(p.slice(root.length + 1))
      }
    }
    walk(join(root, 'src'))
    walk(join(root, 'api'))
    expect(offenders).toEqual([])
  })
})

describe('the live API check covers every app that calls Claude', () => {
  // A file that builds a Messages API request and isn't in the live check is one
  // whose next 400 nobody sees until the app breaks. Settings.jsx only sends the
  // body lib/curate.js builds; anthropic.ts is the helper the others go through.
  const EXEMPT = new Set(['src/shared/anthropic.ts'])
  const SENDS_ONLY = { 'src/lexi5/components/Settings.jsx': 'src/lexi5/lib/curate.js' }

  it('is imported by the live test and listed in the workflow paths', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const { join, resolve } = await import('node:path')
    const root = resolve(__dirname, '../..')
    const callers = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue }
        if (!/\.(js|jsx|ts|tsx|mjs)$/.test(e.name) || /\.test\.|\.live\./.test(e.name)) continue
        const src = readFileSync(p, 'utf8')
        if (/v1\/messages|requestAnthropic\(|askClaude\(|messages\.(?:create|stream)\(/.test(src)) callers.push(p.slice(root.length + 1))
      }
    }
    walk(join(root, 'src'))
    walk(join(root, 'api'))

    const live = readFileSync(join(root, 'scripts/anthropic.live.test.js'), 'utf8')
    const workflow = readFileSync(join(root, '.github/workflows/ai-models.yml'), 'utf8')
    const missing = []
    for (const file of callers) {
      if (EXEMPT.has(file)) continue
      const covered = SENDS_ONLY[file] ?? file
      if (!live.includes(`../${covered}`)) missing.push(`${covered}: not in scripts/anthropic.live.test.js`)
      // Listed twice: once for push, once for pull_request.
      if (workflow.split(`- ${file}\n`).length - 1 !== 2) missing.push(`${file}: not in both ai-models.yml paths lists`)
    }
    expect(callers.length).toBeGreaterThan(10)
    expect(missing).toEqual([])
  })
})
