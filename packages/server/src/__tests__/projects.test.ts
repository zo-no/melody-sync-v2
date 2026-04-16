import { describe, it, expect, beforeAll, beforeEach } from 'bun:test'
import { setupTestDb, resetTestDb, GET, POST, PATCH, DEL } from './helpers'
import type { Project } from '@melody-sync/types'

beforeAll(() => setupTestDb())
beforeEach(() => resetTestDb())

describe('GET /api/projects', () => {
  it('returns empty list initially', async () => {
    const { status, json } = await GET('/api/projects')
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data).toEqual([])
  })

  it('returns created projects', async () => {
    await POST('/api/projects', { name: 'A', path: '/a' })
    await POST('/api/projects', { name: 'B', path: '/b' })
    const { json } = await GET<Project[]>('/api/projects')
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data).toHaveLength(2)
  })
})

describe('POST /api/projects', () => {
  it('creates a project', async () => {
    const { status, json } = await POST<Project>('/api/projects', {
      name: 'My Project',
      path: '/Users/foo/my-project',
    })
    expect(status).toBe(201)
    expect(json.ok).toBe(true)
    if (json.ok) {
      expect(json.data.name).toBe('My Project')
      expect(json.data.path).toBe('/Users/foo/my-project')
      expect(json.data.id).toMatch(/^proj_/)
    }
  })

  it('creates a project with system prompt', async () => {
    const { json } = await POST<Project>('/api/projects', {
      name: 'P',
      path: '/p',
      systemPrompt: 'You are helpful.',
    })
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data.systemPrompt).toBe('You are helpful.')
  })

  it('rejects missing name', async () => {
    const { status, json } = await POST('/api/projects', { path: '/x' })
    expect(status).toBe(400)
    expect(json.ok).toBe(false)
  })

  it('rejects missing path', async () => {
    const { status, json } = await POST('/api/projects', { name: 'X' })
    expect(status).toBe(400)
    expect(json.ok).toBe(false)
  })
})

describe('GET /api/projects/:id', () => {
  it('returns 404 for unknown id', async () => {
    const { status, json } = await GET('/api/projects/proj_notexist')
    expect(status).toBe(404)
    expect(json.ok).toBe(false)
  })

  it('returns the project', async () => {
    const { json: created } = await POST<Project>('/api/projects', { name: 'X', path: '/x' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const { status, json } = await GET<Project>(`/api/projects/${created.data.id}`)
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data.id).toBe(created.data.id)
  })
})

describe('PATCH /api/projects/:id', () => {
  it('updates name and path', async () => {
    const { json: created } = await POST<Project>('/api/projects', { name: 'Old', path: '/old' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const { status, json } = await PATCH<Project>(`/api/projects/${created.data.id}`, {
      name: 'New',
      path: '/new',
    })
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) {
      expect(json.data.name).toBe('New')
      expect(json.data.path).toBe('/new')
    }
  })

  it('clears system prompt with null', async () => {
    const { json: created } = await POST<Project>('/api/projects', {
      name: 'P', path: '/p', systemPrompt: 'hello',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const { json } = await PATCH<Project>(`/api/projects/${created.data.id}`, { systemPrompt: null })
    expect(json.ok).toBe(true)
    if (json.ok) expect(json.data.systemPrompt).toBeUndefined()
  })

  it('returns 404 for unknown id', async () => {
    const { status } = await PATCH('/api/projects/proj_nope', { name: 'X' })
    expect(status).toBe(404)
  })
})

describe('DELETE /api/projects/:id', () => {
  it('deletes a project', async () => {
    const { json: created } = await POST<Project>('/api/projects', { name: 'X', path: '/x' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const { status, json } = await DEL(`/api/projects/${created.data.id}`)
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    // confirm gone
    const { status: s2 } = await GET(`/api/projects/${created.data.id}`)
    expect(s2).toBe(404)
  })
})
