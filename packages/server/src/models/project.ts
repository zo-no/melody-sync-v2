import { randomBytes } from 'node:crypto'
import type { Project, CreateProjectInput, UpdateProjectInput } from '@melody-sync/types'
import { getDb } from '../db'

function genId(): string {
  return 'proj_' + randomBytes(8).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

type ProjectRow = {
  id: string
  name: string
  path: string
  system_prompt: string | null
  created_at: string
  updated_at: string
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    systemPrompt: row.system_prompt ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

export function listProjects(): Project[] {
  const db = getDb()
  const rows = db.query<ProjectRow, []>(
    `SELECT * FROM projects ORDER BY updated_at DESC`
  ).all()
  return rows.map(rowToProject)
}

export function getProject(id: string): Project | null {
  const db = getDb()
  const row = db.query<ProjectRow, [string]>(
    'SELECT * FROM projects WHERE id = ?'
  ).get(id)
  return row ? rowToProject(row) : null
}

export function createProject(input: CreateProjectInput): Project {
  const db = getDb()
  const id = genId()
  const ts = now()

  db.run(
    `INSERT INTO projects (id, name, path, system_prompt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.path, input.systemPrompt ?? null, ts, ts]
  )

  return getProject(id)!
}

export function updateProject(id: string, input: UpdateProjectInput): Project {
  const db = getDb()
  const existing = getProject(id)
  if (!existing) throw new Error(`Project not found: ${id}`)

  const ts = now()
  const sets: string[] = ['updated_at = ?']
  const params: (string | null)[] = [ts]

  if ('name' in input && input.name !== undefined) {
    sets.push('name = ?')
    params.push(input.name)
  }
  if ('path' in input && input.path !== undefined) {
    sets.push('path = ?')
    params.push(input.path)
  }
  if ('systemPrompt' in input) {
    sets.push('system_prompt = ?')
    params.push(input.systemPrompt ?? null)
  }

  params.push(id)
  db.run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, params)
  return getProject(id)!
}

export function deleteProject(id: string): void {
  const db = getDb()
  db.run('DELETE FROM projects WHERE id = ?', [id])
}
