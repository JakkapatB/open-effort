import type { Engine } from 'claude-code/testing'
import type { CommandPresentation, ModelCompleteInput, SessionMessage, ModelCompleteResult, On, PromptSubmitInput, TurnStepInput } from 'claude-code'

// The test runtime has timers; the mod's own type settings leave them out.
declare global {
  function setTimeout(callback: (value?: unknown) => void, ms?: number): unknown
}

/** How a typed command is shown: on the main screen, in a terminal 100 columns wide. */
export const PRESENTATION: CommandPresentation = { isFullscreen: false, columns: 100 }

export const BAND = {
  plugin: 'open-effort',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

export const PANE = {
  plugin: 'open-effort',
  component: 'Pane',
  requestId: 'open-effort',
  props: {
    title: 'open-effort',
    isFocused: false,
    bodyColumns: 70,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

export const SURFACES = ['terminal', 'desktop'] as const

const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

/** How Haiku answers a score: its reply text, or a call that times out, fails, or throws. */
export type Haiku = string | 'timeout' | 'fail' | 'throw'

/** The six Main Flow skills, as the mattpocock-skills plugin lists them among the session's commands. */
export const MATT_SKILLS = ['grill-with-docs', 'to-spec', 'to-tickets', 'implement', 'code-review', 'retro']

/**
 * Haiku's answer to every score, or one per score in order (the last repeating); the store's first values; and the
 * Main Flow skills installed (`matt`, default none), next to Claude Code's own code-review.
 */
export type EngineOptions = {
  settings?: Record<string, unknown>
  haiku?: Haiku | readonly Haiku[]
  store?: Record<string, unknown>
  matt?: readonly string[]
  /** What Claude said last in the main conversation, as `$.session.messages()` returns it. */
  said?: string
  /** The conversation before that, oldest first: a resumed session's messages. */
  history?: readonly SessionMessage[]
  /** How long Haiku takes to answer, in real milliseconds (default at once). */
  haikuDelayMs?: number
  /** The session's model, as `/model` shows it (default Opus 5.5). */
  model?: string
  /** The session's project root, when it is not the folder the session starts in (a shell `cd` moved it). */
  root?: string
  /** Files the mod may read, by path, as `$.fs.read` finds them. */
  files?: Record<string, string>
  /**
   * What GitHub answers for the newest plugin.json: its text, a failed request, or no answer at all (default: a failed
   * request, as with no network).
   */
  latest?: string | 'fail' | 'never'
  /** How each process the mod runs exits, in order (the last repeating); 'throw' when it cannot start. */
  processes?: readonly ({ exitCode: number; stdout?: string; stderr?: string } | 'throw')[]
  /** Environment variables the mod may read. */
  env?: Record<string, string>
  /** The person's own skills and other plugins' among the session's commands: a name, and the plugin it comes from. */
  skills?: readonly { name: string; plugin?: string }[]
  /** Why the surface will not put an agent's transcript in view (the desktop app draws no main view); default it does. */
  viewDeny?: string
}

/** The sub-agents running: a1 and a2 of a built-in type, c1 of the person's own, t3 working ticket 03. */
const AGENTS = [
  { id: 'a1', type: 'general-purpose', description: 'look around', status: 'running' as const },
  { id: 'a2', type: 'Explore', description: 'search', status: 'running' as const },
  { id: 'c1', type: 'code-reviewer', description: 'review', status: 'running' as const },
  { id: 't3', type: 'general-purpose', description: 'ticket 03', status: 'running' as const },
]

/**
 * The engine beneath the mod: a session, its settings, a Haiku that answers scores as told, a model that answers
 * every request, and the engine's own band. What the mod sent each way is kept for the test to read.
 */
export function engine(on: On, options: EngineOptions = {}) {
  const sent: TurnStepInput[] = []
  const asked: ModelCompleteInput[] = []
  const submitted: PromptSubmitInput[] = []
  const replies = typeof options.haiku === 'string' ? [options.haiku] : options.haiku ?? ['clarity=goal hard=no risky=no size=none']
  const opened: string[] = []
  const where = { cwd: '/work/app', root: '/work/app', model: options.model ?? 'claude-opus-5-5' }
  // The clock stands still until a test moves it: 31 October 2026, 07:00 UTC.
  const clock = { now: Date.UTC(2026, 9, 31, 7, 0) }
  on('clock.now', () => ({ value: clock.now }))
  // A wait takes real time, as it does in the app: a score that comes within the prompt's grace still goes with it.
  on('clock.sleep', async (_, e) => {
    await new Promise(resolve => setTimeout(resolve, e.ms))
    return { value: undefined }
  })

  on('session.start', (_, e) => {
    where.cwd = e.cwd
    where.root = options.root ?? e.cwd
    return { cwd: e.cwd }
  })
  on('session.cwd', () => ({ value: where.cwd }))
  on('session.repo', () => ({ value: { root: where.cwd, remote: null, internal: false, name: null } }))
  on('session.root', () => ({ value: where.root }))
  on('session.model', () => ({ value: where.model }))
  // The conversation as the session holds it: the options' history, what Claude said last, then what a test adds.
  const conversation: SessionMessage[] = []
  on('session.messages', () => ({
    value: [...(options.history ?? []), ...(options.said ? [{ role: 'assistant' as const, text: options.said, toolUses: [] }] : []), ...conversation],
  }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: [...new Set(opened)].map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  on('ui.close', (_, e) => {
    opened.splice(0, opened.length, ...opened.filter(id => id !== e.id))
    return { value: undefined }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  const viewed: string[] = []
  on('ui.view', (_, e) => {
    viewed.push((e as { agentId?: string }).agentId ?? '')
    return { value: options.viewDeny ? { deny: options.viewDeny } : {} }
  })
  // The store, in memory, seeded as the test says; every value the mod writes is also kept as text.
  const store = new Map<string, unknown>(Object.entries(options.store ?? {}))
  const written: string[] = []
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    written.push(JSON.stringify(e))
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.delete', (_, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  // The engine hands the path made absolute against the session's folder: a file is found by its ending.
  const fileAt = (path: string) => Object.entries(options.files ?? {}).find(([known]) => path === known || path.endsWith(`/${known}`))?.[1]
  on('fs.read', (_, e) => {
    const text = fileAt(e.path)
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: text }
  })
  on('fs.exists', (_, e) => ({ value: fileAt(e.path) !== undefined }))
  on('command.register', () => ({ value: { command: 'open-effort' } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__open-effort__${e.name}` } }))
  on('agent.list', () => ({ value: [...AGENTS] }))
  on('command.list', () => ({
    value: [
      { name: 'code-review', description: "Claude Code's own review", source: 'builtin' as const },
      ...(options.matt ?? []).map(name => ({ name: `mattpocock-skills:${name}`, description: name, source: 'plugin' as const, plugin: 'mattpocock-skills' })),
      ...(options.skills ?? []).map(s => ({ name: s.name, description: s.name, source: s.plugin ? ('plugin' as const) : ('user' as const), ...(s.plugin ? { plugin: s.plugin } : {}) })),
    ],
  }))
  on('settings.read', () => ({ value: options.settings ?? {} }))
  const commands: { command: string; args: string }[] = []
  on('command.run', (_, e) => {
    commands.push({ command: e.command, args: e.args })
    return { text: '' }
  })
  // The network: GitHub's plugin.json as the test says.
  const fetched: string[] = []
  on('http.fetch', async (_, e) => {
    fetched.push(e.url)
    if (options.latest === 'never') await new Promise(() => undefined)
    if (options.latest === undefined || options.latest === 'fail') throw new Error('network unreachable')
    return { value: { status: 200, ok: true, headers: {}, text: options.latest } }
  })
  // Processes run as told, recorded with their argument vectors.
  const ran: string[][] = []
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    const outcomes = options.processes ?? [{ exitCode: 0 }]
    const outcome = outcomes[Math.min(ran.length, outcomes.length) - 1]
    if (!outcome || outcome === 'throw') throw new Error('spawn ENOENT')
    return { value: { exitCode: outcome.exitCode, stdout: outcome.stdout ?? '', stderr: outcome.stderr ?? '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('env.get', (_, e) => ({ value: options.env?.[e.name] }))
  on('prompt.submit', (_, e) => {
    submitted.push(e)
    return { text: e.text, context: e.context }
  })
  on('model.complete', async (_, e): Promise<{ value: ModelCompleteResult }> => {
    asked.push(e)
    if (options.haikuDelayMs) await new Promise(resolve => setTimeout(resolve, options.haikuDelayMs))
    const haiku = replies[Math.min(asked.length, replies.length) - 1]
    if (haiku === 'throw') throw new Error('network down')
    if (haiku === 'timeout') return { value: { isAnswered: false, reason: 'aborted', usage: USAGE } }
    if (haiku === 'fail') return { value: { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: USAGE } }
    return { value: { isAnswered: true, text: haiku ?? '', usage: USAGE } }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('turn.step', async function* (_, e) {
    sent.push(e)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  // Bash runs as told: `bash.passes` decides whether the next command exits 0.
  const bash = { passes: true }
  const calls: Record<string, unknown>[] = []
  on('tool.call', (_, e) => {
    calls.push(e as Record<string, unknown>)
    // The Agent tool answers with the id of the agent it started: the one the list gives its description.
    if (e.tool === 'Agent') {
      const listed = AGENTS.find(a => a.description === (e as { description?: string }).description)
      return { result: listed ? { agentId: listed.id } : {}, text: 'started' }
    }
    return bash.passes ? { result: {}, text: 'ok' } : { result: {}, text: 'Exit code 1', isError: true }
  })
  return { sent, asked, submitted, bash, opened, written, clock, calls, viewed, where, store, conversation, fetched, ran, commands }
}

export const DAY_MS = 24 * 60 * 60 * 1000

/** Claude asks the person a question, as a note from the mod tells it to. */
export function askPerson(conversation: SessionMessage[]) {
  conversation.push({ role: 'assistant', text: 'Which model?', toolUses: [{ tool_use_id: `q${conversation.length}`, tool: 'AskUserQuestion', input: { questions: [] } }] })
}

/** Claude reports the person's answer to a model offer: "up" or "keep". */
export function answerOffer($: Engine, choice: string) {
  return $.tool.call({ tool: 'mcp__open-effort__model', choice } as never)
}

/** The main session's turn ends with an answer. */
export async function finish($: Engine) {
  await $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 1000, isAborted: false, reason: 'answer' })
}

/** Every text the pane draws, joined by lines. */
export async function paneText($: Engine, surface: (typeof SURFACES)[number] = 'desktop') {
  const ui = await $.ui.mount({ ...PANE, surface })
  const texts: string[] = []
  const walk = (node: unknown): void => {
    if (typeof node === 'string') texts.push(node)
    else if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === 'object') {
      const { props, children } = node as { props?: Record<string, unknown>; children?: unknown }
      if (typeof props?.label === 'string') texts.push(props.label)
      // A chart's words are its tooltips.
      if (typeof props?.source === 'string') texts.push(...[...props.source.matchAll(/<title>([^<]*)<\/title>/g)].map(m => m[1] ?? ''))
      walk(children)
    }
  }
  walk(await ui.drawn())
  await ui.unmount()
  return texts.join('\n')
}

/** The person presses a Button in the pane. */
export async function pressPane($: Engine, key: string) {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key })
  await ui.unmount()
}

/** Claude runs a command in Bash, which passes or fails as told; `agentId` runs it in a sub-agent. */
export async function run($: Engine, bash: { passes: boolean }, command: string, passes: boolean, agentId?: string) {
  bash.passes = passes
  await $.tool.call({ tool: 'Bash', command, ...(agentId ? { agentId } : {}) })
}

/** The same check failing `times` times in a row. */
export async function fail($: Engine, bash: { passes: boolean }, times = 3, command = 'npm test', agentId?: string) {
  for (let i = 0; i < times; i++) await run($, bash, command, false, agentId)
}

export async function start($: Engine) {
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
}

/** The person types a prompt and presses Enter. */
export async function type($: Engine, text: string) {
  await $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
}

/** One model request of a sub-agent's loop, carrying the effort its Agent call set. */
export async function agentRequest($: Engine, agentId: string, effort: NonNullable<TurnStepInput['effort']>, index = 0, model = 'claude-opus-5-5') {
  const stream = $.turn.step({ turnId: `t-${agentId}`, index, model, effort, messageCount: 1, agentId })
  for await (const _ of stream) {
    // the chunks are not what these tests look at
  }
  return stream.result
}

/** One model request of the main session, carrying the session's own effort (`'none'` for a model that takes none). */
export async function request($: Engine, effort: NonNullable<TurnStepInput['effort']> | 'none' = 'high', index = 0, model = 'claude-opus-5-5') {
  const stream = $.turn.step({ turnId: 't1', index, model, effort: effort === 'none' ? undefined : effort, messageCount: 1 })
  for await (const _ of stream) {
    // the chunks are not what these tests look at
  }
  return stream.result
}

/** The band's text, as drawn on a surface. */
export async function bandText($: Engine, surface: (typeof SURFACES)[number] = 'desktop') {
  const ui = await $.ui.mount({ ...BAND, surface })
  // The terminal writes the band's line; a surface that draws pictures carries it as the diagram's alt.
  const text = await ui.find({ type: 'Text', text: /open-effort/ })
  const alts: string[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === 'object') {
      const { type, props, children } = node as { type?: string; props?: Record<string, unknown>; children?: unknown }
      if (type === 'Svg' && typeof props?.alt === 'string') alts.push(props.alt)
      walk(children)
    }
  }
  walk(await ui.drawn())
  await ui.unmount()
  return text?.text ?? alts.find(alt => alt.includes('open-effort'))
}
