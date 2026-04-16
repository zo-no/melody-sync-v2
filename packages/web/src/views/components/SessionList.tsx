import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { useProjectStore } from '@/controllers/project'
import { useSessionStore } from '@/controllers/session'
import { StatusGlyph, ToolGlyph } from '@/views/components/UiGlyphs'
import type { Project, Session } from '@melody-sync/types'

function formatProjectPath(path?: string): string {
  if (!path) return ''
  return path.replace(/^\/Users\/[^/]+/, '~')
}

function formatRelativeTime(value: string): string {
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return ''

  const diffMs = Date.now() - ts
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(ts))
}

function ChevronIcon({ open = false }: { open?: boolean }) {
  return (
    <svg
      className={`ms-chevron${open ? ' is-open' : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 4v5l3 3v1H6v-1l3-3V4h6Zm-3 9v7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 7h16v4H4zm2 4h12v8H6zm4 4h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 7h14M9 7V5h6v2m-7 3v7m4-7v7m4-7v7M7 7l1 12h8l1-12"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

interface ProjectSwitcherProps {
  onProjectChosen?: () => void
}

function ProjectSwitcher({ onProjectChosen }: ProjectSwitcherProps) {
  const projects = useProjectStore((s) => s.projects)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const currentProject = projects.find((project) => project.id === currentProjectId) ?? null
  const selectProject = useProjectStore((s) => s.selectProject)
  const setCurrentProject = useSessionStore((s) => s.setCurrentProject)

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function handleSelect(project: Project) {
    selectProject(project.id)
    setCurrentProject(project.id)
    setOpen(false)
    onProjectChosen?.()
  }

  return (
    <div ref={ref} className="ms-project-switcher">
      <button
        type="button"
        className="ms-project-switcher-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className="ms-project-switcher-copy">
          <span className="ms-project-switcher-name">
            {currentProject?.name ?? 'No project selected'}
          </span>
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="ms-project-switcher-menu">
          {projects.length === 0 ? (
            <p className="ms-project-switcher-empty">No projects yet.</p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={`ms-project-option${project.id === currentProject?.id ? ' is-active' : ''}`}
                onClick={() => handleSelect(project)}
              >
                <span className="ms-project-option-name">{project.name}</span>
                <span className="ms-project-option-path">{formatProjectPath(project.path)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const createProject = useProjectStore((s) => s.createProject)
  const selectProject = useProjectStore((s) => s.selectProject)
  const setCurrentProject = useSessionStore((s) => s.setCurrentProject)

  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !path.trim()) return

    setSaving(true)
    setError(null)

    try {
      const project = await createProject({
        name: name.trim(),
        path: path.trim(),
        systemPrompt: systemPrompt.trim() || undefined,
      })
      selectProject(project.id)
      setCurrentProject(project.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ms-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ms-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create project"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ms-modal-header">
          <div>
            <h2>Create project</h2>
            <p>Projects scope the sessions shown in this workspace.</p>
          </div>
          <button type="button" className="ms-icon-button" onClick={onClose} aria-label="Close">
            <span>✕</span>
          </button>
        </div>

        <form className="ms-modal-form" onSubmit={handleSubmit}>
          <label className="ms-field">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My Project"
            />
          </label>

          <label className="ms-field">
            <span>Path</span>
            <input
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="/Users/you/my-project"
            />
          </label>

          <label className="ms-field">
            <span>System prompt</span>
            <textarea
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="Optional project-level instructions"
              rows={4}
            />
          </label>

          {error && <p className="ms-form-error">{error}</p>}

          <div className="ms-modal-actions">
            <button type="button" className="ms-secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="ms-primary-button"
              disabled={saving || !name.trim() || !path.trim()}
            >
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SessionStateChip({ session }: { session: Session }) {
  if (session.activeRunId) {
    return <StatusGlyph tone="live" pulse className="ms-session-state-glyph" />
  }

  if (session.autoRenamePending) {
    return <StatusGlyph tone="warning" className="ms-session-state-glyph" />
  }

  return null
}

interface SessionRowProps {
  session: Session
  isActive: boolean
  onSelect: () => void
  onRename: (name: string) => Promise<void>
  onPin: () => Promise<void>
  onArchive: () => Promise<void>
  onDelete: () => Promise<void>
}

function SessionRow({
  session,
  isActive,
  onSelect,
  onRename,
  onPin,
  onArchive,
  onDelete,
}: SessionRowProps) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(session.name || 'Untitled')
  const [busy, setBusy] = useState<'rename' | 'pin' | 'archive' | 'delete' | null>(null)

  useEffect(() => {
    setDraftName(session.name || 'Untitled')
  }, [session.id, session.name])

  async function commitRename() {
    const trimmed = draftName.trim()
    setEditing(false)

    if (!trimmed || trimmed === session.name) {
      setDraftName(session.name || 'Untitled')
      return
    }

    try {
      setBusy('rename')
      await onRename(trimmed)
    } finally {
      setBusy(null)
    }
  }

  async function handleAction(
    event: SyntheticEvent,
    action: 'pin' | 'archive' | 'delete',
  ) {
    event.preventDefault()
    event.stopPropagation()

    try {
      setBusy(action)
      if (action === 'pin') {
        await onPin()
        return
      }

      if (action === 'archive') {
        await onArchive()
        return
      }

      await onDelete()
    } finally {
      setBusy(null)
    }
  }

  function handleRenameShortcut(event: SyntheticEvent) {
    event.preventDefault()
    event.stopPropagation()
    setEditing(true)
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void commitRename()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setDraftName(session.name || 'Untitled')
      setEditing(false)
    }
  }

  return (
    <div className={`ms-session-row${isActive ? ' is-active' : ''}`}>
      {editing ? (
        <div className="ms-session-row-main">
          <input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={() => void commitRename()}
            onKeyDown={handleRenameKeyDown}
            className="ms-session-rename-input"
          />
          <div className="ms-session-row-meta">
            <span>Press Enter to save</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ms-session-row-main"
          onClick={onSelect}
          onDoubleClick={() => setEditing(true)}
        >
          <div className="ms-session-row-title">
            {session.pinned && (
              <span className="ms-session-pin" aria-hidden="true">
                <PinIcon />
              </span>
            )}
            <span className="ms-session-row-name">{session.name || 'Untitled'}</span>
          </div>
          <div className="ms-session-row-meta">
            <span>{formatRelativeTime(session.updatedAt)}</span>
            {session.tool && <ToolGlyph tool={session.tool} className="ms-session-row-tool" />}
            <SessionStateChip session={session} />
          </div>
        </button>
      )}

      {!editing && (
        <div className="ms-session-row-actions">
          <button
            type="button"
            className="ms-icon-button"
            onClick={handleRenameShortcut}
            title="Rename session"
            aria-label="Rename session"
            disabled={busy !== null}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className={`ms-icon-button${session.pinned ? ' is-active' : ''}`}
            onClick={(event) => void handleAction(event, 'pin')}
            title={session.pinned ? 'Unpin session' : 'Pin session'}
            aria-label={session.pinned ? 'Unpin session' : 'Pin session'}
            disabled={busy !== null}
          >
            <PinIcon />
          </button>
          <button
            type="button"
            className="ms-icon-button"
            onClick={(event) => void handleAction(event, 'archive')}
            title="Archive session"
            aria-label="Archive session"
            disabled={busy !== null}
          >
            <ArchiveIcon />
          </button>
          <button
            type="button"
            className="ms-icon-button is-danger"
            onClick={(event) => void handleAction(event, 'delete')}
            title="Delete session"
            aria-label="Delete session"
            disabled={busy !== null}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  )
}

interface SessionListProps {
  onRequestClose?: () => void
}

export function SessionList({ onRequestClose }: SessionListProps) {
  const projects = useProjectStore((s) => s.projects)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const currentProject = projects.find((project) => project.id === currentProjectId) ?? null

  const sessions = useSessionStore((s) => s.sessions)
  const currentSessionId = useSessionStore((s) => s.currentSessionId)
  const loading = useSessionStore((s) => s.loading)
  const error = useSessionStore((s) => s.error)
  const fetchSessions = useSessionStore((s) => s.fetchSessions)
  const selectSession = useSessionStore((s) => s.selectSession)
  const createSession = useSessionStore((s) => s.createSession)
  const updateSession = useSessionStore((s) => s.updateSession)
  const deleteSession = useSessionStore((s) => s.deleteSession)
  const archiveSession = useSessionStore((s) => s.archiveSession)
  const pinSession = useSessionStore((s) => s.pinSession)
  const setCurrentProject = useSessionStore((s) => s.setCurrentProject)

  const [search, setSearch] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)

  useEffect(() => {
    setCurrentProject(currentProjectId)
  }, [currentProjectId, setCurrentProject])

  useEffect(() => {
    setSearch('')
  }, [currentProjectId])

  useEffect(() => {
    if (currentProjectId) {
      void fetchSessions(currentProjectId)
    }
  }, [currentProjectId, fetchSessions])

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return sessions

    return sessions.filter((session) => {
      const haystack = [session.name, session.tool, session.model]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [search, sessions])

  const pinnedSessions = filteredSessions.filter((session) => session.pinned)
  const regularSessions = filteredSessions.filter((session) => !session.pinned)

  async function handleNewSession() {
    if (!currentProjectId) return
    const session = await createSession({ projectId: currentProjectId, name: 'New Session' })
    selectSession(session.id)
    onRequestClose?.()
  }

  function handleSelectSession(sessionId: string) {
    selectSession(sessionId)
    onRequestClose?.()
  }

  return (
    <>
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}

      <aside className="ms-sidebar">
        <div className="ms-sidebar-top">
          <ProjectSwitcher onProjectChosen={onRequestClose} />

          <button
            type="button"
            className="ms-sidebar-subtle-button"
            onClick={() => setShowNewProject(true)}
          >
            New project
          </button>

          <div className="ms-sidebar-section-heading">
            <span>Sessions</span>
            <span>{sessions.length}</span>
          </div>

          <label className="ms-sidebar-search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sessions"
            />
          </label>
        </div>

        <div className="ms-sidebar-scroll">
          {!currentProjectId && (
            <div className="ms-session-list-empty">
              <span className="ms-session-list-empty-label">No project selected</span>
              <p className="ms-session-list-empty-hint">
                Pick a project or create one to start a session workspace.
              </p>
            </div>
          )}

          {currentProjectId && loading && (
            <div className="ms-session-list-empty">
              <span className="ms-session-list-empty-label">Loading sessions…</span>
            </div>
          )}

          {currentProjectId && !loading && error && (
            <div className="ms-session-list-empty">
              <span className="ms-session-list-empty-label">Could not load sessions</span>
              <p className="ms-session-list-empty-hint">{error}</p>
            </div>
          )}

          {currentProjectId && !loading && !error && filteredSessions.length === 0 && (
            <div className="ms-session-list-empty">
              <span className="ms-session-list-empty-label">
                {search.trim() ? 'No matching sessions' : 'No sessions yet'}
              </span>
              <p className="ms-session-list-empty-hint">
                {search.trim()
                  ? 'Try a different search or clear the filter.'
                  : 'Create a new session to start the conversation.'}
              </p>
            </div>
          )}

          {pinnedSessions.length > 0 && (
            <section className="ms-session-group">
              <div className="ms-session-group-heading">
                <span>Pinned</span>
              </div>
              <div className="ms-session-group-items">
                {pinnedSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isActive={session.id === currentSessionId}
                    onSelect={() => handleSelectSession(session.id)}
                    onRename={(name) => updateSession(session.id, { name })}
                    onPin={() => pinSession(session.id, !session.pinned)}
                    onArchive={async () => {
                      const confirmed = window.confirm(`Archive "${session.name || 'Untitled'}"?`)
                      if (!confirmed) return
                      await archiveSession(session.id)
                    }}
                    onDelete={async () => {
                      const confirmed = window.confirm(`Delete "${session.name || 'Untitled'}"?`)
                      if (!confirmed) return
                      await deleteSession(session.id)
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {regularSessions.length > 0 && (
            <section className="ms-session-group">
              <div className="ms-session-group-heading">
                <span>{pinnedSessions.length > 0 ? 'All sessions' : 'Recent'}</span>
              </div>
              <div className="ms-session-group-items">
                {regularSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isActive={session.id === currentSessionId}
                    onSelect={() => handleSelectSession(session.id)}
                    onRename={(name) => updateSession(session.id, { name })}
                    onPin={() => pinSession(session.id, !session.pinned)}
                    onArchive={async () => {
                      const confirmed = window.confirm(`Archive "${session.name || 'Untitled'}"?`)
                      if (!confirmed) return
                      await archiveSession(session.id)
                    }}
                    onDelete={async () => {
                      const confirmed = window.confirm(`Delete "${session.name || 'Untitled'}"?`)
                      if (!confirmed) return
                      await deleteSession(session.id)
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="ms-sidebar-footer">
          <button
            type="button"
            className="ms-new-session-button"
            onClick={() => void handleNewSession()}
            disabled={!currentProjectId}
          >
            <PlusIcon />
            <span>New session</span>
          </button>
        </div>
      </aside>
    </>
  )
}
