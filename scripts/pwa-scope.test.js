// Every app in this repo shares one origin, so anything a PWA claims at the root claims
// all of them. A root-scoped install owns every URL on the origin from the OS: Chrome
// answers "already installed" for any app, and opens pages never installed as a PWA.
// One such install exists (a Radar-B WebAPK Chrome minted without reading its manifest,
// see CABINET.md) and only the device can remove it; these rules keep the repo from
// making another.
//
// - Manifests. Each needs an id and a scope narrower than "/".
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

const manifests = readdirSync(PUBLIC).filter((f) => f.endsWith('.webmanifest'))

describe('web app manifests', () => {
  it.each(manifests)('%s declares a narrow scope and an id', (file) => {
    const m = JSON.parse(readFileSync(join(PUBLIC, file), 'utf8'))
    expect(m.id, 'without an id Chrome derives one from start_url, and a later move orphans the install').toBeTruthy()
    expect(m.scope, 'an omitted scope defaults to the start_url directory, which here is "/"').toBeTruthy()
    expect(m.scope).not.toBe('/')
    expect(m.start_url.startsWith(m.scope), 'start_url must sit inside scope').toBe(true)
  })

  // When an install does claim the whole origin, its splash shows on every app's launch.
  // With one shared icon that splash is the same neutral snowflake whichever app it is
  // (CLAUDE.md, "PWA icon"). Home-screen icons are the same icon too; Android has no
  // separate splash icon.
  it.each(manifests)('%s uses the shared Cone of Cold icon', (file) => {
    const m = JSON.parse(readFileSync(join(PUBLIC, file), 'utf8'))
    const srcs = m.icons.map((i) => i.src).sort()
    expect(srcs).toEqual(['/coneofcold-icon-192.png', '/coneofcold-icon-512-maskable.png', '/coneofcold-icon-512.png'])
    for (const sc of m.shortcuts ?? []) for (const i of sc.icons ?? []) expect(i.src).toBe('/coneofcold-icon-192.png')
  })

  it('Sol Odyssey, whose manifest vite.config.js generates, uses it too', () => {
    const cfg = readFileSync(join(REPO, 'vite.config.js'), 'utf8')
    const icons = cfg.slice(cfg.indexOf("name: 'Sol Odyssey'")).match(/icons: \[([\s\S]*?)\]/)[1]
    expect(icons).toContain('/coneofcold-icon-192.png')
    expect(icons).not.toMatch(/sol-odyssey-icon/)
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

// Workers that answer fetches must fetch the manifest fresh: a cache-first copy hands
// Chrome the old icon and name on install and on its update check, so a manifest change
// (the shared PWA icon, CLAUDE.md) never reaches an installed app.
describe('service workers serve the manifest from the network', () => {
  const workers = readdirSync(PUBLIC).filter((f) => f === 'sw.js' || f.endsWith('-sw.js'))
  it.each(workers)('%s', (file) => {
    const src = readFileSync(join(PUBLIC, file), 'utf8')
    if (!src.includes("addEventListener('fetch'")) return
    const handler = src.slice(src.indexOf("addEventListener('fetch'"))
    const first = handler.split('\n').slice(1, 12).join('\n')
    expect(first, 'the manifest check must come first in the fetch handler').toContain(".webmanifest')")
    expect(first).toContain('fetch(e.request)')
  })
})
