import { describe, it, expect, afterEach, vi } from 'vitest'
import { installDetectionSupported, absoluteManifestUrl, checkInstalledApps, checkInstalledFlags } from './installState'

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
