// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { APPS } from '../apps-registry'
import { ThemeProvider } from './lib/themeContext'
import App from './App'

// The Cabinet is the landing page every other app is opened from, so what's
// pinned here is the behaviour a wrong tile costs most: which apps are listed,
// what each tile's action promises, and that a saved order and sort survive a
// registry that keeps growing.

const CABINET_APPS = APPS.filter((a) => a.kind === 'react-vite' || a.kind === 'static')
const REACT_VITE_APPS = APPS.filter((a) => a.kind === 'react-vite')
const STATIC_APPS = APPS.filter((a) => a.kind === 'static')

const DESKTOP_NAV = { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', platform: 'Win32', maxTouchPoints: 0 }
const IPHONE_NAV = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', platform: 'iPhone', maxTouchPoints: 5 }
const ANDROID_NAV = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile Safari/537.36', platform: 'Linux armv8l', maxTouchPoints: 5 }

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  )
}

// App kicks off an async getInstalledRelatedApps() pass on mount; flush it so
// any resulting setState lands inside act() rather than warning afterwards.
async function settle() {
  await act(async () => { await Promise.resolve() })
}

function tileLabels() {
  return screen.queryAllByRole('link').map((l) => l.getAttribute('aria-label'))
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('navigator', DESKTOP_NAV)
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  cleanup()
})

describe('the grid', () => {
  it('lists every registry app that has a kind', async () => {
    renderApp()
    await settle()
    expect(tileLabels()).toHaveLength(CABINET_APPS.length)
    for (const app of CABINET_APPS) {
      expect(screen.getByText(app.title)).toBeTruthy()
    }
  })

  it('never lists a registry entry without a kind', async () => {
    renderApp()
    await settle()
    for (const app of APPS.filter((a) => !a.kind)) {
      expect(screen.queryByText(app.title)).toBeNull()
    }
  })

  it('offers a details sheet (with QR) for every app', async () => {
    renderApp()
    await settle()
    expect(screen.getAllByRole('button', { name: /details for/i })).toHaveLength(CABINET_APPS.length)
  })
})

describe('what a tile promises', () => {
  it('offers Install for an uninstalled react-vite app', async () => {
    renderApp()
    await settle()
    expect(screen.getByRole('link', { name: `Install ${REACT_VITE_APPS[0].title}` })).toBeTruthy()
  })

  it('offers Launch once the app has flagged itself installed', async () => {
    const app = REACT_VITE_APPS[0]
    localStorage.setItem(`installed:${app.file}`, '1')
    renderApp()
    await settle()
    expect(screen.getByRole('link', { name: `Launch ${app.title}` })).toBeTruthy()
  })

  // A static page has no manifest and nothing to install — Codex Alchymicus and
  // the legacy Touch Grass variants are launched, never installed.
  it('only ever offers Open for a static app', async () => {
    renderApp()
    await settle()
    for (const app of STATIC_APPS) {
      expect(screen.getByRole('link', { name: `Open ${app.title}` })).toBeTruthy()
    }
  })

  it('says Open, not Install, on iOS — where no tap can install anything', async () => {
    vi.stubGlobal('navigator', IPHONE_NAV)
    renderApp()
    await settle()
    const app = REACT_VITE_APPS[0]
    expect(screen.queryByRole('link', { name: `Install ${app.title}` })).toBeNull()
    expect(screen.getByRole('link', { name: `Open ${app.title}` })).toBeTruthy()
  })

  it('explains Add to Home Screen once on iOS, and not at all elsewhere', async () => {
    renderApp()
    await settle()
    expect(screen.queryByText(/Add to Home Screen/i)).toBeNull()
    cleanup()

    vi.stubGlobal('navigator', IPHONE_NAV)
    renderApp()
    await settle()
    expect(screen.getAllByText(/Add to Home Screen/i)).toHaveLength(1)
  })
})

