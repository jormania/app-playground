import React, { useState, useEffect } from 'react'
import { isDiscountBannerPersistent, setDiscountBannerPersistent, clearDiscountBannerSnooze } from '../lib/priceTracking'
import { isReleaseBannerPersistent, setReleaseBannerPersistent, clearReleaseBannerSnooze } from '../lib/releaseTracking'
import { StudiosConnector, SEED_STUDIOS } from '../lib/studios-connector'

export function SettingsModal({ onClose, onSaveToken, onShowBannerNow, onShowReleaseBannerNow, onResetDb }) {
  const [token, setToken] = useState(localStorage.getItem('cd_notion_token') || '')
  const [dbId, setDbId] = useState(localStorage.getItem('cd_notion_db') || '')
  const [theme, setTheme] = useState(localStorage.getItem('cd_theme') || 'union')
  const [crtEffect, setCrtEffect] = useState(localStorage.getItem('cd_crt_effect') === 'true')
  const [randomWeight, setRandomWeight] = useState(localStorage.getItem('cd_random_weight') || 'uniform')
  const [bannerPersistent, setBannerPersistent] = useState(() => isDiscountBannerPersistent())
  const [bannerStatus, setBannerStatus] = useState('')
  const [releaseBannerPersistentState, setReleaseBannerPersistentState] = useState(() => isReleaseBannerPersistent())
  const [releaseBannerStatus, setReleaseBannerStatus] = useState('')
  const [status, setStatus] = useState('')

  const [studios, setStudios] = useState([])
  const [studiosLoading, setStudiosLoading] = useState(false)
  const [newStudioName, setNewStudioName] = useState('')
  const [newStudioDev, setNewStudioDev] = useState('')
  const [studiosStatus, setStudiosStatus] = useState('')

  const loadStudios = async () => {
    if (!StudiosConnector.isInitialized()) return
    setStudiosLoading(true)
    try {
      setStudios(await StudiosConnector.getStudios())
    } catch (err) {
      setStudiosStatus(`Failed to load studios: ${err.message}`)
    }
    setStudiosLoading(false)
  }

  useEffect(() => { loadStudios() }, [])

  const handleCreateDb = async () => {
    if (!token) {
      setStatus('Please enter a Notion Integration Token first.')
      return
    }
    if (dbId) {
      const confirm = window.confirm('You already have a Database ID entered. Initializing a new schema will ignore it. Continue?')
      if (!confirm) return
    }
    setStatus('Creating database in Notion...')
    
    // Hardcoded parent page ID provided by user
    const parentPageId = '390d3e6d-60db-81a7-92dd-de76b056e2d2'
    
    const schema = {
      parent: { type: 'page_id', page_id: parentPageId },
      title: [{ type: 'text', text: { content: 'Click Deck' } }],
      properties: {
        'Title': { title: {} },
        'Release Year': { number: { format: 'number' } },
        'Developer/Studio': { select: {} },
        'Tags': { multi_select: {} },
        'Status': { 
          select: {
            options: [
              { name: 'Backlog', color: 'gray' },
              { name: 'Playing', color: 'blue' },
              { name: 'Completed', color: 'yellow' },
              { name: 'Abandoned', color: 'red' }
            ]
          }
        },
        'Rating': { number: { format: 'number' } },
        'Journal/Notes': { rich_text: {} },
        'Platform': { select: {} }
      }
    }

    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-notion-token': token
        },
        body: JSON.stringify({
          path: 'databases',
          method: 'POST',
          body: schema
        })
      })
      
      const data = await res.json()
      if (res.ok) {
        setStatus(`Success! DB Created. ID: ${data.id}`)
        setDbId(data.id)
        localStorage.setItem('cd_notion_db', data.id)
      } else {
        setStatus(`Error: ${data.message || JSON.stringify(data)}`)
      }
    } catch (err) {
      setStatus(`Failed to reach proxy: ${err.message}`)
    }
  }

  const handleInitStudiosDb = async () => {
    if (!token) {
      setStudiosStatus('Please enter a Notion Integration Token first.')
      return
    }
    if (StudiosConnector.getDbId()) {
      const confirmed = window.confirm('You already have a Followed Studios database configured. Initializing a new one will replace it. Continue?')
      if (!confirmed) return
    }
    setStudiosStatus('Creating Followed Studios database in Notion...')
    // Same parent page as the main Click Deck DB, so both sit under the same
    // Click Deck heading in the workspace's App Databases section.
    const parentPageId = '390d3e6d-60db-81a7-92dd-de76b056e2d2'
    const schema = {
      parent: { type: 'page_id', page_id: parentPageId },
      title: [{ type: 'text', text: { content: 'Click Deck — Followed Studios' } }],
      properties: {
        'Title': { title: {} },
        'Steam Developer': { rich_text: {} },
        'Notes': { rich_text: {} }
      }
    }
    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-notion-token': token },
        body: JSON.stringify({ path: 'databases', method: 'POST', body: schema })
      })
      const data = await res.json()
      if (res.ok) {
        StudiosConnector.setDbId(data.id)
        setStudiosStatus('Database created — seeding starter studios...')
        await StudiosConnector.seedIfEmpty()
        await loadStudios()
        setStudiosStatus('Followed Studios database ready.')
      } else {
        setStudiosStatus(`Error: ${data.message || JSON.stringify(data)}`)
      }
    } catch (err) {
      setStudiosStatus(`Failed to reach proxy: ${err.message}`)
    }
  }

  const handleAddStudio = async () => {
    if (!newStudioName.trim()) return
    try {
      const added = await StudiosConnector.addStudio({ name: newStudioName.trim(), steamDeveloper: newStudioDev.trim() })
      setStudios(prev => [...prev, added])
      setNewStudioName('')
      setNewStudioDev('')
    } catch (err) {
      setStudiosStatus(`Failed to add studio: ${err.message}`)
    }
  }

  const handleRemoveStudio = async (id) => {
    const previous = studios
    setStudios(prev => prev.filter(s => s.id !== id))
    try {
      await StudiosConnector.removeStudio(id)
    } catch (err) {
      setStudios(previous)
      setStudiosStatus(`Failed to remove studio: ${err.message}`)
    }
  }

  const handleSave = () => {
    localStorage.setItem('cd_notion_token', token)
    localStorage.setItem('cd_notion_db', dbId)
    localStorage.setItem('cd_theme', theme)
    localStorage.setItem('cd_crt_effect', crtEffect ? 'true' : 'false')
    localStorage.setItem('cd_random_weight', randomWeight)
    setDiscountBannerPersistent(bannerPersistent)
    setReleaseBannerPersistent(releaseBannerPersistentState)
    document.documentElement.setAttribute('data-theme', theme)
    if (onSaveToken) onSaveToken()
    onClose()
  }

  // The safety net for "I dismissed the sale banner by accident and want it
  // back now" — acts immediately, independent of Save, rather than making the
  // user wait out the 24h snooze.
  const handleShowBannerNow = () => {
    clearDiscountBannerSnooze()
    if (onShowBannerNow) onShowBannerNow()
    setBannerStatus('Banner will show again now (if there are active discounts).')
  }

  // Same recovery pattern, own key, for the release banner.
  const handleShowReleaseBannerNow = () => {
    clearReleaseBannerSnooze()
    if (onShowReleaseBannerNow) onShowReleaseBannerNow()
    setReleaseBannerStatus('Banner will show again now (if anything released recently).')
  }

  return (
    <div className="cd-modal-overlay">
      <div className="cd-modal cd-panel" style={{ maxWidth: '500px' }}>
        <div className="cd-modal-header">
          <h2>SYSTEM_SETTINGS</h2>
          <button className="cd-btn-icon" onClick={onClose} aria-label="Close">[X]</button>
        </div>
        
        <div className="cd-form-group">
          <label>NOTION INTEGRATION TOKEN</label>
          <input 
            type="password" 
            value={token} 
            onChange={e => setToken(e.target.value)} 
            placeholder="secret_..."
          />
        </div>

        <div className="cd-form-group">
          <label>DATABASE ID</label>
          <input 
            type="text" 
            value={dbId} 
            onChange={e => setDbId(e.target.value)} 
            placeholder="UUID of existing DB"
          />
        </div>

        <div className="cd-form-group">
          <label>AESTHETIC THEME</label>
          <select 
            value={theme}
            onChange={e => {
              setTheme(e.target.value)
              document.documentElement.setAttribute('data-theme', e.target.value)
            }}
            style={{ width: '100%', padding: '0.8rem', background: 'var(--cd-bg-dark)', color: 'var(--cd-accent-cyan)', border: '1px solid var(--cd-border-color)', fontFamily: 'var(--cd-font-terminal)', fontSize: '1rem', outline: 'none' }}
          >
            <option value="union">Union City (Cyan/Amber)</option>
            <option value="voodoo">Voodoo (Toxic/Purple)</option>
            <option value="noir">Noir (Grayscale/Gold)</option>
            <option value="sierra">Sierra Nights (Indigo/Gold)</option>
            <option value="amber-terminal">Amber Terminal (DOS CRT)</option>
            <option value="cga">CGA (Cyan/Magenta)</option>
          </select>
        </div>

        <div className="cd-form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={crtEffect}
              onChange={e => {
                setCrtEffect(e.target.checked)
                document.documentElement.setAttribute('data-crt', e.target.checked ? 'true' : 'false')
              }}
              style={{ width: 'auto' }}
            />
            RETRO CRT MODE
          </label>
          <p style={{ fontSize: '0.85rem', color: 'var(--cd-text-muted)', margin: '0.3rem 0 0' }}>
            Scanlines, a screen vignette, and viewfinder corner brackets on every panel.
          </p>
        </div>

        <div className="cd-form-group">
          <label>RANDOM PICK WEIGHTING</label>
          <select
            value={randomWeight}
            onChange={e => setRandomWeight(e.target.value)}
            style={{ width: '100%', padding: '0.8rem', background: 'var(--cd-bg-dark)', color: 'var(--cd-accent-cyan)', border: '1px solid var(--cd-border-color)', fontFamily: 'var(--cd-font-terminal)', fontSize: '1rem', outline: 'none' }}
          >
            <option value="uniform">Uniform (equal odds)</option>
            <option value="oldest">Favor oldest backlog entries</option>
            <option value="cheapest">Favor cheapest entries</option>
          </select>
          <p style={{ fontSize: '0.85rem', color: 'var(--cd-text-muted)', margin: '0.3rem 0 0' }}>
            Controls how [R] picks your next playthrough from the backlog.
          </p>
        </div>

        <div className="cd-form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={bannerPersistent}
              onChange={e => setBannerPersistent(e.target.checked)}
              style={{ width: 'auto' }}
            />
            SALE BANNER: ALWAYS SHOW (DON'T AUTO-DISMISS)
          </label>
          <p style={{ fontSize: '0.85rem', color: 'var(--cd-text-muted)', margin: '0.3rem 0 0' }}>
            Off by default: dismissing the banner snoozes it for 24 hours. Turn this on to keep it visible permanently whenever anything's on sale.
          </p>
          <div style={{ marginTop: '0.8rem' }}>
            <button type="button" onClick={handleShowBannerNow}>Show Sale Banner Now</button>
            <p style={{ fontSize: '0.85rem', color: 'var(--cd-text-muted)', margin: '0.4rem 0 0' }}>
              Dismissed it by accident? This clears the snooze immediately — no need to wait for tomorrow.
            </p>
            {bannerStatus && <div style={{ color: 'var(--cd-accent-cyan)', fontSize: '0.9rem', marginTop: '0.4rem' }}>{bannerStatus}</div>}
          </div>
        </div>

        <div className="cd-form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={releaseBannerPersistentState}
              onChange={e => setReleaseBannerPersistentState(e.target.checked)}
              style={{ width: 'auto' }}
            />
            RELEASE BANNER: ALWAYS SHOW (DON'T AUTO-DISMISS)
          </label>
          <p style={{ fontSize: '0.85rem', color: 'var(--cd-text-muted)', margin: '0.3rem 0 0' }}>
            Same idea as the sale banner: off by default (24h snooze on dismiss), or keep it permanently visible whenever something released recently.
          </p>
          <div style={{ marginTop: '0.8rem' }}>
            <button type="button" onClick={handleShowReleaseBannerNow}>Show Release Banner Now</button>
            <p style={{ fontSize: '0.85rem', color: 'var(--cd-text-muted)', margin: '0.4rem 0 0' }}>
              Dismissed it by accident? This clears the snooze immediately.
            </p>
            {releaseBannerStatus && <div style={{ color: 'var(--cd-accent-cyan)', fontSize: '0.9rem', marginTop: '0.4rem' }}>{releaseBannerStatus}</div>}
          </div>
        </div>

        <div className="cd-form-group" style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid var(--cd-border-color)', background: 'rgba(0, 0, 0, 0.2)' }}>
          <label style={{ marginBottom: '0.5rem', display: 'block' }}>FOLLOWED STUDIOS</label>
          <p style={{ fontSize: '0.95rem', color: 'var(--cd-text-muted)', marginBottom: '1rem', lineHeight: '1.4' }}>
            The studios [W]'s "Find New Games" searches for unreleased/uncollected titles. Lives in its own Notion database so it syncs across devices, same as your collection.
          </p>
          {!StudiosConnector.getDbId() ? (
            <button type="button" onClick={handleInitStudiosDb}>Initialize Followed Studios Database</button>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Studio name..."
                  value={newStudioName}
                  onChange={e => setNewStudioName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="text"
                  placeholder="Exact Steam developer tag (optional)"
                  value={newStudioDev}
                  onChange={e => setNewStudioDev(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={handleAddStudio} style={{ whiteSpace: 'nowrap' }}>+ ADD</button>
              </div>
              {studiosLoading ? (
                <p className="cd-text-muted">Loading...</p>
              ) : studios.length === 0 ? (
                <p className="cd-text-muted">No studios yet — add one above, or seed the {SEED_STUDIOS.length} starter studios below.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {studios.map(s => (
                    <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                      <span>{s.name}{s.steamDeveloper ? ` (${s.steamDeveloper})` : ''}</span>
                      <button type="button" className="cd-btn-icon" onClick={() => handleRemoveStudio(s.id)}>[X]</button>
                    </li>
                  ))}
                </ul>
              )}
              {studios.length === 0 && !studiosLoading && (
                <button type="button" style={{ marginTop: '0.8rem' }} onClick={async () => { await StudiosConnector.seedIfEmpty(); await loadStudios() }}>
                  Seed Starter Studios
                </button>
              )}
            </>
          )}
          {studiosStatus && <div style={{ color: 'var(--cd-accent-cyan)', fontSize: '0.9rem', marginTop: '0.6rem' }}>{studiosStatus}</div>}
        </div>

        <div className="cd-form-group" style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid var(--cd-border-color)', background: 'rgba(0, 0, 0, 0.2)' }}>
          <label style={{ marginBottom: '0.5rem', display: 'block' }}>DATABASE ACTIONS</label>
          <p style={{ fontSize: '0.95rem', color: 'var(--cd-text-muted)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
            Initialize a new schema, seed mock data, or factory reset the local application state.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button type="button" onClick={handleCreateDb}>Initialize New Database Schema</button>
            <button type="button" onClick={async () => {
              setStatus('Checking database state...')
              try {
                const { McpConnector } = await import('../lib/mcp-connector.js')
                
                // Safety check: is DB already populated?
                const existingGames = await McpConnector.getGames()
                if (existingGames && existingGames.length > 0) {
                  const confirm = window.confirm('This database already contains data. Seeding it again will create duplicates. Are you absolutely sure?')
                  if (!confirm) {
                    setStatus('Seeding cancelled.')
                    return
                  }
                }
                
                setStatus('Seeding database... please wait.')
                await McpConnector.initializeMockData()
                setStatus('Seeding complete! You may close settings.')
              } catch(e) {
                setStatus('Seeding failed: ' + e.message)
              }
            }}>Populate Seed Data</button>
            <button type="button" onClick={async () => {
              setStatus('Patching database schema...')
              try {
                const { McpConnector } = await import('../lib/mcp-connector.js')
                await McpConnector.updateDatabaseSchema()
                setStatus('Database schema successfully patched for Live Pricing!')
              } catch (err) {
                setStatus('Failed to patch schema: ' + err.message)
              }
            }}>Patch Database for Pricing Schema</button>
            <button type="button" onClick={async () => {
              setStatus('Patching database schema...')
              try {
                const { McpConnector } = await import('../lib/mcp-connector.js')
                await McpConnector.updateWatchlistSchema()
                setStatus('Database schema successfully patched for the Watchlist!')
              } catch (err) {
                setStatus('Failed to patch schema: ' + err.message)
              }
            }}>Patch Database for Watchlist Schema</button>
            <button type="button" onClick={() => {
              const confirm = window.prompt('Are you sure you want to completely wipe the local DB state? Type "RESET" to confirm.')
              if(confirm === 'RESET') {
                if (onResetDb) onResetDb()
                setStatus('Database state reset successfully.')
              } else {
                setStatus('Factory reset cancelled.')
              }
            }} style={{ color: 'var(--cd-accent-amber)', borderColor: 'var(--cd-accent-amber)' }}>
              ⚠️ Factory Reset DB State
            </button>
            {status && <div style={{ color: 'var(--cd-accent-cyan)', fontSize: '0.9rem' }}>{status}</div>}
          </div>
        </div>

        <div className="cd-modal-actions">
          <button onClick={onClose}>CANCEL</button>
          <button className="primary" onClick={handleSave}>SAVE_SETTINGS</button>
        </div>
      </div>
    </div>
  )
}
