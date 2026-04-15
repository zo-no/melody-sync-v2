import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ApiResult } from '@melody-sync/types'
import { getRun, getRunsBySession, cancelRun } from '../../models/run'

// ─── helpers ──────────────────────────────────────────────────────────────────

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

function errBody(error: string): ApiResult<never> {
  return { ok: false, error }
}

function sc(n: number): ContentfulStatusCode {
  return n as ContentfulStatusCode
}

// ─── router ───────────────────────────────────────────────────────────────────

export const runsRouter = new Hono()

// GET /runs/:id
runsRouter.get('/runs/:id', (c) => {
  const id = c.req.param('id')
  try {
    const run = getRun(id)
    if (!run) return c.json(errBody('Run not found'), sc(404))
    return c.json(ok(run))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// GET /sessions/:id/runs
runsRouter.get('/sessions/:id/runs', (c) => {
  const sessionId = c.req.param('id')
  try {
    const runs = getRunsBySession(sessionId)
    return c.json(ok(runs))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// POST /runs/:id/cancel
runsRouter.post('/runs/:id/cancel', (c) => {
  const id = c.req.param('id')
  try {
    const run = cancelRun(id)
    return c.json(ok(run))
  } catch (e) {
    const msg = String(e)
    if (msg.includes('not found')) return c.json(errBody(msg), sc(404))
    return c.json(errBody(msg), sc(500))
  }
})
