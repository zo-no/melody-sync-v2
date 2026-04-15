export type WorkflowState = '' | 'waiting_user' | 'done' | 'paused'
export type WorkflowPriority = 'high' | 'medium' | 'low'
export type TaskListVisibility = 'primary' | 'secondary' | 'hidden'
export type TaskListOrigin = 'user' | 'assistant' | 'system'
export type LtBucket = 'long_term' | 'short_term' | 'waiting' | 'inbox' | 'skill'
export type LtRole = 'project' | 'member'
export type PersistentKind = 'recurring_task' | 'scheduled_task' | 'waiting_task' | 'skill'

export interface Session {
  // identity
  id: string
  createdAt: string
  updatedAt: string
  ordinal: number
  builtinName?: string

  // display
  name: string
  autoRenamePending?: boolean
  folder: string
  group?: string
  description?: string
  pinned?: boolean
  archived?: boolean
  archivedAt?: string

  // runtime preferences
  tool?: string
  model?: string
  effort?: string
  thinking?: boolean
  systemPrompt?: string

  // workflow
  workflowState?: WorkflowState
  workflowPriority?: WorkflowPriority
  workflowCompletedAt?: string

  // run lifecycle
  activeRunId?: string
  followUpQueue?: FollowUpEntry[]

  // visibility
  taskListOrigin?: TaskListOrigin
  taskListVisibility?: TaskListVisibility

  // long-term task fields
  ltRole?: LtRole
  ltBucket?: LtBucket
  persistentKind?: PersistentKind
  projectSessionId?: string

  // fork lineage
  forkedFromSessionId?: string
  rootSessionId?: string

  // connector metadata
  sourceId?: string
  sourceName?: string
  externalTriggerId?: string
}

export interface FollowUpEntry {
  requestId: string
  text: string
  queuedAt: string
}

export interface CreateSessionInput {
  name?: string
  folder?: string
  tool?: string
  model?: string
  effort?: string
  thinking?: boolean
  systemPrompt?: string
  taskListOrigin?: TaskListOrigin
  taskListVisibility?: TaskListVisibility
  ltBucket?: LtBucket
  forkedFromSessionId?: string
}

export interface UpdateSessionInput {
  name?: string
  folder?: string
  group?: string
  description?: string
  pinned?: boolean
  archived?: boolean
  tool?: string
  model?: string
  effort?: string
  thinking?: boolean
  systemPrompt?: string
  workflowState?: WorkflowState
  workflowPriority?: WorkflowPriority
  taskListVisibility?: TaskListVisibility
}
