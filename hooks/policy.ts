import type { Clarity, Effort, ModelTier, Rung, Score, Size, Stage, SubAgent, Task, TicketSetting } from '../types'
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

/** Whether a model family is no more capable than another. */
export function isTierAtMost(tier: ModelTier, than: ModelTier): boolean {
  return TIERS.indexOf(tier) <= TIERS.indexOf(than)
}

const SIZES: readonly Size[] = ['none', 'small', 'borderline', 'large']

/** Whether work of a size is no larger than another. */
export function isSizeAtMost(size: Size, than: Size): boolean {
  return SIZES.indexOf(size) <= SIZES.indexOf(than)
}

/** The larger of two sizes; `a` absent, `b`. */
export function largerSize(a: Size | null, b: Size): Size {
  return a && SIZES.indexOf(a) > SIZES.indexOf(b) ? a : b
}

/** The model a task runs on: the one a climb moved it to, else the one the person chose for it, else the session's. */
export function taskModel(task: Task, sessionModel: string | null): string | null {
  return task.climbModel ?? task.model ?? sessionModel
}

/** The family one up from a model's; null at Fable, or for a model not known. */
export function tierAbove(model: string | null): ModelTier | null {
  const tier = tierOf(model)
  return tier ? (TIERS[TIERS.indexOf(tier) + 1] ?? null) : null
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
  climbModel: null,
  isClimbOffer: false,
  isClimbDeclined: false,
  stage: null,
  isFlowInvited: false,
  model: null,
  modelOffer: null,
  ticket: null,
  skill: null,
}

/** A task with no score yet: the session's own effort until something sets one. */
export const FRESH_TASK: Task = { score: null, effort: null, ...NEW_TASK }

/**
 * A task moved to a flow's stage: `effort`, the stage's, with the last stage's climb left behind, a model it climbed to
 * and a climb's offer included (a flow that runs on Fable keeps it); its score stays.
 */
export function enteredStage(task: Task, stage: Stage, effort: Effort): Task {
  return {
    ...task,
    stage,
    effort,
    climbed: null,
    isOnFable: isFable(task.model),
    ...(task.isClimbOffer ? { modelOffer: null, isClimbOffer: false } : {}),
    climbModel: null,
    isClimbDeclined: false,
    fails: 0,
    isAtLadderEnd: false,
    ticket: null,
    skill: null,
  }
}

/**
 * Work done directly, outside the flow, on which Claude used a stage's skill (code-review, tdd): the task keeps at
 * least `floor`, that stage's effort, from then on, a climb above it left in place, and moves to `model` when one is
 * given.
 */
