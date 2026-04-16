import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useChatStore } from '@/controllers/chat'
import { useProjectStore } from '@/controllers/project'
import { useSessionStore } from '@/controllers/session'
import type { SessionEvent } from '@melody-sync/types'

interface ChatViewProps {
  sessionId: string
}

function normalizeTimestamp(value: number): number {
  if (!Number.isFinite(value)) return Date.now()
  return value < 1_000_000_000_000 ? value * 1000 : value
}

function formatChatTimestamp(value: number): string {
  const date = new Date(normalizeTimestamp(value))
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatProjectPath(path?: string): string {
  if (!path) return ''
  return path.replace(/^\/Users\/[^/]+/, '~')
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5v14M7 10l5-5 5 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function resolveEventBody(event: SessionEvent): string {
  if (event.type === 'tool_use') {
    return event.toolInput ?? event.bodyPreview ?? event.content ?? ''
  }

  if (event.type === 'tool_result') {
    return event.output ?? event.bodyPreview ?? event.content ?? ''
  }

  return event.content ?? event.bodyPreview ?? ''
}

function renderToolLabel(event: SessionEvent): string {
  switch (event.type) {
    case 'reasoning':
      return 'Reasoning'
    case 'tool_use':
      return 'Tool input'
    case 'tool_result':
      return 'Tool output'
    case 'file_change':
      return 'File change'
    case 'usage':
      return 'Usage'
    default:
      return 'Details'
  }
}

function EventBlock({ event }: { event: SessionEvent }) {
  const body = resolveEventBody(event)

  if (event.type === 'status') {
    return (
      <div className="ms-status-event">
        <span>{body}</span>
      </div>
    )
  }

  if (event.type !== 'message') {
    return (
      <details className="ms-sidecar-event">
        <summary>
          <span>{renderToolLabel(event)}</span>
          <span>{formatChatTimestamp(event.timestamp)}</span>
        </summary>
        <div className="ms-sidecar-event-body">
          <pre>{body}</pre>
          {event.bodyTruncated && <p className="ms-sidecar-event-note">Output truncated.</p>}
        </div>
      </details>
    )
  }

  if (event.role === 'user') {
    return (
      <div className="ms-message ms-message-user">
        <div className="ms-message-user-stack">
          <div className="ms-message-user-bubble">{body}</div>
          <span className="ms-message-time">{formatChatTimestamp(event.timestamp)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ms-message ms-message-assistant">
      <div className="ms-message-assistant-body">{body}</div>
      <span className="ms-message-time">{formatChatTimestamp(event.timestamp)}</span>
    </div>
  )
}

export function ChatView({ sessionId }: ChatViewProps) {
  const events = useChatStore((s) => s.events)
  const sending = useChatStore((s) => s.sending)
  const draft = useChatStore((s) => s.draft)
  const fetchEvents = useChatStore((s) => s.fetchEvents)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const setDraft = useChatStore((s) => s.setDraft)

  const sessions = useSessionStore((s) => s.sessions)
  const currentSession = sessions.find((session) => session.id === sessionId) ?? null
  const projects = useProjectStore((s) => s.projects)
  const currentProject = projects.find((project) => project.id === currentSession?.projectId) ?? null

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void fetchEvents(sessionId)
  }, [sessionId, fetchEvents])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [draft, sessionId])

  function submitDraft() {
    if (!draft.trim() || sending) return
    void sendMessage(sessionId, draft.trim())
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitDraft()
    }
  }

  return (
    <div className="ms-chat-shell">
      <div className="ms-thread">
        <div className="ms-thread-inner">
          {events.length === 0 ? (
            <div className="ms-chat-empty">
              <h2>{currentSession?.name || 'New session'}</h2>
              <p>Start the conversation from the composer below.</p>
            </div>
          ) : (
            events.map((event) => (
              <EventBlock key={event.seq} event={event} />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="ms-composer-shell">
        <div className="ms-composer">
          <div className="ms-composer-toolbar">
            <div className="ms-composer-context">
              <span>{currentProject?.name || 'Session workspace'}</span>
              {currentProject?.path && (
                <span>{formatProjectPath(currentProject.path)}</span>
              )}
            </div>

            <div className="ms-composer-pills">
              {currentSession?.model && <span className="ms-composer-pill">{currentSession.model}</span>}
              {currentSession?.effort && <span className="ms-composer-pill">{currentSession.effort}</span>}
              {currentSession?.thinking && <span className="ms-composer-pill">Thinking</span>}
            </div>
          </div>

          <div className="ms-composer-row">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder={sending ? 'Sending…' : 'Message the session'}
              className="ms-composer-textarea"
              rows={1}
            />

            <button
              type="button"
              className="ms-send-button"
              onClick={submitDraft}
              disabled={!draft.trim() || sending}
              aria-label="Send message"
            >
              <ArrowUpIcon />
            </button>
          </div>

          <div className="ms-composer-footer">
            <span>Enter to send, Shift+Enter for a new line.</span>
            <span>{sending ? 'Sending…' : 'Ready'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
