// Text on the accent reads at 4.5:1 or better (WCAG AA) in both themes. The
// dark theme once swapped the accent to a light blue and kept the light
// theme's cream text on it: 2.3:1, on every main button and selected option
// of every app on the design system (KeyPath audit, 2026-10-28).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const block = (selector) => css.slice(css.indexOf(selector), css.indexOf('}', css.indexOf(selector)))
const token = (text, name) => text.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('text on the accent', () => {
  it('reads at 4.5:1 or better on the dark theme’s accent and its hover', () => {
    const dark = block(':root[data-theme="dark"]')
    const onAccent = token(dark, 'color-on-accent')
    expect(onAccent).toBeTruthy()
    for (const name of ['color-accent', 'color-accent-hover']) expect(contrast(onAccent, token(dark, name))).toBeGreaterThanOrEqual(4.5)
  })
})
