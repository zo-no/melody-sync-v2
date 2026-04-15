import { useSessionStore } from '@/controllers/session'
import { SessionList } from '@/views/components/SessionList'
import { ChatView } from '@/views/components/ChatView'

export function MainPage() {
  const currentSession = useSessionStore((s) => s.currentSession)
  const currentSessionId = useSessionStore((s) => s.currentSessionId)

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-[280px] shrink-0 flex flex-col">
        <SessionList />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="shrink-0 flex items-center gap-4 px-5 py-3 border-b border-gray-800 bg-gray-900">
          {currentSession ? (
            <>
              <h1 className="text-sm font-semibold truncate flex-1">
                {currentSession.name || 'Untitled'}
              </h1>
              {currentSession.model && (
                <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded shrink-0">
                  {currentSession.model}
                </span>
              )}
              {currentSession.tool && (
                <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded shrink-0">
                  {currentSession.tool}
                </span>
              )}
            </>
          ) : (
            <h1 className="text-sm font-semibold text-gray-500">MelodySync</h1>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {currentSessionId ? (
            <ChatView sessionId={currentSessionId} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 text-base">Select a session to start chatting</p>
                <p className="text-gray-700 text-sm mt-1">
                  Or create a new one from the sidebar
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
