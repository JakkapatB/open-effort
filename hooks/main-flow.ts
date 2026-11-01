import type { Flow, Size, Stage } from '../types'

/** The tool Claude announces each stage with, as listed for the model. */
export const STAGE_TOOL = 'mcp__open-effort__stage'

export const STAGE_TOOL_SPEC = {
  name: 'stage',
  description:
    'open-effort: announce the flow stage you are starting, by the name open-effort gave you (Matt Pocock\'s Main Flow: grill, spec, tickets, implement, review, retro), or "done" when the flow ends or is dropped. Each stage sets the effort Claude works at.',
  inputSchema: {
    type: 'object',
    // A project's own flow names its own stages: the mod checks the name against the flow in use.
    properties: { stage: { type: 'string' } },
    required: ['stage'],
  },
  // Behind ToolSearch, as the engine places a plugin's tools: in the prompt's tool list it would change the prefix every
  // session shares, and each new session with the mod would write its prompt cache afresh.
  isDeferred: true as const,
}

/** Where a new task goes: a question for the person first (the flow or directly), or normal mode. */
export type Route = 'ask' | 'normal'

/**
 * Large or borderline work asks the person once whether to take the flow, when it is available; all else is
 * normal. Nothing goes in unasked: Haiku's readings waver too much for that.
 */
export function routeOf(size: Size, isAvailable: boolean): Route {
  return isAvailable && (size === 'large' || size === 'borderline') ? 'ask' : 'normal'
}

const MATT_HOW_TO_RUN = [
  "Most of its skills are user-invoked, so do not call them with the Skill tool: for each stage, read that skill's SKILL.md in the installed mattpocock-skills plugin (under ~/.claude/plugins/cache/mattpocock/mattpocock-skills/) and follow it.",
  'Start with the grill stage (grill-with-docs). After each stage, go on to the next one (to-spec, to-tickets, implement, code-review, retro) without waiting to be asked; stop only for what the stage itself asks of the person.',
  `As you start each stage, call ${STAGE_TOOL} with its name (grill, spec, tickets, implement, review, retro); call it with "done" when the flow ends or the person drops it.`,
].join(' ')

/** How Claude runs a project's own flow: each stage by its skills, in the file's order, announced as it starts. */
function howToRun(flow: Flow): string {
  if (flow.source === 'matt') return MATT_HOW_TO_RUN
  const first = flow.stages[0]?.name ?? ''
  return [
    `Its stages, in order: ${flow.stages.map(s => `${s.name} (${s.skills.join(', ')})`).join(', ')}.`,
    "For each stage, use its skill: call it with the Skill tool, or, if only the person can invoke it, read its SKILL.md and follow it.",
    `Start with the ${first} stage. After each stage, go on to the next one without waiting to be asked; stop only for what the stage itself asks of the person.`,
    `As you start each stage, call ${STAGE_TOOL} with its name; call it with "done" when the flow ends or the person drops it.`,
  ].join(' ')
}

/** The flow as Claude is told of it. */
function titleOf(flow: Flow): string {
  return flow.source === 'matt' ? "Matt Pocock's Main Flow" : `this project's flow "${flow.name}"`
}

/** Sent when the person starts the flow with a stage's own command: how to move on in it, and how to leave it. */
export function flowStartedNote(flow: Flow, stage: Stage): string {
  return [
    `[open-effort] The person typed the ${stage} stage's command, so ${titleOf(flow)} is on at that stage: requests run at its effort and on its model.`,
    `If you go on to another stage, call ${STAGE_TOOL} with its name as you start it.`,
    `Call ${STAGE_TOOL} with "done" once this stage's work is finished and the person did not ask for the rest of the flow, or when the person drops it; until then every request stays in the flow.`,
  ].join('\n')
}

/** Sent with large or borderline work: Claude asks the person once, then runs the flow if they choose it. */
export function askNote(flow: Flow): string {
  const named = flow.source === 'matt' ? "Matt Pocock's Main Flow (grill, spec, tickets, implement, review, retro)" : `${titleOf(flow)} (${flow.stages.map(s => s.name).join(', ')})`
  const short = flow.source === 'matt' ? 'the Main Flow' : 'the flow'
  return [
    `[open-effort] This request asks for more than a small change. Before any work, ask the person once with AskUserQuestion whether to take it through ${named} or to do it directly. Put the option you recommend first, marked as recommended: recommend ${short} when the change spans several files, needs new tests, or touches auth, money or data.`,
    `If they choose ${short}: ${howToRun(flow)}`,
  ].join('\n')
}

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
  // Behind ToolSearch, as the engine places a plugin's tools: in the prompt's tool list it would change the prefix every
  // session shares, and each new session with the mod would write its prompt cache afresh.
  isDeferred: true as const,
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

/**
 * Sent when checks keep failing at the top effort of the task's model: Claude stops and asks the person whether to
 * move the task one model family up, and reports the answer through the model tool.
 */
