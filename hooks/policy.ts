import type { Clarity, Effort, ModelTier, Rung, Score, Stage, SubAgent, Task, TicketSetting } from '../types'
import { MODEL_TIERS as TIERS, isUnsure } from './score'

export const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

export function isEffort(value: unknown): value is Effort {
  return EFFORTS.includes(value as Effort)
}

// How clear the plan is sets the effort; Anthropic's guidance: low when the plan is clear, medium for well-scoped work.
const CLARITY_EFFORT: Readonly<Record<Clarity, Effort>> = { clear: 'low', goal: 'medium', unclear: 'high' }

/** Risky work never starts below this. */
const RISK_FLOOR: Effort = 'medium'

/** Failing checks in a row on one rung that make a stall. */
export const FAILS_TO_STALL = 3


/** The model each family moves a task to: its current generation. */
export const TIER_MODEL: Readonly<Record<ModelTier, string>> = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
  fable: 'claude-fable-5-1',
}

/** The model a task moves to past the last effort rung on its own model. */
export const FABLE_MODEL = TIER_MODEL.fable

/** A model's family; null for one not known. */
export function tierOf(model: string | null): ModelTier | null {
  return TIERS.find(tier => model !== null && model.toLowerCase().includes(tier)) ?? null
}

/** The family to offer for a task: the one Haiku named when it is above the session model's; never a step down. */
export function modelUp(named: ModelTier | undefined, sessionModel: string | null): ModelTier | null {
  const own = tierOf(sessionModel)
  if (!named || own === null) return null
  return TIERS.indexOf(named) > TIERS.indexOf(own) ? named : null
}

/** The model a task runs on: the one the person chose for it, else the session's. */
export function taskModel(task: Task, sessionModel: string | null): string | null {
  return task.model ?? sessionModel
}

export function isFable(model: string | null): boolean {
  return model !== null && /fable/i.test(model)
}

function atLeast(effort: Effort, floor: Effort): Effort {
  return EFFORTS.indexOf(effort) < EFFORTS.indexOf(floor) ? floor : effort
}

/**
 * The efforts a model takes in `output_config.effort`, lowest first. Models of the current families take all five;
 * Opus and Sonnet 4.6 have no xhigh, Opus 4.5 stops at high, and Sonnet 4.5, Haiku 4.5 and older take none (the
 * request carries no effort, so the mod leaves it alone). A model not known here is taken to be current.
 */
export function supportedEfforts(model: string | null): readonly Effort[] {
  const id = (model ?? '').replace(/^.*?(claude-)/, '$1')
  if (/^claude-(opus|sonnet)-4-6/.test(id)) return ['low', 'medium', 'high', 'max']
  if (/^claude-opus-4-5/.test(id)) return ['low', 'medium', 'high']
  if (/^claude-(sonnet|haiku)-4-5|^claude-(3|[a-z]+-[0-3])\b|^claude-[a-z]+-4-[0-4]\b|^claude-[a-z]+-4-20/.test(id)) return []
  return EFFORTS
}

/** `effort` if the model takes it; else the nearest it takes below, else the lowest it takes; unchanged if it takes none. */
export function fitEffort(effort: Effort, model: string | null): Effort {
  const takes = supportedEfforts(model)
  if (takes.length === 0 || takes.includes(effort)) return effort
  const at = EFFORTS.indexOf(effort)
  return [...takes].reverse().find(e => EFFORTS.indexOf(e) < at) ?? takes[0] ?? effort
}

/** An effort moved `by` notches, held between low and max. */
export function notch(effort: Effort, by: number): Effort {
  const at = Math.min(Math.max(EFFORTS.indexOf(effort) + by, 0), EFFORTS.length - 1)
  return EFFORTS[at] ?? effort
}

/** A task's starting effort from its score: by clarity, xhigh when unusually hard, never below medium when risky; never max. */
export function startingEffort(score: Score): Effort {
  const effort = score.isHard ? 'xhigh' : CLARITY_EFFORT[score.clarity]
  // Risky work, or a reading Haiku is unsure of, never starts below medium.
  return score.isRisky || isUnsure(score) ? atLeast(effort, RISK_FLOOR) : effort
}

