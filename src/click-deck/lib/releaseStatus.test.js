import { describe, it, expect } from 'vitest'
import { readReleaseStatus, isComingSoon, isIgnored, isActiveCollectionGame } from './releaseStatus'

describe('readReleaseStatus', () => {
  it('treats missing/blank as Released', () => {
    expect(readReleaseStatus({})).toBe('Released')
    expect(readReleaseStatus({ releaseStatus: undefined })).toBe('Released')
    expect(readReleaseStatus(null)).toBe('Released')
  })

  it('reads an explicit value through', () => {
    expect(readReleaseStatus({ releaseStatus: 'Coming Soon' })).toBe('Coming Soon')
    expect(readReleaseStatus({ releaseStatus: 'Ignored' })).toBe('Ignored')
  })
})

describe('isComingSoon / isIgnored', () => {
  it('each only matches its own status', () => {
    expect(isComingSoon({ releaseStatus: 'Coming Soon' })).toBe(true)
    expect(isComingSoon({ releaseStatus: 'Ignored' })).toBe(false)
    expect(isIgnored({ releaseStatus: 'Ignored' })).toBe(true)
    expect(isIgnored({ releaseStatus: 'Coming Soon' })).toBe(false)
    expect(isIgnored({})).toBe(false)
  })
})

describe('isActiveCollectionGame', () => {
  it('excludes both Coming Soon and Ignored', () => {
    expect(isActiveCollectionGame({ releaseStatus: 'Coming Soon' })).toBe(false)
    expect(isActiveCollectionGame({ releaseStatus: 'Ignored' })).toBe(false)
  })

  it('includes Released and legacy games with no releaseStatus at all', () => {
    expect(isActiveCollectionGame({ releaseStatus: 'Released' })).toBe(true)
    expect(isActiveCollectionGame({})).toBe(true)
  })
})
