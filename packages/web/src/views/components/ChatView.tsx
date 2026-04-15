import { useEffect, useRef, KeyboardEvent } from 'react'
import { useChatStore } from '@/controllers/chat'
import type { SessionEvent } from '@melody-sync/types'

interface ChatViewProps {
  sessionId: string
}

function EventBubble({ event }: { event: SessionEvent }) {
  const isUser = event.role === 'user'

  if (event.type === 'tool_use') {
    return (
      <div className="my-2">
        <div className="inline-block max-w-full rounded bg-gray-800 border border-gray-700 overflow-hidden">
          <div className="px-3 py-1 text-xs text-gray-400 bg-gray-900 border-b border-gray-700">
            tool_use
          </div>
          <pre className="px-3 py-2 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
            {event.toolInput ?? event.content ?? ''}
          </pre>
        </div>
      </div>
    )
  }

  if (event.type === 'tool_result') {
    return (
      <div className="my-2">
        <div className="inline-block max-w-full rounded bg-gray-800 border border-gray-700 overflow-hidden">
          <div className="px-3 py-1 text-xs text-gray-400 bg-gray-900 border-b border-gray-700">
            tool_result
          </div>
          <pre className="px-3 py-2 text-xs text-yellow-300 overflow-x-auto whitespace-pre-wrap break-all">
            {event.output ?? event.content ?? ''}
          </pre>
        </div>
      </div>
    )
  }

  if (event.type === 'status') {
    return (
      <div className="my-1 flex justify-center">
        <span className="text-xs text-gray-600 italic">{event.content}</span>
      </div>
    )
  }

  return (
    <div className={`my-2 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words',
          isUser
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-gray-800 text-gray-100 rounded-bl-sm',
        ].join(' ')}
      >
        {event.content ?? ''}
      </div>
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

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchEvents(sessionId)
  }, [sessionId, fetchEvents])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (draft.trim() && !sending) {
        sendMessage(sessionId, draft.trim())
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {events.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-600 text-sm">No messages yet. Say something!</p>
          </div>
        )}
        {events.map((event) => (
          <EventBubble key={event.seq} event={event} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-800 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            placeholder={sending ? 'Sending…' : 'Message (Enter to send, Shift+Enter for newline)'}
            rows={3}
            className={[
              'flex-1 resize-none rounded-xl px-4 py-2.5 text-sm text-gray-100',
              'bg-gray-800 border border-gray-700 placeholder-gray-600',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors',
            ].join(' ')}
          />
          <button
            onClick={() => {
              if (draft.trim() && !sending) {
                sendMessage(sessionId, draft.trim())
              }
            }}
            disabled={!draft.trim() || sending}
            className={[
              'shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium',
              'bg-indigo-600 text-white hover:bg-indigo-500',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'transition-colors',
            ].join(' ')}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
