export type NodeState = 'active' | 'done' | 'waiting' | 'failed'
export type EdgeKind = 'fork' | 'delegate' | 'merge'

export interface WorkbenchNode {
  id: string
  sessionId: string
  sourceSessionId?: string
  label: string
  state: NodeState
  bucket?: string
  planId: string
  createdAt: string
  updatedAt: string
}

export interface WorkbenchEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  kind: EdgeKind
  planId: string
}

export interface TaskMapPlan {
  id: string
  rootSessionId: string
  activeNodeId: string
  createdAt: string
  updatedAt: string
  nodes: WorkbenchNode[]
  edges: WorkbenchEdge[]
}

export interface Hook {
  id: string
  eventPattern: string
  label: string
  shellCommand: string
  runInBackground: boolean
  enabled: boolean
  createdAt: string
}
