import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import type { ApiResult } from '@melody-sync/types'
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../../models/project'

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

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  systemPrompt: z.string().optional(),
})

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  systemPrompt: z.string().nullable().optional(),
})

// ─── router ───────────────────────────────────────────────────────────────────

export const projectsRouter = new Hono()

// GET /projects
projectsRouter.get('/projects', (c) => {
  try {
    return c.json(ok(listProjects()))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// GET /projects/:id
projectsRouter.get('/projects/:id', (c) => {
  const id = c.req.param('id')
  try {
    const project = getProject(id)
    if (!project) return c.json(errBody('Project not found'), sc(404))
    return c.json(ok(project))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// POST /projects
projectsRouter.post('/projects', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json(errBody('Invalid JSON body'), sc(400))
  }
  const parsed = CreateProjectSchema.safeParse(body)
  if (!parsed.success) return c.json(errBody(parsed.error.message), sc(400))
  try {
    return c.json(ok(createProject(parsed.data)), sc(201))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})

// PATCH /projects/:id
projectsRouter.patch('/projects/:id', async (c) => {
  const id = c.req.param('id')
  let body: unknown
  try { body = await c.req.json() } catch {
    return c.json(errBody('Invalid JSON body'), sc(400))
  }
  const parsed = UpdateProjectSchema.safeParse(body)
  if (!parsed.success) return c.json(errBody(parsed.error.message), sc(400))
  try {
    return c.json(ok(updateProject(id, parsed.data)))
  } catch (e) {
    const msg = String(e)
    if (msg.includes('not found')) return c.json(errBody(msg), sc(404))
    return c.json(errBody(msg), sc(500))
  }
})

// DELETE /projects/:id
projectsRouter.delete('/projects/:id', (c) => {
  const id = c.req.param('id')
  try {
    deleteProject(id)
    return c.json(ok({ deleted: true }))
  } catch (e) {
    return c.json(errBody(String(e)), sc(500))
  }
})
