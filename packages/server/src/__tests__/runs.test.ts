import { describe, it, expect, beforeAll, beforeEach } from 'bun:test'
import { setupTestDb, resetTestDb, GET, POST } from './helpers'
import type { Project, Session, Run } from '@melody-sync/types'
import { createRun } from '../models/run'

let projId: string
let sessId: string

beforeAll(() => setupTestDb())

beforeEach(async () => {
  resetTestDb()
  const { json: p } = await POST<Project>('/api/projects', { name: 'P', path: '/p' })
  if (!p.ok) throw new Error()
  projId = p.data.id
  const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
  if (!s.ok) throw new Error()
  sessId = s.data.id
})

describe('GET /api/sessions/:id/runs', () => {
  it('returns empty list initially', async () => {
    const { status, json } = await GET<Run[]>(`/api/sessions/${sessId}/runs`)
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data).toEqual([])
  })

  it('returns created runs', async () => {
    createRun({ sessionId: sessId, requestId: 'req_1', tool: 'claude', model: 'claude-opus-4-5' })
    createRun({ sessionId: sessId, requestId: 'req_2', tool: 'claude', model: 'claude-opus-4-5' })
    const { json } = await GET<Run[]>(`/api/sessions/${sessId}/runs`)
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data).toHaveLength(2)
  })
})

describe('GET /api/runs/:id', () => {
  it('returns 404 for unknown id', async () => {
    const { status } = await GET('/api/runs/run_nope')
    expect(status).toBe(404)
  })

  it('returns the run', async () => {
    const run = createRun({ sessionId: sessId, requestId: 'req_1', tool: 'claude', model: 'claude-opus-4-5' })
    const { status, json } = await GET<Run>(`/api/runs/${run.id}`)
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) {
      expect(json.data.id).toBe(run.id)
      expect(json.data.state).toBe('accepted')
      expect(json.data.tool).toBe('claude')
      expect(json.data.model).toBe('claude-opus-4-5')
    }
  })
})

describe('POST /api/runs/:id/cancel', () => {
  it('sets cancelRequested=true', async () => {
    const run = createRun({ sessionId: sessId, requestId: 'req_1', tool: 'claude', model: 'claude-opus-4-5' })
    const { status, json } = await POST<Run>(`/api/runs/${run.id}/cancel`)
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data.cancelRequested).toBe(true)
  })

  it('returns 404 for unknown id', async () => {
    const { status } = await POST('/api/runs/run_nope/cancel')
    expect(status).toBe(404)
  })
})
