import type { CommandInfo } from 'claude-code'

import type { Size, Stage } from '../types'

/** The plugin Matt Pocock's skills come in, and the skills its Main Flow runs, in order. */
export const MATT_PLUGIN = 'mattpocock-skills'
export const MAIN_FLOW_SKILLS = ['grill-with-docs', 'to-spec', 'to-tickets', 'implement', 'code-review', 'retro'] as const

/** What the person runs to install the plugin; the mod never runs them. */
export const INSTALL_COMMANDS = ['claude plugin marketplace add mattpocock/skills', 'claude plugin install mattpocock-skills@mattpocock'] as const

/** The Main Flow skills missing from the session's commands: only the plugin's own count, not Claude Code's code-review. */
export function missingSkills(commands: readonly CommandInfo[]): string[] {
  const installed = new Set(
    commands.filter(c => c.plugin === MATT_PLUGIN || c.name.startsWith(`${MATT_PLUGIN}:`)).map(c => c.name.replace(`${MATT_PLUGIN}:`, '')),
  )
  return MAIN_FLOW_SKILLS.filter(skill => !installed.has(skill))
}

export const STAGES: readonly Stage[] = ['grill', 'spec', 'tickets', 'implement', 'review', 'retro']

/** The stage each of Matt Pocock's skills runs; tdd and implement-spec are part of implementing. */
const SKILL_STAGE: Readonly<Record<string, Stage>> = {
  'grill-with-docs': 'grill',
  'to-spec': 'spec',
  'to-tickets': 'tickets',
  implement: 'implement',
  'implement-spec': 'implement',
  tdd: 'implement',
  'code-review': 'review',
  retro: 'retro',
}

/**
 * The stage a skill or command name runs: `mattpocock-skills:<skill>`, or the bare skill name for all but
 * code-review, which bare is Claude Code's own.
 */
export function stageOfSkill(name: string): Stage | null {
  const prefixed = name.startsWith(`${MATT_PLUGIN}:`)
  const skill = prefixed ? name.slice(MATT_PLUGIN.length + 1) : name
  if (!prefixed && skill === 'code-review') return null
  return SKILL_STAGE[skill] ?? null
}

/**
 * Whether a stage command the person types starts the Main Flow by itself: every stage's skill but tdd, which people
 * also run on its own and which counts as the implement stage only inside the flow.
 */
export function startsFlow(name: string): boolean {
  return stageOfSkill(name) !== null && !/(^|:)tdd$/.test(name)
}

// A stage skill's SKILL.md inside the installed plugin: …/mattpocock-skills/<version>/skills/<group>/<skill>/SKILL.md
const SKILL_FILE = new RegExp(`${MATT_PLUGIN}/[^\\s'"]*?/skills/[^\\s'"/]+/([a-z-]+)/SKILL\\.md`)

/** The stage whose SKILL.md a path or a command names; null for any other. */
export function stageOfPath(text: string): Stage | null {
  const skill = SKILL_FILE.exec(text)?.[1]
  return skill ? (SKILL_STAGE[skill] ?? null) : null
}

/** The tool Claude announces each stage with, as listed for the model. */
export const STAGE_TOOL = 'mcp__open-effort__stage'

export const STAGE_TOOL_SPEC = {
  name: 'stage',
  description:
    'open-effort: announce the Main Flow stage you are starting (grill, spec, tickets, implement, review, retro), or "done" when the flow ends or is dropped. Each stage sets the effort Claude works at.',
  inputSchema: {
    type: 'object',
    properties: { stage: { type: 'string', enum: [...STAGES, 'done'] } },
    required: ['stage'],
  },
  isDeferred: false as const,
}

/** Where a new task goes: a question for the person first (the Main Flow or directly), or normal mode. */
export type Route = 'ask' | 'normal'

/**
 * Large or borderline work asks the person once whether to take the Main Flow, when it is available; all else is
 * normal. Nothing goes in unasked: Haiku's readings waver too much for that.
 */
export function routeOf(size: Size, isAvailable: boolean): Route {
  return isAvailable && (size === 'large' || size === 'borderline') ? 'ask' : 'normal'
}

