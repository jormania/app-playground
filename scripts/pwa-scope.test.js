// Every app in this repo shares one origin, so anything a PWA claims at the root claims
// all of them. Each rule below has been broken once already:
//
// - Manifests. The first Touch Grass manifest said "scope": "/". A WebAPK minted from it
//   in June 2026 still owns every URL on the origin: Chrome answers "already installed"
//   for any app you try to install, and opens pages that were never installed as a PWA.
// - Service worker registrations. Lexi5 registered with no scope, which for a worker at
//   the site root means "/" — the same registration Touch Grass's /sw.js holds, so each
//   visit swapped the other's worker out.
// - Cache cleanup. Cache Storage is origin-wide too; eleven workers deleted every cache
//   that wasn't their own on activate, wiping the other apps' offline copies.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'

const REPO = resolve(__dirname, '..')
const PUBLIC = join(REPO, 'public')

// /sw.js is the legacy Touch Grass worker, shared at the root by design with the static
// Touch Grass pages (see its header comment). The only root-scoped worker allowed.
const ROOT_WORKERS = new Set(['/sw.js'])

const manifests = readdirSync(PUBLIC).filter((f) => f.endsWith('.webmanifest') || f === 'manifest.json')

describe('web app manifests', () => {
  it.each(manifests)('%s declares a narrow scope and an id', (file) => {
    const m = JSON.parse(readFileSync(join(PUBLIC, file), 'utf8'))
    expect(m.id, 'without an id Chrome derives one from start_url, and a later move orphans the install').toBeTruthy()
    expect(m.scope, 'an omitted scope defaults to the start_url directory, which here is "/"').toBeTruthy()
    expect(m.scope).not.toBe('/')
    expect(m.start_url.startsWith(m.scope), 'start_url must sit inside scope').toBe(true)
  })
})

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(jsx?|tsx?)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
  }
  return out
}

describe('service worker registrations', () => {
  const sources = [
    ...walk(join(REPO, 'src')),
    ...readdirSync(REPO).filter((f) => f.endsWith('.html')).map((f) => join(REPO, f)),
    ...readdirSync(PUBLIC).filter((f) => f.endsWith('.html')).map((f) => join(PUBLIC, f)),
  ]
  const calls = sources.flatMap((file) => {
    const text = readFileSync(file, 'utf8')
    return [...text.matchAll(/serviceWorker\s*\.register\(\s*'([^']+)'([^)]*)\)/g)].map((m) => ({
      where: file.slice(REPO.length + 1),
      script: m[1],
      args: m[2],
    }))
  })

  it('finds the registrations it is meant to check', () => {
    expect(calls.length).toBeGreaterThan(15)
  })

  it('scopes every worker except the legacy shared root one', () => {
    const unscoped = calls.filter((c) => !ROOT_WORKERS.has(c.script) && !/scope\s*:/.test(c.args))
    expect(unscoped.map((c) => `${c.where}: ${c.script}`)).toEqual([])
  })
})

describe('service worker cache cleanup', () => {
  const workers = readdirSync(PUBLIC).filter((f) => /(^|-)sw\.js$/.test(f))

  it.each(workers)('%s only deletes its own caches', (file) => {
    const text = readFileSync(join(PUBLIC, file), 'utf8')
    if (!text.includes('caches.delete')) return
    expect(text).toMatch(/k\.indexOf\(CACHE_PREFIX\) === 0 && k !== CACHE/)
    const prefix = text.match(/CACHE_PREFIX = '([^']+)'/)[1]
    const cache = text.match(/CACHE = '([^']+)'/)[1]
    expect(cache.startsWith(prefix)).toBe(true)
  })
})
