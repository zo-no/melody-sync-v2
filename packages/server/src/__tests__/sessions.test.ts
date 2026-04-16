import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setupTestDb, resetTestDb, GET, POST, PATCH, DEL, waitFor } from './helpers'
import type { Project, Run, RuntimeModelCatalog, RuntimeTool, Session } from '@melody-sync/types'

let projId: string
let projectPath: string
let fakeBinDir: string
let fakeCodexPath: string
let fakeClaudePath: string
let fakeCodexArgsLog: string
let fakeClaudeArgsLog: string

const PROVIDER_RUN_WAIT_TIMEOUT_MS = 5000

beforeAll(() => {
  setupTestDb()

  fakeBinDir = mkdtempSync(join(tmpdir(), 'melody-sync-v2-fake-tools-'))
  fakeCodexPath = join(fakeBinDir, 'fake-codex')
  fakeClaudePath = join(fakeBinDir, 'fake-claude')
  fakeCodexArgsLog = join(fakeBinDir, 'fake-codex-args.jsonl')
  fakeClaudeArgsLog = join(fakeBinDir, 'fake-claude-args.jsonl')

  writeFileSync(fakeCodexPath, `#!/usr/bin/env node
const fs = require('fs');
const argv = process.argv.slice(2);
const delay = Number(process.env.FAKE_CODEX_DELAY_MS || 0);
const fail = process.env.FAKE_CODEX_FAIL === '1';
const resumeIndex = argv.indexOf('resume');
const threadId = resumeIndex !== -1 ? argv[resumeIndex + 1] : (process.env.FAKE_CODEX_THREAD_ID || 'thread_fake_codex');
const reply = resumeIndex !== -1
  ? (process.env.FAKE_CODEX_RESUME_REPLY || ('resumed from ' + threadId))
  : (process.env.FAKE_CODEX_REPLY || 'finished from fake codex');
if (process.env.FAKE_CODEX_ARGS_LOG) {
  fs.appendFileSync(process.env.FAKE_CODEX_ARGS_LOG, JSON.stringify(argv) + '\\n');
}
console.log(JSON.stringify({ type: 'thread.started', thread_id: threadId }));
setTimeout(() => {
  if (fail) {
    console.log(JSON.stringify({ type: 'turn.failed', error: { message: 'fake codex failed' } }));
    process.exit(1);
    return;
  }
  console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: reply } }));
  console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 12, cached_input_tokens: 3, output_tokens: 7 } }));
  process.exit(0);
}, delay);
`, 'utf8')
  chmodSync(fakeCodexPath, 0o755)

  writeFileSync(fakeClaudePath, `#!/usr/bin/env node
const fs = require('fs');
const argv = process.argv.slice(2);
const delay = Number(process.env.FAKE_CLAUDE_DELAY_MS || 0);
const fail = process.env.FAKE_CLAUDE_FAIL === '1';
const softFail = process.env.FAKE_CLAUDE_SOFT_FAIL === '1';
const resumeIndex = argv.findIndex((value) => value === '--resume' || value === '-r');
const sessionId = resumeIndex !== -1 ? argv[resumeIndex + 1] : (process.env.FAKE_CLAUDE_SESSION_ID || 'sess_fake_claude');
const reply = resumeIndex !== -1
  ? (process.env.FAKE_CLAUDE_RESUME_REPLY || ('resumed from ' + sessionId))
  : (process.env.FAKE_CLAUDE_REPLY || 'finished from fake claude');
if (process.env.FAKE_CLAUDE_ARGS_LOG) {
  fs.appendFileSync(process.env.FAKE_CLAUDE_ARGS_LOG, JSON.stringify(argv) + '\\n');
}
console.log(JSON.stringify({ type: 'system', subtype: 'init', session_id: sessionId }));
setTimeout(() => {
  if (fail) {
    console.log(JSON.stringify({
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      errors: ['fake claude failed']
    }));
    console.error('fake claude failed');
    process.exit(1);
    return;
  }
  if (softFail) {
    console.log(JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: true,
      result: 'fake claude soft failure'
    }));
    process.exit(0);
    return;
  }
  console.log(JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text: reply }
      ]
    }
  }));
  console.log(JSON.stringify({
    type: 'result',
    usage: {
      input_tokens: 11,
      cache_creation_input_tokens: 2,
      cache_read_input_tokens: 0,
      output_tokens: 5
    }
  }));
  process.exit(0);
}, delay);
`, 'utf8')
  chmodSync(fakeClaudePath, 0o755)

  process.env['MELODYSYNC_CODEX_COMMAND'] = fakeCodexPath
  process.env['MELODYSYNC_CLAUDE_COMMAND'] = fakeClaudePath
  process.env['FAKE_CODEX_ARGS_LOG'] = fakeCodexArgsLog
  process.env['FAKE_CLAUDE_ARGS_LOG'] = fakeClaudeArgsLog
})

