// @vitest-environment happy-dom
import { test, expect, describe, vi, beforeEach } from 'vitest'
import { mapsLink, openTickets } from './links.js'

describe('mapsLink', () => {
  test('prefers the resolved placeUrl', () => {
    expect(mapsLink('Cinema Pro', 'https://maps.example/pin')).toBe('https://maps.example/pin')
  })
  test('falls back to a Maps search by name when there is no placeUrl', () => {
    expect(mapsLink('Cinema Pro, București', '')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Cinema%20Pro%2C%20Bucure%C8%99ti'
    )
  })
  test('null when there is no place at all', () => {
    expect(mapsLink('', '')).toBe(null)
    expect(mapsLink(null, null)).toBe(null)
  })
})

describe('openTickets', () => {
  let openSpy
  beforeEach(() => {
    openSpy?.mockRestore()
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  test('one ticket opens it directly', () => {
    const onOpen = vi.fn()
    openTickets({ tickets: [{ url: 'https://x.example/t.pdf' }] }, onOpen)
    expect(openSpy).toHaveBeenCalledWith('https://x.example/t.pdf', '_blank', 'noopener')
    expect(onOpen).not.toHaveBeenCalled()
  })
  test('more than one opens the entry instead', () => {
    const onOpen = vi.fn()
    const entry = { tickets: [{ url: 'https://x.example/a.pdf' }, { url: 'https://x.example/b.pdf' }] }
    openTickets(entry, onOpen)
    expect(openSpy).not.toHaveBeenCalled()
    expect(onOpen).toHaveBeenCalledWith(entry)
  })
  test('no tickets does nothing', () => {
    const onOpen = vi.fn()
    openTickets({ tickets: [] }, onOpen)
    expect(openSpy).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })
})
