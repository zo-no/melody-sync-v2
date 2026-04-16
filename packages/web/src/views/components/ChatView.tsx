import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useChatStore } from '@/controllers/chat'
import { getRuntimeModelCatalog, getRuntimeTools } from '@/controllers/runtime'
import { useSessionStore } from '@/controllers/session'
import { StatusGlyph, StopGlyph, ToolGlyph } from '@/views/components/UiGlyphs'
import type { RuntimeModelCatalog, RuntimeTool, SessionEvent } from '@melody-sync/types'

interface ChatViewProps {
  sessionId: string
}

const FALLBACK_TOOLS: RuntimeTool[] = [
  {
    id: 'codex',
    name: 'Codex',
    command: 'codex',
    runtimeFamily: 'codex-json',
    builtin: true,
    available: true,
  },
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    runtimeFamily: 'claude-stream-json',
    builtin: true,
    available: true,
  },
]

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

function resolveToolId(tool?: string): 'codex' | 'claude' {
  return tool === 'claude' ? 'claude' : 'codex'
}

function getModelOptions(catalog: RuntimeModelCatalog | null) {
  return catalog?.models ?? []
}

function getEffortOptions(catalog: RuntimeModelCatalog | null, selectedModel?: string | null): string[] {
  if (!catalog || catalog.reasoning.kind !== 'enum') return []
  const model = catalog.models.find((entry) => entry.id === selectedModel)
  if (model?.effortLevels?.length) return model.effortLevels
  return catalog.effortLevels ?? []
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
  const sendError = useChatStore((s) => s.sendError)
  const fetchEvents = useChatStore((s) => s.fetchEvents)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const setDraft = useChatStore((s) => s.setDraft)
  const fetchRuns = useChatStore((s) => s.fetchRuns)
  const cancelRun = useChatStore((s) => s.cancelRun)

  const sessions = useSessionStore((s) => s.sessions)
  const refreshSession = useSessionStore((s) => s.refreshSession)
  const updateSession = useSessionStore((s) => s.updateSession)
  const currentSession = sessions.find((session) => session.id === sessionId) ?? null
  const [runtimeTools, setRuntimeTools] = useState<RuntimeTool[]>(FALLBACK_TOOLS)
  const [modelCatalog, setModelCatalog] = useState<RuntimeModelCatalog | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectedTool = resolveToolId(currentSession?.tool)
  const modelOptions = getModelOptions(modelCatalog)
  const effortOptions = getEffortOptions(modelCatalog, currentSession?.model ?? null)
  const runtimeLocked = Boolean(currentSession?.activeRunId || sending)

  useEffect(() => {
    void fetchEvents(sessionId)
    void fetchRuns(sessionId)
  }, [sessionId, fetchEvents, fetchRuns])

  useEffect(() => {
    let cancelled = false

    void getRuntimeTools()
      .then((tools) => {
        if (cancelled || tools.length === 0) return
        setRuntimeTools(tools)
      })
      .catch((error) => {
        if (cancelled) return
        setRuntimeError(error instanceof Error ? error.message : String(error))
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void getRuntimeModelCatalog(selectedTool)
      .then((catalog) => {
        if (cancelled) return
        setModelCatalog(catalog)
      })
      .catch((error) => {
        if (cancelled) return
        setModelCatalog(null)
        setRuntimeError(error instanceof Error ? error.message : String(error))
      })

    return () => {
      cancelled = true
    }
  }, [selectedTool])

  useEffect(() => {
    if (!currentSession?.activeRunId) return

    const timer = window.setInterval(() => {
      void fetchEvents(sessionId)
      void fetchRuns(sessionId)
      void refreshSession(sessionId)
    }, 900)

    return () => window.clearInterval(timer)
  }, [currentSession?.activeRunId, fetchEvents, fetchRuns, refreshSession, sessionId])

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
    void sendMessage(sessionId, {
      text: draft.trim(),
      tool: selectedTool,
      model: currentSession?.model ?? null,
      effort: selectedTool === 'codex' ? (currentSession?.effort ?? null) : null,
      thinking: selectedTool === 'claude' ? currentSession?.thinking === true : false,
    })
  }

  function setRuntimeErrorMessage(error: unknown) {
    setRuntimeError(error instanceof Error ? error.message : String(error))
  }

  async function switchTool(tool: 'codex' | 'claude') {
    if (!currentSession || resolveToolId(currentSession.tool) === tool || runtimeLocked) return

    try {
      const nextCatalog = await getRuntimeModelCatalog(tool)
      const nextPatch: Parameters<typeof updateSession>[1] = { tool }
      if (currentSession.model && !nextCatalog.models.some((model) => model.id === currentSession.model)) {
        nextPatch.model = null
      }
      await updateSession(sessionId, nextPatch)
      setModelCatalog(nextCatalog)
      setRuntimeError(null)
    } catch (error) {
      setRuntimeErrorMessage(error)
    }
  }

  async function changeModel(value: string) {
    if (!currentSession || runtimeLocked) return

    const nextModel = value || null
    const nextPatch: Parameters<typeof updateSession>[1] = { model: nextModel }
    if (modelCatalog?.reasoning.kind === 'enum') {
      const nextEfforts = getEffortOptions(modelCatalog, nextModel)
      if (currentSession.effort && !nextEfforts.includes(currentSession.effort)) {
        const matchedModel = modelCatalog.models.find((model) => model.id === nextModel)
        nextPatch.effort = matchedModel?.defaultEffort ?? modelCatalog.reasoning.default ?? nextEfforts[0] ?? null
      }
    }

    try {
      await updateSession(sessionId, nextPatch)
      setRuntimeError(null)
    } catch (error) {
      setRuntimeErrorMessage(error)
    }
  }

  async function changeEffort(value: string) {
    if (!currentSession || runtimeLocked) return

    try {
      await updateSession(sessionId, { effort: value || null })
      setRuntimeError(null)
    } catch (error) {
      setRuntimeErrorMessage(error)
    }
  }

  async function changeThinking(checked: boolean) {
    if (!currentSession || runtimeLocked) return

    try {
      await updateSession(sessionId, { thinking: checked })
      setRuntimeError(null)
    } catch (error) {
      setRuntimeErrorMessage(error)
    }
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
            <div className="ms-tool-switch" role="group" aria-label="Session tool">
              {runtimeTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className={`ms-tool-button${selectedTool === tool.id ? ' is-active' : ''}`}
                  onClick={() => void switchTool(resolveToolId(tool.id))}
                  disabled={runtimeLocked || !tool.available}
                  aria-label={tool.name}
                  title={tool.name}
                >
                  <ToolGlyph tool={tool.id} />
                </button>
              ))}
            </div>

            <div className="ms-runtime-controls">
              <label className="ms-runtime-field">
                <select
                  className="ms-runtime-select"
                  value={currentSession?.model ?? ''}
                  onChange={(event) => void changeModel(event.target.value)}
                  disabled={runtimeLocked || modelOptions.length === 0}
                  aria-label="Model"
                  title="Model"
                >
                  <option value="">
                    {modelCatalog?.defaultModel
                      ? `Tool default (${modelCatalog.defaultModel})`
                      : 'Tool default'}
                  </option>
                  {modelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>

              {modelCatalog?.reasoning.kind === 'enum' && (
                <label className="ms-runtime-field">
                  <select
                    className="ms-runtime-select"
                    value={currentSession?.effort ?? ''}
                    onChange={(event) => void changeEffort(event.target.value)}
                    disabled={runtimeLocked}
                    aria-label={modelCatalog.reasoning.label}
                    title={modelCatalog.reasoning.label}
                  >
                    <option value="">
                      {modelCatalog.reasoning.default
                        ? `Tool default (${modelCatalog.reasoning.default})`
                        : 'Tool default'}
                    </option>
                    {effortOptions.map((effort) => (
                      <option key={effort} value={effort}>
                        {effort}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {modelCatalog?.reasoning.kind === 'toggle' && (
                <label className="ms-runtime-toggle" title={modelCatalog.reasoning.label}>
                  <input
                    type="checkbox"
                    checked={currentSession?.thinking === true}
                    onChange={(event) => void changeThinking(event.target.checked)}
                    disabled={runtimeLocked}
                    aria-label={modelCatalog.reasoning.label}
                  />
                  <StatusGlyph tone={currentSession?.thinking ? 'idle' : 'muted'} className="ms-runtime-toggle-glyph" />
                </label>
              )}
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
            <span>
              {sendError
                ? sendError
                : runtimeError
                  ? `Runtime settings unavailable: ${runtimeError}`
                  : 'Enter to send'}
            </span>
            <div className="ms-composer-footer-actions">
              {currentSession?.activeRunId && (
                <button
                  type="button"
                  className="ms-secondary-button ms-secondary-button-icon"
                  onClick={() => void cancelRun(currentSession.activeRunId!)}
                  aria-label="Cancel run"
                  title="Cancel run"
                >
                  <StopGlyph />
                </button>
              )}
              <StatusGlyph
                tone={sendError ? 'warning' : sending || currentSession?.activeRunId ? 'live' : 'muted'}
                pulse={Boolean(sending || currentSession?.activeRunId)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
