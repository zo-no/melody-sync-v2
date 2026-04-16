/**
 * Unit tests for model-layer functions (no HTTP).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'bun:test'
import { setupTestDb, resetTestDb } from './helpers'
import { createProject, getProject, listProjects, updateProject, deleteProject } from '../models/project'
import {
  createSession, getSession, listSessions, updateSession,
  getFollowUpQueue, enqueueFollowUp, dequeueFollowUp,
} from '../models/session'
import { createRun, getRun, updateRun, cancelRun } from '../models/run'

beforeAll(() => setupTestDb())
beforeEach(() => resetTestDb())

// ── Project model ─────────────────────────────────────────────────────────────

describe('project model', () => {
  it('create / get roundtrip', () => {
    const p = createProject({ name: 'My Project', path: '/foo' })
    expect(p.id).toMatch(/^proj_/)
    expect(p.name).toBe('My Project')
    expect(p.path).toBe('/foo')
    expect(p.systemPrompt).toBeUndefined()

    const fetched = getProject(p.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.id).toBe(p.id)
  })

  it('listProjects returns all', () => {
    createProject({ name: 'A', path: '/a' })
    createProject({ name: 'B', path: '/b' })
    expect(listProjects()).toHaveLength(2)
  })

  it('updateProject changes fields', () => {
    const p = createProject({ name: 'Old', path: '/old' })
    const updated = updateProject(p.id, { name: 'New', systemPrompt: 'Hi' })
    expect(updated.name).toBe('New')
    expect(updated.systemPrompt).toBe('Hi')
    expect(updated.path).toBe('/old') // unchanged
  })

  it('deleteProject removes it', () => {
    const p = createProject({ name: 'X', path: '/x' })
    deleteProject(p.id)
    expect(getProject(p.id)).toBeNull()
  })

  it('updateProject throws on unknown id', () => {
    expect(() => updateProject('proj_nope', { name: 'X' })).toThrow()
  })
})

// ── Session model ─────────────────────────────────────────────────────────────

describe('session model', () => {
  let projId: string

  beforeEach(() => {
    const p = createProject({ name: 'P', path: '/p' })
    projId = p.id
  })

  it('create / get roundtrip', () => {
    const s = createSession({ projectId: projId, name: 'Chat 1' })
    expect(s.id).toMatch(/^sess_/)
    expect(s.projectId).toBe(projId)
    expect(s.name).toBe('Chat 1')
    expect(s.tool).toBe('codex')
    expect(s.archived).toBeFalsy()
    expect(s.pinned).toBeFalsy()

    const fetched = getSession(s.id)
    expect(fetched?.id).toBe(s.id)
  })

  it('listSessions filters by projectId', () => {
    const p2 = createProject({ name: 'P2', path: '/p2' })
    createSession({ projectId: projId, name: 'S1' })
    createSession({ projectId: p2.id, name: 'S2' })
    const list = listSessions({ projectId: projId })
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('S1')
  })

  it('listSessions excludes archived by default', () => {
    const s = createSession({ projectId: projId })
    updateSession(s.id, { archived: true })
    expect(listSessions({ projectId: projId })).toHaveLength(0)
    expect(listSessions({ projectId: projId, archived: true })).toHaveLength(1)
  })

  it('pinned sessions sort first', () => {
    const s1 = createSession({ projectId: projId, name: 'Normal' })
    const s2 = createSession({ projectId: projId, name: 'Pinned' })
    updateSession(s2.id, { pinned: true })
    const list = listSessions({ projectId: projId })
    expect(list[0].id).toBe(s2.id)
    expect(list[1].id).toBe(s1.id)
  })

  it('archived sets archivedAt', () => {
    const s = createSession({ projectId: projId })
    const updated = updateSession(s.id, { archived: true })
    expect(updated.archived).toBe(true)
    expect(updated.archivedAt).toBeTruthy()
    // unarchive clears it
    const unarchived = updateSession(s.id, { archived: false })
    expect(unarchived.archived).toBeFalsy()
    expect(unarchived.archivedAt).toBeUndefined()
  })

  it('persists provider resume ids on create and update', () => {
    const created = createSession({
      projectId: projId,
      tool: 'claude',
      claudeSessionId: 'sess_claude_1',
    })
    expect(created.claudeSessionId).toBe('sess_claude_1')
    expect(created.codexThreadId).toBeUndefined()

    const updated = updateSession(created.id, {
      claudeSessionId: null,
      codexThreadId: 'thread_codex_1',
    })
    expect(updated.claudeSessionId).toBeUndefined()
    expect(updated.codexThreadId).toBe('thread_codex_1')
  })
})

// ── Follow-up queue ───────────────────────────────────────────────────────────

describe('follow-up queue', () => {
  let sessId: string

  beforeEach(() => {
    const p = createProject({ name: 'P', path: '/p' })
    const s = createSession({ projectId: p.id })
    sessId = s.id
  })

  it('starts empty', () => {
    expect(getFollowUpQueue(sessId)).toEqual([])
  })

  it('enqueue / dequeue roundtrip', () => {
    enqueueFollowUp(sessId, {
      requestId: 'req_1',
      text: 'Hello',
      tool: 'codex',
      model: null,
      effort: 'medium',
      thinking: false,
    })
    enqueueFollowUp(sessId, {
      requestId: 'req_2',
      text: 'World',
      tool: 'claude',
      model: 'opus',
      effort: null,
      thinking: true,
    })
    expect(getFollowUpQueue(sessId)).toHaveLength(2)

    const first = dequeueFollowUp(sessId)
    expect(first?.requestId).toBe('req_1')
    expect(getFollowUpQueue(sessId)).toHaveLength(1)

    const second = dequeueFollowUp(sessId)
    expect(second?.requestId).toBe('req_2')
    expect(dequeueFollowUp(sessId)).toBeNull()
  })

  it('deduplicates by requestId', () => {
    enqueueFollowUp(sessId, {
      requestId: 'req_1',
      text: 'Hello',
      tool: 'codex',
      model: null,
      effort: 'medium',
      thinking: false,
    })
    enqueueFollowUp(sessId, {
      requestId: 'req_1',
      text: 'Hello again',
      tool: 'codex',
      model: null,
      effort: 'high',
      thinking: false,
    })
    expect(getFollowUpQueue(sessId)).toHaveLength(1)
  })
})

// ── Run model ─────────────────────────────────────────────────────────────────

describe('run model', () => {
  let sessId: string

  beforeEach(() => {
    const p = createProject({ name: 'P', path: '/p' })
    const s = createSession({ projectId: p.id })
    sessId = s.id
  })

  it('create / get roundtrip', () => {
    const r = createRun({ sessionId: sessId, requestId: 'req_1', tool: 'claude', model: 'claude-opus-4-5' })
    expect(r.id).toMatch(/^run_/)
    expect(r.state).toBe('accepted')
    expect(r.cancelRequested).toBe(false)
    expect(r.tool).toBe('claude')
    expect(r.model).toBe('claude-opus-4-5')

    const fetched = getRun(r.id)
    expect(fetched?.id).toBe(r.id)
  })

  it('updateRun transitions state', () => {
    const r = createRun({ sessionId: sessId, requestId: 'req_1', tool: 'claude', model: 'claude-opus-4-5' })
    const updated = updateRun(r.id, { state: 'running' })
    expect(updated.state).toBe('running')
  })

  it('cancelRun sets cancelRequested', () => {
    const r = createRun({ sessionId: sessId, requestId: 'req_1', tool: 'claude', model: 'claude-opus-4-5' })
    const cancelled = cancelRun(r.id)
    expect(cancelled.cancelRequested).toBe(true)
  })

  it('updateRun throws on unknown id', () => {
    expect(() => updateRun('run_nope', { state: 'running' })).toThrow()
  })
})