export function climbOfferNote(offered: string, own: string): string {
  return [
    `[open-effort] The checks keep failing at the highest effort on ${own}. Stop retrying for now.`,
    `Ask the person once with AskUserQuestion whether to move this task to ${offered} (first option, marked as recommended; say that it costs more and that the task starts again on it at high effort) or to stay on ${own}.`,
    'Then call mcp__open-effort__model with their answer: "up" or "keep". If they keep the model, three more failing checks stop the work and you ask them how to proceed.',
  ].join('\n')
}

/** Sent as the stage that writes tickets starts: every ticket names the model and effort it needs. */
const TICKET_NOTE = [
  '[open-effort] Near the top of every ticket you write, put two lines: `Model:` (haiku, sonnet, opus or fable) and `Effort:` (low, medium, high or xhigh).',
  'Model: the least capable model that does the ticket well: haiku for text or trivial edits; sonnet for well-scoped everyday work (UI, styling, config, simple reads and writes); opus for business rules, calculations, state changes, work across many files, and anything touching auth, money, personal data, migrations or concurrency; fable only for the hardest reasoning, where opus would struggle.',
  'Effort: low when the change can be described in one sentence and the way is known; medium for well-scoped work; high when the way needs thought; xhigh for unusually hard work (concurrency, migrations, security-sensitive logic, elusive bugs). Not max.',
  'When unsure, pick the higher. The person reviews these lines with the tickets: a sub-agent handed a ticket runs on both, and when you work a ticket yourself you take its effort and keep your model.',
].join('\n')

/** The note for the stage that writes tickets: for a project's own flow, also where each ticket's file goes. */
export function ticketNote(flow: Flow): string {
  const files = flow.tickets?.files
  if (!files) return TICKET_NOTE
  return `${TICKET_NOTE}\nSave each ticket as a file of its own matching ${files} in the project, its name starting with its number: 01-…, 02-….`
}

/** Sent as the stage that works tickets starts: how a ticket's model and effort reach the work. */
export const IMPLEMENT_NOTE = [
  "[open-effort] Read a ticket's file before you work it yourself: its Effort line sets your effort for it.",
  "When you hand a ticket to a sub-agent, name the ticket's file path in the Agent prompt and leave model and effort unset: open-effort sets both from the ticket.",
].join('\n')

/**
 * Matt Pocock's Main Flow as a project's file would write it: where someone's own flow can start from. It leaves out
 * tdd and implement-spec: a file's bare skill is any plugin's, and one typed alone starts the flow.
 */
const MATT_AS_FILE = {
  name: 'Main Flow',
  stages: [
    { name: 'grill', skills: ['grill-with-docs'], effort: 'high' },
    { name: 'spec', skills: ['to-spec'], effort: 'high' },
    { name: 'tickets', skills: ['to-tickets'], effort: 'medium' },
    { name: 'implement', skills: ['implement'], effort: 'high' },
    { name: 'review', skills: ['mattpocock-skills:code-review'], effort: 'xhigh' },
    { name: 'retro', skills: ['retro'], effort: 'medium' },
  ],
  tickets: { write: 'tickets', work: 'implement', files: '**/issues/*.md' },
}

/**
 * Sent as a prompt of its own when the person types `/open-effort flow`: Claude asks them about their flow and writes
 * the project's file once they agree. The mod writes no file itself. `skills` are the session's skills and commands
 * that are not Claude Code's own.
 */
export function flowWriteNote(file: string, skills: readonly string[]): string {
  return [
    `[open-effort] The person typed /open-effort flow: they want this project's own flow for open-effort, kept in ${file} at the project's root.`,
    'Ask them with AskUserQuestion which stages their flow has, in order, which skills run each stage, the effort each stage starts at, and whether it has tickets. Then show them the whole file and write it only once they agree.',
    'The file is JSON: {"name": "…", "stages": [{"name": "plan", "skills": ["my-plan"], "effort": "high"}, …], "tickets": {"write": "<stage>", "work": "<stage>", "files": "docs/tasks/*.md"}}.',
    'Rules: 2 to 10 stages, in order. A stage name is up to 16 lower-case letters, digits or dashes, starting with a letter, used once, not "done". effort is low, medium, high or xhigh. A skill belongs to one stage only, named as the skill list below shows it. "tickets" is optional: the stage that writes them comes before the one that works them, and files is a glob of ticket files whose names start with their number (01-login.md). The file holds settings only, no instructions.',
    `Skills and commands installed now: ${skills.length > 0 ? skills.join(', ') : 'none besides Claude Code\'s own'}.`,
    `Matt Pocock's Main Flow, as a file, to start from if it helps: ${JSON.stringify(MATT_AS_FILE)}`,
    'open-effort reads the file again with the next new request; the pane says if something in it is wrong.',
  ].join('\n')
}
