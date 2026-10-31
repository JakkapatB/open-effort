import type { HistoryEntry, Project, Sent, Task, TurnLog } from '../types'

/** Finished turns kept per project. */
export const HISTORY_SIZE = 500

export const EMPTY_TURN: TurnLog = { sent: [], climbs: 0 }

/** The store keys of a project's own values: its switch, and its history. */
export function projectKey(root: string): string {
  return `project:${root}`
}

export function historyKey(root: string): string {
  return `history:${root}`
}

export function projectOf(root: string): Project {
  return { root, name: root.replace(/\/+$/, '').split('/').pop() || root }
}

/** Each value once, where it first differs from the one before. */
function changes<T>(values: readonly T[]): T[] {
  return values.filter((v, i) => i === 0 || v !== values[i - 1])
}

/** The history entry of a finished turn: none for a turn that sent no request. */
export function entryOf(task: Task, log: TurnLog, at: number): HistoryEntry | null {
  if (log.sent.length === 0) return null
  return {
    at,
    mode: task.stage ? 'main-flow' : 'normal',
    score: task.score,
    stage: task.stage,
    start: task.effort,
    efforts: changes(log.sent.map((s: Sent) => s.effort)),
    models: changes(log.sent.map((s: Sent) => s.model)),
    climbs: log.climbs,
  }
}

/** A history with one more entry, the oldest dropped past HISTORY_SIZE. */
export function appended(history: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [...history, entry].slice(-HISTORY_SIZE)
}

/** The stored history of a project, entries of the wrong shape dropped. */
export function historyFrom(stored: unknown): HistoryEntry[] {
  if (!Array.isArray(stored)) return []
  return stored.filter((e): e is HistoryEntry => !!e && typeof e === 'object' && typeof e.at === 'number' && Array.isArray(e.efforts)).slice(-HISTORY_SIZE)
}
