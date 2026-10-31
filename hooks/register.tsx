import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptOrigin, Register } from 'claude-code'

import type { Effort, HistoryEntry, Language, LanguageChoice, ModelTier, Project, Stage, SubAgent, Switches, Task, TicketSetting, TurnLog } from '../types'
import { checkRun } from './checks'
import { EMPTY_TURN, appended, entryOf, historyFrom, historyKey, projectKey, projectOf } from './history'
import {
  ASK_NOTE, IMPLEMENT_NOTE, INSTALL_COMMANDS, MODEL_TOOL_SPEC, TICKET_NOTE, STAGES, STAGE_TOOL_SPEC, modelNote, missingSkills, routeOf, stageOfPath, stageOfSkill, startsFlow,
} from './main-flow'
import {
  EFFORTS, FABLE_MODEL, FAILS_TO_STALL, FRESH_TASK, TIER_MODEL, afterTicketAgentCheck, enteredTicket, fitEffort, modelUp, taskModel, ticketIn, ticketOf, ticketSettingOf, tierOf, afterAgentCheck, afterCheck, enteredStage, isBuiltInAgent, isEffort, isFable, rungOf, startingEffort,
  subAgentStart,
} from './policy'
import { SCORE_GRACE_MS, isGoOn, isUnsure, scoreRequest } from './score'
import type { Scored } from './score'
import { clockTime, languageOf, modelName, wordsFor } from './words'
import { THEMES, THEME_IDS, agentsSvg, bandKeys, historySvg, isThemeId, stageSvg, stepsSvg, useTheme } from './diagrams'
import type { ThemeId } from './diagrams'
import type { Loop, Step } from './diagrams'
import type { Why } from './words'

const isOn = atom({ plugin: 'open-effort', key: 'isOn' } as const, true)
const switches = atom(
  { plugin: 'open-effort', key: 'switches' } as const,
  { machine: true, project: null, flowMachine: true, flowProject: null } as Switches,
)
const missing = atom({ plugin: 'open-effort', key: 'missing' } as const, [] as string[])
const project = atom({ plugin: 'open-effort', key: 'project' } as const, null as Project | null)
const sessionEffort = atom({ plugin: 'open-effort', key: 'sessionEffort' } as const, null as Effort | null)
const sessionModel = atom({ plugin: 'open-effort', key: 'sessionModel' } as const, null as string | null)
const languageChoice = atom({ plugin: 'open-effort', key: 'languageChoice' } as const, 'auto' as LanguageChoice)
// The colour theme picked in the pane, kept in the store for every session.
const themeChoice = atom({ plugin: 'open-effort', key: 'themeChoice' } as const, 'claude' as ThemeId)
const language = atom({ plugin: 'open-effort', key: 'language' } as const, 'en' as Language)
const task = atom({ plugin: 'open-effort', key: 'task' } as const, FRESH_TASK as Task)
const turnLog = atom({ plugin: 'open-effort', key: 'turnLog' } as const, EMPTY_TURN as TurnLog)
const history = atom({ plugin: 'open-effort', key: 'history' } as const, [] as HistoryEntry[])
const seen = atom({ plugin: 'open-effort', key: 'seen' } as const, {} as Record<string, number>)
const running = atom({ plugin: 'open-effort', key: 'running' } as const, [] as string[])
const seenLast = atom({ plugin: 'open-effort', key: 'seenLast' } as const, { score: 'none yet', effort: 'none yet', model: 'none yet', starts: 0 })
const agents = atom({ plugin: 'open-effort', key: 'agents' } as const, {} as Record<string, SubAgent>)
// Tickets handed to sub-agents not yet seen running, by the Agent call's description: the ticket and its setting.
const handed = atom({ plugin: 'open-effort', key: 'handed' } as const, {} as Record<string, { ticket: string } & TicketSetting>)
// Counts new tasks, so a late score applies only to the task it was asked for.
const scoring = atom({ plugin: 'open-effort', key: 'scoring' } as const, 0)

/** Sub-agents kept: the latest ones, enough for any session's running agents. */
const AGENTS_KEPT = 50

function keptAgents(all: Record<string, SubAgent>): Record<string, SubAgent> {
  return Object.fromEntries(Object.entries(all).slice(-AGENTS_KEPT))
}

/** A sub-agent as the mod knows it; the first time, its type is looked up to know whether it is one the mod climbs. */
async function subAgent($: EngineInterface, id: string): Promise<SubAgent> {
  const known = (await read($, agents))[id]
  if (known) return known
  const listed = (await $.agent.list()).find(a => a.id === id)
  // A sub-agent handed a ticket runs on the ticket's setting and climbs from it, whatever its type.
  const ticket = listed ? (await read($, handed))[listed.description] : undefined
  if (ticket) {
    await update($, handed, all => Object.fromEntries(Object.entries(all).filter(([d]) => d !== listed?.description)))
    return { effort: ticket.effort, climbed: null, fails: 0, isClimbable: true, ticket: ticket.ticket, ...(ticket.tier ? { tier: ticket.tier } : {}) }
  }
  return { effort: null, climbed: null, fails: 0, isClimbable: isBuiltInAgent(listed?.type) }
}

