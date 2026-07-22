import React, { useState, useEffect } from 'react'
import { ALL_TAGS } from '../lib/seed-data'
import { findBestSteamMatch } from '../lib/steamMatch'
import { readReleaseStatus } from '../lib/releaseStatus'

export function GameEditorModal({ game, onSave, onDelete, onClose, onToast, watchlistSchemaReady = false }) {
  // Only offer the Release Status control once we know Notion actually has
  // the property — either the collection already has at least one game
  // carrying it (watchlistSchemaReady, computed in App.jsx), or this
  // specific game already carries it individually. Otherwise formData never
  // gets a releaseStatus key at all, so mapGameToProperties correctly omits
  // it from the save and an ordinary edit never references a Notion
  // property that doesn't exist yet for anyone who hasn't patched.
  const schemaSupportsReleaseStatus = watchlistSchemaReady || (game && game.releaseStatus !== undefined)
  const [formData, setFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    developer: '',
    tags: [],
    status: 'Backlog',
    rating: null,
    journal: '',
    coverUrl: ''
  })
  const [isFetchingCover, setIsFetchingCover] = useState(false)
  const [validationError, setValidationError] = useState('')

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

  // True only when the plain-text journal shown in the textarea is exactly what was
  // loaded from the original rich-text entry — i.e. the user hasn't touched it, so
  // it's safe to write the original formatted segments straight back on save.
  const journalUnchanged = Boolean(game) && Array.isArray(game.journalRich) && game.journalRich.length > 0 && formData.journal === game.journal
  const journalHasRichFormatting = Array.isArray(game?.journalRich) && game.journalRich.some(rt =>
    rt.annotations && (rt.annotations.bold || rt.annotations.italic || rt.annotations.strikethrough || rt.annotations.underline || rt.annotations.code || (rt.annotations.color && rt.annotations.color !== 'default'))
  )

  const handleSave = () => {
    if (!formData.title) {
      setValidationError('TITLE REQUIRED')
      return
    }
    if (!formData.status) return // simple validation
    setValidationError('')
    // Only forward journalRich when it's confirmed unchanged — otherwise a stale
    // rich-text array (from the initial `...game` spread) would override the
    // edited plain text, or worse, silently resurrect formatting the user just
    // tried to remove. mapGameToProperties falls back to plain text when absent.
    const dataToSave = journalUnchanged ? formData : { ...formData, journalRich: undefined }
    onSave(dataToSave)
  }

  const fetchCover = async () => {
    if (!formData.title) return;
    setIsFetchingCover(true)
    try {
      const targetUrl = `/api/steam-search?term=${encodeURIComponent(formData.title)}`;
      const res = await fetch(targetUrl);
      const json = await res.json();

      // Steam's search is fuzzy-ranked, not exact — classics are frequently
      // re-listed with a "Remastered"/"Special Edition" suffix, so the
      // literal first result isn't always the right game. Score candidates
      // by normalized title instead of trusting items[0] blindly.
      const { match, confident } = findBestSteamMatch(json.items, formData.title);
      if (match) {
        setFormData(prev => ({
          ...prev,
          coverUrl: match.coverUrl || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${match.id}/header.jpg`,
          // Previously only the cover URL was saved here, never the App ID —
          // meaning a game whose cover came from this button would silently
          // never get pricing (the nightly cron only picks up games with a
          // Steam App ID) and its cover would never link to the store page.
          appId: match.id
        }));
        // A short or generic title (e.g. "Loom", "Norco") can coincidentally
        // match an unrelated Steam listing rather than the real game — this
        // is still applied as a best-effort guess, but flagged so it gets a
        // manual look instead of silently writing a possibly-wrong App ID.
        if (!confident && onToast) {
          onToast(`⚠ Uncertain Steam match for "${match.name}" — please verify the cover and App ID.`)
        }
      } else {
        if (onToast) onToast('No cover found on Steam for that title.');
      }
    } catch (err) {
      console.error(err);
      if (onToast) onToast('Error fetching cover from Steam.');
    }
    setIsFetchingCover(false);
  };

  const showRating = ['Completed', 'Playing', 'Abandoned'].includes(formData.status)

  return (
    <div className="cd-modal-overlay">
      <div className="cd-modal cd-panel">
        <div className="cd-modal-header">
          <h2>{game ? 'EDIT_ENTRY' : 'NEW_ENTRY'}</h2>
          <button className="cd-btn-icon" onClick={onClose} aria-label="Close">[X]</button>
        </div>
        
        <div className="cd-form-group">
          <label>TITLE</label>
          <input name="title" value={formData.title} onChange={handleChange} autoFocus />
        </div>
        
        <div className="cd-form-group">
          <label>COVER_URL (Optional)</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input name="coverUrl" placeholder="https://..." value={formData.coverUrl || ''} onChange={handleChange} />
            <button type="button" onClick={fetchCover} disabled={isFetchingCover} style={{ whiteSpace: 'nowrap', fontSize: '0.9rem', padding: '0 1rem' }}>
              {isFetchingCover ? 'FETCHING...' : 'FETCH STEAM'}
            </button>
          </div>
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

        {schemaSupportsReleaseStatus && (
          <div className="cd-form-group">
            <label>RELEASE STATUS</label>
            <select
              name="releaseStatus"
              value={formData.releaseStatus ?? (game ? readReleaseStatus(game) : 'Released')}
              onChange={handleChange}
            >
              <option value="Released">Released</option>
              <option value="Coming Soon">Coming Soon</option>
            </select>
            <p className="cd-tag-warning" style={{ color: 'var(--cd-text-muted)' }}>
              Coming Soon games are hidden from the Timeline, Stats and Random Game — see them on the [W] Watchlist view instead.
            </p>
          </div>
        )}

        <div className="cd-form-group">
          <label>TAGS ({formData.tags.length}/7)</label>
          <div className="cd-tag-picker">
            {/* Canonical tags plus any already on this entry that predate the list,
                so off-list tags stay visible and removable instead of vanishing. */}
            {[...ALL_TAGS, ...formData.tags.filter(t => !ALL_TAGS.includes(t))].map(tag => {
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
          {/* The 5-7 tag policy is for played/owned games — a Coming Soon
              entry deliberately ships with no tags until it's actually
              released, so the warning would otherwise be a permanent,
              unfixable false positive. */}
          {readReleaseStatus(formData) !== 'Coming Soon' && formData.tags.length > 0 && formData.tags.length < 5 && (
            <p className="cd-tag-warning">⚠ Collection policy calls for 5–7 tags per entry — only {formData.tags.length} selected.</p>
          )}
          {readReleaseStatus(formData) !== 'Coming Soon' && formData.tags.length > 7 && (
            <p className="cd-tag-warning">⚠ Collection policy calls for 5–7 tags per entry — {formData.tags.length} selected (predates the current cap).</p>
          )}
        </div>

        <div className="cd-form-group">
          <label>JOURNAL/NOTES</label>
          <textarea
            name="journal"
            value={formData.journal || ''}
            onChange={handleChange}
            rows={4}
          />
          {journalHasRichFormatting && !journalUnchanged && (
            <p className="cd-tag-warning">⚠ This entry has Notion rich-text formatting (bold/color). Saving your edit here will replace it with plain text.</p>
          )}
        </div>

        <div className="cd-modal-actions" style={{ justifyContent: game ? 'space-between' : 'flex-end', display: 'flex', flexWrap: 'wrap-reverse', gap: '1rem', width: '100%', alignItems: 'center' }}>
          {game && (
            <button 
              onClick={() => { if(window.confirm('Are you sure you want to completely delete this entry?')) onDelete(game.id) }} 
              style={{ color: 'var(--cd-accent-amber)', borderColor: 'var(--cd-accent-amber)', whiteSpace: 'nowrap' }}>
              [ DELETE ENTRY ]
            </button>
          )}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {validationError && <span style={{ color: 'var(--cd-accent-amber)', fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>* {validationError}</span>}
            <button onClick={onClose} style={{ whiteSpace: 'nowrap' }}>CANCEL</button>
            <button className="primary" onClick={handleSave} style={{ whiteSpace: 'nowrap' }}>SAVE_DATA</button>
          </div>
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
        .cd-tag-warning {
          margin: 0.5rem 0 0;
          font-size: 0.85rem;
          color: var(--cd-accent-amber);
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
