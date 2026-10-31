import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptOrigin, Register, RenderChildren } from 'claude-code'

import type { Declined, Effort, HistoryEntry, Language, LanguageChoice, ModelTier, Project, Stage, SubAgent, Switches, Task, TicketSetting, TurnLog } from '../types'
import { checkRun, isTestFile } from './checks'
import { THEMES, THEME_IDS, agentsSvg, bandKeys, historySvg, isThemeId, stageSvg, stepsSvg, useTheme } from './diagrams'
import type { Loop, Step, ThemeId } from './diagrams'
import { EMPTY_TURN, appended, entryOf, historyFrom, historyKey, projectKey, projectOf } from './history'
import {
  ASK_NOTE, IMPLEMENT_NOTE, INSTALL_COMMANDS, MODEL_TOOL_SPEC, STAGES, STAGE_TOOL, STAGE_TOOL_SPEC, TICKET_NOTE, flowStartedNote, missingSkills, modelNote, routeOf, stageOfPath, stageOfSkill,
  startsFlow,
} from './main-flow'
import {
  EFFORTS, FABLE_MODEL, FAILS_TO_STALL, FLOW_MODELS, FRESH_TASK, TIER_MODEL, afterAgentCheck, afterCheck, afterTicketAgentCheck, enteredStage, enteredTicket,
  fitEffort, flowModelFor, isBuiltInAgent, isEffort, isFable, isFlowModel, modelUp, rungOf, startingEffort, subAgentStart, supportedEfforts, taskModel, usedStageSkill, ticketIn, ticketOf,
  isSizeAtMost, isTierAtMost, largerSize, ticketLinesOf, tierOf,
} from './policy'
import type { FlowModel } from './policy'
import { SCORE_GRACE_MS, isGoOn, isUnsure, scoreRequest } from './score'
import type { Scored } from './score'
import { clockTime, languageOf, modelName, wordsFor } from './words'
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
// The model the Main Flow runs on, picked in the pane and kept in the store.
const flowModel = atom({ plugin: 'open-effort', key: 'flowModel' } as const, 'frontier' as FlowModel)
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
// Tickets handed to sub-agents not yet started, by the Agent call's tool_use_id: the ticket and its setting.
const handed = atom({ plugin: 'open-effort', key: 'handed' } as const, {} as Record<string, { ticket: string } & TicketSetting>)
// Counts new tasks, so a late score applies only to the task it was asked for.
const scoring = atom({ plugin: 'open-effort', key: 'scoring' } as const, 0)
// Whether a prompt's score is still on its way: its requests go out at the session's own effort meanwhile.
const isScoring = atom({ plugin: 'open-effort', key: 'isScoring' } as const, false)
// The task as it stood when the prompt now being scored was typed: what changed since is kept when the score comes.
const before = atom({ plugin: 'open-effort', key: 'before' } as const, FRESH_TASK as Task)
// What the person turned down this session: the largest work they chose to do without the Main Flow, and the most
// capable model they chose not to move to. Neither is asked about again for work no larger.
const declined = atom({ plugin: 'open-effort', key: 'declined' } as const, { flow: null, model: null } as Declined)
// Whether the main session's turn is running: a score that comes after it ended sends Claude no questions.
const isTurnRunning = atom({ plugin: 'open-effort', key: 'isTurnRunning' } as const, false)
// How many messages the conversation held when the mod offered a model: the question must come after.
const offerAt = atom({ plugin: 'open-effort', key: 'offerAt' } as const, 0)
// Whether the main session wrote a test since its last check: the next failing check is the red step, not a stall.
const isRed = atom({ plugin: 'open-effort', key: 'isRed' } as const, false)
// Haiku's readings of tickets without Model and Effort lines, by path, with the text read: read again only once the
// ticket changes.
const ticketReads = atom({ plugin: 'open-effort', key: 'ticketReads' } as const, {} as Record<string, { text: string; setting: TicketSetting }>)
// Whether the surface can put an agent's transcript in view; false once it said it draws no main view. The desktop
// app never can: its band never offers it.
const canView = atom({ plugin: 'open-effort', key: 'canView' } as const, true)

