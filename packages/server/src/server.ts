import { Hono } from 'hono'
import type { ApiErr } from '@melody-sync/types'
import { authRouter } from './controllers/http/auth'
import { projectsRouter } from './controllers/http/projects'
import { sessionsRouter } from './controllers/http/sessions'
import { runsRouter } from './controllers/http/runs'
import { runtimeRouter } from './controllers/http/runtime'
import { requireAuth } from './middleware/auth'

// ─── app ──────────────────────────────────────────────────────────────────────

export const app = new Hono()

// Health check (public)
app.get('/health', (c) =>
  c.json({ ok: true, service: 'melody-sync', ts: Date.now() }),
)

// Auth routes (public)
app.route('/', authRouter)

// All /api/* routes require auth
app.use('/api/*', requireAuth)
app.route('/api', projectsRouter)
app.route('/api', sessionsRouter)
app.route('/api', runsRouter)
app.route('/api', runtimeRouter)

// ─── global error handler ─────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('[server] unhandled error:', err)
  const body: ApiErr = {
    ok: false,
    error: err.message ?? 'Internal server error',
  }
  return c.json(body, 500)
})

app.notFound((c) => {
  const body: ApiErr = {
    ok: false,
    error: `Not found: ${c.req.method} ${c.req.path}`,
  }
  return c.json(body, 404)
})

// ─── start ────────────────────────────────────────────────────────────────────

const DEFAULT_PORT = 7761

export function startServer(port: number = DEFAULT_PORT): void {
  console.log(`[melody-sync] starting server on port ${port}`)
  const server = Bun.serve({ port, fetch: app.fetch })
  console.log(`[melody-sync] listening on http://localhost:${server.port}`)
}

if (import.meta.main) {
  const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : DEFAULT_PORT
  startServer(port)
}
