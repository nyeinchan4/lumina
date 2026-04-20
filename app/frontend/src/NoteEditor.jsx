import { useState, useEffect, useCallback, useRef } from 'react'
import './notes.css'

const AUTO_SAVE_DELAY = 1500 // ms

// ── Confirm Modal ────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-box__title">{title}</h3>
        <p className="modal-box__msg">{message}</p>
        <div className="modal-box__actions">
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className={`modal-btn ${confirmClass}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export default function NoteEditor({ apiBaseUrl, token, username, noteId, onBack, onLogout, onNewNote }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [currentNoteId, setCurrentNoteId] = useState(noteId)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [modal, setModal] = useState(null) // null | 'trash' | 'delete'
  const autoSaveTimer = useRef(null)
  const bodyRef = useRef(null)

  // ── Load existing note ─────────────────────────────────────
  useEffect(() => {
    if (!noteId) {
      setTitle(''); setBody(''); setTags([]); setIsFavorite(false); setCurrentNoteId(null)
      return
    }
    const load = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok) {
          setTitle(data.note.title || '')
          setBody(data.note.body || '')
          setTags(data.note.tags || [])
          setIsFavorite(data.note.is_favorite || false)
          setCurrentNoteId(data.note.id)
        }
      } catch { /* silent */ }
    }
    load()
  }, [noteId, apiBaseUrl, token])

  // ── Auto-save ──────────────────────────────────────────────
  const save = useCallback(async (t, b, tg, fav) => {
    setSaveStatus('Saving…')
    try {
      if (currentNoteId) {
        // Update
        await fetch(`${apiBaseUrl}/api/notes/${currentNoteId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: t, body: b, tags: tg, is_favorite: fav }),
        })
      } else {
        // Create
        const res = await fetch(`${apiBaseUrl}/api/notes`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: t, body: b, tags: tg }),
        })
        const data = await res.json()
        if (res.ok) setCurrentNoteId(data.note.id)
      }
      setSaveStatus('Saved')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch {
      setSaveStatus('Save failed')
    }
  }, [apiBaseUrl, token, currentNoteId])

  const scheduleAutoSave = useCallback((t, b, tg, fav) => {
    clearTimeout(autoSaveTimer.current)
    setSaveStatus('Unsaved changes')
    autoSaveTimer.current = setTimeout(() => save(t, b, tg, fav), AUTO_SAVE_DELAY)
  }, [save])

  const handleTitleChange = (e) => {
    setTitle(e.target.value)
    scheduleAutoSave(e.target.value, body, tags, isFavorite)
  }

  const handleBodyChange = (e) => {
    setBody(e.target.value)
    scheduleAutoSave(title, e.target.value, tags, isFavorite)
  }

  const handleToggleFavorite = () => {
    const next = !isFavorite
    setIsFavorite(next)
    scheduleAutoSave(title, body, tags, next)
  }

  // ── Tags ───────────────────────────────────────────────────
  const addTag = () => {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      const next = [...tags, trimmed]
      setTags(next)
      scheduleAutoSave(title, body, next, isFavorite)
    }
    setTagInput('')
  }

  const removeTag = (tag) => {
    const next = tags.filter((t) => t !== tag)
    setTags(next)
    scheduleAutoSave(title, body, next, isFavorite)
  }

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
    if (e.key === 'Backspace' && !tagInput && tags.length) {
      removeTag(tags[tags.length - 1])
    }
  }

  // ── Formatting helpers ─────────────────────────────────────
  const applyFormat = (type) => {
    const el = bodyRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = body.slice(start, end)
    let replacement = selected

    switch (type) {
      case 'bold': replacement = `**${selected}**`; break
      case 'italic': replacement = `_${selected}_`; break
      case 'underline': replacement = `<u>${selected}</u>`; break
      case 'ul': replacement = selected.split('\n').map((l) => `- ${l}`).join('\n'); break
      case 'ol': replacement = selected.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n'); break
      case 'check': replacement = selected.split('\n').map((l) => `[ ] ${l}`).join('\n'); break
      default: break
    }

    const next = body.slice(0, start) + replacement + body.slice(end)
    setBody(next)
    scheduleAutoSave(title, next, tags, isFavorite)
    // Restore cursor
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + replacement.length, start + replacement.length)
    }, 0)
  }

  // ── Delete / Trash ─────────────────────────────────────────
  const handleTrashNote = async () => {
    setModal(null)
    if (!currentNoteId) { onBack(); return }
    await fetch(`${apiBaseUrl}/api/notes/${currentNoteId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_trashed: true }),
    })
    onBack()
  }

  const handleDeleteNote = async () => {
    setModal(null)
    if (!currentNoteId) { onBack(); return }
    await fetch(`${apiBaseUrl}/api/notes/${currentNoteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    onBack()
  }

  const navLinks = [
    { label: 'All Notes', icon: '📄', onClick: onBack },
    { label: 'New Note', icon: '＋', onClick: () => { clearTimeout(autoSaveTimer.current); onNewNote() } },
  ]

  return (
    <div className="notes-layout">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <nav className={`notes-sidebar${mobileNavOpen ? ' notes-sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="sidebar-logo__icon">✦</span>
            <div>
              <h1 className="sidebar-logo__title">Notes</h1>
              <p className="sidebar-logo__sub">Personal Workspace</p>
            </div>
          </div>
        </div>

        <button className="notes-new-btn" onClick={() => { clearTimeout(autoSaveTimer.current); onNewNote(); setMobileNavOpen(false) }}>
          <span>＋</span> New Note
        </button>

        <div className="sidebar-nav">
          <button className="sidebar-nav__link" onClick={() => { setMobileNavOpen(false); onBack() }}>
            <span className="sidebar-nav__icon">←</span> Back to Dashboard
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user__avatar">{username.charAt(0).toUpperCase()}</div>
            <div>
              <p className="sidebar-user__name">{username}</p>
              <button className="sidebar-user__logout" onClick={onLogout}>Sign out</button>
            </div>
          </div>
        </div>
      </nav>

      {mobileNavOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* ── Editor Main ──────────────────────────────────────── */}
      <main className="notes-main editor-main">
        {/* Mobile topbar */}
        <header className="notes-topbar">
          <button className="notes-topbar__menu" onClick={() => setMobileNavOpen(true)}>☰</button>
          <span className="notes-topbar__title">Note Editor</span>
          <button className="notes-topbar__back" onClick={onBack}>← Back</button>
        </header>

        {/* Top actions bar */}
        <div className="editor-toolbar">
          <div className="editor-toolbar__left">
            <button className="editor-back-btn" onClick={onBack}>← Dashboard</button>
            <span className="editor-save-status">{saveStatus}</span>
          </div>
          <div className="editor-toolbar__right">
            <button
              className={`editor-icon-btn${isFavorite ? ' editor-icon-btn--active' : ''}`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={handleToggleFavorite}
            >
              {isFavorite ? '★' : '☆'}
            </button>
            <button className="editor-icon-btn" title="Save now" onClick={() => save(title, body, tags, isFavorite)}>
              💾
            </button>
            {currentNoteId && (
              <button
                className="editor-icon-btn editor-icon-btn--trash"
                title="Move to trash"
                onClick={() => setModal('trash')}
              >
                🗑
              </button>
            )}
          </div>
        </div>

        {/* Floating format toolbar */}
        <div className="format-bar">
          <button className="format-btn" title="Bold" onClick={() => applyFormat('bold')}><b>B</b></button>
          <button className="format-btn" title="Italic" onClick={() => applyFormat('italic')}><i>I</i></button>
          <button className="format-btn" title="Underline" onClick={() => applyFormat('underline')}><u>U</u></button>
          <div className="format-bar__divider" />
          <button className="format-btn" title="Bullet list" onClick={() => applyFormat('ul')}>•≡</button>
          <button className="format-btn" title="Numbered list" onClick={() => applyFormat('ol')}>1≡</button>
          <button className="format-btn" title="Checklist" onClick={() => applyFormat('check')}>☑</button>
        </div>

        {/* Writing area */}
        <div className="editor-canvas">
          <div className="editor-inner">
            {/* Title */}
            <input
              id="note-title"
              className="editor-title"
              type="text"
              placeholder="Untitled Note"
              value={title}
              onChange={handleTitleChange}
            />

            {/* Tags */}
            <div className="editor-tags">
              {tags.map((tag) => (
                <span key={tag} className="editor-tag">
                  {tag}
                  <button className="editor-tag__remove" onClick={() => removeTag(tag)}>✕</button>
                </span>
              ))}
              <input
                className="editor-tag-input"
                placeholder="Add tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={addTag}
              />
            </div>

            {/* Body */}
            <textarea
              id="note-body"
              ref={bodyRef}
              className="editor-body"
              placeholder="Start writing…"
              value={body}
              onChange={handleBodyChange}
            />
          </div>
        </div>
      </main>
      {/* ── Confirm Modals ─────────────────────────────────── */}
      {modal === 'trash' && (
        <ConfirmModal
          title="Move to Trash?"
          message={`“${title || 'Untitled Note'}” will be moved to Trash. You can restore it later.`}
          confirmLabel="Move to Trash"
          confirmClass="modal-btn--danger"
          onConfirm={handleTrashNote}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'delete' && (
        <ConfirmModal
          title="Delete Permanently?"
          message="This note will be deleted forever. This action cannot be undone."
          confirmLabel="Delete Forever"
          confirmClass="modal-btn--delete"
          onConfirm={handleDeleteNote}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}
