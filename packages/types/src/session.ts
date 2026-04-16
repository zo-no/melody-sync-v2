export interface Session {
  // identity
  id: string
  projectId: string
  createdAt: string
  updatedAt: string

  // display
  name: string
  autoRenamePending?: boolean
  pinned?: boolean
  archived?: boolean
  archivedAt?: string

  // runtime preferences
  model?: string
  effort?: string
  thinking?: boolean

  // run lifecycle
  activeRunId?: string
}

export interface CreateSessionInput {
  projectId: string
  name?: string
  model?: string
  effort?: string
  thinking?: boolean
}

export interface UpdateSessionInput {
  name?: string
  pinned?: boolean
  archived?: boolean
  model?: string
  effort?: string
  thinking?: boolean
  activeRunId?: string | null
  autoRenamePending?: boolean
}