// What outlives the session in the store: the machine's switches, the language picked, the last effort seen; and per
// project (projectKey, historyKey) its switches and its history.
const STORE_IS_ON = 'isOn'
const STORE_MAIN_FLOW = 'mainFlow'
const STORE_LANGUAGE = 'language'
const STORE_THEME = 'theme'

const PANE = 'open-effort'

/** Sent once when a task stalls at the top of the ladder. */
const LADDER_END_NOTE =
  '[open-effort] The checks keep failing at the highest effort on the strongest model. Stop retrying: report what fails and what you tried, and ask the person how to proceed.'

/** A person's own gesture: what they typed, from the terminal, a phone or an SDK host; never a plugin or the model. */
function isPerson(origin: PromptOrigin): boolean {
  return origin.kind === 'composer' || origin.kind === 'bridge' || origin.kind === 'sdk'
}

function isLanguageChoice(value: unknown): value is LanguageChoice {
  return value === 'auto' || value === 'th' || value === 'en'
}

/** Sets the switches, kept in the store (the project's under its key), and the mod on or off by them. */
async function setSwitches($: EngineInterface, change: (s: Switches) => Switches): Promise<void> {
  const next = change(await read($, switches))
  await update($, switches, () => next)
  await update($, isOn, () => next.project ?? next.machine)
  await $.store.set(STORE_IS_ON, next.machine)
  await $.store.set(STORE_MAIN_FLOW, next.flowMachine)
  const p = await read($, project)
  if (p) await $.store.set(projectKey(p.root), { isOn: next.project, mainFlow: next.flowProject })
}

/** Whether the Main Flow can run: switched on (the project's switch over the machine's) and its skills installed. */
async function isFlowAvailable($: EngineInterface): Promise<boolean> {
  const s = await read($, switches)
  return (s.flowProject ?? s.flowMachine) && (await read($, missing)).length === 0
}

/** The Main Flow skills this session lacks, read again from its commands (a plugin installed meanwhile counts). */
async function checkSkills($: EngineInterface): Promise<void> {
  const lacking = missingSkills(await $.command.list())
  await update($, missing, () => lacking)
}

/** The colour theme picked, kept in the store. */
async function setTheme($: EngineInterface, id: ThemeId): Promise<void> {
  await update($, themeChoice, () => id)
  await $.store.set(STORE_THEME, id)
}

/** The language picked, kept in the store; auto reads Claude Code's own setting. */
async function setLanguage($: EngineInterface, choice: LanguageChoice): Promise<void> {
  await update($, languageChoice, () => choice)
  await update($, language, () => (choice === 'auto' ? 'en' : choice))
  if (choice === 'auto') {
    const setting = await $.settings.read({ key: 'language' })
    await update($, language, () => languageOf(setting))
  }
  await $.store.set(STORE_LANGUAGE, choice)
}

/**
 * A Main Flow stage was started: the task takes the stage's effort. Claude moves a task only once it is in the flow, or the mod sent it there or asked the
 * person; the person's own stage command (`isFlowStart`) may start the flow. Nothing moves while the mod or the
 * Main Flow is off.
 */
async function moveToStage($: EngineInterface, stage: Stage, isFlowStart = false): Promise<true | 'off' | 'not-invited'> {
  if (!(await read($, isOn)) || !(await isFlowAvailable($))) return 'off'
  const t = await read($, task)
  if (t.stage === stage) return true
  if (t.stage === null && !t.isFlowInvited && !isFlowStart) return 'not-invited'
  await setTask($, (current): Task => enteredStage(current, stage))
  // The stages where tickets are written and worked tell Claude how a ticket's model and effort are named and used.
  const note = stage === 'tickets' ? TICKET_NOTE : stage === 'implement' ? IMPLEMENT_NOTE : null
  if (note) await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: note }] } })
  return true
}

/**
 * A ticket's setting: the Model and Effort lines it names, else Haiku's reading of it (its effort, and its model
 * when Haiku is sure); null when the file cannot be read or Haiku gives no score.
 */
async function ticketSetting($: EngineInterface, path: string): Promise<TicketSetting | null> {
  let text: string
  try {
    text = await $.fs.read(path)
  } catch {
    return null
  }
  const named = ticketSettingOf(text)
  if (named) return named
  const { score } = await scoreRequest($, text)
  if (!score) return null
  const tier = !isUnsure(score) ? score.model : undefined
  return { ...(tier ? { tier } : {}), effort: startingEffort(score) }
}

/** Claude showed it is starting a stage (calling its skill, reading its SKILL.md): the main session's only. */
async function stageSign($: EngineInterface, agentId: string | undefined, stage: Stage | null): Promise<void> {
  if (agentId === undefined && stage) await moveToStage($, stage)
}

/** The Main Flow ended: the next request starts a new task. */
async function endFlow($: EngineInterface): Promise<void> {
  if ((await read($, task)).stage === null) return
  await setTask($, () => FRESH_TASK)
}

/** How long a band step counts as just appeared, and pops in when drawn. */
const FRESH_MS = 1500

