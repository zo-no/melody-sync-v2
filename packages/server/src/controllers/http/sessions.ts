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
} from '../../models/session'
import { appendEvent, listEvents } from '../../models/history'
import { submitSessionMessage } from '../../runtime/session-runner'

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

// ─── schemas ──────────────────────────────────────────────────────────────────

const CreateSessionSchema = z.object({
  projectId: z.string(),
  name: z.string().optional(),
  tool: z.string().optional(),
  model: z.string().nullable().optional(),
  effort: z.string().nullable().optional(),
  thinking: z.boolean().optional(),
  claudeSessionId: z.string().nullable().optional(),
  codexThreadId: z.string().nullable().optional(),
})

const UpdateSessionSchema = z.object({
  name: z.string().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  tool: z.string().optional(),
  model: z.string().nullable().optional(),
  effort: z.string().nullable().optional(),
  thinking: z.boolean().optional(),
  claudeSessionId: z.string().nullable().optional(),
  codexThreadId: z.string().nullable().optional(),
  autoRenamePending: z.boolean().optional(),
})

const SendMessageSchema = z.object({
  text: z.string(),
  requestId: z.string().optional(),
  tool: z.string().optional(),
  model: z.string().nullable().optional(),
  effort: z.string().nullable().optional(),
  thinking: z.boolean().optional(),
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
})

// ─── router ───────────────────────────────────────────────────────────────────

export const sessionsRouter = new Hono()

// GET /sessions
sessionsRouter.get('/sessions', (c) => {
  const projectId = c.req.query('projectId')
  const archivedQ = c.req.query('archived')
  const archived = archivedQ === 'true' ? true : archivedQ === 'false' ? false : undefined
  try {
    return c.json(ok(listSessions({ projectId, archived })))
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
  try { body = await c.req.json() } catch {
    return c.json(errBody('Invalid JSON body'), sc(400))
  }
  const parsed = CreateSessionSchema.safeParse(body)
  if (!parsed.success) return c.json(errBody(parsed.error.message), sc(400))
  try {
    return c.json(ok(createSession(parsed.data)), sc(201))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// PATCH /sessions/:id
sessionsRouter.patch('/sessions/:id', async (c) => {
  const id = c.req.param('id')
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json(errBody('Invalid JSON body'), sc(400))
  }
  const parsed = UpdateSessionSchema.safeParse(body)
  if (!parsed.success) return c.json(errBody(parsed.error.message), sc(400))
  try {
    return c.json(ok(updateSession(id, parsed.data)))
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

// GET /sessions/:id/events
sessionsRouter.get('/sessions/:id/events', (c) => {
  const id = c.req.param('id')
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : undefined
  try {
    const items = listEvents(id, { limit, offset })
    return c.json(ok({ items, total: items.length, offset: offset ?? 0, limit: limit ?? items.length }))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// POST /sessions/:id/messages
sessionsRouter.post('/sessions/:id/messages', async (c) => {
  const id = c.req.param('id')
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json(errBody('Invalid JSON body'), sc(400))
  }
  const parsed = SendMessageSchema.safeParse(body)
  if (!parsed.success) return c.json(errBody(parsed.error.message), sc(400))

  const session = getSession(id)
  if (!session) return c.json(errBody('Session not found'), sc(404))

  try {
    return c.json(ok(submitSessionMessage({
      sessionId: id,
      text: parsed.data.text,
      requestId: parsed.data.requestId,
      tool: parsed.data.tool,
      model: parsed.data.model,
      effort: parsed.data.effort,
      thinking: parsed.data.thinking,
      attachments: parsed.data.attachments,
    })))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})
