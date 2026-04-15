import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import type { ApiResult } from '@melody-sync/types'
import {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  archiveSession,
  pinSession,
} from '../../models/session'
import { listEvents } from '../../models/history'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const CreateSessionSchema = z.object({
  name: z.string().optional(),
  folder: z.string().optional(),
  tool: z.string().optional(),
  model: z.string().optional(),
  effort: z.string().optional(),
  thinking: z.boolean().optional(),
  systemPrompt: z.string().optional(),
  taskListOrigin: z.enum(['user', 'assistant', 'system']).optional(),
  taskListVisibility: z.enum(['primary', 'secondary', 'hidden']).optional(),
  ltBucket: z.enum(['long_term', 'short_term', 'waiting', 'inbox', 'skill']).optional(),
  forkedFromSessionId: z.string().optional(),
})

const UpdateSessionSchema = z.object({
  name: z.string().optional(),
  folder: z.string().optional(),
  group: z.string().optional(),
  description: z.string().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  tool: z.string().optional(),
  model: z.string().optional(),
  effort: z.string().optional(),
  thinking: z.boolean().optional(),
  systemPrompt: z.string().optional(),
  workflowState: z
    .enum(['', 'waiting_user', 'done', 'paused'])
    .optional(),
  workflowPriority: z.enum(['high', 'medium', 'low']).optional(),
  taskListVisibility: z.enum(['primary', 'secondary', 'hidden']).optional(),
})

const PinBodySchema = z.object({
  pinned: z.boolean(),
})

const SendMessageSchema = z.object({
  text: z.string(),
  attachments: z
    .array(
      z.object({
        type: z.enum(['file', 'image']),
        assetId: z.string().optional(),
        name: z.string(),
        mimeType: z.string(),
      }),
    )
    .optional(),
  requestId: z.string().optional(),
})

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

export const sessionsRouter = new Hono()

// GET /sessions
sessionsRouter.get('/sessions', (c) => {
  const folder = c.req.query('folder')
  const archivedQ = c.req.query('archived')
  const visibility = c.req.query('visibility')

  const archived =
    archivedQ === 'true' ? true : archivedQ === 'false' ? false : undefined

  try {
    const result = listSessions({ folder, archived, visibility })
    return c.json(ok(result))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// GET /sessions/:id
sessionsRouter.get('/sessions/:id', (c) => {
  const id = c.req.param('id')
  try {
    const session = getSession(id)
    if (!session) return c.json(errBody('Session not found'), sc(404))
    return c.json(ok(session))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// POST /sessions
sessionsRouter.post('/sessions', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(errBody('Invalid JSON body'), sc(400))
  }

  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(errBody(parsed.error.message), sc(400))
  }

  try {
    const session = createSession(parsed.data)
    return c.json(ok(session), sc(201))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// PATCH /sessions/:id
sessionsRouter.patch('/sessions/:id', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(errBody('Invalid JSON body'), sc(400))
  }

  const parsed = UpdateSessionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(errBody(parsed.error.message), sc(400))
  }

  try {
    const session = updateSession(id, parsed.data)
    return c.json(ok(session))
  } catch (e) {
    const msg = String(e)
    if (msg.includes('not found')) return c.json(errBody(msg), sc(404))
    return c.json(errBody(msg), sc(500))
  }
})

// DELETE /sessions/:id
sessionsRouter.delete('/sessions/:id', (c) => {
  const id = c.req.param('id')
  try {
    deleteSession(id)
    return c.json(ok({ deleted: true }))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// POST /sessions/:id/archive
sessionsRouter.post('/sessions/:id/archive', (c) => {
  const id = c.req.param('id')
  try {
    const session = archiveSession(id)
    return c.json(ok(session))
  } catch (e) {
    const msg = String(e)
    if (msg.includes('not found')) return c.json(errBody(msg), sc(404))
    return c.json(errBody(msg), sc(500))
  }
})

// POST /sessions/:id/pin
sessionsRouter.post('/sessions/:id/pin', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(errBody('Invalid JSON body'), sc(400))
  }

  const parsed = PinBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json(errBody(parsed.error.message), sc(400))
  }

  try {
    const session = pinSession(id, parsed.data.pinned)
    return c.json(ok(session))
  } catch (e) {
    const msg = String(e)
    if (msg.includes('not found')) return c.json(errBody(msg), sc(404))
    return c.json(errBody(msg), sc(500))
  }
})

// GET /sessions/:id/events
sessionsRouter.get('/sessions/:id/events', (c) => {
  const id = c.req.param('id')
  const limitQ = c.req.query('limit')
  const offsetQ = c.req.query('offset')

  const limit = limitQ ? parseInt(limitQ, 10) : undefined
  const offset = offsetQ ? parseInt(offsetQ, 10) : undefined

  try {
    const events = listEvents(id, { limit, offset })
    return c.json(ok(events))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// POST /sessions/:id/messages
sessionsRouter.post('/sessions/:id/messages', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(errBody('Invalid JSON body'), sc(400))
  }

  const parsed = SendMessageSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(errBody(parsed.error.message), sc(400))
  }

  // Session existence check
  const session = getSession(id)
  if (!session) return c.json(errBody('Session not found'), sc(404))

  // TODO: dispatch to runner — for now just acknowledge
  return c.json(ok({ ok: true, message: 'queued' }))
})
