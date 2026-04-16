import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import type { ApiResult } from '@melody-sync/types'
import {
  loginWithPassword,
  loginWithToken,
  validateAuthSession,
  deleteAuthSession,
  makeCookie,
  clearCookie,
  parseSessionToken,
  hasAuth,
} from '../../models/auth'

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function errBody(error: string): ApiResult<never> {
  return { ok: false, error }
}

function sc(n: number): ContentfulStatusCode {
  return n as ContentfulStatusCode
}

const LoginSchema = z.union([
  z.object({ password: z.string() }),
  z.object({ token: z.string() }),
])

export const authRouter = new Hono()

// POST /auth/login
authRouter.post('/auth/login', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json(errBody('Invalid JSON body'), sc(400))
  }

  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) return c.json(errBody(parsed.error.message), sc(400))

  let sessionToken: string | null = null

  if ('password' in parsed.data) {
    sessionToken = loginWithPassword(parsed.data.password)
  } else {
    sessionToken = loginWithToken(parsed.data.token)
  }

  if (!sessionToken) {
    return c.json(errBody('Invalid credentials'), sc(401))
  }

  c.header('Set-Cookie', makeCookie(sessionToken))
  return c.json(ok({ ok: true }))
})

// POST /auth/logout
authRouter.post('/auth/logout', (c) => {
  const token = parseSessionToken(c.req.header('cookie'))
  if (token) deleteAuthSession(token)
  c.header('Set-Cookie', clearCookie())
  return c.json(ok({ ok: true }))
})

// GET /api/auth/me
authRouter.get('/api/auth/me', (c) => {
  const token = parseSessionToken(c.req.header('cookie'))
  const authenticated = token ? validateAuthSession(token) : false
  const setupRequired = !hasAuth()
  return c.json(ok({ authenticated, setupRequired }))
})
