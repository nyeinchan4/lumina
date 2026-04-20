const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const dotenv = require('dotenv')

dotenv.config()

const pool = require('./db')

const app = express()
const port = process.env.PORT || 4000
const isProduction = process.env.NODE_ENV === 'production'

const ensureTablesSQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT FALSE,
  is_trashed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`

const logError = (label, error) => {
  console.error(`[${new Date().toISOString()}] ${label}`)
  console.error('message:', error.message)
  if (error.code) console.error('code:', error.code)
  if (error.detail) console.error('detail:', error.detail)
  if (error.stack) console.error(error.stack)
}

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(cors())
app.use(express.json())

/** Verifies the Bearer JWT and attaches req.user = { userId, username } */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing or invalid authorization header' })
  }
  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { userId: payload.userId, username: payload.username }
    return next()
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' })
  }
}

// ── Health ──────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.status(200).json({ ok: true }))

// ── Auth ────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' })
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email],
    )
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'username or email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, passwordHash],
    )

    return res.status(201).json({ message: 'account created', user: result.rows[0] })
  } catch (error) {
    logError('register failed', error)
    return res.status(500).json({
      error: 'unable to create account',
      details: isProduction ? undefined : error.message,
    })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body

  if (!identifier || !password) {
    return res.status(400).json({ error: 'identifier and password are required' })
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
      [identifier],
    )

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'invalid credentials' })
    }

    const user = result.rows[0]
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'invalid credentials' })
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    })

    return res.status(200).json({ token, username: user.username })
  } catch (error) {
    logError('login failed', error)
    return res.status(500).json({
      error: 'unable to login',
      details: isProduction ? undefined : error.message,
    })
  }
})

// ── Notes CRUD ───────────────────────────────────────────────────────────────

/** GET /api/notes  — list all non-trashed notes for the authenticated user */
app.get('/api/notes', requireAuth, async (req, res) => {
  const { view, search } = req.query  // view: 'all' | 'favorites' | 'trash'
  const { userId } = req.user

  try {
    let whereClause = 'WHERE user_id = $1'
    const params = [userId]

    if (view === 'trash') {
      whereClause += ' AND is_trashed = TRUE'
    } else if (view === 'favorites') {
      whereClause += ' AND is_trashed = FALSE AND is_favorite = TRUE'
    } else {
      whereClause += ' AND is_trashed = FALSE'
    }

    if (search) {
      params.push(`%${search}%`)
      whereClause += ` AND (title ILIKE $${params.length} OR body ILIKE $${params.length})`
    }

    const result = await pool.query(
      `SELECT id, title, body, tags, is_favorite, is_trashed, created_at, updated_at
       FROM notes ${whereClause}
       ORDER BY is_favorite DESC, updated_at DESC`,
      params,
    )

    return res.status(200).json({ notes: result.rows })
  } catch (error) {
    logError('list notes failed', error)
    return res.status(500).json({ error: 'unable to fetch notes' })
  }
})

/** GET /api/notes/:id  — get single note */
app.get('/api/notes/:id', requireAuth, async (req, res) => {
  const { userId } = req.user
  const noteId = parseInt(req.params.id, 10)

  try {
    const result = await pool.query(
      'SELECT * FROM notes WHERE id = $1 AND user_id = $2',
      [noteId, userId],
    )
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'note not found' })
    }
    return res.status(200).json({ note: result.rows[0] })
  } catch (error) {
    logError('get note failed', error)
    return res.status(500).json({ error: 'unable to fetch note' })
  }
})

/** POST /api/notes  — create a new note */
app.post('/api/notes', requireAuth, async (req, res) => {
  const { title = '', body = '', tags = [] } = req.body
  const { userId } = req.user

  try {
    const result = await pool.query(
      `INSERT INTO notes (user_id, title, body, tags)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, title, body, tags],
    )
    return res.status(201).json({ note: result.rows[0] })
  } catch (error) {
    logError('create note failed', error)
    return res.status(500).json({ error: 'unable to create note' })
  }
})

/** PATCH /api/notes/:id  — update title / body / tags / is_favorite / is_trashed */
app.patch('/api/notes/:id', requireAuth, async (req, res) => {
  const { userId } = req.user
  const noteId = parseInt(req.params.id, 10)
  const { title, body, tags, is_favorite, is_trashed } = req.body

  // Build dynamic SET clause
  const setClauses = ['updated_at = NOW()']
  const params = [noteId, userId]

  if (title !== undefined) { params.push(title); setClauses.push(`title = $${params.length}`) }
  if (body !== undefined) { params.push(body); setClauses.push(`body = $${params.length}`) }
  if (tags !== undefined) { params.push(tags); setClauses.push(`tags = $${params.length}`) }
  if (is_favorite !== undefined) { params.push(is_favorite); setClauses.push(`is_favorite = $${params.length}`) }
  if (is_trashed !== undefined) { params.push(is_trashed); setClauses.push(`is_trashed = $${params.length}`) }

  try {
    const result = await pool.query(
      `UPDATE notes SET ${setClauses.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      params,
    )
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'note not found' })
    }
    return res.status(200).json({ note: result.rows[0] })
  } catch (error) {
    logError('update note failed', error)
    return res.status(500).json({ error: 'unable to update note' })
  }
})

/** DELETE /api/notes/:id  — permanently delete a note */
app.delete('/api/notes/:id', requireAuth, async (req, res) => {
  const { userId } = req.user
  const noteId = parseInt(req.params.id, 10)

  try {
    const result = await pool.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2',
      [noteId, userId],
    )
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'note not found' })
    }
    return res.status(200).json({ message: 'note deleted' })
  } catch (error) {
    logError('delete note failed', error)
    return res.status(500).json({ error: 'unable to delete note' })
  }
})

// ── Error handler ───────────────────────────────────────────────────────────

app.use((error, _req, res, _next) => {
  logError('unhandled request error', error)
  return res.status(500).json({
    error: 'internal server error',
    details: isProduction ? undefined : error.message,
  })
})

// ── Bootstrap ───────────────────────────────────────────────────────────────

const startServer = async () => {
  try {
    await pool.query('SELECT 1')
    await pool.query(ensureTablesSQL)
    console.log(`Database connected: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`)
    console.log('Verified users and notes tables exist')
  } catch (error) {
    logError('database connection failed', error)
  }

  app.listen(port, () => {
    console.log(`Backend API is running on port ${port}`)
  })
}

process.on('unhandledRejection', (error) => logError('unhandledRejection', error))
process.on('uncaughtException', (error) => logError('uncaughtException', error))

startServer()
