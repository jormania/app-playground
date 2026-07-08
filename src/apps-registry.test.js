import { describe, it, expect } from 'vitest'
import { APPS } from './apps-registry'

const REACT_VITE_TITLES = [
  'Law of the Day',
  'Tempo',
  'Sol Odyssey',
  'Touch Grass',
  'Journal of Delights',
  'Kettlebell Training',
  'Yoru',
  'Wanderlist',
]

const STATIC_TITLES = ['Touch Grass · Original', 'Touch Grass · Thrive', 'Touch Grass · Nora', 'Codex Alchymicus — KCD2']

describe('APPS registry', () => {
  it('marks exactly the eight Vite+React apps as kind: "react-vite"', () => {
    const reactViteApps = APPS.filter((app) => app.kind === 'react-vite')
    expect(reactViteApps.map((app) => app.title).sort()).toEqual([...REACT_VITE_TITLES].sort())
  })

  it('gives every react-vite app a manifest path', () => {
    const reactViteApps = APPS.filter((app) => app.kind === 'react-vite')
    for (const app of reactViteApps) {
      expect(app.manifest, `${app.title} is missing a manifest path`).toMatch(/^\/.+\.webmanifest$/)
    }
  })

  it('marks exactly the four legacy apps as kind: "static"', () => {
    const staticApps = APPS.filter((app) => app.kind === 'static')
    expect(staticApps.map((app) => app.title).sort()).toEqual([...STATIC_TITLES].sort())
  })

  it('gives no non-react-vite app a manifest path', () => {
    const nonReactViteApps = APPS.filter((app) => app.kind !== 'react-vite')
    for (const app of nonReactViteApps) {
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
