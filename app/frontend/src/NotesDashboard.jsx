import { useState, useEffect, useCallback, useRef } from 'react'
import './notes.css'

const VIEWS = ['all', 'favorites', 'trash']

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function NoteCard({ note, onOpen, onToggleFavorite, onTrash, onRestore, onDelete, isTrash }) {
  const preview = note.body?.replace(/\n+/g, ' ').trim() || ''

  return (
    <div
      className={`note-card${note.is_favorite ? ' note-card--featured' : ''}`}
      onClick={() => !isTrash && onOpen(note.id)}
      role={isTrash ? 'listitem' : 'button'}
      tabIndex={isTrash ? undefined : 0}
      onKeyDown={(e) => { if (!isTrash && e.key === 'Enter') onOpen(note.id) }}
    >
      {note.is_favorite && !isTrash && (
        <span className="note-card__star" title="Favorited">★</span>
      )}

      <h3 className="note-card__title">{note.title || 'Untitled Note'}</h3>
      <p className="note-card__preview">{preview || 'No content yet…'}</p>

      <div className="note-card__footer">
        <div className="note-card__tags">
          {(note.tags || []).map((tag) => (
            <span key={tag} className="note-card__tag">{tag}</span>
          ))}
        </div>
        <span className="note-card__date">{formatDate(note.updated_at)}</span>
      </div>

      <div className="note-card__actions" onClick={(e) => e.stopPropagation()}>
        {isTrash ? (
          <>
            <button className="card-action-btn" title="Restore" onClick={() => onRestore(note.id)}>↩ Restore</button>
            <button className="card-action-btn card-action-btn--danger" title="Delete permanently" onClick={() => onDelete(note.id)}>✕ Delete</button>
          </>
        ) : (
          <>
            <button
              className={`card-action-btn${note.is_favorite ? ' card-action-btn--active' : ''}`}
              title={note.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={() => onToggleFavorite(note)}
            >
              {note.is_favorite ? '★' : '☆'}
            </button>
            <button
              className="card-action-btn card-action-btn--trash"
              title="Move to trash"
              onClick={() => onTrash(note.id)}
            >
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function NotesDashboard({ apiBaseUrl, token, username, onOpenNote, onNewNote, onLogout }) {
  const [notes, setNotes] = useState([])
  const [activeView, setActiveView] = useState('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const searchTimeout = useRef(null)

  const fetchNotes = useCallback(async (view, q) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ view })
      if (q) params.set('search', q)
      const res = await fetch(`${apiBaseUrl}/api/notes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setNotes(data.notes)
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [apiBaseUrl, token])

  useEffect(() => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => fetchNotes(activeView, search), 300)
    return () => clearTimeout(searchTimeout.current)
  }, [activeView, search, fetchNotes])

  const handleToggleFavorite = async (note) => {
    await fetch(`${apiBaseUrl}/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: !note.is_favorite }),
    })
    fetchNotes(activeView, search)
  }

  const handleTrash = async (noteId) => {
    await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_trashed: true }),
    })
    fetchNotes(activeView, search)
  }

  const handleRestore = async (noteId) => {
    await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_trashed: false }),
    })
    fetchNotes(activeView, search)
  }

  const handleDelete = async (noteId) => {
    if (!window.confirm('Permanently delete this note? This cannot be undone.')) return
    await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchNotes(activeView, search)
  }

  const navLinks = [
    { id: 'all', label: 'All Notes', icon: '📄' },
    { id: 'favorites', label: 'Favorites', icon: '★' },
    { id: 'trash', label: 'Trash', icon: '🗑' },
  ]

  const viewTitle = { all: 'All Notes', favorites: 'Favorites', trash: 'Trash' }

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

        <button className="notes-new-btn" onClick={() => { onNewNote(); setMobileNavOpen(false) }}>
          <span>＋</span> New Note
        </button>

        <div className="sidebar-nav">
          {navLinks.map((link) => (
            <button
              key={link.id}
              className={`sidebar-nav__link${activeView === link.id ? ' sidebar-nav__link--active' : ''}`}
              onClick={() => { setActiveView(link.id); setMobileNavOpen(false) }}
            >
              <span className="sidebar-nav__icon">{link.icon}</span>
              {link.label}
            </button>
          ))}
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

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="notes-main">
        {/* Mobile topbar */}
        <header className="notes-topbar">
          <button className="notes-topbar__menu" onClick={() => setMobileNavOpen(true)}>☰</button>
          <span className="notes-topbar__title">ColorBurst Notes</span>
          <button className="notes-topbar__new" onClick={onNewNote}>＋</button>
        </header>

        {/* Search + heading row */}
        <div className="notes-toolbar">
          <h2 className="notes-toolbar__heading">{viewTitle[activeView]}</h2>
          <div className="notes-search">
            <span className="notes-search__icon">🔍</span>
            <input
              id="notes-search-input"
              className="notes-search__input"
              type="text"
              placeholder="Search notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="notes-search__clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="notes-loading">
            <div className="notes-spinner" />
          </div>
        ) : notes.length === 0 ? (
          <div className="notes-empty">
            <span className="notes-empty__icon">{activeView === 'trash' ? '🗑' : activeView === 'favorites' ? '★' : '📄'}</span>
            <p className="notes-empty__msg">
              {activeView === 'trash' ? 'Trash is empty.' : activeView === 'favorites' ? 'No favorites yet.' : 'No notes yet. Create your first one!'}
            </p>
            {activeView === 'all' && (
              <button className="notes-empty__cta" onClick={onNewNote}>＋ New Note</button>
            )}
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((note, i) => (
              <div
                key={note.id}
                className={`notes-grid__cell${i === 0 && activeView !== 'trash' && notes.length > 2 ? ' notes-grid__cell--wide' : ''}`}
              >
                <NoteCard
                  note={note}
                  onOpen={onOpenNote}
                  onToggleFavorite={handleToggleFavorite}
                  onTrash={handleTrash}
                  onRestore={handleRestore}
                  onDelete={handleDelete}
                  isTrash={activeView === 'trash'}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Mobile FAB */}
      <button className="notes-fab" onClick={onNewNote} title="New Note">＋</button>
    </div>
  )
}