// The OS-level intent is what makes Android offer an installed WebAPK at all
// — a same-origin same-tab link tap never triggers that hand-off on its own
// (see browserSupport.js). It's fired unconditionally, regardless of
// `installed` status: gating it on a confirmed install used to mean a
// genuinely-installed app whose flag hadn't been set yet (e.g. added to the
// home screen but never opened standalone once) could never get that first
// standalone launch from the Cabinet — the tap just reopened a browser tab,
// with no way to break the cycle. If no WebAPK claims the URL,
// S.browser_fallback_url just reopens the page, i.e. a plain link's behaviour,
// so there's no real downside to always trying it.
describe('Android launch routing', () => {
  function hrefFor(title) {
    return screen.getByRole('link', { name: new RegExp(`${title}$`) }).getAttribute('href')
  }

  it('uses an OS intent for an app confirmed installed', async () => {
    const app = REACT_VITE_APPS[0]
    localStorage.setItem(`installed:${app.file}`, '1')
    vi.stubGlobal('navigator', ANDROID_NAV)
    renderApp()
    await settle()
    expect(hrefFor(app.title)).toContain('intent://')
    expect(hrefFor(app.title)).toContain(app.file)
  })

  it('still uses an OS intent for an app not (yet) confirmed installed, so a real install always gets found', async () => {
    vi.stubGlobal('navigator', ANDROID_NAV)
    renderApp()
    await settle()
    const app = REACT_VITE_APPS[0]
    expect(hrefFor(app.title)).toContain('intent://')
    expect(hrefFor(app.title)).toContain(app.file)
  })

  it('never uses an intent for a static app, installed flag or not', async () => {
    vi.stubGlobal('navigator', ANDROID_NAV)
    renderApp()
    await settle()
    expect(hrefFor(STATIC_APPS[0].title)).toBe(`/${STATIC_APPS[0].file}`)
  })

  it('leaves non-Android platforms on plain links', async () => {
    const app = REACT_VITE_APPS[0]
    localStorage.setItem(`installed:${app.file}`, '1')
    renderApp()
    await settle()
    expect(hrefFor(app.title)).toBe(`/${app.file}`)
  })
})

describe('the Android "Open by default" hint', () => {
  it('is shown once something is actually installed', async () => {
    localStorage.setItem(`installed:${REACT_VITE_APPS[0].file}`, '1')
    vi.stubGlobal('navigator', ANDROID_NAV)
    renderApp()
    await settle()
    expect(screen.getByText(/Open by default/)).toBeTruthy()
  })

  // Useless advice to someone with nothing installed to set it on.
  it('stays hidden when nothing is installed', async () => {
    vi.stubGlobal('navigator', ANDROID_NAV)
    renderApp()
    await settle()
    expect(screen.queryByText(/Open by default/)).toBeNull()
  })

  it('stays hidden off Android', async () => {
    localStorage.setItem(`installed:${REACT_VITE_APPS[0].file}`, '1')
    renderApp()
    await settle()
    expect(screen.queryByText(/Open by default/)).toBeNull()
  })

  it('stays dismissed across a reload', async () => {
    localStorage.setItem(`installed:${REACT_VITE_APPS[0].file}`, '1')
    vi.stubGlobal('navigator', ANDROID_NAV)
    renderApp()
    await settle()
    await userEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(screen.queryByText(/Open by default/)).toBeNull()

    cleanup()
    renderApp()
    await settle()
    expect(screen.queryByText(/Open by default/)).toBeNull()
  })
})

describe('sorting', () => {
  it('sorts A–Z on demand and remembers the choice', async () => {
    renderApp()
    await settle()
    await userEvent.click(screen.getByRole('radio', { name: 'A–Z' }))

    const titles = tileLabels().map((l) => l.replace(/^(Install|Launch|Open) /, ''))
    expect(titles).toEqual(CABINET_APPS.map((a) => a.title).sort((a, b) => a.localeCompare(b)))
    expect(JSON.parse(localStorage.getItem('cabinet:sort'))).toBe('az')
  })

  it('puts the most recently opened app first under Recent', async () => {
    const [first, second] = CABINET_APPS
    localStorage.setItem('cabinet:lastOpened', JSON.stringify({
      [first.file]: { count: 1, last: 1000 },
      [second.file]: { count: 1, last: 9000 },
    }))
    renderApp()
    await settle()
    await userEvent.click(screen.getByRole('radio', { name: 'Recent' }))
    expect(tileLabels()[0]).toContain(second.title)
  })

  it('puts the most opened app first under Popular, regardless of recency', async () => {
    const [first, second] = CABINET_APPS
    localStorage.setItem('cabinet:lastOpened', JSON.stringify({
      [first.file]: { count: 2, last: 9000 },
      [second.file]: { count: 40, last: 1000 },
    }))
    renderApp()
    await settle()
    await userEvent.click(screen.getByRole('radio', { name: 'Popular' }))
    expect(tileLabels()[0]).toContain(second.title)
  })

  it('disables reordering under an automatic sort, where a move would do nothing', async () => {
    renderApp()
    await settle()
    await userEvent.click(screen.getByRole('radio', { name: 'A–Z' }))
    expect(screen.getByRole('button', { name: /reorder apps/i }).hasAttribute('disabled')).toBe(true)
  })
})

