// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { Repo, memoryStore } from './store/repo'
import { demoCurator } from './dev/demoCurator'
import { CuratorUnavailable, type CuratorClient } from './curation/api'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/'
})
afterEach(cleanup)

// The demo curator's canned answers stand in for Claude; the store is memory.
const curator = (): CuratorClient => {
  const demo = demoCurator()
  return { call: (op, payload) => (op === 'status' ? Promise.reject(new CuratorUnavailable('not-set-up', 'x')) : demo.call(op, payload)) }
}

describe('The Long Listen', () => {
  it('goes from three directions to a programme with named recordings', async () => {
    const repo = new Repo(memoryStore())
    render(<App repo={repo} curator={curator()} />)
    expect(await screen.findByText('Three ways into the week', {}, { timeout: 4000 })).toBeTruthy()
    const choose = screen.getAllByRole('button', { name: 'Listen this way →' })
    expect(choose).toHaveLength(3)

    await userEvent.click(choose[0])
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/p\//), { timeout: 4000 })
    expect(await screen.findByRole('heading', { name: 'La mer' }, { timeout: 4000 })).toBeTruthy()
    expect(screen.getAllByText('Pierre Boulez · The Cleveland Orchestra').length).toBeGreaterThan(0)
    expect(screen.getByText('Same work, two perspectives')).toBeTruthy()

    // The other two directions are kept open, not discarded.
    const options = await repo.options.all()
    expect(options.filter((o) => o.status === 'open')).toHaveLength(2)
  }, 15000)

  it('never shows a streak, a score or a statistic', async () => {
    render(<App repo={new Repo(memoryStore())} curator={curator()} />)
    await screen.findByText('Three ways into the week', {}, { timeout: 4000 })
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/streak|points|badge|minutes listened|days listened|%|level \d|xp\b/i)
  })

  it('explains, without a stack trace, when the curator is locked', async () => {
    const locked: CuratorClient = { call: () => Promise.reject(new CuratorUnavailable('locked', 'The curator needs your passphrase — add it in Settings.')) }
    render(<App repo={new Repo(memoryStore())} curator={locked} />)
    expect(await screen.findByText('Before the first programme')).toBeTruthy()
    expect(screen.getByText('The curator needs your passphrase — add it in Settings.')).toBeTruthy()
  })
})
