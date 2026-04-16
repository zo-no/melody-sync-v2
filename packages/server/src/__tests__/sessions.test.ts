import { describe, it, expect, beforeAll, beforeEach } from 'bun:test'
import { setupTestDb, resetTestDb, GET, POST, PATCH, DEL } from './helpers'
import type { Project, Session } from '@melody-sync/types'

let projId: string

beforeAll(() => setupTestDb())

beforeEach(async () => {
  resetTestDb()
  // Create a project for each test
  const { json } = await POST<Project>('/api/projects', { name: 'Test Project', path: '/test' })
  if (!json.ok) throw new Error('Failed to create project')
  projId = json.data.id
})

// ── List ──────────────────────────────────────────────────────────────────────

describe('GET /api/sessions', () => {
  it('returns empty list for new project', async () => {
    const { status, json } = await GET<Session[]>(`/api/sessions?projectId=${projId}`)
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data).toEqual([])
  })

  it('filters by projectId', async () => {
    await POST('/api/sessions', { projectId: projId, name: 'S1' })
    // second project
    const { json: p2 } = await POST<Project>('/api/projects', { name: 'P2', path: '/p2' })
    if (!p2.ok) throw new Error()
    await POST('/api/sessions', { projectId: p2.data.id, name: 'S2' })

    const { json } = await GET<Session[]>(`/api/sessions?projectId=${projId}`)
    expect(json.ok).toBe(true)
    if (json.ok) {
      expect(json.data).toHaveLength(1)
      expect(json.data[0].name).toBe('S1')
    }
  })

  it('excludes archived sessions by default', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId, name: 'S' })
    if (!s.ok) throw new Error()
    await PATCH(`/api/sessions/${s.data.id}`, { archived: true })
    const { json } = await GET<Session[]>(`/api/sessions?projectId=${projId}`)
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data).toHaveLength(0)
  })

  it('returns archived sessions when archived=true', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId, name: 'S' })
    if (!s.ok) throw new Error()
    await PATCH(`/api/sessions/${s.data.id}`, { archived: true })
    const { json } = await GET<Session[]>(`/api/sessions?projectId=${projId}&archived=true`)
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data).toHaveLength(1)
  })
})

// ── Create ────────────────────────────────────────────────────────────────────

describe('POST /api/sessions', () => {
  it('creates a session with defaults', async () => {
    const { status, json } = await POST<Session>('/api/sessions', {
      projectId: projId,
    })
    expect(status).toBe(201)
    expect(json.ok).toBe(true)
    if (json.ok) {
      expect(json.data.id).toMatch(/^sess_/)
      expect(json.data.projectId).toBe(projId)
      expect(json.data.name).toBe('New Session')
    }
  })

  it('creates with custom name and model', async () => {
    const { json } = await POST<Session>('/api/sessions', {
      projectId: projId,
      name: 'Chat 1',
      model: 'claude-opus-4-5',
    })
    expect(json.ok).toBe(true)
    if (json.ok) {
      expect(json.data.name).toBe('Chat 1')
      expect(json.data.model).toBe('claude-opus-4-5')
    }
  })

  it('rejects missing projectId', async () => {
    const { status } = await POST('/api/sessions', { name: 'X' })
    expect(status).toBe(400)
  })
})

// ── Get ───────────────────────────────────────────────────────────────────────

describe('GET /api/sessions/:id', () => {
  it('returns 404 for unknown id', async () => {
    const { status } = await GET('/api/sessions/sess_nope')
    expect(status).toBe(404)
  })

  it('returns the session', async () => {
    const { json: created } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!created.ok) throw new Error()
    const { status, json } = await GET<Session>(`/api/sessions/${created.data.id}`)
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data.id).toBe(created.data.id)
  })
})

// ── Update ────────────────────────────────────────────────────────────────────

describe('PATCH /api/sessions/:id', () => {
  it('renames a session', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    const { json } = await PATCH<Session>(`/api/sessions/${s.data.id}`, { name: 'Renamed' })
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data.name).toBe('Renamed')
  })

  it('pins and unpins', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    const { json: pinned } = await PATCH<Session>(`/api/sessions/${s.data.id}`, { pinned: true })
    expect(pinned.ok && pinned.data.pinned).toBe(true)
    const { json: unpinned } = await PATCH<Session>(`/api/sessions/${s.data.id}`, { pinned: false })
    expect(unpinned.ok && unpinned.data.pinned).toBeFalsy()
  })

  it('archives a session', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    const { json } = await PATCH<Session>(`/api/sessions/${s.data.id}`, { archived: true })
    expect(json.ok).toBe(true)
    if (json.ok) {
      expect(json.data.archived).toBe(true)
      expect(json.data.archivedAt).toBeTruthy()
    }
  })

  it('returns 404 for unknown id', async () => {
    const { status } = await PATCH('/api/sessions/sess_nope', { name: 'X' })
    expect(status).toBe(404)
  })
})

// ── Delete ────────────────────────────────────────────────────────────────────

describe('DELETE /api/sessions/:id', () => {
  it('deletes a session', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    const { status } = await DEL(`/api/sessions/${s.data.id}`)
    expect(status).toBe(200)
    const { status: s2 } = await GET(`/api/sessions/${s.data.id}`)
    expect(s2).toBe(404)
  })
})

// ── Events ────────────────────────────────────────────────────────────────────

describe('GET /api/sessions/:id/events', () => {
  it('returns empty events for new session', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    const { status, json } = await GET(`/api/sessions/${s.data.id}/events`)
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) {
      const data = json.data as { items: unknown[] }
      expect(data.items).toEqual([])
    }
  })
})

// ── Send message ──────────────────────────────────────────────────────────────

describe('POST /api/sessions/:id/messages', () => {
  it('returns queued:true (runner not wired yet)', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    const { status, json } = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'Hello',
      requestId: 'req_001',
    })
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) {
      const data = json.data as { queued: boolean }
      expect(data.queued).toBe(true)
    }
  })

  it('returns 404 for unknown session', async () => {
    const { status } = await POST('/api/sessions/sess_nope/messages', { text: 'Hi' })
    expect(status).toBe(404)
  })
})
