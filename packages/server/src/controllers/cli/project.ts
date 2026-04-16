import { Command } from 'commander'
import type { Project } from '@melody-sync/types'
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../../models/project'

// ─── formatting helpers ───────────────────────────────────────────────────────

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

function printProject(p: Project): void {
  console.log(`${p.id}  ${p.name}`)
  console.log(`  path: ${p.path}`)
  if (p.systemPrompt) console.log(`  system_prompt: ${p.systemPrompt.slice(0, 80)}...`)
  console.log(`  created: ${p.createdAt}  updated: ${p.updatedAt}`)
}

function printProjects(list: Project[]): void {
  if (list.length === 0) {
    console.log('(no projects)')
    return
  }
  for (const p of list) {
    console.log(`${p.id}  ${p.name.padEnd(30)}  ${p.path}`)
  }
}

// ─── command ──────────────────────────────────────────────────────────────────

export const projectCommand = new Command('project')
projectCommand.description('Manage projects')

// project list
projectCommand
  .command('list')
  .description('List all projects')
  .option('--json', 'Output as JSON', false)
  .action((opts: { json: boolean }) => {
    try {
      const projects = listProjects()
      opts.json ? printJson(projects) : printProjects(projects)
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// project get
projectCommand
  .command('get <id>')
  .description('Get a single project')
  .option('--json', 'Output as JSON', false)
  .action((id: string, opts: { json: boolean }) => {
    try {
      const project = getProject(id)
      if (!project) {
        console.error(`Project not found: ${id}`)
        process.exit(1)
      }
      opts.json ? printJson(project) : printProject(project)
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// project create
projectCommand
  .command('create')
  .description('Create a new project')
  .requiredOption('--name <name>', 'Project name')
  .requiredOption('--path <path>', 'Local folder path')
  .option('--system-prompt <prompt>', 'System prompt')
  .option('--json', 'Output as JSON', false)
  .action((opts: { name: string; path: string; systemPrompt?: string; json: boolean }) => {
    try {
      const project = createProject({ name: opts.name, path: opts.path, systemPrompt: opts.systemPrompt })
      opts.json ? printJson(project) : (console.log(`Created project: ${project.id}`), printProject(project))
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// project update
projectCommand
  .command('update <id>')
  .description('Update a project')
  .option('--name <name>', 'New name')
  .option('--path <path>', 'New path')
  .option('--system-prompt <prompt>', 'New system prompt')
  .option('--json', 'Output as JSON', false)
  .action((id: string, opts: { name?: string; path?: string; systemPrompt?: string; json: boolean }) => {
    try {
      const project = updateProject(id, { name: opts.name, path: opts.path, systemPrompt: opts.systemPrompt })
      opts.json ? printJson(project) : (console.log(`Updated: ${project.id}`), printProject(project))
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })

// project delete
projectCommand
  .command('delete <id>')
  .description('Delete a project')
  .option('--confirm', 'Confirm deletion', false)
  .option('--json', 'Output as JSON', false)
  .action((id: string, opts: { confirm: boolean; json: boolean }) => {
    if (!opts.confirm) {
      console.error('Add --confirm to actually delete the project.')
      process.exit(1)
    }
    try {
      deleteProject(id)
      const result = { deleted: true, id }
      opts.json ? printJson(result) : console.log(`Deleted project: ${id}`)
    } catch (e) {
      console.error('Error:', String(e))
      process.exit(1)
    }
  })
