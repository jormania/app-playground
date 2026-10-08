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
  return { call: (op, payload) => demo.call(op, payload) }
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

  it('asks for three other directions and keeps the first three open', async () => {
    const repo = new Repo(memoryStore())
    render(<App repo={repo} curator={curator()} />)
    await screen.findByText('Three ways into the week', {}, { timeout: 4000 })
    await userEvent.click(screen.getByRole('button', { name: 'None of these? Ask for three others' }))
    await userEvent.type(screen.getByLabelText(/What are you in the mood for/), 'Something quieter')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))
    await waitFor(async () => expect((await repo.options.all()).filter((o) => o.status === 'open')).toHaveLength(3), { timeout: 4000 })
  }, 15000)

  it('fills the journal and the library once a week has been listened to', async () => {
    const repo = new Repo(memoryStore())
    render(<App repo={repo} curator={curator()} />)
    await screen.findByText('Three ways into the week', {}, { timeout: 4000 })
    await userEvent.click(screen.getAllByRole('button', { name: 'Listen this way →' })[0])
    await screen.findByRole('heading', { name: 'La mer' }, { timeout: 4000 })
    await userEvent.click(screen.getAllByRole('radio', { name: 'Heard' })[0])

    window.location.hash = '#/journal'
    expect(await screen.findByText('The weeks so far')).toBeTruthy()
    expect(await screen.findByRole('link', { name: 'The orchestra becomes colour' })).toBeTruthy()
    expect(screen.getAllByText(/left open/)).toHaveLength(2)

    window.location.hash = '#/library'
    expect(await screen.findByText('Everything met so far')).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Claude Debussy' })).toBeTruthy()
    await userEvent.type(screen.getByLabelText('Search the library'), 'monteux')
    expect(screen.queryByRole('heading', { name: 'Claude Debussy' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Maurice Ravel' })).toBeTruthy()
  }, 20000)

  it('settings offers each connection with a test, and preferences', async () => {
    window.location.hash = '#/settings'
    localStorage.setItem('long-listen:settings', JSON.stringify({ anthropicKey: 'sk-ant-api03-test' }))
    render(<App repo={new Repo(memoryStore())} curator={curator()} />)
    expect(await screen.findByLabelText('Anthropic API key')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Test the key' })).toBeTruthy()
    expect(screen.getByLabelText('Spotify Client ID')).toBeTruthy()
    expect(screen.getByLabelText('Notion integration token')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Test Notion' })).toBeTruthy()
    expect(screen.getByText('How you listen')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Test the key' }))
    expect(await screen.findByText(/The curator is ready/)).toBeTruthy()
  })

  it('explains, without a stack trace, when the curator is locked', async () => {
    const locked: CuratorClient = { call: () => Promise.reject(new CuratorUnavailable('locked', 'The curator needs your Anthropic key — add it in Settings, then test it.')) }
    render(<App repo={new Repo(memoryStore())} curator={locked} />)
    expect(await screen.findByText('Before the first programme')).toBeTruthy()
    expect(screen.getByText('The curator needs your Anthropic key — add it in Settings, then test it.')).toBeTruthy()
  })
})
