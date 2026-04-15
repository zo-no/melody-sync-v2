import { useSessionStore } from '@/controllers/session'
import type { CreateSessionInput } from '@melody-sync/types'

export function SessionList() {
  const sessions = useSessionStore((s) => s.sessions)
  const currentSessionId = useSessionStore((s) => s.currentSessionId)
  const selectSession = useSessionStore((s) => s.selectSession)
  const createSession = useSessionStore((s) => s.createSession)
  const loading = useSessionStore((s) => s.loading)
  const error = useSessionStore((s) => s.error)

  async function handleNew() {
    const input: CreateSessionInput = { name: 'New Session' }
    const session = await createSession(input)
    selectSession(session.id)
  }

  return (
    <aside className="flex flex-col h-full bg-gray-900 text-gray-100 border-r border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
        <span className="text-sm font-semibold text-gray-300 tracking-wide uppercase">
          Sessions
        </span>
        <button
          onClick={handleNew}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
        >
          <span>+</span>
          <span>New</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="px-4 py-3 text-xs text-gray-500">Loading…</p>
        )}
        {error && (
          <p className="px-4 py-3 text-xs text-red-400">{error}</p>
        )}
        {!loading && !error && sessions.length === 0 && (
          <p className="px-4 py-3 text-xs text-gray-600">No sessions yet.</p>
        )}
        <ul>
          {sessions.map((session) => {
            const isActive = session.id === currentSessionId
            return (
              <li key={session.id}>
                <button
                  onClick={() => selectSession(session.id)}
                  className={[
                    'w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors',
                    isActive ? 'bg-gray-800 border-l-2 border-indigo-500' : 'border-l-2 border-transparent',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {session.name || 'Untitled'}
                    </span>
                    {session.workflowState && (
                      <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                        {session.workflowState}
                      </span>
                    )}
                  </div>
                  {session.folder && (
                    <p className="mt-0.5 text-xs text-gray-500 truncate">
                      {session.folder}
                    </p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