/** Sub-agents kept: the latest ones, enough for any session's running agents. */
const AGENTS_KEPT = 50

/** The sub-agents with one set to `agent`, moved to the newest place: the ones least lately used leave first. */
function withAgent(all: Record<string, SubAgent>, id: string, agent: SubAgent): Record<string, SubAgent> {
  return Object.fromEntries([...Object.entries(all).filter(([known]) => known !== id), [id, agent] as const].slice(-AGENTS_KEPT))
}

/**
 * A sub-agent as the mod knows it; the first time, its type is looked up to know whether it is one the mod climbs. A
 * ticket's sub-agent is known from its start (the `agent.spawn` hook).
 */
async function subAgent($: EngineInterface, id: string): Promise<SubAgent> {
  const known = (await read($, agents))[id]
  if (known) return known
  const listed = (await $.agent.list()).find(a => a.id === id)
  return { effort: null, climbed: null, fails: 0, isClimbable: isBuiltInAgent(listed?.type) }
}

/** A test file was written, by the main session or a sub-agent: the next failing check is its red step, no stall. */
async function testWritten($: EngineInterface, agentId: string | undefined, path: unknown): Promise<void> {
  if (typeof path !== 'string' || !isTestFile(path) || !(await read($, isOn))) return
  if (agentId === undefined) {
    await update($, isRed, () => true)
    return
  }
  const agent = await subAgent($, agentId)
  await update($, agents, all => withAgent(all, agentId, { ...agent, isRed: true }))
}

/** Drops a hand-off once its agent started, or the call started none. */
async function dropHanded($: EngineInterface, toolUseId: string): Promise<void> {
  await update($, handed, all => Object.fromEntries(Object.entries(all).filter(([id]) => id !== toolUseId)))
}

// What outlives the session in the store: the machine's switches, the language picked, the last effort seen; and per
// project (projectKey, historyKey) its switches and its history.
const STORE_IS_ON = 'isOn'
const STORE_MAIN_FLOW = 'mainFlow'
const STORE_FLOW_MODEL = 'flowModel'
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
  // Off, the mod keeps no task to come back to; with the Main Flow off, a task in it leaves it.
  if (!(next.project ?? next.machine)) await setTask($, () => FRESH_TASK)
  else if (!(next.flowProject ?? next.flowMachine)) await endFlow($)
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

/** The Main Flow's model, picked in the pane and kept in the store. */
async function setFlowModel($: EngineInterface, pick: FlowModel): Promise<void> {
  await update($, flowModel, () => pick)
  await $.store.set(STORE_FLOW_MODEL, pick)
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

/** Who moved the task to a stage: the person's own stage command, or Claude's stage tool. */
type StageMover = 'person' | 'tool'

/**
 * Whether the conversation shows a Main Flow under way: Claude's last stage call named a stage, not "done". A session
 * resumed in a new process starts with no task, though the conversation is mid-flow.
 */
async function isFlowInTranscript($: EngineInterface): Promise<boolean> {
  try {
    const calls = (await $.session.messages()).flatMap(m => (m.role === 'assistant' ? m.toolUses : [])).filter(u => u.tool === STAGE_TOOL)
    const last = calls.at(-1)?.input as { stage?: unknown } | undefined
    return typeof last?.stage === 'string' && last.stage !== 'done'
  } catch {
    return false
  }
}

/**
 * A Main Flow stage was started: the task takes the stage's effort. The person's own stage command may start the
 * flow; Claude's stage tool may start it after the mod asked the person about it, or to bring back a flow the
 * conversation shows under way (a resumed session). Only those two move a task between stages. Nothing moves while
 * the mod or the Main Flow is off.
 */
async function moveToStage($: EngineInterface, stage: Stage, by: StageMover): Promise<true | 'off' | 'not-invited'> {
  if (!(await read($, isOn)) || !(await isFlowAvailable($))) return 'off'
  const t = await read($, task)
  if (t.stage === stage) return true
  if (t.stage === null && by === 'tool' && !t.isFlowInvited && !(await isFlowInTranscript($))) return 'not-invited'
  // Entering the flow moves the task to the model picked for it (the frontier model by default), never down.
  const moveTo = t.stage === null ? flowModelFor(await read($, flowModel), taskModel(t, await read($, sessionModel))) : null
  await setTask($, (current): Task => ({
    ...enteredStage(current, stage),
    ...(moveTo ? { model: moveTo, isOnFable: current.isOnFable || isFable(moveTo) } : {}),
  }))
  // A flow the person started with a stage's command: Claude learns how to move on in it and how to leave it.
  // The stages where tickets are written and worked tell Claude how a ticket's model and effort are named and used.
  const notes = [
    ...(t.stage === null && by === 'person' ? [flowStartedNote(stage)] : []),
    ...(stage === 'tickets' ? [TICKET_NOTE] : stage === 'implement' ? [IMPLEMENT_NOTE] : []),
  ]
  for (const note of notes) await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: note }] } })
  return true
}

