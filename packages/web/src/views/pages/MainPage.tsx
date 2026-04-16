import { useState } from 'react'
import { useProjectStore } from '@/controllers/project'
import { useSessionStore } from '@/controllers/session'
import { SessionList } from '@/views/components/SessionList'
import { StatusGlyph } from '@/views/components/UiGlyphs'
import { ChatView } from '@/views/components/ChatView'

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

export function MainPage() {
  const sessions = useSessionStore((s) => s.sessions)
  const currentSessionId = useSessionStore((s) => s.currentSessionId)
  const currentSession = sessions.find((session) => session.id === currentSessionId) ?? null

  const projects = useProjectStore((s) => s.projects)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const currentProject = projects.find((project) => project.id === currentProjectId) ?? null

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const headerTitle = currentSession?.name || currentProject?.name || 'MelodySync'

  return (
    <div className="ms-app-shell">
      <header className="ms-header">
        <button
          type="button"
          className="ms-header-menu"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sessions"
        >
          <MenuIcon />
        </button>

        <div className="ms-header-copy">
          <h1 className="ms-header-title">{headerTitle}</h1>
        </div>

        <div className="ms-header-actions">
          <StatusGlyph
            tone={currentSession?.activeRunId ? 'live' : 'muted'}
            pulse={Boolean(currentSession?.activeRunId)}
            className="ms-header-status-glyph"
          />
        </div>
      </header>

      <div className="ms-layout">
        <button
          type="button"
          className={`ms-sidebar-backdrop${sidebarOpen ? ' is-open' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sessions"
        />

        <div className={`ms-sidebar-shell${sidebarOpen ? ' is-open' : ''}`}>
          <SessionList onRequestClose={() => setSidebarOpen(false)} />
        </div>

        <main className="ms-main">
          {currentSession ? (
            <ChatView sessionId={currentSession.id} />
          ) : (
            <div className="ms-empty-panel">
              <div className="ms-empty-panel-copy">
                <h2>{currentProject ? currentProject.name : 'Select a project'}</h2>
                <p>
                  {currentProject
                    ? 'Choose a session from the sidebar or start a new one.'
                    : 'Create or select a project to begin a session.'}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
