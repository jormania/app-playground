import { test, expect, describe } from 'vitest'
import { shareText, whatsappUrl, emailUrl } from './share.js'

const entry = {
  name: 'Anim’est closing night',
  description: 'shorts + gala at Cinema Pro',
  place: 'Cinema Pro, București',
  placeUrl: 'https://maps.example/pin',
  link: 'https://animest.ro',
}

describe('shareText', () => {
  test('name, note, then place + links footer; no metadata', () => {
    expect(shareText(entry)).toBe(
      'Anim’est closing night\n\nshorts + gala at Cinema Pro\n\n📍 Cinema Pro, București\nhttps://maps.example/pin\n🔗 https://animest.ro'
    )
  })
  test('bare item is just the name', () => {
    expect(shareText({ name: 'A cinema' })).toBe('A cinema')
    expect(shareText({})).toBe('Something to see')
  })
  test('omits empty parts', () => {
    expect(shareText({ name: 'X', link: 'https://x' })).toBe('X\n\n🔗 https://x')
  })
})

describe('whatsappUrl', () => {
  test('wa.me link carrying the full text', () => {
    const url = whatsappUrl({ name: 'Jazz', link: 'https://x' })
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1])).toBe('Jazz\n\n🔗 https://x')
  })
})

describe('emailUrl', () => {
  test('name becomes the subject; body is note + footer only', () => {
    const url = emailUrl(entry)
    const subject = decodeURIComponent(url.match(/subject=([^&]*)/)[1])
    const body = decodeURIComponent(url.match(/body=([^&]*)/)[1])
    expect(subject).toBe('Anim’est closing night')
    expect(body).toBe('shorts + gala at Cinema Pro\n\n📍 Cinema Pro, București\nhttps://maps.example/pin\n🔗 https://animest.ro')
    expect(body).not.toContain('Anim’est') // the name is only in the subject
  })
})
