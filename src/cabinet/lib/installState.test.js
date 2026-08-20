import { describe, it, expect, afterEach, vi } from 'vitest'
import { installDetectionSupported, absoluteManifestUrl, checkInstalledApps, checkInstalledFlags, reconcileInstallFlags } from './installState'

// `navigator` is a read-only getter on globalThis in Node — vi.stubGlobal
// swaps it out safely (and vi.unstubAllGlobals restores it after each test).
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('installDetectionSupported', () => {
  it('is false when getInstalledRelatedApps is absent', () => {
    vi.stubGlobal('navigator', {})
    expect(installDetectionSupported()).toBe(false)
  })

  it('is true when getInstalledRelatedApps exists', () => {
    vi.stubGlobal('navigator', { getInstalledRelatedApps: async () => [] })
    expect(installDetectionSupported()).toBe(true)
  })
})

describe('absoluteManifestUrl', () => {
  it('resolves a root-relative manifest path against the production origin', () => {
    expect(absoluteManifestUrl('/tempo.webmanifest')).toBe('https://coneofcold.vercel.app/tempo.webmanifest')
  })
})

describe('checkInstalledApps', () => {
  const apps = [
    { title: 'Tempo', manifest: '/tempo.webmanifest' },
    { title: 'Kettlebell Training', manifest: '/kettlebell-training.webmanifest' },
  ]

  it('returns null when the browser has no detection API', async () => {
    vi.stubGlobal('navigator', {})
    expect(await checkInstalledApps(apps)).toBeNull()
  })

  it('returns null when the API call throws', async () => {
    vi.stubGlobal('navigator', {
      getInstalledRelatedApps: async () => { throw new Error('nope') },
    })
    expect(await checkInstalledApps(apps)).toBeNull()
  })

  it('maps each manifest to true/false based on what the browser reports installed', async () => {
    vi.stubGlobal('navigator', {
      getInstalledRelatedApps: async () => [
        { id: 'tempo', platform: 'webapp', url: 'https://coneofcold.vercel.app/tempo.webmanifest' },
      ],
    })
    const result = await checkInstalledApps(apps)
    expect(result.get('/tempo.webmanifest')).toBe(true)
    expect(result.get('/kettlebell-training.webmanifest')).toBe(false)
  })

  it('reports nothing installed when the API returns an empty list', async () => {
    vi.stubGlobal('navigator', { getInstalledRelatedApps: async () => [] })
    const result = await checkInstalledApps(apps)
    expect(result.get('/tempo.webmanifest')).toBe(false)
    expect(result.get('/kettlebell-training.webmanifest')).toBe(false)
  })
})

describe('checkInstalledFlags', () => {
  const apps = [
    { file: 'tempo-react.html', manifest: '/tempo.webmanifest' },
    { file: 'kettlebell-training-react.html', manifest: '/kettlebell-training.webmanifest' },
  ]

  it("reads each app's own install flag (set by src/shared/installFlag.ts) from localStorage", () => {
    vi.stubGlobal('localStorage', { getItem: (k) => (k === 'installed:tempo-react.html' ? '1' : null) })
    const result = checkInstalledFlags(apps)
    expect(result.get('/tempo.webmanifest')).toBe(true)
    expect(result.get('/kettlebell-training.webmanifest')).toBe(false)
  })

  it('treats an unavailable localStorage as nothing installed', () => {
    vi.stubGlobal('localStorage', undefined)
    const result = checkInstalledFlags(apps)
    expect(result.get('/tempo.webmanifest')).toBe(false)
  })
})

// getInstalledRelatedApps() only ever reports apps this page's own manifest
// declares in related_applications, so an app missing from that list can never
// be detected as installed however many times it's been installed — its tile
// just reads "Install" forever. The list is hand-maintained in
// public/cabinet.webmanifest and has silently drifted from the registry twice
// (Fit Check and Wanderlist shipped without an entry), which is invisible until
// someone notices a wrong label on a phone. Pin it here instead.
describe('cabinet.webmanifest related_applications', () => {
  it('declares exactly the react-vite apps in the registry', async () => {
    const { readFileSync } = await import('node:fs')
    const { APPS } = await import('../../apps-registry.js')

    const manifest = JSON.parse(readFileSync('public/cabinet.webmanifest', 'utf8'))
    const declared = manifest.related_applications
      .map((entry) => new URL(entry.url).pathname)
      .sort()
    const expected = APPS.filter((app) => app.kind === 'react-vite')
      .map((app) => app.manifest)
      .sort()

    expect(declared).toEqual(expected)
  })

  it('points every entry at the same production origin absoluteManifestUrl builds', async () => {
    const { readFileSync } = await import('node:fs')
    const manifest = JSON.parse(readFileSync('public/cabinet.webmanifest', 'utf8'))
    for (const entry of manifest.related_applications) {
      expect(entry.url).toBe(absoluteManifestUrl(new URL(entry.url).pathname))
    }
  })
})

describe('reconcileInstallFlags', () => {
  const apps = [
    { file: 'tempo-react.html', manifest: '/tempo.webmanifest' },
    { file: 'loom-react.html', manifest: '/loom.webmanifest' },
  ]

  // Node has no localStorage; stand in a Map-backed one so removals are visible.
  function stubStorage(initial) {
    const store = new Map(Object.entries(initial))
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    })
    return store
  }

  it('does nothing when detection is unsupported', () => {
    const store = stubStorage({ 'installed:tempo-react.html': '1' })
    expect(reconcileInstallFlags(apps, null)).toBe(false)
    expect(store.get('installed:tempo-react.html')).toBe('1')
  })

  // An all-false answer is exactly what Chrome's throttling produces, so it
  // proves nothing and must never clear a flag.
  it('leaves flags alone when nothing at all came back installed', () => {
    const store = stubStorage({ 'installed:tempo-react.html': '1' })
    const detected = new Map([['/tempo.webmanifest', false], ['/loom.webmanifest', false]])
    expect(reconcileInstallFlags(apps, detected)).toBe(false)
    expect(store.get('installed:tempo-react.html')).toBe('1')
  })

  // But an answer naming a real install can't have been a throttled one — so
  // the apps it doesn't name really are gone, and their flags go with them.
  it('clears the flag of an app missing from an otherwise conclusive answer', () => {
    const store = stubStorage({
      'installed:tempo-react.html': '1',
      'installed:loom-react.html': '1',
    })
    const detected = new Map([['/tempo.webmanifest', false], ['/loom.webmanifest', true]])
    expect(reconcileInstallFlags(apps, detected)).toBe(true)
    expect(store.has('installed:tempo-react.html')).toBe(false)
    expect(store.get('installed:loom-react.html')).toBe('1')
  })

  it('survives localStorage being unavailable', () => {
    const detected = new Map([['/tempo.webmanifest', false], ['/loom.webmanifest', true]])
    vi.stubGlobal('localStorage', undefined)
    expect(() => reconcileInstallFlags(apps, detected)).not.toThrow()
  })
})
