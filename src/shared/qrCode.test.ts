import { describe, it, expect } from 'vitest'
import { appQrUrl } from './qrCode'

describe('appQrUrl', () => {
  it('builds an absolute production URL for a react-vite app', () => {
    expect(appQrUrl('wanderlist-react.html')).toBe('https://coneofcold.vercel.app/wanderlist-react.html')
  })

  it('builds an absolute production URL for a static (legacy) app', () => {
    expect(appQrUrl('kcd2-codex-v3.html')).toBe('https://coneofcold.vercel.app/kcd2-codex-v3.html')
  })
})