// Below 560px the sort options show marks instead of words (see
// App.module.css). The word must stay in the DOM as an accessible name at
// every width — swapping the visually-hidden span for `display: none` would
// leave screen-reader users four unlabelled radio buttons, and nothing on
// screen would look any different.
describe('sort control labelling', () => {
  it('keeps a word as the accessible name of every sort option', async () => {
    renderApp()
    await settle()
    for (const name of ['Manual', 'Recent', 'Popular', 'A–Z']) {
      expect(screen.getByRole('radio', { name })).toBeTruthy()
    }
  })

  it('hides the decorative marks from assistive tech', async () => {
    renderApp()
    await settle()
    const manual = screen.getByRole('radio', { name: 'Manual' })
    expect(manual.querySelector('[aria-hidden="true"] svg')).toBeTruthy()
  })
})

describe('manual order', () => {
  it('honours a saved order and appends apps added to the registry since', async () => {
    const [first, second] = CABINET_APPS
    // Only two ids saved — every other app must still appear, at the end.
    localStorage.setItem('cabinet:order', JSON.stringify([second.file, first.file]))
    renderApp()
    await settle()
    const labels = tileLabels()
    expect(labels[0]).toContain(second.title)
    expect(labels[1]).toContain(first.title)
    expect(labels).toHaveLength(CABINET_APPS.length)
  })

  it('drops a saved id that is no longer in the registry', async () => {
    localStorage.setItem('cabinet:order', JSON.stringify(['deleted-app.html', ...CABINET_APPS.map((a) => a.file)]))
    renderApp()
    await settle()
    expect(tileLabels()).toHaveLength(CABINET_APPS.length)
  })

  it('moves a tile down and persists the new order', async () => {
    renderApp()
    await settle()
    await userEvent.click(screen.getByRole('button', { name: /reorder apps/i }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0])

    const saved = JSON.parse(localStorage.getItem('cabinet:order'))
    expect(saved[0]).toBe(CABINET_APPS[1].file)
    expect(saved[1]).toBe(CABINET_APPS[0].file)
  })

  it('drops the launch links while reordering, so a tap moves rather than navigates', async () => {
    renderApp()
    await settle()
    await userEvent.click(screen.getByRole('button', { name: /reorder apps/i }))
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})

describe('search', () => {
  it('filters by title', async () => {
    renderApp()
    await settle()
    await userEvent.type(screen.getByRole('searchbox', { name: /search apps/i }), CABINET_APPS[0].title)
    const labels = tileLabels()
    expect(labels.length).toBeGreaterThan(0)
    expect(labels.every((l) => l.includes(CABINET_APPS[0].title))).toBe(true)
  })

  it('filters by tag as well as title', async () => {
    const tagged = REACT_VITE_APPS.find((a) => (a.tags || []).includes('notion'))
    renderApp()
    await settle()
    await userEvent.type(screen.getByRole('searchbox', { name: /search apps/i }), 'notion')
    const shown = tileLabels().length
    expect(shown).toBeGreaterThan(0)
    expect(shown).toBeLessThan(CABINET_APPS.length)
    expect(screen.getByText(tagged.title)).toBeTruthy()
  })

  it('shows nothing for a query that matches no app', async () => {
    renderApp()
    await settle()
    await userEvent.type(screen.getByRole('searchbox', { name: /search apps/i }), 'zzzznotanapp')
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('is hidden while reordering, where a filtered grid would desync the move targets', async () => {
    renderApp()
    await settle()
    await userEvent.click(screen.getByRole('button', { name: /reorder apps/i }))
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})

describe('?resetStats=1', () => {
  it('wipes open stats but leaves order and sort alone, then strips the param', async () => {
    localStorage.setItem('cabinet:lastOpened', JSON.stringify({ 'x.html': { count: 5, last: 1 } }))
    localStorage.setItem('cabinet:sort', JSON.stringify('az'))
    localStorage.setItem('cabinet:order', JSON.stringify(CABINET_APPS.map((a) => a.file)))
    window.history.replaceState({}, '', '/cabinet.html?resetStats=1')

    renderApp()
    await settle()

    expect(JSON.parse(localStorage.getItem('cabinet:lastOpened'))).toEqual({})
    expect(JSON.parse(localStorage.getItem('cabinet:sort'))).toBe('az')
    expect(JSON.parse(localStorage.getItem('cabinet:order'))).toHaveLength(CABINET_APPS.length)
    // Stripped so a refresh doesn't wipe a second time.
    expect(window.location.search).toBe('')
  })
})
