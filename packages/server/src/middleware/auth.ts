import type { Context, Next } from 'hono'
import type { ApiResult } from '@melody-sync/types'
import { validateAuthSession, parseSessionToken, hasAuth } from '../models/auth'

export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  // If no auth is configured, allow all requests (dev / first-run mode)
  if (!hasAuth()) return next()

  const token = parseSessionToken(c.req.header('cookie'))
  if (!token || !validateAuthSession(token)) {
    const body: ApiResult<never> = { ok: false, error: 'Unauthorized' }
    return c.json(body, 401)
  }
  return next()
}