export const NEW_TASK: Omit<Task, 'score' | 'effort'> = {
  climbed: null,
  fails: 0,
  isOnFable: false,
  isAtLadderEnd: false,
  stage: null,
  isFlowInvited: false,
  model: null,
  modelOffer: null,
  ticket: null,
  skill: null,
}

/** A task with no score yet: the session's own effort until something sets one. */
export const FRESH_TASK: Task = { score: null, effort: null, ...NEW_TASK }

/** The effort each Main Flow stage starts at. */
export const STAGE_EFFORT: Readonly<Record<Stage, Effort>> = {
  grill: 'high',
  spec: 'high',
  tickets: 'medium',
  implement: 'high',
  review: 'xhigh',
  retro: 'medium',
}

/**
 * A task moved to a Main Flow stage: the stage's effort, with the last stage's climb left behind; its score and
 * Fable 5.1, once reached, stay.
 */
export function enteredStage(task: Task, stage: Stage): Task {
  return {
    ...task,
    stage,
    effort: STAGE_EFFORT[stage],
    climbed: null,
    fails: 0,
    isAtLadderEnd: false,
    ticket: null,
    skill: null,
  }
}

/**
 * Work done directly, outside the Main Flow, on which Claude used a stage's skill (code-review, tdd): the task keeps at
 * least that stage's effort from then on, a climb above it left in place, and moves to `model` when one is given.
 */
export function usedStageSkill(task: Task, stage: Stage, own: Effort | null, model: string | null): Task {
  const floor = STAGE_EFFORT[stage]
  const effort = atLeast(task.effort ?? own ?? floor, floor)
  return {
    ...task,
    effort,
    skill: stage,
    ...(model ? { model, isOnFable: task.isOnFable || isFable(model) } : {}),
  }
}

/**
 * Where a task stands: the rung a stall moved it to, else its starting point (its own effort, else `own`, the
 * session's), on Fable 5.1 once it reached it or when `model`, the one the task runs on, is Fable; null with no
 * effort to stand on.
 */
export function rungOf(task: Task, own: Effort | null, model: string | null): Rung | null {
  if (task.climbed) return task.climbed
  const effort = task.effort ?? own
  if (!effort) return null
  const onFable = task.isOnFable || isFable(model)
  // An effort the task's model does not take goes out as the nearest one it does.
  return { effort: onFable ? effort : fitEffort(effort, model), isFable: onFable }
}

/**
 * The rung above: the next effort up to xhigh on `model`, the one the task runs on, then Fable 5.1 at high, xhigh
 * and max (on a task already on Fable, its max); null at the top. Max on the task's model, which only the person's
 * own session effort brings, climbs to Fable at max.
 */
export function rungAbove(rung: Rung, model: string | null = null): Rung | null {
  const at = EFFORTS.indexOf(rung.effort)
  if (rung.isFable) {
    const next = EFFORTS[at + 1]
    return next ? { effort: next, isFable: true } : null
  }
  // On the task's model the ladder goes no higher than xhigh, and only through the efforts that model takes.
  const next = supportedEfforts(model).find(effort => EFFORTS.indexOf(effort) > at && EFFORTS.indexOf(effort) <= EFFORTS.indexOf('xhigh'))
  return next ? { effort: next, isFable: false } : { effort: rung.effort === 'max' ? 'max' : 'high', isFable: true }
}

/**
 * A check's outcome on a task: a pass clears the count and settles a climbed task back to its starting point (on
 * Fable if it reached it); the third failure in a row climbs a rung, or at the top reaches the ladder's end.
 * `hasReachedLadderEnd` is true the one time the task reaches the ladder's end.
 */
