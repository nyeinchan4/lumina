import { useMemo, useState, useEffect, useCallback } from 'react'
import './App.css'
import NotesDashboard from './NotesDashboard'
import NoteEditor from './NoteEditor'

function App() {
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_URL || '', [])
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUsername, setCurrentUsername] = useState('')
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' })
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' })

  // Notes app state
  const [view, setView] = useState('dashboard') // 'dashboard' | 'editor'
  const [editingNoteId, setEditingNoteId] = useState(null)

  // Restore session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('lumina_token')
    const storedUsername = localStorage.getItem('lumina_username')
    if (storedToken && storedUsername) {
      setToken(storedToken)
      setCurrentUsername(storedUsername)
      setIsLoggedIn(true)
    }
  }, [])

  const clearStatus = () => { setMessage(''); setError('') }

  const handleRegisterChange = (e) => {
    const { name, value } = e.target
    setRegisterForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleLoginChange = (e) => {
    const { name, value } = e.target
    setLoginForm((prev) => ({ ...prev, [name]: value }))
  }

  const registerUser = async (e) => {
    e.preventDefault()
    clearStatus()
    setIsLoading(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to create account.')
      setMessage('Account created. You can now log in.')
      setRegisterForm({ username: '', email: '', password: '' })
      setIsLoginMode(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const loginUser = async (e) => {
    e.preventDefault()
    clearStatus()
    setIsLoading(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Invalid login credentials.')
      localStorage.setItem('lumina_token', data.token)
      localStorage.setItem('lumina_username', data.username)
      setToken(data.token)
      setCurrentUsername(data.username)
      setIsLoggedIn(true)
      setLoginForm({ identifier: '', password: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const logoutUser = useCallback(() => {
    localStorage.removeItem('lumina_token')
    localStorage.removeItem('lumina_username')
    setIsLoggedIn(false)
    setCurrentUsername('')
    setToken('')
    setView('dashboard')
    setEditingNoteId(null)
  }, [])

  const openEditor = useCallback((noteId = null) => {
    setEditingNoteId(noteId)
    setView('editor')
  }, [])

  const closeEditor = useCallback(() => {
    setView('dashboard')
    setEditingNoteId(null)
  }, [])

  if (isLoggedIn) {
    if (view === 'editor') {
      return (
        <NoteEditor
          apiBaseUrl={apiBaseUrl}
          token={token}
          username={currentUsername}
          noteId={editingNoteId}
          onBack={closeEditor}
          onLogout={logoutUser}
          onNewNote={() => openEditor(null)}
        />
      )
    }
    return (
      <NotesDashboard
        apiBaseUrl={apiBaseUrl}
        token={token}
        username={currentUsername}
        onOpenNote={openEditor}
        onNewNote={() => openEditor(null)}
        onLogout={logoutUser}
      />
    )
  }

  return (
    <div className="auth-page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-logo">ColorBurst Notes</div>
        </div>
      </header>

      <main className="page-shell">
        <div className="ambient ambient-right" aria-hidden="true" />
        <div className="ambient ambient-left" aria-hidden="true" />

        <section className="auth-card">
          <div className="login-heading">
            <h1>Welcome Back</h1>
            <p>Access your notes with a cleaner, faster flow.</p>
          </div>

          <div className="mode-switch">
            <button
              type="button"
              className={isLoginMode ? 'mode-btn active' : 'mode-btn'}
              onClick={() => { clearStatus(); setIsLoginMode(true) }}
            >
              Login
            </button>
            <button
              type="button"
              className={!isLoginMode ? 'mode-btn active' : 'mode-btn'}
              onClick={() => { clearStatus(); setIsLoginMode(false) }}
            >
              Create Account
            </button>
          </div>

          {isLoginMode ? (
            <form className="auth-form" onSubmit={loginUser}>
              <label htmlFor="identifier">Username or Email</label>
              <div className="input-wrap">
                <input
                  id="identifier"
                  name="identifier"
                  value={loginForm.identifier}
                  onChange={handleLoginChange}
                  placeholder="name@example.com"
                  required
                />
              </div>

              <label htmlFor="loginPassword">Password</label>
              <div className="input-wrap">
                <input
                  id="loginPassword"
                  name="password"
                  type="password"
                  value={loginForm.password}
                  placeholder="••••••••"
                  onChange={handleLoginChange}
                  required
                />
              </div>

              <button type="submit" className="primary-btn" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Login'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={registerUser}>
              <label htmlFor="registerUsername">Username</label>
              <div className="input-wrap">
                <input
                  id="registerUsername"
                  name="username"
                  value={registerForm.username}
                  onChange={handleRegisterChange}
                  placeholder="yourname"
                  required
                />
              </div>

              <label htmlFor="registerEmail">Email</label>
              <div className="input-wrap">
                <input
                  id="registerEmail"
                  name="email"
                  type="email"
                  value={registerForm.email}
                  onChange={handleRegisterChange}
                  placeholder="name@example.com"
                  required
                />
              </div>

              <label htmlFor="registerPassword">Password</label>
              <div className="input-wrap">
                <input
                  id="registerPassword"
                  name="password"
                  type="password"
                  minLength="6"
                  value={registerForm.password}
                  placeholder="At least 6 characters"
                  onChange={handleRegisterChange}
                  required
                />
              </div>

              <button type="submit" className="primary-btn" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {error ? <p className="status error">{error}</p> : null}
          {message ? <p className="status success">{message}</p> : null}
        </section>
      </main>
    </div>
  )
}

export default App
