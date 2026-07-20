import React, { useState, useEffect } from 'react'
import { ALL_TAGS } from '../lib/seed-data'

export function GameEditorModal({ game, onSave, onClose }) {
  const [formData, setFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    developer: '',
    tags: [],
    status: 'Backlog',
    rating: null,
    journal: ''
  })

  useEffect(() => {
    if (game) {
      setFormData({
        ...game,
        rating: game.rating || null
      })
    }
  }, [game])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value) || value : value
    }))
  }

  const toggleTag = (tag) => {
    setFormData(prev => {
      if (prev.tags.includes(tag)) {
        return { ...prev, tags: prev.tags.filter(t => t !== tag) }
      } else {
        if (prev.tags.length >= 7) return prev // Max 7 tags per prompt instructions
        return { ...prev, tags: [...prev.tags, tag] }
      }
    })
  }

  const handleSave = () => {
    if (!formData.title || !formData.status) return // simple validation
    onSave(formData)
  }

  const showRating = ['Completed', 'Playing', 'Abandoned'].includes(formData.status)

  return (
    <div className="cd-modal-overlay">
      <div className="cd-modal cd-panel">
        <div className="cd-modal-header">
          <h2>{game ? 'EDIT_ENTRY' : 'NEW_ENTRY'}</h2>
          <button className="cd-btn-icon" onClick={onClose}>[X]</button>
        </div>
        
        <div className="cd-form-group">
          <label>TITLE</label>
          <input name="title" value={formData.title} onChange={handleChange} autoFocus />
        </div>
        
        <div className="cd-form-row">
          <div className="cd-form-group">
            <label>RELEASE_YEAR</label>
            <input name="year" type="number" value={formData.year} onChange={handleChange} />
          </div>
          <div className="cd-form-group">
            <label>DEVELOPER/STUDIO</label>
            <input name="developer" value={formData.developer} onChange={handleChange} />
          </div>
        </div>

        <div className="cd-form-row">
          <div className="cd-form-group">
            <label>STATUS</label>
            <select name="status" value={formData.status} onChange={handleChange}>
              <option value="Backlog">Backlog</option>
              <option value="Playing">Playing</option>
              <option value="Completed">Completed</option>
              <option value="Abandoned">Abandoned</option>
            </select>
          </div>
          {showRating && (
            <div className="cd-form-group">
              <label>RATING (1-5)</label>
              <select name="rating" value={formData.rating || ''} onChange={handleChange}>
                <option value="">--</option>
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="cd-form-group">
          <label>TAGS (Max 7)</label>
          <div className="cd-tag-picker">
            {ALL_TAGS.map(tag => {
              const isActive = formData.tags.includes(tag)
              return (
                <span 
                  key={tag} 
                  className={`cd-picker-tag ${isActive ? 'active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </span>
              )
            })}
          </div>
        </div>

        <div className="cd-form-group">
          <label>JOURNAL/NOTES</label>
          <textarea 
            name="journal" 
            value={formData.journal || ''} 
            onChange={handleChange}
            rows={4}
          />
        </div>

        <div className="cd-modal-actions">
          <button onClick={onClose}>CANCEL</button>
          <button className="primary" onClick={handleSave}>SAVE_DATA</button>
        </div>
      </div>

      <style>{`
        .cd-tag-picker {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          max-height: 150px;
          overflow-y: auto;
          padding: 0.5rem;
          border: 1px solid var(--cd-border-color);
          background: var(--cd-bg-dark);
        }
        .cd-picker-tag {
          font-size: 0.8rem;
          padding: 0.2rem 0.4rem;
          border: 1px solid var(--cd-border-color);
          cursor: pointer;
          color: var(--cd-text-muted);
        }
        .cd-picker-tag:hover {
          color: var(--cd-text-primary);
        }
        .cd-picker-tag.active {
          background: var(--cd-accent-cyan-dim);
          border-color: var(--cd-accent-cyan);
          color: var(--cd-accent-cyan);
        }
      `}</style>
    </div>
  )
}