/**
 * A ticket's setting: the Model and Effort lines it names; Haiku reads it for an effort it does not name (and for
 * its model when it names none and Haiku is sure). Null when the file cannot be read, or it names no effort and
 * Haiku gives no score.
 */
async function ticketSetting($: EngineInterface, path: string): Promise<TicketSetting | null> {
  let text: string
  try {
    text = await $.fs.read(path)
  } catch {
    return null
  }
  const named = ticketLinesOf(text)
  if (named.effort) return { ...(named.tier ? { tier: named.tier } : {}), effort: named.effort }
  const known = (await read($, ticketReads))[path]
  if (known && known.text === text) return known.setting
  const { score } = await scoreRequest($, text)
  if (!score) return null
  const tier = named.tier ?? (!isUnsure(score) ? score.model : undefined)
  const setting: TicketSetting = { ...(tier ? { tier } : {}), effort: startingEffort(score) }
  await update($, ticketReads, all => Object.fromEntries([...Object.entries(all).filter(([p]) => p !== path), [path, { text, setting }] as const].slice(-AGENTS_KEPT)))
  return setting
}

/**
 * Claude used a stage's skill (called it, read its SKILL.md): the main session's only. The task keeps at least that
 * stage's effort and stays where it is: in the Main Flow only the stage tool or the person moves it (a review Claude
 * runs on its own work during implement is not the review stage), and work done directly stays out of the flow. Work
 * done directly also moves to the Main Flow's model (never a step down), while the Main Flow is on.
 */
async function stageSign($: EngineInterface, agentId: string | undefined, stage: Stage | null): Promise<void> {
  if (agentId !== undefined || !stage || !(await read($, isOn))) return
  const t = await read($, task)
  if (t.stage === stage) return
  const moveTo = t.stage === null && (await isFlowAvailable($)) ? flowModelFor(await read($, flowModel), taskModel(t, await read($, sessionModel))) : null
  const own = await read($, sessionEffort)
  await setTask($, current => usedStageSkill(current, stage, own, moveTo))
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
  await update($, isScoring, () => false)
  // Switched off while the score was on its way: nothing to apply, nothing to ask.
  if (!(await read($, isOn))) return []
  const { score, outcome } = scored
  await update($, seenLast, last => ({ ...last, score: score?.continues ? 'continues' : outcome }))
  // No score: a new task at the session's own effort.
  if (!score) {
    await setTask($, () => FRESH_TASK)
    return []
  }
  // A reply that goes on with the task keeps it; one that answers Claude's stop at the ladder's end lets the next
  // stall stop it again.
  if (score.continues) {
    await setTask($, (t): Task => ({ ...t, isAtLadderEnd: false }))
    return []
  }
  const now = await read($, task)
  const was = await read($, before)
  // The task this one replaces: a Main Flow asked about and never entered was turned down for work of its size.
  const turnedDown = was.isFlowInvited && was.stage === null && was.score ? was.score.size : null
  if (turnedDown) await update($, declined, d => ({ ...d, flow: largerSize(d.flow, turnedDown) }))
  // What happened while the score was on its way stays: a flow the person started, a stage's skill Claude used.
  const fresh: Task = { ...FRESH_TASK, score, effort: startingEffort(score) }
  const next =
    now.stage !== null && now.stage !== was.stage ? { ...now, score }
    : now.skill !== null && now.skill !== was.skill ? usedStageSkill(fresh, now.skill, null, now.model !== was.model ? now.model : null)
    : fresh
  await setTask($, () => next)
  if (next.stage !== null) return []
  const notes: string[] = []
  const said = await read($, declined)
  // A more capable model than the session's, when Haiku is sure the work needs one, and the person did not turn it
  // down already this session: they are asked first.
  const own = await sessionModelNow($)
  const up = isUnsure(score) ? null : modelUp(score.model, own)
  const offer = up && !(said.model && isTierAtMost(up, said.model)) ? up : null
  if (offer) {
    await update($, offerAt, () => 0)
    try {
      const count = (await $.session.messages()).length
      await update($, offerAt, () => count)
    } catch {
      // Any question asked counts.
    }
    await setTask($, (t): Task => ({ ...t, modelOffer: offer }))
    notes.push(modelNote(modelName(TIER_MODEL[offer]), modelName(own)))
  }
  await checkSkills($)
  const isAsked = routeOf(score.size, await isFlowAvailable($)) === 'ask' && !(said.flow && isSizeAtMost(score.size, said.flow))
  if (isAsked) {
    await setTask($, (t): Task => ({ ...t, isFlowInvited: true }))
    notes.unshift(ASK_NOTE)
  }
  return notes
}

