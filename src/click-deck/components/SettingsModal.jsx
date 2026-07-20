import React, { useState } from 'react'

export function SettingsModal({ onClose, onSaveToken }) {
  const [token, setToken] = useState(localStorage.getItem('cd_notion_token') || '')
  const [dbId, setDbId] = useState(localStorage.getItem('cd_notion_db') || '')
  const [status, setStatus] = useState('')

  const handleCreateDb = async () => {
    if (!token) {
      setStatus('Please enter a Notion Integration Token first.')
      return
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

  const handleSave = () => {
    localStorage.setItem('cd_notion_token', token)
    localStorage.setItem('cd_notion_db', dbId)
    if (onSaveToken) onSaveToken()
    onClose()
  }

  return (
    <div className="cd-modal-overlay">
      <div className="cd-modal cd-panel" style={{ maxWidth: '500px' }}>
        <div className="cd-modal-header">
          <h2>SYSTEM_SETTINGS</h2>
          <button className="cd-btn-icon" onClick={onClose}>[X]</button>
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

        <div className="cd-form-group" style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid var(--cd-border-color)', background: 'rgba(0, 0, 0, 0.2)' }}>
          <label style={{ marginBottom: '0.5rem', display: 'block' }}>DATABASE ACTIONS</label>
          <p style={{ fontSize: '0.95rem', color: 'var(--cd-text-muted)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
            Initialize a new schema, seed mock data, or factory reset the local application state.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button type="button" onClick={handleCreateDb}>Initialize Database via MCP</button>
            <button type="button" onClick={async () => {
              setStatus('Seeding database... please wait.')
              try {
                const { McpConnector } = await import('../lib/mcp-connector.js')
                await McpConnector.initializeMockData()
                setStatus('Seeding complete! You may close settings.')
              } catch(e) {
                setStatus('Seeding failed: ' + e.message)
              }
            }}>Populate Seed Data</button>
            <button type="button" onClick={() => {
              if(window.confirm('Are you sure you want to completely wipe the local DB state?')) {
                if (onResetDb) onResetDb()
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
