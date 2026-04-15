import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { SessionEvent } from '@melody-sync/types'

// ─── path helpers ─────────────────────────────────────────────────────────────

function historyRoot(): string {
  const base =
    process.env['MELODYSYNC_DB_PATH'] ??
    `${process.env['HOME'] ?? '~'}/.melodysync/runtime/sessions/sessions.db`

  const root = base.startsWith('~/')
    ? resolve(process.env['HOME'] ?? '', base.slice(2))
    : resolve(base)

  // history lives next to the DB file, under history/
  return resolve(dirname(root), 'history')
}

function sessionDir(sessionId: string): string {
  return resolve(historyRoot(), sessionId)
}

function eventsDir(sessionId: string): string {
  return resolve(sessionDir(sessionId), 'events')
}

function metaPath(sessionId: string): string {
  return resolve(sessionDir(sessionId), 'meta.json')
}

function seqFilename(seq: number): string {
  return seq.toString().padStart(9, '0') + '.json'
}

// ─── atomic write helper ──────────────────────────────────────────────────────

function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + '.tmp'
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(tmp, content, 'utf8')
  renameSync(tmp, filePath)
}

// ─── meta types ───────────────────────────────────────────────────────────────

interface HistoryMeta {
  latestSeq: number
  size: number
  lastEventAt: string
}

// ─── public API ───────────────────────────────────────────────────────────────

export function getHistoryMeta(sessionId: string): HistoryMeta | null {
  const mp = metaPath(sessionId)
  try {
    const raw = readFileSync(mp, 'utf8')
    return JSON.parse(raw) as HistoryMeta
  } catch {
    return null
  }
}

export function listEvents(
  sessionId: string,
  opts: { limit?: number; offset?: number } = {},
): SessionEvent[] {
  const dir = eventsDir(sessionId)
  let files: string[]
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
  } catch {
    return []
  }

  const offset = opts.offset ?? 0
  const limit = opts.limit ?? files.length

  const slice = files.slice(offset, offset + limit)

  return slice.flatMap((f) => {
    try {
      const raw = readFileSync(resolve(dir, f), 'utf8')
      return [JSON.parse(raw) as SessionEvent]
    } catch {
      return []
    }
  })
}

export function appendEvent(
  sessionId: string,
  event: Omit<SessionEvent, 'seq'>,
): SessionEvent {
  const meta = getHistoryMeta(sessionId)
  const nextSeq = (meta?.latestSeq ?? -1) + 1

  const full: SessionEvent = { ...event, seq: nextSeq }

  // write event file
  const eventPath = resolve(eventsDir(sessionId), seqFilename(nextSeq))
  atomicWrite(eventPath, JSON.stringify(full))

  // compute directory size (approximate: count files * avg size)
  let size = meta?.size ?? 0
  try {
    size = statSync(eventsDir(sessionId)).size
  } catch {
    // ignore
  }

  // update meta
  const newMeta: HistoryMeta = {
    latestSeq: nextSeq,
    size,
    lastEventAt: new Date().toISOString(),
  }
  atomicWrite(metaPath(sessionId), JSON.stringify(newMeta))

  return full
}

export function getEventBody(sessionId: string, seq: number): string | null {
  const eventPath = resolve(eventsDir(sessionId), seqFilename(seq))
  try {
    return readFileSync(eventPath, 'utf8')
  } catch {
    return null
  }
}
