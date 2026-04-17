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
const ensureUsersTableSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`

const logError = (label, error) => {
  console.error(`[${new Date().toISOString()}] ${label}`)
  console.error('message:', error.message)
  if (error.code) {
    console.error('code:', error.code)
  }
  if (error.detail) {
    console.error('detail:', error.detail)
  }
  if (error.stack) {
    console.error(error.stack)
  }
}

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' })
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email])

    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'username or email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, passwordHash],
    )

    return res.status(201).json({
      message: 'account created',
      user: result.rows[0],
    })
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
      expiresIn: '1d',
    })

    return res.status(200).json({
      token,
      username: user.username,
    })
  } catch (error) {
    logError('login failed', error)
    return res.status(500).json({
      error: 'unable to login',
      details: isProduction ? undefined : error.message,
    })
  }
})

app.use((error, _req, res, _next) => {
  logError('unhandled request error', error)
  return res.status(500).json({
    error: 'internal server error',
    details: isProduction ? undefined : error.message,
  })
})

const startServer = async () => {
  try {
    await pool.query('SELECT 1')
    await pool.query(ensureUsersTableSql)
    console.log(
      `Database connected: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    )
    console.log('Verified users table exists')
  } catch (error) {
    logError('database connection failed', error)
  }

  app.listen(port, () => {
    console.log(`Backend API is running on port ${port}`)
  })
}

process.on('unhandledRejection', (error) => {
  logError('unhandledRejection', error)
})

process.on('uncaughtException', (error) => {
  logError('uncaughtException', error)
})

startServer()
