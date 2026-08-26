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

// cabinet.webmanifest USED to declare a related_applications entry per
// react-vite sub-app, and this block pinned that list against the registry to
// catch drift. The field is gone now: it was suppressing Chrome's WebAPK
// minting for the Cabinet hub itself (chrome://webapks listed all 15 sub-apps
// but never the Cabinet, and the install UI wrongly claimed "already
// installed"). See the comment atop installState.js. So the assertion flips —
// pin the ABSENCE, so nobody re-adds the field and silently un-installs the
// Cabinet again.
describe('cabinet.webmanifest', () => {
  async function readManifest() {
    const { readFileSync } = await import('node:fs')
    return JSON.parse(readFileSync('public/cabinet.webmanifest', 'utf8'))
  }

  it('declares no related_applications — it blocks WebAPK minting for the hub', async () => {
    const manifest = await readManifest()
    expect(manifest.related_applications).toBeUndefined()
  })

  it('keeps the rest of the install-relevant manifest intact', async () => {
    const manifest = await readManifest()
    expect(manifest.id).toBe('/cabinet.html')
    expect(manifest.start_url).toBe('/cabinet.html')
    expect(manifest.scope).toBe('/cabinet.html')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.map((icon) => icon.sizes)).toContain('512x512')
  })
})

// With no related_applications to match against, the browser can only ever
// hand back an empty list here — which checkInstalledApps() maps to all-false,
// and reconcileInstallFlags() correctly refuses to act on.
describe('with related_applications removed', () => {
  const apps = [
    { file: 'tempo-react.html', manifest: '/tempo.webmanifest' },
    { file: 'loom-react.html', manifest: '/loom.webmanifest' },
  ]

  it('never clears a flag, because the answer can never be conclusive', async () => {
    vi.stubGlobal('navigator', { getInstalledRelatedApps: async () => [] })
    const store = new Map([['installed:tempo-react.html', '1']])
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      removeItem: (k) => store.delete(k),
    })

    const detected = await checkInstalledApps(apps)
    expect([...detected.values()]).toEqual([false, false])
    expect(reconcileInstallFlags(apps, detected)).toBe(false)
    // The primary signal — the app's own flag — survives untouched.
    expect(store.get('installed:tempo-react.html')).toBe('1')
    expect(checkInstalledFlags(apps).get('/tempo.webmanifest')).toBe(true)
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