/** Whether Claude asked the person a question (AskUserQuestion) in the conversation's messages from `from` on. */
async function askedSince($: EngineInterface, from: number): Promise<boolean> {
  try {
    return (await $.session.messages()).slice(from).some(m => m.role === 'assistant' && m.toolUses.some(u => u.tool === 'AskUserQuestion'))
  } catch {
    return false
  }
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
    // A session started again (resumed, or cleared) without an end carries nothing over from before.
    await setTask($, () => FRESH_TASK)
    await update($, running, () => [])
    await update($, handed, () => ({}))
    await update($, isScoring, () => false)
    await update($, scoring, n => n + 1)
    await update($, declined, (): Declined => ({ flow: null, model: null }))
    await update($, turnLog, () => EMPTY_TURN)
    await update($, isRed, () => false)
    try {
      await loadProject($)
      // The session's own effort is known from its first request, not from an earlier session's.
      await update($, sessionEffort, () => null)
      const choice = await $.store.get(STORE_LANGUAGE)
      await setLanguage($, isLanguageChoice(choice) ? choice : 'auto')
      const pickedFlowModel = await $.store.get(STORE_FLOW_MODEL)
      await update($, flowModel, () => (isFlowModel(pickedFlowModel) ? pickedFlowModel : 'frontier'))
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
    // "up" costs the person more: it stands only on their answer to a question Claude asked after the offer.
    if (choice === 'up' && !(await askedSince($, await read($, offerAt)))) {
      return { result: 'open-effort: ask the person first with AskUserQuestion, then call this with their answer. The task stays on its model.' }
    }
    if (choice === 'keep') await update($, declined, d => ({ ...d, model: d.model && isTierAtMost(offer, d.model) ? d.model : offer }))
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
    const moved = await moveToStage($, stage, 'tool')
    return {
      result:
        moved === true ? `open-effort: stage ${stage}; requests go out at its effort.`
        : moved === 'off' ? 'open-effort: the Main Flow is off or its skills are missing, so the stage changes nothing.'
        : 'open-effort: this task was not sent into the Main Flow, so the stage changes nothing.',
    }
  }).catch(() => ({ result: 'open-effort: the stage was not set.' }))

  // A stage skill Claude calls through the Skill tool (to-tickets, code-review, tdd) raises the task to its stage's effort.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const ran = await next(e)
    // Only a skill that ran: one the engine refused (a user-invoked skill) starts no stage.
    if (ran.deny === undefined && ran.isError !== true) await stageSign($, e.agentId, stageOfSkill(e.skill))
    return ran
  }).catch(($, e, next) => next(e))

  // Reading a stage skill's SKILL.md, as the Main Flow note asks, raises the task to its stage's effort.
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
  // its starting effort. Large or borderline work asks the person about the Main Flow first, when the flow is
  // available. A go-on reply, a reply to what Claude said, a slash command or a row the person did not type keeps the
  // task under way.
  on('prompt.submit', async ($, e, next) => {
    // The session moved to another project (a host's directory change): its switches and history come with it.
    if ((await read($, project))?.root !== (await $.session.root())) await loadProject($)
    // A stage command the person types starts its stage, and the flow with it (tdd only inside the flow).
    const typed = e.command && isPerson(e.origin) ? stageOfSkill(e.command.name) : null
    if (typed && e.command && (startsFlow(e.command.name) || (await read($, task)).stage !== null)) await moveToStage($, typed, 'person')
    // A command typed with words after it (`/fix-bug the cart total`) asks for work like a prompt; one alone, or the
    // mod's own, or a stage's, keeps the task under way.
    const isCommandWork = !!e.command && !typed && e.command.name !== 'open-effort' && e.command.args.trim() !== ''
    if (e.isMeta || (e.command && !isCommandWork) || !isPerson(e.origin) || !e.text.trim() || isGoOn(e.text) || !(await read($, isOn))) return next(e)
    // Inside the Main Flow, what the person types is part of it: no new task, no score. In retro, the last stage, a
    // reply to it keeps the flow and new work ends it, as the score says.
    const inStage = (await read($, task)).stage
    if (inStage !== null && inStage !== 'retro') return next(e)
    // Typed over a running turn: part of the task under way, not a new one.
    if (e.turnId !== undefined) return next(e)
    // The prompt does not wait for Haiku: its requests go out at the session's effort until the score comes. A score
    // back within a moment still brings its notes with the prompt; a later one sends them as a row Claude reads next.
    const generation = (await read($, scoring)) + 1
    await update($, scoring, () => generation)
    await update($, isScoring, () => true)
    // With a task under way, Haiku also reads what Claude said last, to tell an answer or a follow-up (which keeps the
    // task and its climbs) from new work. The task under way holds until the score says which.
    const under = await read($, task)
    await update($, before, () => under)
    const said = under.score !== null || under.effort !== null ? await lastSaid($) : ''
    await update($, seenLast, last => ({ ...last, haikuCalls: (last.haikuCalls ?? 0) + 1 }))
    // A call that fails is no score, never a rejection: the wait for the score always ends.
    const scored = scoreRequest($, e.text, said || undefined).catch((): Scored => ({ score: null, outcome: 'error' }))
    const early = await Promise.race([scored, $.clock.sleep(SCORE_GRACE_MS).then(() => null)])
    if (early) {
      const notes = await applyScore($, early, generation)
      return notes.length > 0 ? next({ ...e, context: [...(e.context ?? []), ...notes] }) : next(e)
    }
    void scored
      .then(async late => {
        const notes = await applyScore($, late, generation)
        if (notes.length === 0) return
        // The turn the prompt started already ended: a question now would land on the next, unrelated request.
        if (!(await read($, isTurnRunning))) {
          await setTask($, (t): Task => ({ ...t, modelOffer: null, isFlowInvited: false }))
          return
        }
        await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: notes.join('\n\n') }] } })
      })
      .catch(() => undefined)
    return next(e)
  }).catch(($, e, next) => next(e))

  // The session ends: so does its task.
  on('session.end', async ($, e, next) => {
    await setTask($, () => FRESH_TASK)
    return next(e)
  }).catch(($, e, next) => next(e))

  // Each main-session request goes out at the rung the task stands on: its effort, on the task's model (the session's
  // unless the person took a model offer or the Main Flow moved it), and Fable 5.1 once it climbed there. The
  // session's own effort and model are kept for the band, and what went out for the turn's history entry.
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
    if (e.agentId === undefined) {
      try {
        // The session's own effort: none on a model that takes none.
        const carried = isEffort(e.effort) ? e.effort : null
        if ((await read($, sessionEffort)) !== carried && (carried || supportedEfforts(e.model).length === 0)) await update($, sessionEffort, () => carried)
        if ((await read($, sessionModel)) !== e.model) await update($, sessionModel, () => e.model)
        if (await read($, isOn)) {
          // While a new prompt's score is on its way, the task under way is not yet known to go on: the request keeps
          // its model, Fable 5.1 included, so the prompt cache holds, and leaves its effort for the session's own.
          const under = await read($, task)
          const t = (await read($, isScoring)) ? { ...FRESH_TASK, model: under.model, isOnFable: under.isOnFable || !!under.climbed?.isFable, effort: carried } : under
          const runsOn = taskModel(t, e.model) ?? e.model
          const rung = rungOf(t, null, runsOn)
          // The task's model: the one the person chose for it, or Fable 5.1 once it climbed there.
          const model = rung?.isFable ? (isFable(runsOn) ? runsOn : FABLE_MODEL) : runsOn
          // The rung's effort when the model takes efforts and the request carried one or moves to it; a model that
          // takes none goes without, as it came.
          const effort = rung && supportedEfforts(model).length > 0 && (carried || model !== e.model) ? rung.effort : null
          if (model !== e.model || (effort && effort !== e.effort)) sent = { ...e, ...(effort ? { effort } : {}), ...(model !== e.model ? { model } : {}) }
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
          // What its requests carry, and on which model, so its climbs step through the efforts that model takes.
          if (!agent.climbed || agent.model !== model) await update($, agents, all => withAgent(all, id, { ...agent, model, ...(agent.climbed ? {} : { effort: carried }) }))
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
    // A sub-agent starts from the task's starting point: its own effort (or the session's) on its model. The main
    // session's climbs and the Fable 5.1 they reached are for its own stalls, not a new agent's search or plan. While
    // a new prompt's score is on its way, the task under way is not yet known to go on: only its model holds.
    const under = await read($, task)
    const t = (await read($, isScoring)) ? { ...FRESH_TASK, model: under.model } : under
    const own = await read($, sessionModel)
    const runsOn = taskModel(t, own)
    const startEffort = t.effort ?? (await read($, sessionEffort))
    const main = startEffort ? { effort: fitEffort(startEffort, runsOn) } : null
    // The task's model, named only when it is not the session's.
    const tier = tierOf(runsOn)
    const taskTier = tier !== tierOf(own) ? tier : null
    // A ticket handed to a sub-agent in the implement stage: it runs on the ticket's model and effort, on the task's
    // model when the ticket names none.
    const path = ticketIn(e.prompt)
    const number = path ? ticketOf(path) : null
    if (path && number && t.stage === 'implement') {
      const setting = await ticketSetting($, path)
      if (setting) {
        // Kept by this call's id until its agent starts: two hand-offs alike never mix, whatever their descriptions.
        const toolUseId = e.tool_use_id
        await update($, handed, all => ({ ...all, [toolUseId]: { ticket: number, ...setting } }))
        const model = setting.tier ?? taskTier
        const ran = await next({ ...e, effort: setting.effort, ...(model ? { model } : {}) })
        // A call refused, or failed, leaves nothing behind; one that started its agent was taken up as it started.
        if (ran.deny !== undefined || ran.isError === true) await dropHanded($, toolUseId)
        return ran
      }
    }
    const start = subAgentStart(e.subagent_type, main?.effort ?? null, taskTier)
    return next(start ? { ...e, ...start } : e)
  }).catch(($, e, next) => next(e))

  // Writing a test (Edit, Write) marks the red step: the next check is expected to fail once.
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await testWritten($, e.agentId, e.file_path)
    return ran
  }).catch(($, e, next) => next(e))
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await testWritten($, e.agentId, e.file_path)
    return ran
  }).catch(($, e, next) => next(e))

  // A sub-agent started for a ticket handed to it: from its first request it runs on the ticket's setting and climbs
  // from it, whatever its type. The spawn carries the Agent call's tool_use_id and answers the agent's own id.
  on('agent.spawn', async ($, e, next) => {
    const res = await next(e)
    const ticket = (await read($, handed))[e.tool_use_id]
    if (!ticket) return res
    await dropHanded($, e.tool_use_id)
    const id = res.agentId
    if (id) {
      const agent: SubAgent = { effort: ticket.effort, climbed: null, fails: 0, isClimbable: true, ticket: ticket.ticket, ...(ticket.tier ? { tier: ticket.tier } : {}) }
      await update($, agents, all => withAgent(all, id, agent))
    }
    return res
  }).catch(($, e, next) => next(e))

  // A check the main session ran: three failures in a row climb the task, a pass after a climb settles it, and a
  // stall at the top tells Claude to stop and ask the person. A sub-agent's check climbs its own effort, up to xhigh.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    // Printing a stage skill's SKILL.md (`cat …/to-spec/SKILL.md`) counts as reading it.
    await stageSign($, e.agentId, stageOfPath(e.command))
    const ran = await next(e)
    // Only a check whose exit is its own counts: a piped, hidden or backgrounded one says nothing either way.
    if (ran.deny !== undefined || checkRun(e.command, e.run_in_background === true) !== 'counted' || !(await read($, isOn))) return ran
    const id = e.agentId
    const passed = ran.isError !== true
    if (id !== undefined) {
      const agent = await subAgent($, id)
      if (!agent.isClimbable) return ran
      // The first failure after it wrote a test is the red step of test-first work: no stall.
      if (agent.isRed) {
        await update($, agents, all => withAgent(all, id, { ...agent, isRed: false }))
        if (!passed) return ran
      }
      // The family it climbs from: its ticket's, else the model its requests go out on, else the task's.
      const startTier: ModelTier = agent.tier ?? tierOf(agent.model ?? null) ?? tierOf(taskModel(await read($, task), await read($, sessionModel))) ?? 'opus'
      const after = agent.ticket ? afterTicketAgentCheck({ ...agent, isRed: false }, passed, startTier) : afterAgentCheck({ ...agent, isRed: false }, passed, agent.model ?? null)
      await update($, agents, all => withAgent(all, id, after))
      return ran
    }
    // The first failure after a test was written is the red step of test-first work: no stall.
    if (await read($, isRed)) {
      await update($, isRed, () => false)
      if (!passed) return ran
    }
    const own = await read($, sessionEffort)
    const model = taskModel(await read($, task), await read($, sessionModel))
    // A model that takes no effort has no ladder to climb: its checks change nothing.
    if (supportedEfforts(model).length === 0) return ran
    const out = afterCheck(await read($, task), ran.isError !== true, own, model)
    await setTask($, () => out.task)
    if (out.hasClimbed) await update($, turnLog, (log): TurnLog => ({ ...log, climbs: log.climbs + 1 }))
    if (out.hasReachedLadderEnd) await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: LADDER_END_NOTE }] } })
    return ran
  }).catch(($, e, next) => next(e))

  // A sub-agent's loop starts and ends: the band counts those at work.
  on('turn.start', async ($, e, next) => {
    const res = await next(e)
    if (e.agentId === undefined) await update($, isTurnRunning, () => true)
    const id = e.agentId
    if (id !== undefined) {
      await update($, running, ids => (ids.includes(id) ? ids : [...ids, id]))
      const now = await $.clock.now()
      await update($, seen, before => ({ ...before, [`agent:${id}`]: before[`agent:${id}`] ?? now }))
    }
    return res
  }).catch(($, e, next) => next(e))

  // The main session's turn ended: its entry joins the project's history, kept in the store.
  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    const done = e.agentId
    if (done !== undefined) {
      await update($, running, ids => ids.filter(id => id !== done))
      await update($, seen, before => Object.fromEntries(Object.entries(before).filter(([key]) => key !== `agent:${done}`)))
      return res
    }
    await update($, isTurnRunning, () => false)
    const ended = await read($, task)
    const entry = entryOf(ended, await read($, turnLog), await $.clock.now())
    await update($, turnLog, () => EMPTY_TURN)
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

  // /open-effort opens the pane; /open-effort on|off switches the mod for this project, a person's own command only.
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
    // Fable 5.1 once the task reached it, settled back or not: its requests stay there.
    const effortModel = onFable ? 'Fable 5.1' : modelName(model)
    const steps: Step[] = [
      source === 'stage'
        ? { title: words.steps.stage, value: `${t.stage ?? ''}${t.ticket ? ` · ${words.steps.ticket(t.ticket)}` : ''}`, state: 'done', rank: 1 }
        : t.skill
          ? { title: words.steps.skill, value: `${t.skill}${t.score ? ` · ${short(reason)}` : ''}`, state: 'done', rank: 1 }
          : { title: words.steps.read, value: source === 'score' ? short(reason) : words.steps.noScore, state: source === 'score' ? 'done' : 'idle', rank: 1 },
      {
        title: `${words.steps.effort} · ${effortModel}`,
        ...(t.climbed && t.effort ? { aside: words.steps.from(t.effort) } : {}),
        // What goes out: the effort fitted to the model, as the band's line says.
        value: rung?.effort ?? words.steps.own,
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
    // Sub-agents at work hang off the step at work as one node saying how many; their names follow, wrapping to the
    // band's width: buttons that open each agent's transcript, or labels where the surface cannot open one.
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
        const reason = res.deny
        // A surface with no main view (the desktop app) never will: the agents show as labels from then on.
        const isNever = /main view/i.test(reason)
        if (isNever) await update($, canView, () => false)
        $.ui.toast(isNever ? words.steps.viewUnavailable : words.steps.viewDenied(reason))
        await update($, seenLast, last => ({ ...last, view: reason }))
      }
    }
    // The desktop app has no main view to put an agent in: its agents are labels from the start. Elsewhere they are
    // buttons until a press finds the surface cannot open one.
    const isPressable = e.surface !== 'desktop' && (await read($, canView))
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
              {atWork.map(a => {
                const label = [
                  <Text key="mark" color={THEMES[picked].accent}>{'⑂ '}</Text>,
                  <Text key="type" bold>{cut(a.type, 24)}</Text>,
                  <Text key="what" dimColor>{` · ${cut(a.description, 32)}`}</Text>,
                ]
                return isPressable ? (
                  <Button key={`agent-${a.id}`} onPress={() => openAgent(a.id)}>
                    {label}
                  </Button>
                ) : (
                  <Box key={`agent-${a.id}`} borderStyle="round" borderDimColor paddingX={1}>
                    {label}
                  </Box>
                )
              })}
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
    const pickedFlowModel = await read($, flowModel)
    const picked = await read($, themeChoice)
    useTheme(picked)
    const ACCENT = THEMES[picked].accent

    const section = (title: string, ...rows: RenderChildren[]) => (
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
    const row = (label: string, control: RenderChildren) => (
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
    const Svg = e.surface !== 'terminal' && 'Svg' in table ? table.Svg : null
    const chart =
      Svg && list.length > 0
        ? historySvg(list, Math.max(120, e.props.bodyColumns * 8 - 40), {
            ...words.chart,
            tooltip: entry => `${clockTime(entry.at)} · ${words.entryTitle(entry)} · ${words.entry(entry)}`,
          })
        : null

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
          <Box flexDirection="column" gap={1}>
            <Text>{words.flowModel}</Text>
            {segmented(FLOW_MODELS.map(pick => ({ key: `flow-model-${pick}`, label: words.flowModels[pick], isPicked: pickedFlowModel === pick, onPress: () => setFlowModel($, pick) })))}
            <Text dimColor>{words.flowModelLimits[pickedFlowModel]}</Text>
          </Box>,
          ...(lacking.length > 0
            ? [
                <Box flexDirection="column">
                  <Text color="#ef4444">{words.missing(lacking)}</Text>
                  <Text dimColor>{words.install}</Text>
                  {INSTALL_COMMANDS.map(c => (
                    <Text key={c}>{c}</Text>
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
          ...(chart && Svg ? [<Svg source={chart.source} width={chart.width} height={chart.height} alt={words.history(list.length)} isInteractive />] : []),
          ...(list.length === 0 ? [<Text dimColor>{words.noHistory}</Text>] : []),
          // The terminal draws no chart: its last few turns as lines instead.
          ...(!chart
            ? list
                .slice(-5)
                .reverse()
                .map(entry => <Text key={String(entry.at)} dimColor>{`${clockTime(entry.at)} · ${words.entryTitle(entry)} · ${words.entry(entry)}`}</Text>)
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
