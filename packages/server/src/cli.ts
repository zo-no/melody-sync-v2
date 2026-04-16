#!/usr/bin/env bun
import { Command } from 'commander'
import { projectCommand } from './controllers/cli/project'
import { sessionCommand } from './controllers/cli/session'
import { runCommand } from './controllers/cli/run'

const program = new Command()

program
  .name('melodysync')
  .description('MelodySync CLI — manage projects, sessions, and runs')
  .version('0.1.0')

program.addCommand(projectCommand)
program.addCommand(sessionCommand)
program.addCommand(runCommand)

program.parse(process.argv)