beforeEach(async () => {
  resetTestDb()
  if (projectPath) {
    rmSync(projectPath, { recursive: true, force: true })
  }
  projectPath = mkdtempSync(join(tmpdir(), 'melody-sync-v2-project-'))
  delete process.env['FAKE_CODEX_DELAY_MS']
  delete process.env['FAKE_CODEX_REPLY']
  delete process.env['FAKE_CODEX_RESUME_REPLY']
  delete process.env['FAKE_CODEX_FAIL']
  delete process.env['FAKE_CODEX_THREAD_ID']
  delete process.env['FAKE_CLAUDE_DELAY_MS']
  delete process.env['FAKE_CLAUDE_REPLY']
  delete process.env['FAKE_CLAUDE_RESUME_REPLY']
  delete process.env['FAKE_CLAUDE_FAIL']
  delete process.env['FAKE_CLAUDE_SOFT_FAIL']
  delete process.env['FAKE_CLAUDE_SESSION_ID']
  rmSync(fakeCodexArgsLog, { force: true })
  rmSync(fakeClaudeArgsLog, { force: true })
  // Create a project for each test
  const { json } = await POST<Project>('/api/projects', { name: 'Test Project', path: projectPath })
  if (!json.ok) throw new Error('Failed to create project')
  projId = json.data.id
})

