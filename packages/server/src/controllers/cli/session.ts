import { Command } from 'commander'
import type { Session } from '@melody-sync/types'
import {
  listSessions,
  getSession,
  createSession,
  deleteSession,
  archiveSession,
} from '../../models/session'

// ─── formatting helpers ───────────────────────────────────────────────────────

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

function printSession(s: Session): void {
  const archived = s.archived ? ' [archived]' : ''
  const pinned = s.pinned ? ' [pinned]' : ''
  console.log(`${s.id}  ${s.name}${pinned}${archived}`)
  console.log(`  folder: ${s.folder}  ordinal: ${s.ordinal}`)
  if (s.tool) console.log(`  tool: ${s.tool}`)
  if (s.model) console.log(`  model: ${s.model}`)
  if (s.workflowState) console.log(`  state: ${s.workflowState}`)
  console.log(`  created: ${s.createdAt}  updated: ${s.updatedAt}`)
}

function printSessions(list: Session[]): void {
  if (list.length === 0) {
    console.log('(no sessions)')
    return
  }
  for (const s of list) {
    console.log(
      `${s.id}  ${s.name.padEnd(30)}  ${s.folder}  ${s.workflowState ?? ''}`,
    )
  }
}

// ─── command ──────────────────────────────────────────────────────────────────

export const sessionCommand = new Command('session')
sessionCommand.description('Manage sessions')

// session list
sessionCommand
  .command('list')
  .description('List sessions')
  .option('--folder <folder>', 'Filter by folder')
  .option('--archived', 'Include archived sessions', false)
  .option('--json', 'Output as JSON', false)
  .action(
    (opts: { folder?: string; archived: boolean; json: boolean }) => {
      try {
        const sessions = listSessions({
          folder: opts.folder,
          archived: opts.archived ? true : undefined,
        })
        if (opts.json) {
          printJson(sessions)
        } else {
          printSessions(sessions)
        }
      } catch (e) {
        console.error('Error:', String(e))
        process.exit(1)
      }
    },
  )

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
      if (opts.json) {
        printJson(session)
      } else {
        printSession(session)
      }
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// session create
sessionCommand
  .command('create')
  .description('Create a new session')
  .requiredOption('--name <name>', 'Session name')
  .option('--folder <folder>', 'Folder', '~')
  .option('--tool <tool>', 'Tool (e.g. claude, codex)')
  .option('--model <model>', 'Model name')
  .option('--json', 'Output as JSON', false)
  .action(
    (opts: {
      name: string
      folder: string
      tool?: string
      model?: string
      json: boolean
    }) => {
      try {
        const session = createSession({
          name: opts.name,
          folder: opts.folder,
          tool: opts.tool,
          model: opts.model,
        })
        if (opts.json) {
          printJson(session)
        } else {
          console.log(`Created session: ${session.id}`)
          printSession(session)
        }
      } catch (e) {
        console.error('Error:', String(e))
        process.exit(1)
      }
    },
  )

// session send
sessionCommand
  .command('send <id> <text>')
  .description('Send a message to a session (queued)')
  .option('--json', 'Output as JSON', false)
  .action((id: string, text: string, opts: { json: boolean }) => {
    // For now, just acknowledge — runner dispatch is not yet wired
    const result = { queued: true, sessionId: id, text }
    if (opts.json) {
      printJson(result)
    } else {
      console.log(`queued: ${text}`)
    }
  })

// session archive
sessionCommand
  .command('archive <id>')
  .description('Archive a session')
  .option('--json', 'Output as JSON', false)
  .action((id: string, opts: { json: boolean }) => {
    try {
      const session = archiveSession(id)
      if (opts.json) {
        printJson(session)
      } else {
        console.log(`Archived: ${session.id}  ${session.name}`)
      }
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// session delete
sessionCommand
  .command('delete <id>')
  .description('Delete a session (requires --confirm)')
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
      if (opts.json) {
        printJson(result)
      } else {
        console.log(`Deleted session: ${id}`)
      }
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })
