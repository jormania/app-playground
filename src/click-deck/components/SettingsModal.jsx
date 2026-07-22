import React, { useState, useEffect } from 'react'
import { isDiscountBannerPersistent, setDiscountBannerPersistent, clearDiscountBannerSnooze } from '../lib/priceTracking'
import { isReleaseBannerPersistent, setReleaseBannerPersistent, clearReleaseBannerSnooze } from '../lib/releaseTracking'
import { StudiosConnector, tierAccentColor } from '../lib/studios-connector'

export function SettingsModal({ onClose, onSaveToken, onShowBannerNow, onShowReleaseBannerNow }) {
  const [token, setToken] = useState(localStorage.getItem('cd_notion_token') || '')
  const [dbId, setDbId] = useState(localStorage.getItem('cd_notion_db') || '')
  const [theme, setTheme] = useState(localStorage.getItem('cd_theme') || 'union')
  const [crtEffect, setCrtEffect] = useState(localStorage.getItem('cd_crt_effect') === 'true')
  const [randomWeight, setRandomWeight] = useState(localStorage.getItem('cd_random_weight') || 'uniform')
  const [bannerPersistent, setBannerPersistent] = useState(() => isDiscountBannerPersistent())
  const [bannerStatus, setBannerStatus] = useState('')
  const [releaseBannerPersistentState, setReleaseBannerPersistentState] = useState(() => isReleaseBannerPersistent())
  const [releaseBannerStatus, setReleaseBannerStatus] = useState('')

  const [studiosDbId, setStudiosDbId] = useState(() => StudiosConnector.getDbId() || '')
  const [studios, setStudios] = useState([])
  const [studiosLoading, setStudiosLoading] = useState(false)
  const [newStudioName, setNewStudioName] = useState('')
  const [newStudioDev, setNewStudioDev] = useState('')
  const [newStudioTier, setNewStudioTier] = useState('')
  const [newStudioNotes, setNewStudioNotes] = useState('')
  const [studiosStatus, setStudiosStatus] = useState('')
  const [editingStudioId, setEditingStudioId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)

  // Loads the studio list and, the first time it finds an empty-but-connected
  // database, seeds the starter studios automatically — no button to click.
  // A freshly duplicated Starter Template database always starts empty, so
  // this is the expected first-connection experience, not a hidden side effect.
  const loadStudios = async () => {
    if (!StudiosConnector.isInitialized()) return
    setStudiosLoading(true)
    try {
      let list = await StudiosConnector.getStudios()
      if (list.length === 0 && StudiosConnector.hasRemoteDb()) {
        list = await StudiosConnector.seedIfEmpty()
        if (list.length > 0) setStudiosStatus(`Seeded ${list.length} starter studios.`)
      }
      setStudios(list)
    } catch (err) {
      setStudiosStatus(`Failed to load studios: ${err.message}`)
    }
    setStudiosLoading(false)
  }

  useEffect(() => { loadStudios() }, [])

  // Pasting an existing Followed Studios database ID (e.g. on a second
  // device, or a fresh duplicate of the Notion Starter Template) is an
  // immediate, independent action — same as add/remove studio below — rather
  // than waiting on the main Save button, so the list loads right away.
  const handleConnectStudiosDb = async () => {
    if (!studiosDbId.trim()) {
      setStudiosStatus('Paste a Followed Studios database ID first.')
      return
    }
    StudiosConnector.setDbId(studiosDbId.trim())
    setStudiosStatus('Connecting...')
    await loadStudios()
    setStudiosStatus(StudiosConnector.getDbId() ? 'Connected.' : '')
  }

  const handleAddStudio = async () => {
    if (!newStudioName.trim()) return
    try {
      const tier = newStudioTier.trim() ? Number(newStudioTier) : null
      const added = await StudiosConnector.addStudio({
        name: newStudioName.trim(),
        steamDeveloper: newStudioDev.trim(),
        notes: newStudioNotes.trim(),
        valueTier: Number.isFinite(tier) ? tier : null
      })
      setStudios(prev => [...prev, added])
      setNewStudioName('')
      setNewStudioDev('')
      setNewStudioTier('')
      setNewStudioNotes('')
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

  const handleStartEdit = (studio) => {
    setEditingStudioId(studio.id)
    setEditDraft({
      name: studio.name,
      steamDeveloper: studio.steamDeveloper || '',
      notes: studio.notes || '',
      valueTier: typeof studio.valueTier === 'number' ? String(studio.valueTier) : ''
    })
  }

  const handleCancelEdit = () => {
    setEditingStudioId(null)
    setEditDraft(null)
  }

  const handleSaveEdit = async (id) => {
    const tier = editDraft.valueTier.trim() ? Number(editDraft.valueTier) : null
    const updates = {
      name: editDraft.name.trim(),
      steamDeveloper: editDraft.steamDeveloper.trim(),
      notes: editDraft.notes.trim(),
      valueTier: Number.isFinite(tier) ? tier : null
    }
    try {
      const saved = await StudiosConnector.updateStudio(id, updates)
      setStudios(prev => prev.map(s => (s.id === id ? saved : s)))
      handleCancelEdit()
    } catch (err) {
      setStudiosStatus(`Failed to update studio: ${err.message}`)
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
          <p style={{ fontSize: '0.85rem', color: 'var(--cd-text-muted)', margin: '0.3rem 0 0' }}>
            No database yet? Duplicate the Click Deck Starter Template in Notion, share it with your integration, then paste its ID here — see the field guide for the full walkthrough.
          </p>
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
            The studios [W]'s "Find New Games" searches for unreleased/uncollected titles. Lives in its own Notion database, separate from your collection — paste its ID below (same one on every device, same as your main Database ID above). <strong>Tier</strong> is a number ranking how much a new release from that studio deserves your attention — higher tiers surface first in New Candidates (suggested scale: 1 opportunistic, 2 strong, 3 automatic follow, but any number works). <strong>Notes</strong> is just for you — why you follow them.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="UUID of Followed Studios DB"
              value={studiosDbId}
              onChange={e => setStudiosDbId(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" onClick={handleConnectStudiosDb} style={{ whiteSpace: 'nowrap' }}>CONNECT</button>
          </div>
          {StudiosConnector.getDbId() && (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Studio name..."
                  value={newStudioName}
                  onChange={e => setNewStudioName(e.target.value)}
                  style={{ flex: 2, minWidth: '160px' }}
                />
                <input
                  type="text"
                  placeholder="Exact Steam developer tag (optional)"
                  value={newStudioDev}
                  onChange={e => setNewStudioDev(e.target.value)}
                  style={{ flex: 2, minWidth: '160px' }}
                />
                <input
                  type="number"
                  placeholder="Tier"
                  title="Personal Value Tier — how much a new release from this studio deserves your attention. Higher ranks first in New Candidates."
                  value={newStudioTier}
                  onChange={e => setNewStudioTier(e.target.value)}
                  style={{ flex: '0 0 70px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Notes — why you follow this studio (optional)"
                  value={newStudioNotes}
                  onChange={e => setNewStudioNotes(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={handleAddStudio} style={{ whiteSpace: 'nowrap' }}>+ ADD</button>
              </div>
              {studiosLoading ? (
                <p className="cd-text-muted">Loading...</p>
              ) : studios.length === 0 ? (
                <p className="cd-text-muted">No studios yet — add one above.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {studios.map(s => (
                    <li key={s.id} style={{ fontSize: '0.9rem', borderBottom: '1px solid var(--cd-border-color)', paddingBottom: '0.5rem' }}>
                      {editingStudioId === s.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              value={editDraft.name}
                              onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                              style={{ flex: 2, minWidth: '140px' }}
                            />
                            <input
                              type="text"
                              placeholder="Steam developer tag"
                              value={editDraft.steamDeveloper}
                              onChange={e => setEditDraft(d => ({ ...d, steamDeveloper: e.target.value }))}
                              style={{ flex: 2, minWidth: '140px' }}
                            />
                            <input
                              type="number"
                              placeholder="Tier"
                              value={editDraft.valueTier}
                              onChange={e => setEditDraft(d => ({ ...d, valueTier: e.target.value }))}
                              style={{ flex: '0 0 70px' }}
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Notes"
                            value={editDraft.notes}
                            onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                          />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" className="cd-btn-icon" onClick={() => handleSaveEdit(s.id)}>SAVE</button>
                            <button type="button" className="cd-btn-icon" onClick={handleCancelEdit}>CANCEL</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div>
                            <div>
                              <span
                                title={typeof s.valueTier === 'number' ? `Personal Value Tier ${s.valueTier}` : 'No tier set'}
                                style={{
                                  display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                                  background: tierAccentColor(s.valueTier), marginRight: '0.5rem'
                                }}
                              ></span>
                              {typeof s.valueTier === 'number' && (
                                <span className="cd-text-muted" style={{ marginRight: '0.4rem' }}>TIER {s.valueTier}</span>
                              )}
                              <span>{s.name}</span>
                              {s.steamDeveloper ? <span className="cd-text-muted"> ({s.steamDeveloper})</span> : ''}
                            </div>
                            {s.notes && <div className="cd-text-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>{s.notes}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                            <button type="button" className="cd-btn-icon" onClick={() => handleStartEdit(s)}>EDIT</button>
                            <button type="button" className="cd-btn-icon" onClick={() => handleRemoveStudio(s.id)}>[X]</button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {studiosStatus && <div style={{ color: 'var(--cd-accent-cyan)', fontSize: '0.9rem', marginTop: '0.6rem' }}>{studiosStatus}</div>}
        </div>

        <div className="cd-modal-actions">
          <button onClick={onClose}>CANCEL</button>
          <button className="primary" onClick={handleSave}>SAVE_SETTINGS</button>
        </div>
      </div>
    </div>
  )
}