export function afterCheck(
  task: Task,
  passed: boolean,
  own: Effort | null,
  model: string | null,
): { task: Task; hasClimbed: boolean; hasReachedLadderEnd: boolean } {
  const unmoved = { hasClimbed: false, hasReachedLadderEnd: false }
  if (passed) return { task: task.climbed ? { ...task, climbed: null, fails: 0, isAtLadderEnd: false } : { ...task, fails: 0 }, ...unmoved }
  const fails = task.fails + 1
  if (fails < FAILS_TO_STALL) return { task: { ...task, fails }, ...unmoved }
  const here = rungOf(task, own ?? 'medium', model) ?? { effort: 'medium', isFable: false }
  const above = rungAbove(here, model)
  // An unscored task keeps the effort it climbed from as its starting point, so it can settle back to it.
  const effort = task.effort ?? (task.climbed ? null : here.effort)
  if (!above) return { task: { ...task, effort, fails: 0, isAtLadderEnd: true }, hasClimbed: false, hasReachedLadderEnd: !task.isAtLadderEnd }
  return { task: { ...task, effort, climbed: above, fails: 0, isOnFable: task.isOnFable || above.isFable }, hasClimbed: true, hasReachedLadderEnd: false }
}

/** How high a sub-agent's own stalls climb its effort; its model never changes. */
const SUB_AGENT_TOP: Effort = 'xhigh'

/**
 * What a sub-agent of a built-in type starts with: Explore on Haiku at low, Plan at high and general-purpose (the
 * type when none is named) at the main session's current effort. Plan and general-purpose run on the task's model:
 * `taskTier` is its family when it is not the session's (the Main Flow's Opus 5.5, an accepted offer, Fable 5.1), else
 * null and the sub-agent keeps the session's. Any other type is the person's own and gets null: left as it is.
 */
export function subAgentStart(type: string | undefined, main: Effort | null, taskTier: ModelTier | null = null): { model?: ModelTier; effort?: Effort } | null {
  const model = taskTier ? { model: taskTier } : {}
  if (type === 'Explore') return { model: 'haiku', effort: 'low' }
  if (type === 'Plan') return { ...model, effort: 'high' }
  if (type === undefined || type === 'general-purpose') return main ? { ...model, effort: main } : taskTier ? model : null
  return null
}

/** The sub-agent types the mod sets and climbs; any other is the person's own. */
export function isBuiltInAgent(type: string | undefined): boolean {
  return type === 'Explore' || type === 'Plan' || type === 'general-purpose'
}

/** A check a sub-agent ran: a pass clears the count; the third failure in a row climbs its effort a notch, up to xhigh. */
export function afterAgentCheck(agent: SubAgent, passed: boolean): SubAgent {
  if (passed) return { ...agent, fails: 0 }
  const fails = agent.fails + 1
  if (fails < FAILS_TO_STALL) return { ...agent, fails }
  const here = agent.climbed ?? agent.effort ?? 'medium'
  const top = EFFORTS.indexOf(SUB_AGENT_TOP)
  const climbed = EFFORTS.indexOf(here) < top ? notch(here, 1) : agent.climbed
  return { ...agent, climbed, fails: 0 }
}

/** A ticket file as /to-tickets names one: `<feature>/issues/03-coupon-rules.md`; its number is `03`. */
const TICKET_FILE = /\/issues\/(\d+)-[^/\s]+\.md$/

/** The number of the ticket a path is; null for any other file. */
export function ticketOf(path: string): string | null {
  return TICKET_FILE.exec(path)?.[1] ?? null
}

