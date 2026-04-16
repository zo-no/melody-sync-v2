import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getDb } from '../db'

const COOKIE_NAME = 'ms_session'
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }
const HASH_LEN = 32

// ─── password ─────────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, HASH_LEN, SCRYPT_PARAMS)
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('hex')}$${hash.toString('hex')}`
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, saltHex, hashHex] = parts
  const salt = Buffer.from(saltHex, 'hex')
  const storedHash = Buffer.from(hashHex, 'hex')
  try {
    const inputHash = scryptSync(password, salt, HASH_LEN, {
      N: parseInt(N), r: parseInt(r), p: parseInt(p),
    })
    return timingSafeEqual(storedHash, inputHash)
  } catch {
    return false
  }
}

// ─── token ────────────────────────────────────────────────────────────────────

function verifyToken(inputToken: string): boolean {
  const db = getDb()
  const row = db.query<{ value: string }, [string]>(
    `SELECT value FROM auth WHERE id = 'token' AND kind = 'token'`
  ).get('token')
  if (!row) return false
  try {
    return timingSafeEqual(Buffer.from(row.value, 'hex'), Buffer.from(inputToken, 'hex'))
  } catch {
    return false
  }
}

// ─── setup ────────────────────────────────────────────────────────────────────

export function hasAuth(): boolean {
  const db = getDb()
  const row = db.query<{ id: string }, []>(
    `SELECT id FROM auth LIMIT 1`
  ).get()
  return !!row
}

export function setPassword(password: string): void {
  const db = getDb()
  const hash = hashPassword(password)
  const ts = new Date().toISOString()
  db.run(
    `INSERT OR REPLACE INTO auth (id, kind, value, created_at) VALUES ('password', 'password', ?, ?)`,
    [hash, ts]
  )
}

export function generateToken(): string {
  const db = getDb()
  const token = randomBytes(32).toString('hex')
  const ts = new Date().toISOString()
  db.run(
    `INSERT OR REPLACE INTO auth (id, kind, value, created_at) VALUES ('token', 'token', ?, ?)`,
    [token, ts]
  )
  return token
}

// ─── login ────────────────────────────────────────────────────────────────────

export function loginWithPassword(password: string): string | null {
  const db = getDb()
  const row = db.query<{ value: string }, []>(
    `SELECT value FROM auth WHERE kind = 'password'`
  ).get()
  if (!row) return null
  if (!verifyPassword(password, row.value)) return null
  return createAuthSession()
}

export function loginWithToken(token: string): string | null {
  if (!verifyToken(token)) return null
  return createAuthSession()
}

function createAuthSession(): string {
  const db = getDb()
  const sessionToken = randomBytes(32).toString('hex')
  const ts = new Date().toISOString()
  db.run(
    `INSERT INTO auth_sessions (id, created_at, last_seen, expires_at) VALUES (?, ?, ?, NULL)`,
    [sessionToken, ts, ts]
  )
  return sessionToken
}

// ─── session validation ───────────────────────────────────────────────────────

export function validateAuthSession(token: string): boolean {
  if (!token) return false
  const db = getDb()
  const row = db.query<{ id: string }, [string]>(
    `SELECT id FROM auth_sessions WHERE id = ?`
  ).get(token)
  if (!row) return false
  db.run(`UPDATE auth_sessions SET last_seen = ? WHERE id = ?`, [
    new Date().toISOString(), token,
  ])
  return true
}

export function deleteAuthSession(token: string): void {
  const db = getDb()
  db.run(`DELETE FROM auth_sessions WHERE id = ?`, [token])
}

// ─── cookie helpers ───────────────────────────────────────────────────────────

export { COOKIE_NAME }

export function makeCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/`
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}

export function parseSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === COOKIE_NAME && v) return v
  }
  return null
}
