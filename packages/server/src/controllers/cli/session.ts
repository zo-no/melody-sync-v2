import { Command } from 'commander'
import type { Session } from '@melody-sync/types'
import {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
} from '../../models/session'

// ─── formatting helpers ───────────────────────────────────────────────────────

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

function printSession(s: Session): void {
  const flags = [s.archived ? '[archived]' : '', s.pinned ? '[pinned]' : ''].filter(Boolean).join(' ')
  console.log(`${s.id}  ${s.name}  ${flags}`)
  console.log(`  project: ${s.projectId}`)
  if (s.tool) console.log(`  tool: ${s.tool}`)
  if (s.model) console.log(`  model: ${s.model}`)
  if (s.effort) console.log(`  effort: ${s.effort}`)
  if (s.thinking) console.log('  thinking: enabled')
  console.log(`  created: ${s.createdAt}  updated: ${s.updatedAt}`)
}

function printSessions(list: Session[]): void {
  if (list.length === 0) {
    console.log('(no sessions)')
    return
  }
  for (const s of list) {
    const flags = [s.archived ? '[archived]' : '', s.pinned ? '[pinned]' : ''].filter(Boolean).join(' ')
    console.log(`${s.id}  ${s.name.padEnd(30)}  ${flags}`)
  }
}

// ─── command ──────────────────────────────────────────────────────────────────

export const sessionCommand = new Command('session')
sessionCommand.description('Manage sessions')

// session list
sessionCommand
  .command('list')
  .description('List sessions')
  .option('--project <projectId>', 'Filter by project')
  .option('--archived', 'Show archived sessions', false)
  .option('--json', 'Output as JSON', false)
  .action((opts: { project?: string; archived: boolean; json: boolean }) => {
    try {
      const sessions = listSessions({ projectId: opts.project, archived: opts.archived ? true : undefined })
      opts.json ? printJson(sessions) : printSessions(sessions)
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// session get
sessionCommand
  .command('get <id>')
  .description('Get a single session')
  .option('--json', 'Output as JSON', false)
  .action((id: string, opts: { json: boolean }) => {
    try {
      const session = getSession(id)
      if (!session) {
        console.error(`Session not found: ${id}`)
        process.exit(1)
      }
      opts.json ? printJson(session) : printSession(session)
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// session create
sessionCommand
  .command('create')
  .description('Create a new session')
  .requiredOption('--project <projectId>', 'Project id')
  .option('--name <name>', 'Session name')
  .option('--tool <tool>', 'Tool name')
  .option('--model <model>', 'Model name')
  .option('--effort <effort>', 'Reasoning effort')
  .option('--thinking', 'Enable thinking mode', false)
  .option('--json', 'Output as JSON', false)
  .action((opts: {
    project: string
    name?: string
    tool?: string
    model?: string
    effort?: string
    thinking: boolean
    json: boolean
  }) => {
    try {
      const session = createSession({
        projectId: opts.project,
        name: opts.name,
        tool: opts.tool,
        model: opts.model,
        effort: opts.effort,
        thinking: opts.thinking,
      })
      opts.json ? printJson(session) : (console.log(`Created session: ${session.id}`), printSession(session))
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// session update
sessionCommand
  .command('update <id>')
  .description('Update session preferences')
  .option('--name <name>', 'Session name')
  .option('--tool <tool>', 'Tool name')
  .option('--model <model>', 'Model name')
  .option('--effort <effort>', 'Reasoning effort')
  .option('--thinking', 'Enable thinking mode')
  .option('--no-thinking', 'Disable thinking mode')
  .option('--json', 'Output as JSON', false)
  .action((id: string, opts: {
    name?: string
    tool?: string
    model?: string
    effort?: string
    thinking?: boolean
    json: boolean
  }) => {
    try {
      const session = updateSession(id, {
        ...(opts.name !== undefined ? { name: opts.name } : {}),
        ...(opts.tool !== undefined ? { tool: opts.tool } : {}),
        ...(opts.model !== undefined ? { model: opts.model } : {}),
        ...(opts.effort !== undefined ? { effort: opts.effort } : {}),
        ...(opts.thinking !== undefined ? { thinking: opts.thinking } : {}),
      })
      opts.json ? printJson(session) : printSession(session)
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// session archive
sessionCommand
  .command('archive <id>')
  .description('Archive a session')
  .option('--json', 'Output as JSON', false)
  .action((id: string, opts: { json: boolean }) => {
    try {
      const session = updateSession(id, { archived: true })
      opts.json ? printJson(session) : console.log(`Archived: ${session.id}  ${session.name}`)
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// session delete
sessionCommand
  .command('delete <id>')
  .description('Delete a session')
  .option('--confirm', 'Confirm deletion', false)
  .option('--json', 'Output as JSON', false)
  .action((id: string, opts: { confirm: boolean; json: boolean }) => {
    if (!opts.confirm) {
      console.error('Add --confirm to actually delete the session.')
      process.exit(1)
    }
    try {
      deleteSession(id)
      const result = { deleted: true, id }
      opts.json ? printJson(result) : console.log(`Deleted session: ${id}`)
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })
