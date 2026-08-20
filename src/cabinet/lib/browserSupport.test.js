import { describe, it, expect, afterEach, vi } from 'vitest'
import { canInstallPwaHere, chromeIntentUrl, isAndroid, pwaLaunchIntentUrl, isIos } from './browserSupport'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('canInstallPwaHere', () => {
  it('is true off Android (desktop, iOS — not gated by this check)', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' })
    expect(canInstallPwaHere()).toBe(true)
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })
    expect(canInstallPwaHere()).toBe(true)
  })

  it('is true on Chrome for Android', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    })
    expect(canInstallPwaHere()).toBe(true)
  })

  it('is false on Edge for Android', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.0.0',
    })
    expect(canInstallPwaHere()).toBe(false)
  })

  it('is true on Samsung Internet for Android', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/24.0 Chrome/115.0.0.0 Mobile Safari/537.36',
    })
    expect(canInstallPwaHere()).toBe(true)
  })

  it('is false on a generic Android WebView browser', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14) Version/4.0 Mobile Safari/537.36' })
    expect(canInstallPwaHere()).toBe(false)
  })
})

describe('chromeIntentUrl', () => {
  it('rewrites an https URL into an Android Chrome intent URL', () => {
    expect(chromeIntentUrl('https://coneofcold.vercel.app/tempo-react.html')).toBe(
      'intent://coneofcold.vercel.app/tempo-react.html#Intent;scheme=https;package=com.android.chrome;end;',
    )
  })
})

describe('isAndroid', () => {
  it('is false off Android', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' })
    expect(isAndroid()).toBe(false)
  })

  it('is true on Android', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    })
    expect(isAndroid()).toBe(true)
  })
})

describe('pwaLaunchIntentUrl', () => {
  it('rewrites an https URL into a package-less intent URL with a browser fallback', () => {
    expect(pwaLaunchIntentUrl('https://coneofcold.vercel.app/touch-grass-react.html')).toBe(
      'intent://coneofcold.vercel.app/touch-grass-react.html#Intent;scheme=https;action=android.intent.action.VIEW;' +
        'S.browser_fallback_url=https%3A%2F%2Fconeofcold.vercel.app%2Ftouch-grass-react.html;end;',
    )
  })
})

describe('isIos', () => {
  it('is true on iPhone', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', platform: 'iPhone' })
    expect(isIos()).toBe(true)
  })

  it('is true on an iPad reporting itself as a Mac', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    })
    expect(isIos()).toBe(true)
  })

  it('is false on a real Mac, which has no touch points', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    })
    expect(isIos()).toBe(false)
  })

  it('is false on Android', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile Safari/537.36', platform: 'Linux armv8l' })
    expect(isIos()).toBe(false)
  })
})