const HOW_TO_RUN = [
  "Most of its skills are user-invoked, so do not call them with the Skill tool: for each stage, read that skill's SKILL.md in the installed mattpocock-skills plugin (under ~/.claude/plugins/cache/mattpocock/mattpocock-skills/) and follow it.",
  'Start with the grill stage (grill-with-docs). After each stage, go on to the next one (to-spec, to-tickets, implement, code-review, retro) without waiting to be asked; stop only for what the stage itself asks of the person.',
  `As you start each stage, call ${STAGE_TOOL} with its name (grill, spec, tickets, implement, review, retro); call it with "done" when the flow ends or the person drops it.`,
].join(' ')

/** Sent when the person starts the Main Flow with a stage's own command: how to move on in it, and how to leave it. */
export function flowStartedNote(stage: Stage): string {
  return [
    `[open-effort] The person typed the ${stage} stage's command, so Matt Pocock's Main Flow is on at that stage: requests run at its effort and on its model.`,
    `If you go on to another stage, call ${STAGE_TOOL} with its name as you start it.`,
    `Call ${STAGE_TOOL} with "done" once this stage's work is finished and the person did not ask for the rest of the flow, or when the person drops it; until then every request stays in the flow.`,
  ].join('\n')
}

/** Sent with large or borderline work: Claude asks the person once, then runs the Main Flow if they choose it. */
export const ASK_NOTE = [
  "[open-effort] This request asks for more than a small change. Before any work, ask the person once with AskUserQuestion whether to take it through Matt Pocock's Main Flow (grill, spec, tickets, implement, review, retro) or to do it directly. Put the option you recommend first, marked as recommended: recommend the Main Flow when the change spans several files, needs new tests, or touches auth, money or data.",
  `If they choose the Main Flow: ${HOW_TO_RUN}`,
].join('\n')

/** The tool Claude reports the person's answer through, when the mod offered a more capable model for a task. */
export const MODEL_TOOL_SPEC = {
  name: 'model',
  description:
    'open-effort: report the person\'s answer to the model offer: "up" to run this task on the more capable model offered, "keep" to stay on the session\'s model. Call it only after the person answered.',
  inputSchema: {
    type: 'object',
    properties: { choice: { type: 'string', enum: ['up', 'keep'] } },
    required: ['choice'],
  },
  isDeferred: false as const,
}

/** The note asking Claude to offer the person a more capable model for the task. */
export function modelNote(offered: string, own: string): string {
  return [
    `[open-effort] Haiku judged this request needs ${offered}, a more capable model than this session's ${own}.`,
    `Before any work, ask the person once with AskUserQuestion whether to run this task on ${offered} (first option, marked as recommended) or keep ${own}; say that ${offered} costs more.`,
    'If you also ask about the Main Flow, ask both in the same AskUserQuestion call.',
    'Then call mcp__open-effort__model with their answer: "up" or "keep".',
  ].join('\n')
}

/** Sent as the tickets stage starts: every ticket names the model and effort it needs. */
export const TICKET_NOTE = [
  '[open-effort] Near the top of every ticket you write, put two lines: `Model:` (haiku, sonnet, opus or fable) and `Effort:` (low, medium, high or xhigh).',
  'Model: the least capable model that does the ticket well: haiku for text or trivial edits; sonnet for well-scoped everyday work (UI, styling, config, simple reads and writes); opus for business rules, calculations, state changes, work across many files, and anything touching auth, money, personal data, migrations or concurrency; fable only for the hardest reasoning, where opus would struggle.',
  'Effort: low when the change can be described in one sentence and the way is known; medium for well-scoped work; high when the way needs thought; xhigh for unusually hard work (concurrency, migrations, security-sensitive logic, elusive bugs). Not max.',
  'When unsure, pick the higher. The person reviews these lines with the tickets: a sub-agent handed a ticket runs on both, and when you work a ticket yourself you take its effort and keep your model.',
].join('\n')

/** Sent as the implement stage starts: how a ticket's model and effort reach the work. */
export const IMPLEMENT_NOTE = [
  "[open-effort] Read a ticket's file before you work it yourself: its Effort line sets your effort for it.",
  "When you hand a ticket to a sub-agent, name the ticket's file path in the Agent prompt and leave model and effort unset: open-effort sets both from the ticket.",
].join('\n')