afterAll(() => {
  if (projectPath) {
    rmSync(projectPath, { recursive: true, force: true })
  }
  if (fakeBinDir) {
    rmSync(fakeBinDir, { recursive: true, force: true })
  }
  delete process.env['MELODYSYNC_CODEX_COMMAND']
  delete process.env['MELODYSYNC_CLAUDE_COMMAND']
  delete process.env['FAKE_CODEX_ARGS_LOG']
  delete process.env['FAKE_CLAUDE_ARGS_LOG']
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
      expect(json.data.tool).toBe('codex')
    }
  })

  it('creates with custom name, tool, and model', async () => {
    const { json } = await POST<Session>('/api/sessions', {
      projectId: projId,
      name: 'Chat 1',
      tool: 'claude',
      model: 'claude-opus-4-5',
    })
    expect(json.ok).toBe(true)
    if (json.ok) {
      expect(json.data.name).toBe('Chat 1')
      expect(json.data.tool).toBe('claude')
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

describe('GET /api/tools', () => {
  it('returns the builtin runtime tools', async () => {
    const { status, json } = await GET<RuntimeTool[]>('/api/tools')
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (!json.ok) return

    const codex = json.data.find((tool) => tool.id === 'codex')
    const claude = json.data.find((tool) => tool.id === 'claude')

    expect(codex?.builtin).toBe(true)
    expect(codex?.available).toBe(true)
    expect(claude?.builtin).toBe(true)
    expect(claude?.available).toBe(true)
  })
})

describe('GET /api/models', () => {
  it('returns the claude runtime model catalog', async () => {
    const { status, json } = await GET<RuntimeModelCatalog>('/api/models?tool=claude')
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (!json.ok) return

    expect(json.data.reasoning.kind).toBe('toggle')
    expect(json.data.models.map((model) => model.id)).toEqual(['sonnet', 'opus', 'haiku'])
  })

  it('returns a codex reasoning catalog', async () => {
    const { status, json } = await GET<RuntimeModelCatalog>('/api/models?tool=codex')
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (!json.ok) return

    expect(json.data.reasoning.kind).toBe('enum')
    expect(json.data.effortLevels?.length).toBeGreaterThan(0)
  })
})

// ── Send message ──────────────────────────────────────────────────────────────

describe('POST /api/sessions/:id/messages', () => {
  it('runs the message through codex and persists the assistant reply', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    process.env['FAKE_CODEX_REPLY'] = 'finished from fake codex'
    const { status, json } = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'Hello',
      requestId: 'req_001',
    })
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) {
      const data = json.data as { queued: boolean; run: Run | null; session: Session | null }
      expect(data.queued).toBe(false)
      expect(data.run?.tool).toBe('codex')
      expect(data.session?.activeRunId).toBe(data.run?.id)

      await waitFor(async () => {
        const { json: runResult } = await GET<Run>(`/api/runs/${data.run!.id}`)
        return runResult.ok && ['completed', 'failed', 'cancelled'].includes(runResult.data.state)
      }, { timeoutMs: PROVIDER_RUN_WAIT_TIMEOUT_MS })

      const { json: runResult } = await GET<Run>(`/api/runs/${data.run!.id}`)
      expect(runResult.ok).toBe(true)
      if (runResult.ok) {
        expect(runResult.data.state).toBe('completed')
        expect(runResult.data.result).toBe('success')
        expect(runResult.data.codexThreadId).toBe('thread_fake_codex')
      }
    }

    const { json: events } = await GET(`/api/sessions/${s.data.id}/events`)
    expect(events.ok).toBe(true)
    if (events.ok) {
      const items = (events.data as { items: Array<{ type: string; role?: string; content?: string }> }).items
      expect(items.some((item) => item.type === 'message' && item.role === 'user' && item.content === 'Hello')).toBe(true)
      expect(items.some((item) => item.type === 'message' && item.role === 'assistant' && item.content === 'finished from fake codex')).toBe(true)
    }

    const { json: sessionDetail } = await GET<Session>(`/api/sessions/${s.data.id}`)
    expect(sessionDetail.ok).toBe(true)
    if (sessionDetail.ok) {
      expect(sessionDetail.data.activeRunId).toBeUndefined()
      expect(sessionDetail.data.tool).toBe('codex')
      expect(sessionDetail.data.codexThreadId).toBe('thread_fake_codex')
    }
  })

  it('runs the message through claude when the session tool is claude', async () => {
    const { json: s } = await POST<Session>('/api/sessions', {
      projectId: projId,
      tool: 'claude',
      model: 'claude-opus-4-5',
    })
    if (!s.ok) throw new Error()
    process.env['FAKE_CLAUDE_REPLY'] = 'finished from fake claude'

    const { status, json } = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'Summarize this',
      requestId: 'req_claude',
    })

    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    if (json.ok) {
      const data = json.data as { queued: boolean; run: Run | null }
      expect(data.queued).toBe(false)
      expect(data.run?.tool).toBe('claude')

      await waitFor(async () => {
        const { json: runResult } = await GET<Run>(`/api/runs/${data.run!.id}`)
        return runResult.ok && runResult.data.state === 'completed'
      }, { timeoutMs: PROVIDER_RUN_WAIT_TIMEOUT_MS })

      const { json: runResult } = await GET<Run>(`/api/runs/${data.run!.id}`)
      expect(runResult.ok).toBe(true)
      if (runResult.ok) {
        expect(runResult.data.claudeSessionId).toBe('sess_fake_claude')
      }
    }

    const { json: events } = await GET(`/api/sessions/${s.data.id}/events`)
    expect(events.ok).toBe(true)
    if (events.ok) {
      const items = (events.data as { items: Array<{ type: string; role?: string; content?: string }> }).items
      expect(items.some((item) => item.type === 'message' && item.role === 'assistant' && item.content === 'finished from fake claude')).toBe(true)
    }

    const { json: sessionDetail } = await GET<Session>(`/api/sessions/${s.data.id}`)
    expect(sessionDetail.ok).toBe(true)
    if (sessionDetail.ok) {
      expect(sessionDetail.data.claudeSessionId).toBe('sess_fake_claude')
    }
  })

  it('resumes codex with the persisted thread id on the next turn', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    process.env['FAKE_CODEX_REPLY'] = 'first codex reply'
    process.env['FAKE_CODEX_RESUME_REPLY'] = 'second codex reply from resume'

    const first = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'First question',
      requestId: 'req_codex_first',
    })
    expect(first.json.ok).toBe(true)
    if (first.json.ok) {
      const run = (first.json.data as { run: Run | null }).run
      await waitFor(async () => {
        const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
        return runResult.ok && runResult.data.state === 'completed'
      }, { timeoutMs: PROVIDER_RUN_WAIT_TIMEOUT_MS })
    }

    const second = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'Second question',
      requestId: 'req_codex_second',
    })
    expect(second.json.ok).toBe(true)
    if (second.json.ok) {
      const run = (second.json.data as { run: Run | null }).run
      await waitFor(async () => {
        const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
        return runResult.ok && runResult.data.state === 'completed'
      }, { timeoutMs: PROVIDER_RUN_WAIT_TIMEOUT_MS })
    }

    const codexArgs = readFileSync(fakeCodexArgsLog, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[])
    expect(codexArgs).toHaveLength(2)
    expect(codexArgs[0].includes('resume')).toBe(false)
    expect(codexArgs[1]).toContain('resume')
    expect(codexArgs[1]).toContain('thread_fake_codex')

    const { json: events } = await GET(`/api/sessions/${s.data.id}/events`)
    expect(events.ok).toBe(true)
    if (events.ok) {
      const items = (events.data as { items: Array<{ type: string; role?: string; content?: string }> }).items
      expect(items.some((item) => item.type === 'message' && item.role === 'assistant' && item.content === 'second codex reply from resume')).toBe(true)
    }
  })

  it('resumes claude with the persisted session id on the next turn', async () => {
    const { json: s } = await POST<Session>('/api/sessions', {
      projectId: projId,
      tool: 'claude',
      model: 'claude-opus-4-5',
    })
    if (!s.ok) throw new Error()
    process.env['FAKE_CLAUDE_REPLY'] = 'first claude reply'
    process.env['FAKE_CLAUDE_RESUME_REPLY'] = 'second claude reply from resume'

    const first = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'First prompt',
      requestId: 'req_claude_first',
    })
    expect(first.json.ok).toBe(true)
    if (first.json.ok) {
      const run = (first.json.data as { run: Run | null }).run
      await waitFor(async () => {
        const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
        return runResult.ok && runResult.data.state === 'completed'
      }, { timeoutMs: PROVIDER_RUN_WAIT_TIMEOUT_MS })
    }

    const second = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'Second prompt',
      requestId: 'req_claude_second',
    })
    expect(second.json.ok).toBe(true)
    if (second.json.ok) {
      const run = (second.json.data as { run: Run | null }).run
      await waitFor(async () => {
        const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
        return runResult.ok && runResult.data.state === 'completed'
      }, { timeoutMs: PROVIDER_RUN_WAIT_TIMEOUT_MS })
    }

    const claudeArgs = readFileSync(fakeClaudeArgsLog, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[])
    expect(claudeArgs).toHaveLength(2)
    expect(claudeArgs[0].includes('--resume')).toBe(false)
    expect(claudeArgs[1]).toContain('--resume')
    expect(claudeArgs[1]).toContain('sess_fake_claude')

    const { json: events } = await GET(`/api/sessions/${s.data.id}/events`)
    expect(events.ok).toBe(true)
    if (events.ok) {
      const items = (events.data as { items: Array<{ type: string; role?: string; content?: string }> }).items
      expect(items.some((item) => item.type === 'message' && item.role === 'assistant' && item.content === 'second claude reply from resume')).toBe(true)
    }
  })

  it('queues follow-up messages while a run is already active', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    process.env['FAKE_CODEX_REPLY'] = 'queued codex reply'
    process.env['FAKE_CODEX_RESUME_REPLY'] = 'queued codex reply'
    process.env['FAKE_CODEX_DELAY_MS'] = '90'

    const first = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'First',
      requestId: 'req_first',
    })
    const second = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'Second',
      requestId: 'req_second',
    })

    expect(first.json.ok).toBe(true)
    expect(second.json.ok).toBe(true)
    if (first.json.ok && second.json.ok) {
      const firstData = first.json.data as { queued: boolean; run: Run | null }
      const secondData = second.json.data as { queued: boolean; run: Run | null }
      expect(firstData.queued).toBe(false)
      expect(firstData.run).not.toBeNull()
      expect(secondData.queued).toBe(true)
      expect(secondData.run).toBeNull()

      await waitFor(async () => {
        const { json: runs } = await GET<Run[]>(`/api/sessions/${s.data.id}/runs`)
        return runs.ok && runs.data.length === 2 && runs.data.every((run) => run.state === 'completed')
      }, { timeoutMs: 5000 })
    }

    const { json: events } = await GET(`/api/sessions/${s.data.id}/events`)
    expect(events.ok).toBe(true)
    if (events.ok) {
      const items = (events.data as { items: Array<{ type: string; role?: string; content?: string }> }).items
      expect(items.filter((item) => item.type === 'message' && item.role === 'user')).toHaveLength(2)
      expect(items.filter((item) => item.type === 'message' && item.role === 'assistant' && item.content === 'queued codex reply')).toHaveLength(2)
    }
  })

  it('keeps the queued message runtime snapshot even if the session preference changes later', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    process.env['FAKE_CODEX_REPLY'] = 'first codex reply'
    process.env['FAKE_CODEX_DELAY_MS'] = '90'
    process.env['FAKE_CLAUDE_REPLY'] = 'queued claude reply'

    const first = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'First',
      requestId: 'req_first_snapshot',
    })
    expect(first.json.ok).toBe(true)

    const second = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'Second',
      requestId: 'req_second_snapshot',
      tool: 'claude',
      model: 'opus',
      thinking: true,
    })
    expect(second.json.ok).toBe(true)
    if (second.json.ok) {
      expect((second.json.data as { queued: boolean }).queued).toBe(true)
    }

    await PATCH(`/api/sessions/${s.data.id}`, {
      tool: 'codex',
      model: null,
      effort: 'medium',
      thinking: false,
    })

    await waitFor(async () => {
      const { json: runs } = await GET<Run[]>(`/api/sessions/${s.data.id}/runs`)
      return runs.ok && runs.data.length === 2 && runs.data.every((run) => run.state === 'completed')
    }, { timeoutMs: 5000 })

    const { json: runs } = await GET<Run[]>(`/api/sessions/${s.data.id}/runs`)
    expect(runs.ok).toBe(true)
    if (!runs.ok) return

    const queuedRun = runs.data.find((run) => run.requestId === 'req_second_snapshot')
    expect(queuedRun?.tool).toBe('claude')
    expect(queuedRun?.model).toBe('opus')
    expect(queuedRun?.thinking).toBe(true)

    const claudeArgs = readFileSync(fakeClaudeArgsLog, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[])
    expect(claudeArgs).toHaveLength(1)
    expect(claudeArgs[0]).toContain('--model')
    expect(claudeArgs[0]).toContain('opus')
    expect(claudeArgs[0]).toContain('--effort')
    expect(claudeArgs[0]).toContain('high')
  })

  it('uses codex provider errors as the run failure reason', async () => {
    const { json: s } = await POST<Session>('/api/sessions', { projectId: projId })
    if (!s.ok) throw new Error()
    process.env['FAKE_CODEX_FAIL'] = '1'

    const send = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'Trigger codex failure',
      requestId: 'req_codex_fail',
    })
    expect(send.json.ok).toBe(true)
    if (!send.json.ok) return

    const run = (send.json.data as { run: Run | null }).run
    await waitFor(async () => {
      const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
      return runResult.ok && runResult.data.state === 'failed'
    }, { timeoutMs: PROVIDER_RUN_WAIT_TIMEOUT_MS })

    const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
    expect(runResult.ok).toBe(true)
    if (runResult.ok) {
      expect(runResult.data.failureReason).toBe('fake codex failed')
    }
  })

  it('fails with a clear error when the project path does not exist', async () => {
    const missingPath = join(projectPath, 'missing-worktree')
    const { json: project } = await POST<Project>('/api/projects', {
      name: 'Broken Project',
      path: missingPath,
    })
    expect(project.ok).toBe(true)
    if (!project.ok) return

    const { json: session } = await POST<Session>('/api/sessions', {
      projectId: project.data.id,
      name: 'Broken Session',
    })
    expect(session.ok).toBe(true)
    if (!session.ok) return

    const send = await POST(`/api/sessions/${session.data.id}/messages`, {
      text: 'Trigger missing cwd',
      requestId: 'req_missing_cwd',
    })
    expect(send.json.ok).toBe(true)
    if (!send.json.ok) return

    const run = (send.json.data as { run: Run | null }).run
    await waitFor(async () => {
      const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
      return runResult.ok && runResult.data.state === 'failed'
    }, { timeoutMs: PROVIDER_RUN_WAIT_TIMEOUT_MS })

    const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
    expect(runResult.ok).toBe(true)
    if (runResult.ok) {
      expect(runResult.data.failureReason).toBe(`project path does not exist: ${missingPath}`)
    }

    const { json: events } = await GET(`/api/sessions/${session.data.id}/events`)
    expect(events.ok).toBe(true)
    if (events.ok) {
      const items = (events.data as { items: Array<{ type: string; content?: string }> }).items
      expect(items.some((item) => item.type === 'status' && item.content === `error: project path does not exist: ${missingPath}`)).toBe(true)
    }
  })

  it('uses claude provider errors as the run failure reason', async () => {
    const { json: s } = await POST<Session>('/api/sessions', {
      projectId: projId,
      tool: 'claude',
      model: 'claude-opus-4-5',
    })
    if (!s.ok) throw new Error()
    process.env['FAKE_CLAUDE_FAIL'] = '1'

    const send = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'Trigger claude failure',
      requestId: 'req_claude_fail',
    })
    expect(send.json.ok).toBe(true)
    if (!send.json.ok) return

    const run = (send.json.data as { run: Run | null }).run
    await waitFor(async () => {
      const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
      return runResult.ok && runResult.data.state === 'failed'
    }, { timeoutMs: PROVIDER_RUN_WAIT_TIMEOUT_MS })

    const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
    expect(runResult.ok).toBe(true)
    if (runResult.ok) {
      expect(runResult.data.failureReason).toBe('fake claude failed')
    }

    const { json: events } = await GET(`/api/sessions/${s.data.id}/events`)
    expect(events.ok).toBe(true)
    if (events.ok) {
      const items = (events.data as { items: Array<{ type: string; content?: string }> }).items
      expect(items.some((item) => item.type === 'status' && item.content === 'Claude error: fake claude failed')).toBe(true)
    }
  })

  it('fails the run when claude reports an error but exits successfully', async () => {
    const { json: s } = await POST<Session>('/api/sessions', {
      projectId: projId,
      tool: 'claude',
      model: 'claude-opus-4-5',
    })
    if (!s.ok) throw new Error()
    process.env['FAKE_CLAUDE_SOFT_FAIL'] = '1'

    const send = await POST(`/api/sessions/${s.data.id}/messages`, {
      text: 'Trigger claude soft failure',
      requestId: 'req_claude_soft_fail',
    })
    expect(send.json.ok).toBe(true)
    if (!send.json.ok) return

    const run = (send.json.data as { run: Run | null }).run
    await waitFor(async () => {
      const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
      return runResult.ok && runResult.data.state === 'failed'
    }, { timeoutMs: PROVIDER_RUN_WAIT_TIMEOUT_MS })

    const { json: runResult } = await GET<Run>(`/api/runs/${run!.id}`)
    expect(runResult.ok).toBe(true)
    if (runResult.ok) {
      expect(runResult.data.result).toBe('error')
      expect(runResult.data.failureReason).toBe('fake claude soft failure')
    }
  })

  it('returns 404 for unknown session', async () => {
    const { status } = await POST('/api/sessions/sess_nope/messages', { text: 'Hi' })
    expect(status).toBe(404)
  })
})