/** Changes the task, and notes when each of the band's steps first showed so only new ones animate in. */
async function setTask($: EngineInterface, change: (t: Task) => Task): Promise<void> {
  await update($, task, change)
  const keys = bandKeys(await read($, task))
  const now = await $.clock.now()
  await update($, seen, before => ({
    ...Object.fromEntries(Object.entries(before).filter(([key]) => key.startsWith('agent:'))),
    ...Object.fromEntries(keys.map(key => [key, before[key] ?? now])),
  }))
}

/**
 * Loads the project the session is in, by its root: where it started, or where a host's directory change took it. A
 * shell `cd` during the session moves the working directory, and with it the git repository read from it, but not
 * the root, so the project and its history stay put. Its switches and history come from the store.
 */
async function loadProject($: EngineInterface): Promise<void> {
  const root = await $.session.root()
  await update($, project, () => projectOf(root))
  const machine = (await $.store.get(STORE_IS_ON)) !== false
  const flowMachine = (await $.store.get(STORE_MAIN_FLOW)) !== false
  const saved = (await $.store.get(projectKey(root))) as { isOn?: unknown; mainFlow?: unknown } | undefined
  await update($, switches, (): Switches => ({
    machine,
    project: typeof saved?.isOn === 'boolean' ? saved.isOn : null,
    flowMachine,
    flowProject: typeof saved?.mainFlow === 'boolean' ? saved.mainFlow : null,
  }))
  const s = await read($, switches)
  await update($, isOn, () => s.project ?? s.machine)
  const kept = historyFrom(await $.store.get(historyKey(root)))
  await update($, history, () => kept)
}

/**
 * A new task's score, when it comes: its starting effort, and the notes for Claude — a more capable model to offer
 * the person, and the Main Flow to ask about. A score for a task already replaced by a newer prompt changes nothing.
 */
async function applyScore($: EngineInterface, scored: Scored, generation: number): Promise<string[]> {
  if ((await read($, scoring)) !== generation) return []
  const { score, outcome } = scored
  await update($, seenLast, last => ({ ...last, score: score?.continues ? 'continues' : outcome }))
  // No score: a new task at the session's own effort. A message that goes on with the task under way keeps it.
  if (!score) {
    await setTask($, () => FRESH_TASK)
    return []
  }
  if (score.continues) return []
  await setTask($, (): Task => ({ ...FRESH_TASK, score, effort: startingEffort(score) }))
  const notes: string[] = []
  // A more capable model than the session's, when Haiku is sure the work needs one: the person is asked first.
  const own = await sessionModelNow($)
  const offer = isUnsure(score) ? null : modelUp(score.model, own)
  if (offer) {
    await setTask($, (t): Task => ({ ...t, modelOffer: offer }))
    notes.push(modelNote(modelName(TIER_MODEL[offer]), modelName(own)))
  }
  await checkSkills($)
  if (routeOf(score.size, await isFlowAvailable($)) === 'ask') {
    await setTask($, (t): Task => ({ ...t, isFlowInvited: true }))
    notes.unshift(ASK_NOTE)
  }
  return notes
}

/** What Claude said last in the main conversation: its last message's text, and the question it asked, if any. */
async function lastSaid($: EngineInterface): Promise<string> {
  try {
    const last = (await $.session.messages()).filter(m => m.role === 'assistant').at(-1)
    if (!last) return ''
    const asked = last.toolUses.filter(u => u.tool === 'AskUserQuestion').map(u => JSON.stringify(u.input))
    return [last.text, ...asked].filter(Boolean).join('\n')
  } catch {
    return ''
  }
}

/** The session's model as `/model` shows it now, so a switch counts from the next prompt; else the last request's. */
async function sessionModelNow($: EngineInterface): Promise<string | null> {
  try {
    return (await $.session.model()) || (await read($, sessionModel))
  } catch {
    return read($, sessionModel)
  }
}

async function openPane($: EngineInterface): Promise<void> {
  await $.ui.open({ id: PANE, title: 'open-effort' })
}

/** The band's ≡: opens the pane, or closes it when it is showing. */
async function togglePane($: EngineInterface): Promise<void> {
  const isShown = (await $.ui.panes()).some(pane => pane.id === PANE && pane.isShown)
  if (isShown) await $.ui.close({ id: PANE })
  else await openPane($)
}