export function usedStageSkill(task: Task, stage: Stage, floor: Effort, own: Effort | null, model: string | null): Task {
  const effort = atLeast(task.effort ?? own ?? floor, floor)
  // A climb that stands below the new effort is left behind; one above it, or on Fable 5.1, stays.
  const isBelow = !!task.climbed && !task.climbed.isFable && EFFORTS.indexOf(task.climbed.effort) <= EFFORTS.indexOf(effort)
  return {
    ...task,
    effort,
    ...(isBelow ? { climbed: null } : {}),
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
  // A climb made on another model (the person switched /model since) goes out as this one takes it.
  if (task.climbed) return task.climbed.isFable ? task.climbed : { ...task.climbed, effort: fitEffort(task.climbed.effort, model) }
  const effort = task.effort ?? own
  if (!effort) return null
  const onFable = task.isOnFable || isFable(model)
  // An effort the task's model does not take goes out as the nearest one it does.
  return { effort: onFable ? effort : fitEffort(effort, model), isFable: onFable }
}

/**
 * The rung above on the model the task runs on (`model`): the next effort it takes up to xhigh, or on Fable 5.1 up to
 * max; null at the top. A model one family up is never climbed to here: the person is asked first (afterCheck).
 */
export function rungAbove(rung: Rung, model: string | null = null): Rung | null {
  const at = EFFORTS.indexOf(rung.effort)
  if (rung.isFable) {
    const next = EFFORTS[at + 1]
    return next ? { effort: next, isFable: true } : null
  }
  // On the task's model the ladder goes no higher than xhigh, and only through the efforts that model takes.
  const next = supportedEfforts(model).find(effort => EFFORTS.indexOf(effort) > at && EFFORTS.indexOf(effort) <= EFFORTS.indexOf('xhigh'))
  return next ? { effort: next, isFable: false } : null
}

/** The effort a task starts at on a model a climb moved it to. */
export const CLIMB_MODEL_EFFORT: Effort = 'high'

/**
 * The person agreed to move a climbed task one family up, to `tier`: from then on it runs on that family's model, at
 * high and climbing from there (at max when `from`, the effort it stood at, was the max the person set), and keeps the
 * model to its end (in a flow, to the next stage or ticket).
 */
export function climbedTo(task: Task, tier: ModelTier, from: Effort | null = null): Task {
  const model = TIER_MODEL[tier]
  const onFable = tier === 'fable'
  return {
    ...task,
    climbModel: model,
    climbed: { effort: fitEffort(from === 'max' ? 'max' : CLIMB_MODEL_EFFORT, model), isFable: onFable },
    isOnFable: task.isOnFable || onFable,
    fails: 0,
    isAtLadderEnd: false,
    modelOffer: null,
    isClimbOffer: false,
  }
}

/**
 * A check's outcome on a task: a pass clears the count and settles a climbed task back to its starting point (on the
 * model it climbed to, if any); the third failure in a row climbs a rung. At the top effort of its model, the task
 * offers the person the model one family up (`offer`, the one time it is offered), unless they kept the model once
 * already or there is none above: then it reaches the ladder's end. `hasReachedLadderEnd` is true the one time the task
 * reaches the ladder's end.
 */
export function afterCheck(
  task: Task,
  passed: boolean,
  own: Effort | null,
  model: string | null,
): { task: Task; hasClimbed: boolean; hasReachedLadderEnd: boolean; offer: ModelTier | null } {
  const unmoved = { hasClimbed: false, hasReachedLadderEnd: false, offer: null }
  if (passed) return { task: { ...task, climbed: null, fails: 0, isAtLadderEnd: false }, ...unmoved }
  const fails = task.fails + 1
  if (fails < FAILS_TO_STALL) return { task: { ...task, fails }, ...unmoved }
  const here = rungOf(task, own ?? 'medium', model) ?? { effort: 'medium', isFable: false }
  const above = rungAbove(here, model)
  // An unscored task keeps the effort it climbed from as its starting point, so it can settle back to it.
  const effort = task.effort ?? (task.climbed ? null : here.effort)
  if (above) return { task: { ...task, effort, climbed: above, fails: 0, isOnFable: task.isOnFable || above.isFable }, hasClimbed: true, hasReachedLadderEnd: false, offer: null }
  const up = here.isFable || task.isClimbDeclined ? null : tierAbove(model)
  // An offer already waiting for the person's answer is not made again.
  if (up && task.isClimbOffer && task.modelOffer) return { task: { ...task, effort, fails: 0 }, ...unmoved }
  if (up) return { task: { ...task, effort, fails: 0, modelOffer: up, isClimbOffer: true }, ...unmoved, offer: up }
  return { task: { ...task, effort, fails: 0, isAtLadderEnd: true }, hasClimbed: false, hasReachedLadderEnd: !task.isAtLadderEnd, offer: null }
}

/** How high a sub-agent's own stalls climb its effort (max on a model without it); its model never changes. */
const SUB_AGENT_TOP: Effort = 'xhigh'

/** The next effort above `here`, up to `top`, that `model` takes; null when there is none. */
function effortAbove(here: Effort, top: Effort, model: string | null): Effort | null {
  return supportedEfforts(model).find(e => EFFORTS.indexOf(e) > EFFORTS.indexOf(here) && EFFORTS.indexOf(e) <= EFFORTS.indexOf(top)) ?? null
}

/**
 * What a sub-agent of a built-in type starts with: Explore on Haiku at low, Plan at high and general-purpose (the
 * type when none is named) at the main session's current effort. Plan and general-purpose run on the task's model:
 * `taskTier` is its family when it is not the session's (the flow's Opus 5.5, an accepted offer, Fable 5.1), else
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

/**
 * A check a sub-agent ran: a pass clears the count; the third failure in a row climbs its effort to the next one that
 * `model`, the one it runs on, takes, up to xhigh. A model that takes max but no xhigh (Opus and Sonnet 4.6) climbs
 * from high to max in its place, since the sub-agent's model never changes; with neither, it stays.
 */
export function afterAgentCheck(agent: SubAgent, passed: boolean, model: string | null): SubAgent {
  if (passed) return { ...agent, fails: 0 }
  const fails = agent.fails + 1
  if (fails < FAILS_TO_STALL) return { ...agent, fails }
  const here = agent.climbed ?? agent.effort ?? 'medium'
  const takes = supportedEfforts(model)
  const top = !takes.includes(SUB_AGENT_TOP) && takes.includes('max') ? 'max' : SUB_AGENT_TOP
  return { ...agent, climbed: effortAbove(here, top, model) ?? agent.climbed, fails: 0 }
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

/**
 * The main session takes up a ticket in the stage that works tickets: its effort, a fresh count of checks; the task's model
 * stays, and Fable 5.1 a climb on the last ticket reached is left behind.
 */
export function enteredTicket(task: Task, ticket: string, effort: Effort): Task {
  return {
    ...task,
    ticket,
    effort,
    climbed: null,
    fails: 0,
    isAtLadderEnd: false,
    isOnFable: isFable(task.model),
    ...(task.isClimbOffer ? { modelOffer: null, isClimbOffer: false } : {}),
    climbModel: null,
    isClimbDeclined: false,
  }
}

/**
 * A check a ticket's sub-agent ran: a pass clears the count; the third failure in a row climbs it, its effort first
 * up to xhigh through the efforts its model takes, then its model one family up at high, as far as Opus: a sub-agent
 * cannot ask the person, and Fable 5.1 is only ever reached with their yes. A ticket that names Fable climbs to max.
 * At the top it stays, and its work goes back to Claude.
 */
export function afterTicketAgentCheck(agent: SubAgent, passed: boolean, startTier: ModelTier): SubAgent {
  if (passed) return { ...agent, fails: 0 }
  const fails = agent.fails + 1
  if (fails < FAILS_TO_STALL) return { ...agent, fails }
  const tier = agent.tier ?? startTier
  const here = agent.climbed ?? agent.effort ?? 'medium'
  const next = effortAbove(here, tier === 'fable' ? 'max' : 'xhigh', TIER_MODEL[tier])
  if (next) return { ...agent, tier, climbed: next, fails: 0 }
  const up = TIERS[TIERS.indexOf(tier) + 1]
  return up && up !== 'fable' ? { ...agent, tier: up, climbed: 'high', fails: 0 } : { ...agent, fails: 0 }
}

/** The model the flow runs on: the frontier model, Fable 5.1, or the session's own. */
export type FlowModel = 'frontier' | 'fable' | 'session'

export const FLOW_MODELS: readonly FlowModel[] = ['frontier', 'fable', 'session']

/** Today's frontier model, the flow's default: the strongest generally used model below Fable. */
export const FRONTIER_MODEL = 'claude-opus-5-5'

export function isFlowModel(value: unknown): value is FlowModel {
  return typeof value === 'string' && (FLOW_MODELS as readonly string[]).includes(value)
}

/**
 * The model a task moves to as it enters the flow: the one picked for the flow, when it is above the model the
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
