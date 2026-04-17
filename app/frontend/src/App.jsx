import { useMemo, useState } from 'react'
import './App.css'

function App() {
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_URL || 'http://localhost:4000', [])
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUsername, setCurrentUsername] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' })
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' })

  const clearStatus = () => {
    setMessage('')
    setError('')
  }

  const handleRegisterChange = (event) => {
    const { name, value } = event.target
    setRegisterForm((previous) => ({ ...previous, [name]: value }))
  }

  const handleLoginChange = (event) => {
    const { name, value } = event.target
    setLoginForm((previous) => ({ ...previous, [name]: value }))
  }

  const registerUser = async (event) => {
    event.preventDefault()
    clearStatus()
    setIsLoading(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create account.')
      }

      setMessage('Account created. You can now log in.')
      setRegisterForm({ username: '', email: '', password: '' })
      setIsLoginMode(true)
    } catch (registerError) {
      setError(registerError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const loginUser = async (event) => {
    event.preventDefault()
    clearStatus()
    setIsLoading(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid login credentials.')
      }

      setCurrentUsername(data.username)
      setIsLoggedIn(true)
      setMessage('Login successful.')
      setLoginForm({ identifier: '', password: '' })
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const logoutUser = () => {
    setIsLoggedIn(false)
    setCurrentUsername('')
    setMessage('Logged out successfully.')
    setError('')
  }

  return (
    <div className="auth-page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-logo">ColorBurstAuth</div>
        </div>
      </header>

      <main className="page-shell">
        <div className="ambient ambient-right" aria-hidden="true" />
        <div className="ambient ambient-left" aria-hidden="true" />

        <section className="auth-card">
          {isLoggedIn ? (
            <div className="welcome-panel">
              <div className="welcome-hero">
                <h2>Welcome, {currentUsername}</h2>
                <p>You are logged in successfully.</p>
              </div>

              <div className="welcome-actions">
                <button type="button" className="primary-btn welcome-logout" onClick={logoutUser}>
                  Logout
                </button>
              </div>

              <div className="welcome-status" role="status" aria-live="polite">
                <span className="welcome-status-dot" aria-hidden="true" />
                <span>Session is active and secure.</span>
              </div>
            </div>
          ) : (
            <>
              <div className="login-heading">
                <h1>Welcome Back</h1>
                <p>Access your account with a cleaner, faster flow.</p>
              </div>

              <div className="mode-switch">
                <button
                  type="button"
                  className={isLoginMode ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => {
                    clearStatus()
                    setIsLoginMode(true)
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={!isLoginMode ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => {
                    clearStatus()
                    setIsLoginMode(false)
                  }}
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
                      placeholder="********"
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
            </>
          )}

          {error ? <p className="status error">{error}</p> : null}
          {message ? <p className="status success">{message}</p> : null}
        </section>
      </main>
    </div>
  )
}

export default App
