// Guardrail: the design-system boundary is one-way.
//
// Existing apps are design-locked and own their own styling (see LEGACY.md). The
// fresh design system in src/ds/ must never leak into them — if a legacy app
// imported from src/ds/, evolving a token could silently restyle a locked app.
// This test fails the suite the moment that happens.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const srcRoot = resolve(here, '..')          // src/
const dsDir = resolve(srcRoot, 'ds')         // src/ds/ — the protected dir

// Folders that must NOT depend on the design system.
const LEGACY_APPS = ['touch-grass', 'journal', 'kettlebell']

const CODE = /\.(jsx?|mjs|cjs|tsx?)$/
// import/export ... from '<spec>'  |  import('<spec>')  |  require('<spec>')
const SPECIFIER =
  /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (CODE.test(name)) out.push(p)
  }
  return out
}

// Does `spec` imported from `file` resolve into src/ds/?
function pointsIntoDs(spec, file) {
  if (spec.startsWith('.')) {
    const target = resolve(dirname(file), spec)
    return target === dsDir || target.startsWith(dsDir + '\\') || target.startsWith(dsDir + '/')
  }
  // Non-relative: catch alias/absolute-ish references to the ds folder too.
  return /(^|\/)(src\/)?ds(\/|$)/.test(spec) || spec.startsWith('@ds/')
}

describe('design-system boundary', () => {
  for (const app of LEGACY_APPS) {
    it(`legacy app "${app}" does not import from src/ds/`, () => {
      const appDir = join(srcRoot, app)
      const violations = []
      for (const file of walk(appDir)) {
        const text = readFileSync(file, 'utf8')
        for (const m of text.matchAll(SPECIFIER)) {
          const spec = m[1] ?? m[2] ?? m[3]
          if (spec && pointsIntoDs(spec, file)) {
            violations.push(`${file} → ${spec}`)
          }
        }
      }
      expect(violations, `legacy app imported the design system:\n${violations.join('\n')}`).toEqual([])
    })
  }
})
