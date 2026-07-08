import { test, expect, describe } from 'vitest'
import { shareText } from './share.js'

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
