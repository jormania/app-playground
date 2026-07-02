import { describe, it, expect } from 'vitest'
import { APPS } from './apps-registry'

const REACT_VITE_TITLES = [
  'Law of the Day',
  'Tempo',
  'Sol Odyssey',
  'Touch Grass, a React Journey',
  'Journal of Delights',
  'Kettlebell Training',
]

describe('APPS registry', () => {
  it('marks exactly the six Vite+React apps as kind: "react-vite"', () => {
    const reactViteApps = APPS.filter((app) => app.kind === 'react-vite')
    expect(reactViteApps.map((app) => app.title).sort()).toEqual([...REACT_VITE_TITLES].sort())
  })

  it('gives every react-vite app a manifest path', () => {
    const reactViteApps = APPS.filter((app) => app.kind === 'react-vite')
    for (const app of reactViteApps) {
      expect(app.manifest, `${app.title} is missing a manifest path`).toMatch(/^\/.+\.webmanifest$/)
    }
  })

  it('leaves the static/hand-authored apps unmarked', () => {
    const staticApps = APPS.filter((app) => app.kind !== 'react-vite')
    for (const app of staticApps) {
      expect(app.manifest, `${app.title} shouldn't have a manifest path`).toBeUndefined()
    }
  })

  it('every app has a title, file, and description', () => {
    for (const app of APPS) {
      expect(app.title).toBeTruthy()
      expect(app.file).toBeTruthy()
      expect(app.description).toBeTruthy()
    }
  })
})
