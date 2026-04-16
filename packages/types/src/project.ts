export interface Project {
  id: string           // 'proj_' + hex
  name: string
  path: string         // absolute local path
  systemPrompt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  path: string
  systemPrompt?: string
}

export interface UpdateProjectInput {
  name?: string
  path?: string
  systemPrompt?: string | null
}