export const register: Register = on => {
  // Once the session has started in its folder: the project, its switches and history, and the language.
  on('session.start', async ($, e, next) => {
    const res = await next(e)
    await update($, seenLast, last => ({ ...last, starts: last.starts + 1 }))
    await update($, isOn, () => true)
    try {
      await loadProject($)
      // The session's own effort is known from its first request, not from an earlier session's.
      await update($, sessionEffort, () => null)
      const choice = await $.store.get(STORE_LANGUAGE)
      await setLanguage($, isLanguageChoice(choice) ? choice : 'auto')
      const pickedTheme = await $.store.get(STORE_THEME)
      await update($, themeChoice, () => (isThemeId(pickedTheme) ? pickedTheme : 'claude'))
      await checkSkills($)
    } catch {
      // A store or setting that cannot be read leaves the defaults: on, English, no effort seen, no history.
    }
    try {
      await $.command.register({ name: 'open-effort', description: wordsFor(await read($, language)).commandDescription })
    } catch {
      // Without the command the band still opens the pane.
    }
    try {
      await $.tool.register({
        name: 'report',
        description: 'open-effort: returns what the mod sees now (switches, task, last score, last request effort and model, sub-agents at work), to diagnose it.',
        inputSchema: { type: 'object', properties: {} },
      })
    } catch {
      // The report is for diagnosing; the mod works without it.
    }
    try {
      await $.tool.register(MODEL_TOOL_SPEC)
    } catch {
      // Without the tool, a model offer stays unanswered and the task keeps the session's model.
    }
    try {
      await $.tool.register(STAGE_TOOL_SPEC)
    } catch {
      // Without the tool, stages are still known from the skills Claude reads and the commands the person types.
    }
    return res
  })

  on('tool.call', { tool: 'mcp__open-effort__report' }, async $ => ({
    result: JSON.stringify(
      {
        isOn: await read($, isOn),
        switches: await read($, switches),
        missing: await read($, missing),
        task: await read($, task),
        sessionEffort: await read($, sessionEffort),
        sessionModel: await read($, sessionModel),
        last: await read($, seenLast),
        scoring: await read($, scoring),
        running: await read($, running),
      },
      null,
      1,
    ),
  })).catch(() => ({ result: 'open-effort: the report failed.' }))

  // Claude reports the person's answer to a model offer: up moves the task to the model offered, for the rest of it.
  on('tool.call', { tool: 'mcp__open-effort__model' }, async ($, e) => {
    const choice = (e as { choice?: unknown }).choice
    const offer = (await read($, task)).modelOffer
    if (!offer) return { result: 'open-effort: no model was offered for this task, so this changes nothing.' }
    if (choice !== 'up' && choice !== 'keep') return { result: 'open-effort: the choice must be up or keep.' }
    const model = TIER_MODEL[offer]
    await setTask($, (t): Task => (choice === 'up' ? { ...t, model, isOnFable: t.isOnFable || isFable(model), modelOffer: null } : { ...t, modelOffer: null }))
    return { result: choice === 'up' ? `open-effort: this task now runs on ${modelName(model)}.` : "open-effort: this task stays on the session's model." }
  }).catch(() => ({ result: 'open-effort: the model was not set.' }))

  // Claude announces the Main Flow stage it starts, or that the flow is done.
  on('tool.call', { tool: 'mcp__open-effort__stage' }, async ($, e) => {
    const named = (e as { stage?: unknown }).stage
    if (named === 'done') {
      await endFlow($)
      return { result: 'open-effort: the Main Flow is done; the next request starts a new task.' }
    }
    const stage = STAGES.find(s => s === named)
    if (!stage) return { result: `open-effort: the stage must be one of ${STAGES.join(', ')}, or done.` }
    const moved = await moveToStage($, stage)
    return {
      result:
        moved === true ? `open-effort: stage ${stage}; requests go out at its effort.`
        : moved === 'off' ? 'open-effort: the Main Flow is off or its skills are missing, so the stage changes nothing.'
        : 'open-effort: this task was not sent into the Main Flow, so the stage changes nothing.',
    }
  }).catch(() => ({ result: 'open-effort: the stage was not set.' }))

  // A stage skill Claude calls through the Skill tool (to-tickets, code-review, tdd) starts its stage.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const ran = await next(e)
    // Only a skill that ran: one the engine refused (a user-invoked skill) starts no stage.
    if (ran.deny === undefined && ran.isError !== true) await stageSign($, e.agentId, stageOfSkill(e.skill))
    return ran
  }).catch(($, e, next) => next(e))

  // Reading a stage skill's SKILL.md, as the Main Flow note asks, starts its stage.
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    await stageSign($, e.agentId, stageOfPath(e.file_path))
    // Claude reading a ticket in the implement stage takes it up: the ticket's effort, on the task's model.
    const number = ticketOf(e.file_path)
    const t = await read($, task)
    if (e.agentId === undefined && number && t.stage === 'implement' && t.ticket !== number && (await read($, isOn))) {
      const setting = await ticketSetting($, e.file_path)
      if (setting) await setTask($, (current): Task => enteredTicket(current, number, setting.effort))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // A new request the person typed ends the task under way and starts another: Haiku scores it, and the score gives
  // its starting effort. Large implementation work goes into
  // the Main Flow and borderline work asks first, when the flow is available. A go-on reply, a slash command or a
  // row the person did not type keeps the task under way.
  on('prompt.submit', async ($, e, next) => {
    // The session moved to another project (a host's directory change): its switches and history come with it.
    if ((await read($, project))?.root !== (await $.session.root())) await loadProject($)
    // A stage command the person types starts its stage, and the flow with it (tdd only inside the flow).
    const typed = e.command && isPerson(e.origin) ? stageOfSkill(e.command.name) : null
    if (typed && e.command) await moveToStage($, typed, startsFlow(e.command.name))
    if (e.isMeta || e.command || !isPerson(e.origin) || !e.text.trim() || isGoOn(e.text) || !(await read($, isOn))) return next(e)
    // Inside the Main Flow, what the person types is part of it: no new task, no score.
    if ((await read($, task)).stage !== null) return next(e)
    // Typed over a running turn: part of the task under way, not a new one.
    if (e.turnId !== undefined) return next(e)
    // The prompt does not wait for Haiku: its requests go out at the session's effort until the score comes. A score
    // back within a moment still brings its notes with the prompt; a later one sends them as a row Claude reads next.
    const generation = (await read($, scoring)) + 1
    await update($, scoring, () => generation)
    // With a task under way, Haiku also reads what Claude said last, to tell an answer or a follow-up (which keeps the
    // task and its climbs) from new work. The task under way holds until the score says which.
    const under = await read($, task)
    const said = under.score !== null || under.effort !== null ? await lastSaid($) : ''
    await update($, seenLast, last => ({ ...last, haikuCalls: (last.haikuCalls ?? 0) + 1 }))
    const scored = scoreRequest($, e.text, said || undefined)
    const early = await Promise.race([scored, new Promise<null>(resolve => setTimeout(() => resolve(null), SCORE_GRACE_MS))])
    if (early) {
      const notes = await applyScore($, early, generation)
      return notes.length > 0 ? next({ ...e, context: [...(e.context ?? []), ...notes] }) : next(e)
    }
    void scored
      .then(async late => {
        const notes = await applyScore($, late, generation)
        if (notes.length > 0) await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: notes.join('\n\n') }] } })
      })
      .catch(() => undefined)
    return next(e)
  }).catch(($, e, next) => next(e))

  // The session ends: so does its task.
  on('session.end', async ($, e, next) => {
    await setTask($, () => FRESH_TASK)
    return next(e)
  }).catch(($, e, next) => next(e))

  // Each main-session request goes out at the rung the task stands on: its effort, and Fable 5.1 once it climbed
  // there; otherwise the session's model (ADR 0001). The session's own effort and model are kept for the band, and
  // what went out for the turn's history entry.
  on('turn.step', async function* ($, e, next) {
    let sent = e
    if (e.agentId === undefined) {
      const raw = e.effort
      try {
        await update($, seenLast, last => ({ ...last, effort: `${typeof raw}:${String(raw)}`, model: e.model }))
      } catch {
        // The report misses one request.
      }
    }
    if (e.agentId === undefined && isEffort(e.effort)) {
      try {
        const carried = e.effort
        if ((await read($, sessionEffort)) !== carried) await update($, sessionEffort, () => carried)
        if ((await read($, sessionModel)) !== e.model) await update($, sessionModel, () => e.model)
        if (await read($, isOn)) {
          const t = await read($, task)
          const runsOn = taskModel(t, e.model) ?? e.model
          const rung = rungOf(t, null, runsOn)
          // The task's model: the one the person chose for it, or Fable 5.1 once it climbed there.
          const model = rung?.isFable ? (isFable(runsOn) ? runsOn : FABLE_MODEL) : runsOn
          if (rung) sent = { ...e, effort: rung.effort, ...(model !== e.model ? { model } : {}) }

        }
      } catch {
        // The request goes out as it came.
        sent = e
      }
    } else if (e.agentId !== undefined && isEffort(e.effort)) {
      // A sub-agent's request: at the effort its stalls climbed it to, else as its Agent call started it.
      try {
        const id = e.agentId
        const carried = e.effort
        if (await read($, isOn)) {
          const agent = await subAgent($, id)
          // A ticket's sub-agent whose climbs moved it up a family runs on that family's model from then on.
          const model = agent.tier && tierOf(e.model) !== agent.tier ? TIER_MODEL[agent.tier] : e.model
          if (agent.climbed) sent = { ...e, model, effort: fitEffort(agent.climbed, model) }
          else await update($, agents, all => keptAgents({ ...all, [id]: { ...agent, effort: carried } }))
        }
      } catch {
        sent = e
      }
    }
    const result = yield* next(sent)
    // What went out joins the turn's history entry once a response came back for it.
    const out = sent
    if (out.agentId === undefined && result.stopReason !== null && isEffort(out.effort) && (await read($, isOn))) {
      const effort = out.effort
      await update($, turnLog, (log): TurnLog => ({ ...log, sent: [...log.sent, { effort, model: out.model }] }))
    }
    return result
  })

  // A sub-agent of a built-in type starts at its rule's model and effort, unless the call names its own.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (e.model !== undefined || e.effort !== undefined || !(await read($, isOn))) return next(e)
    // A ticket handed to a sub-agent in the implement stage: it runs on the ticket's model and effort.
    const path = ticketIn(e.prompt)
    const number = path ? ticketOf(path) : null
    if (path && number && (await read($, task)).stage === 'implement') {
      const setting = await ticketSetting($, path)
      if (setting) {
        await update($, handed, all => ({ ...all, [e.description]: { ticket: number, ...setting } }))
        return next({ ...e, effort: setting.effort, ...(setting.tier ? { model: setting.tier } : {}) })
      }
    }
    const main = rungOf(await read($, task), await read($, sessionEffort), taskModel(await read($, task), await read($, sessionModel)))
    const start = subAgentStart(e.subagent_type, main?.effort ?? null)
    return next(start ? { ...e, ...start } : e)
  }).catch(($, e, next) => next(e))

  // A check the main session ran: three failures in a row climb the task, a pass after a climb settles it, and a
  // stall at the top tells Claude to stop and ask the person. A sub-agent's check climbs its own effort, up to xhigh.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    // Printing a stage skill's SKILL.md (`cat …/to-spec/SKILL.md`) starts its stage, as reading it does.
    await stageSign($, e.agentId, stageOfPath(e.command))
    const ran = await next(e)
    // Only a check whose exit is its own counts: a piped, hidden or backgrounded one says nothing either way.
    if (ran.deny !== undefined || checkRun(e.command, e.run_in_background === true) !== 'counted' || !(await read($, isOn))) return ran
    const id = e.agentId
    if (id !== undefined) {
      const agent = await subAgent($, id)
      if (!agent.isClimbable) return ran
      const startTier: ModelTier = agent.tier ?? tierOf(taskModel(await read($, task), await read($, sessionModel))) ?? 'opus'
      const after = agent.ticket ? afterTicketAgentCheck(agent, ran.isError !== true, startTier) : afterAgentCheck(agent, ran.isError !== true)
      await update($, agents, all => keptAgents({ ...all, [id]: after }))
      return ran
    }
    const own = await read($, sessionEffort)
    const model = taskModel(await read($, task), await read($, sessionModel))
    const out = afterCheck(await read($, task), ran.isError !== true, own, model)
    await setTask($, () => out.task)
    if (out.hasClimbed) await update($, turnLog, (log): TurnLog => ({ ...log, climbs: log.climbs + 1 }))
    if (out.hasReachedLadderEnd) await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: LADDER_END_NOTE }] } })
    return ran
  }).catch(($, e, next) => next(e))

  // The main session's turn ended: its entry joins the project's history, kept in the store.
  // A sub-agent's loop starts and ends: the band counts those at work.
  on('turn.start', async ($, e, next) => {
    const res = await next(e)
    const id = e.agentId
    if (id !== undefined) {
      await update($, running, ids => (ids.includes(id) ? ids : [...ids, id]))
      const now = await $.clock.now()
      await update($, seen, before => ({ ...before, [`agent:${id}`]: before[`agent:${id}`] ?? now }))
    }
    return res
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    const done = e.agentId
    if (done !== undefined) {
      await update($, running, ids => ids.filter(id => id !== done))
      await update($, seen, before => Object.fromEntries(Object.entries(before).filter(([key]) => key !== `agent:${done}`)))
      return res
    }
    const ended = await read($, task)
    const entry = entryOf(ended, await read($, turnLog), await $.clock.now())
    await update($, turnLog, () => EMPTY_TURN)
    // The retro stage's turn is the Main Flow's last.
    if (ended.stage === 'retro') await endFlow($)
    const p = await read($, project)
    if (!entry || !p) return res
    // Appended to what the store holds now, not to what this session loaded: another session in the project, or a
    // merge, may have written since.
    const stored = historyFrom(await $.store.get(historyKey(p.root)))
    const list = appended(stored, entry)
    await update($, history, () => list)
    await $.store.set(historyKey(p.root), list)
    return res
  }).catch(($, e, next) => next(e))

  // /open-effort opens the pane; /open-effort on|off switches the mod for this machine, a person's own command only.
  on('command.run', { command: 'open-effort' }, async ($, e) => {
    const words = wordsFor(await read($, language))
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      if (!isPerson(e.origin)) return { text: words.onlyPerson }
      // The project's switch, as the pane's main toggle: the machine's stays the default for other projects.
      await setSwitches($, s => ({ ...s, project: arg === 'on' }))
    } else {
      await openPane($)
    }
    return { text: words.status(await read($, isOn)) }
  }).catch(() => ({ text: 'open-effort: the command failed; the switch is unchanged.' }))


  // The band: on surfaces that draw pictures, a compact flow (why, then the effort in effect, and in the Main Flow
  // the stage track above it) sized to the band's width; on the terminal, the words alone. Then the pane's button.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isOn))) return next(e)
    const table = $.ui.resolve(e)
    const { Box, Button, Text } = table
    const words = wordsFor(await read($, language))
    const t = await read($, task)
    const model = taskModel(t, await read($, sessionModel))
    const own = await read($, sessionEffort)
    const rung = rungOf(t, own, model)
    const why: Why =
      t.isAtLadderEnd ? { kind: 'ladderEnd' }
      : t.climbed ? { kind: 'climbed' }
      : t.stage ? { kind: 'stage' }
      : t.score && t.effort ? { kind: 'scored', score: t.score }
      : { kind: 'own' }
    const onFable = !!rung?.isFable && !isFable(model)
    const line = words.band(rung?.effort ?? null, onFable, why, t.stage)
    const pane = <Button key="pane" label="≡" onPress={() => togglePane($)} />
    if (e.surface === 'terminal' || !('Svg' in table)) {
      return (
        <Box gap={1}>
          <Text dimColor>{line}</Text>
          {pane}
        </Box>
      )
    }
    const { Svg } = table
    const picked = await read($, themeChoice)
    useTheme(picked)
    // The band's cells are about 8 CSS pixels wide on the desktop; leave room for the pane's button.
    const room = Math.max(96, e.props.bodyColumns * 8 - 64)
    const short = (text: string) => (text.length > 26 ? `${text.slice(0, 25)}…` : text)
    const source = t.stage ? 'stage' : t.score && t.effort ? 'score' : 'own'
    const reason = t.score ? words.reason({ kind: 'scored', score: t.score }) : words.reason(why)
    // The task's flow, left to right: what Haiku read (or the stage), then the effort in use, which carries the
    // ladder's meter. Failing checks and climbs are not steps of their own: they loop back into the effort, which
    // changes in place, and the loop goes once the work is past it. Only the ladder's end adds a step, the stop.
    const meter = rung ? { at: EFFORTS.indexOf(rung.effort), isFable: onFable } : undefined
    const shown = await read($, seen)
    const now = await $.clock.now()
    const isFresh = (key: string) => shown[key] !== undefined && now - (shown[key] ?? 0) < FRESH_MS
    const climbKey = t.climbed ? `climb:${t.climbed.effort}:${t.climbed.isFable}` : ''
    const loop: Loop | undefined =
      t.fails > 0 && !t.isAtLadderEnd
        ? { label: `${words.steps.failed} ${t.fails}/${FAILS_TO_STALL}`, tone: 'alert', isNew: isFresh(`fail:${t.fails}`) }
        : t.climbed && isFresh(climbKey)
          ? { label: `${words.steps.climbed} ↑ ${t.climbed.effort}`, tone: onFable ? 'violet' : 'brand', isNew: true, isLeaving: true }
          : undefined
    const effortModel = t.climbed && onFable ? 'Fable 5.1' : modelName(model)
    const steps: Step[] = [
      source === 'stage'
        ? { title: words.steps.stage, value: `${t.stage ?? ''}${t.ticket ? ` · ${words.steps.ticket(t.ticket)}` : ''}`, state: 'done', rank: 1 }
        : { title: words.steps.read, value: source === 'score' ? short(reason) : words.steps.noScore, state: source === 'score' ? 'done' : 'idle', rank: 1 },
      {
        title: `${words.steps.effort} · ${effortModel}`,
        ...(t.climbed && t.effort ? { aside: words.steps.from(t.effort) } : {}),
        value: t.climbed?.effort ?? t.effort ?? rung?.effort ?? words.flow.own,
        state: t.isAtLadderEnd ? 'done' : loop?.tone === 'alert' ? 'alert' : onFable ? 'violet' : rung ? 'active' : 'idle',
        meter,
        rank: 3,
        ...(loop ? { loop } : {}),
      },
      ...(t.isAtLadderEnd ? [{ title: words.steps.stopped, value: words.steps.atEnd, state: 'red', rank: 6 } as Step] : []),
    ]
    const last = steps[steps.length - 1]
    if (last) steps[steps.length - 1] = { ...last, isWorking: true }
    // Only what just appeared animates in: a redraw that changes nothing else keeps the band still.
    const keys = bandKeys(t).filter(key => !key.startsWith('track') && !key.startsWith('stage:'))
    steps.forEach((st, i) => {
      steps[i] = { ...st, isNew: isFresh(keys[i] ?? '') }
    })
    const flow = stepsSvg(steps, room, e.props.isWorking, room)
    const stages = t.stage ? stageSvg(t.stage, room, { isTrackNew: isFresh('track'), isStageNew: isFresh(`stage:${t.stage}`) }) : null
    // Sub-agents at work hang off the step at work as one node saying how many; their names follow as buttons that
    // wrap to the band's width, each opening its agent's transcript.
    const ids = await read($, running)
    const atWork = ids.length > 0 ? (await $.agent.list()).filter(a => ids.includes(a.id)) : []
    const band = room + 64
    const node = atWork.length > 0
      ? agentsSvg(flow.anchor ?? 16, band - 8, `${words.steps.agents} · ${words.steps.agentsAt(atWork.length)}`, atWork.some(a => isFresh(`agent:${a.id}`)))
      : null
    const cut = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(1, n - 1))}…` : text)
    const openAgent = async (id: string) => {
      const res = await $.ui.view({ agentId: id })
      // A refusal is said, not swallowed: the person pressed and should know why nothing opened.
      if ('deny' in res && res.deny) {
        $.ui.toast(words.steps.viewDenied(res.deny))
        await update($, seenLast, last => ({ ...last, view: res.deny }))
      }
    }
    return (
      <Box flexDirection="column" gap={1}>
        {stages && <Svg source={stages.source} width={stages.width} height={stages.height} alt={`Main Flow: ${t.stage}`} />}
        <Box flexDirection="column">
          <Box justifyContent="space-between" alignItems="center" gap={1}>
            <Svg source={flow.source} width={flow.width} height={flow.height} alt={line} />
            {pane}
          </Box>
          {node && <Svg source={node.source} width={node.width} height={node.height} alt={words.steps.agentsAt(atWork.length)} />}
          {node && (
            <Box flexWrap="wrap" gap={1} marginTop={1}>
              {atWork.map(a => (
                <Button key={`agent-${a.id}`} onPress={() => openAgent(a.id)}>
                  <Text color={THEMES[picked].accent}>{'⑂ '}</Text>
                  <Text bold>{cut(a.type, 24)}</Text>
                  <Text dimColor>{` · ${cut(a.description, 32)}`}</Text>
                </Button>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    )
  })

  // The pane, a dark side panel as a workflow builder has: the mod's name and project, then sections with a small
  // caption over a rounded panel of rows. Rows that hold a choice put it on a line of its own, so nothing wraps.
  on('ui.render', { component: 'Pane', requestId: 'open-effort' }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Button, Text } = table
    const words = wordsFor(await read($, language)).pane
    const s = await read($, switches)
    const p = await read($, project)
    const choice = await read($, languageChoice)
    const list = await read($, history)
    const lacking = await read($, missing)
    const name = p?.name ?? '-'
    const picked = await read($, themeChoice)
    useTheme(picked)
    const ACCENT = THEMES[picked].accent

    const section = (title: string, ...rows: unknown[]) => (
      <Box flexDirection="column" marginTop={1}>
        <Box paddingX={1}>
          <Text dimColor bold>
            {title}
          </Text>
        </Box>
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} gap={1}>
          {rows}
        </Box>
      </Box>
    )
    const row = (label: string, control: unknown) => (
      <Box justifyContent="space-between" alignItems="center" gap={1}>
        <Text>{label}</Text>
        {control}
      </Box>
    )
    // A toggle: pressing it flips the value; its key says what pressing does.
    const toggle = (keyOn: string, keyOff: string, isOn: boolean, set: (value: boolean) => Promise<void>) => (
      <Button key={isOn ? keyOff : keyOn} variant={isOn ? 'primary' : 'secondary'} onPress={() => set(!isOn)}>
        {isOn ? `● ${words.on}` : `○ ${words.off}`}
      </Button>
    )
    const segmented = (options: readonly { key: string; label: string; isPicked: boolean; onPress: () => Promise<void> }[]) => (
      <Box flexWrap="wrap" gap={1}>
        {options.map(o => (
          <Button key={o.key} label={o.label} variant={o.isPicked ? 'primary' : 'secondary'} onPress={o.onPress} />
        ))}
      </Box>
    )
    const chart = e.surface !== 'terminal' && 'Svg' in table && list.length > 0 ? historySvg(list, Math.max(120, e.props.bodyColumns * 8 - 40), {
            ...words.chart,
            tooltip: entry => `${clockTime(entry.at)} · ${words.entryTitle(entry)} · ${words.entry(entry)}`,
          }) : null

    return (
      <Box flexDirection="column">
        <Box justifyContent="space-between" alignItems="center" paddingX={1}>
          <Text bold>open-effort</Text>
          <Text color={(s.project ?? s.machine) ? ACCENT : undefined} dimColor={!(s.project ?? s.machine)}>
            {(s.project ?? s.machine) ? `● ${words.on}` : `○ ${words.off}`}
          </Text>
        </Box>
        {section(
          words.switches,
          row(words.useHere(name), toggle('project-on', 'project-off', s.project ?? s.machine, value => setSwitches($, x => ({ ...x, project: value })))),
        )}
        {section(
          words.mainFlow,
          row(words.useHere(name), toggle('flow-project-on', 'flow-project-off', s.flowProject ?? s.flowMachine, value => setSwitches($, x => ({ ...x, flowProject: value })))),
          ...(lacking.length > 0
            ? [
                <Box flexDirection="column">
                  <Text color="#ef4444">{words.missing(lacking)}</Text>
                  <Text dimColor>{words.install}</Text>
                  {INSTALL_COMMANDS.map(c => (
                    <Text>{c}</Text>
                  ))}
                </Box>,
              ]
            : []),
        )}
        {section(
          words.language,
          segmented([
            { key: 'language-auto', label: words.auto, isPicked: choice === 'auto', onPress: () => setLanguage($, 'auto') },
            { key: 'language-th', label: 'ไทย', isPicked: choice === 'th', onPress: () => setLanguage($, 'th') },
            { key: 'language-en', label: 'English', isPicked: choice === 'en', onPress: () => setLanguage($, 'en') },
          ]),
        )}
        {section(
          words.theme,
          <Box flexWrap="wrap" gap={1}>
            {THEME_IDS.map(id => (
              <Button key={`theme-${id}`} variant={picked === id ? 'primary' : 'secondary'} onPress={() => setTheme($, id)}>
                <Text color={THEMES[id].accent}>{'● '}</Text>
                {words.themes[id]}
              </Button>
            ))}
          </Box>,
        )}
        {section(
          words.history(list.length),
          ...(list.length > 0 ? [<Text dimColor>{words.summary(list)}</Text>] : []),
          ...(chart ? [<table.Svg source={chart.source} width={chart.width} height={chart.height} alt={words.history(list.length)} isInteractive />] : []),
          ...(list.length === 0 ? [<Text dimColor>{words.noHistory}</Text>] : []),
          // The terminal draws no chart: its last few turns as lines instead.
          ...(!chart
            ? list
                .slice(-5)
                .reverse()
                .map(entry => <Text dimColor>{`${clockTime(entry.at)} · ${words.entryTitle(entry)} · ${words.entry(entry)}`}</Text>)
            : []),
        )}
        {section(
          words.advanced,
          <Text dimColor>{words.defaults}</Text>,
          row('open-effort', toggle('machine-on', 'machine-off', s.machine, value => setSwitches($, x => ({ ...x, machine: value })))),
          row(words.mainFlow, toggle('flow-machine-on', 'flow-machine-off', s.flowMachine, value => setSwitches($, x => ({ ...x, flowMachine: value })))),
        )}
      </Box>
    )
  })
}