/** The first ticket file a sub-agent's prompt names, as Claude hands one ticket to each; null for none. */
export function ticketIn(prompt: string): string | null {
  for (const word of prompt.split(/[\s'"`()[\]<>]+/)) {
    // A path that ends a sentence or a clause: `…/03-rules.md.` or `…/03-rules.md,`.
    const path = word.replace(/[.,;:!?]+$/, '')
    if (TICKET_FILE.test(path)) return path
  }
  return null
}

/** The value of a ticket's first `<name>:` line (bold or a list bullet allowed), lower-cased; undefined for none. */
function lineValue(text: string, name: string): string | undefined {
  const line = new RegExp(`^[ \\t]*(?:[-*+][ \\t]+)?(?:\\*\\*)?${name}(?:\\*\\*)?[ \\t]*:(.*)$`, 'i')
  for (const row of text.split(/\r?\n/)) {
    const m = line.exec(row)
    if (m) return m[1]?.toLowerCase()
  }
  return undefined
}

/**
 * What a ticket names for itself: the model family first named on its `Model:` line (`Opus 5.5` and
 * `claude-opus-5-5` both read as opus) and the effort on its `Effort:` line (`extra high` is xhigh); each absent
 * when its line is, and Haiku reads the ticket for what is missing.
 */
export function ticketLinesOf(text: string): Partial<TicketSetting> {
  const tier = new RegExp(TIERS.join('|')).exec(lineValue(text, 'model') ?? '')?.[0] as ModelTier | undefined
  const named = /\b(x[-\s]?high|extra[-\s]?high|low|medium|high|max)\b/.exec(lineValue(text, 'effort') ?? '')?.[1]
  const effort: Effort | undefined = !named ? undefined : named.startsWith('x') || named.startsWith('extra') ? 'xhigh' : (named as Effort)
  return { ...(tier ? { tier } : {}), ...(effort ? { effort } : {}) }
}

/** The main session takes up a ticket in the implement stage: its effort, a fresh count of checks; its model stays. */
export function enteredTicket(task: Task, ticket: string, effort: Effort): Task {
  return { ...task, ticket, effort, climbed: null, fails: 0, isAtLadderEnd: false }
}

/**
 * A check a ticket's sub-agent ran: a pass clears the count; the third failure in a row climbs it, its effort first
 * up to xhigh through the efforts its model takes, then its model one family up at high, and on Fable 5.1 to max.
 * At the top it stays.
 */
export function afterTicketAgentCheck(agent: SubAgent, passed: boolean, startTier: ModelTier): SubAgent {
  if (passed) return { ...agent, fails: 0 }
  const fails = agent.fails + 1
  if (fails < FAILS_TO_STALL) return { ...agent, fails }
  const tier = agent.tier ?? startTier
  const here = agent.climbed ?? agent.effort ?? 'medium'
  const top = tier === 'fable' ? 'max' : 'xhigh'
  const next = supportedEfforts(TIER_MODEL[tier]).find(e => EFFORTS.indexOf(e) > EFFORTS.indexOf(here) && EFFORTS.indexOf(e) <= EFFORTS.indexOf(top))
  if (next) return { ...agent, tier, climbed: next, fails: 0 }
  const up = TIERS[TIERS.indexOf(tier) + 1]
  return up ? { ...agent, tier: up, climbed: 'high', fails: 0 } : { ...agent, fails: 0 }
}

/** The model the Main Flow runs on: the frontier model, Fable 5.1, or the session's own. */
export type FlowModel = 'frontier' | 'fable' | 'session'

export const FLOW_MODELS: readonly FlowModel[] = ['frontier', 'fable', 'session']

/** Today's frontier model, the Main Flow's default: the strongest generally used model below Fable. */
export const FRONTIER_MODEL = 'claude-opus-5-5'

export function isFlowModel(value: unknown): value is FlowModel {
  return typeof value === 'string' && (FLOW_MODELS as readonly string[]).includes(value)
}

/**
 * The model a task moves to as it enters the Main Flow: the one picked for the flow, when it is above the model the
 * task runs on; null to keep it (the session's own picked, or the task already on as capable a model).
 */
export function flowModelFor(pick: FlowModel, runsOn: string | null): string | null {
  if (pick === 'session') return null
  const target = pick === 'fable' ? FABLE_MODEL : FRONTIER_MODEL
  const own = tierOf(runsOn)
  const want = tierOf(target)
  if (own === null || want === null) return target
  return TIERS.indexOf(want) > TIERS.indexOf(own) ? target : null
}
