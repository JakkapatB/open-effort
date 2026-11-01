import type { CommandInfo } from 'claude-code'

import type { Effort, Flow, FlowStage, FlowTickets, Stage } from '../types'

/** Where a project keeps its own flow, from its root. */
export const FLOW_FILE = '.claude/open-effort.json'

/** The plugin Matt Pocock's skills come in. */
export const MATT_PLUGIN = 'mattpocock-skills'

/**
 * Matt Pocock's Main Flow, the flow a project without its own file uses. Its bare skills are the plugin's (`tdd` or
 * `mattpocock-skills:tdd`); its code-review is named with the plugin, as a bare `code-review` is Claude Code's own.
 */
export const MATT_FLOW: Flow = {
  name: 'Main Flow',
  source: 'matt',
  stages: [
    { name: 'grill', skills: ['grill-with-docs'], effort: 'high' },
    { name: 'spec', skills: ['to-spec'], effort: 'high' },
    { name: 'tickets', skills: ['to-tickets'], effort: 'medium' },
    { name: 'implement', skills: ['implement', 'implement-spec', 'tdd'], effort: 'high' },
    { name: 'review', skills: [`${MATT_PLUGIN}:code-review`], effort: 'xhigh' },
    { name: 'retro', skills: ['retro'], effort: 'medium' },
  ],
  tickets: { write: 'tickets', work: 'implement', files: null },
  plugin: MATT_PLUGIN,
  // People also run tdd on its own: it is the implement stage only inside the flow.
  quiet: ['tdd'],
  required: ['grill-with-docs', 'to-spec', 'to-tickets', 'implement', `${MATT_PLUGIN}:code-review`, 'retro'],
}

/** What the person runs to install Matt Pocock's plugin; the mod never runs them. */
export const INSTALL_COMMANDS = ['claude plugin marketplace add mattpocock/skills', 'claude plugin install mattpocock-skills@mattpocock'] as const

/** A skill's own name, without the plugin before it. */
function bare(name: string): string {
  return name.slice(name.lastIndexOf(':') + 1)
}

/** The plugin a skill's name starts with (`mattpocock-skills:tdd`); null for a bare name. */
function prefixOf(name: string): string | null {
  const at = name.indexOf(':')
  return at < 0 ? null : name.slice(0, at)
}

/**
 * Whether `name`, a skill or command as Claude Code names it, is the flow's skill `entry`. An entry named with its
 * plugin is that one alone; a bare entry is also any plugin's skill of that name, or only its own plugin's when the
 * flow has one.
 */
function isSkillOf(flow: Flow, entry: string, name: string): boolean {
  if (name === entry) return true
  if (entry.includes(':')) return false
  const owner = prefixOf(name)
  return owner !== null && bare(name) === entry && (flow.plugin === undefined || owner === flow.plugin)
}

/** The stage a skill or command name runs in the flow; null for any other. */
export function stageOfSkill(flow: Flow, name: string): Stage | null {
  return flow.stages.find(s => s.skills.some(entry => isSkillOf(flow, entry, name)))?.name ?? null
}

/** Whether a stage command the person types starts the flow by itself: every stage's skill but a quiet one. */
export function startsFlow(flow: Flow, name: string): boolean {
  return stageOfSkill(flow, name) !== null && !(flow.quiet ?? []).some(entry => isSkillOf(flow, entry, name))
}

// A skill's SKILL.md: …/<skill>/SKILL.md, and for Matt's inside his plugin: …/mattpocock-skills/<version>/skills/<group>/<skill>/SKILL.md
const SKILL_FILE = /([A-Za-z0-9_.-]+)\/SKILL\.md/g
const MATT_SKILL_FILE = new RegExp(`${MATT_PLUGIN}/[^\\s'"]*?/skills/[^\\s'"/]+/([a-z-]+)/SKILL\\.md`)

/**
 * The stage whose skill's SKILL.md a path or a command names; null for any other. A skill named with its plugin, or
 * of a flow with one, counts only inside that plugin's folder.
 */
export function stageOfPath(flow: Flow, text: string): Stage | null {
  if (flow.plugin !== undefined) {
    const skill = MATT_SKILL_FILE.exec(text)?.[1]
    return skill ? (flow.stages.find(s => s.skills.some(entry => bare(entry) === skill))?.name ?? null) : null
  }
  for (const m of text.matchAll(SKILL_FILE)) {
    const skill = m[1]
    const stage = flow.stages.find(s => s.skills.some(entry => bare(entry) === skill && (!entry.includes(':') || text.includes(`/${prefixOf(entry)}/`))))
    if (stage) return stage.name
  }
  return null
}

/** Whether a command the session lists is the flow's skill `entry`, as the plugin it comes from says. */
function isInstalled(flow: Flow, entry: string, command: CommandInfo): boolean {
  const owner = command.plugin ?? prefixOf(command.name)
  if (entry.includes(':')) return command.name === entry || (owner === prefixOf(entry) && bare(command.name) === bare(entry))
  return bare(command.name) === entry && (flow.plugin === undefined || owner === flow.plugin)
}

/**
 * The flow's skills missing from the session's commands; a flow with a plugin names them without it. A project's own
 * flow needs one skill of each stage, as a stage's skills are ways to run it: a stage with none lists them all.
 */
export function missingSkills(flow: Flow, commands: readonly CommandInfo[]): string[] {
  const has = (entry: string) => commands.some(c => isInstalled(flow, entry, c))
  if (flow.required) return flow.required.filter(entry => !has(entry)).map(entry => (flow.plugin ? bare(entry) : entry))
  return flow.stages.filter(s => !s.skills.some(has)).map(s => s.skills.join(' or '))
}

/** The effort a stage of the flow starts at; null for a stage it does not have. */
export function stageEffort(flow: Flow, stage: Stage): Effort | null {
  return flow.stages.find(s => s.name === stage)?.effort ?? null
}

/** The flow's last stage, where a reply goes on with it and new work ends it. */
export function lastStage(flow: Flow): Stage | null {
  return flow.stages.at(-1)?.name ?? null
}

/** A ticket file as Matt's /to-tickets names one: `<feature>/issues/03-coupon-rules.md`; its number is `03`. */
const MATT_TICKET_FILE = /\/issues\/(\d+)-[^/\s]+\.md$/

/** A glob as a pattern matching the end of a path: `*` within a folder, `**` across folders, `?` one character. */
function globPattern(glob: string): RegExp {
  let out = ''
  const g = glob.replace(/^\.\//, '')
  for (let i = 0; i < g.length; i++) {
    const c = g[i] ?? ''
    if (c === '*' && g[i + 1] === '*') {
      out += g[i + 2] === '/' ? '(?:[^/]+/)*' : '.*'
      i += g[i + 2] === '/' ? 2 : 1
    } else if (c === '*') out += '[^/]*'
    else if (c === '?') out += '[^/]'
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`(?:^|/)${out}$`)
}

/** The number of the flow's ticket a path is: a file where its tickets live, its name starting with it; null else. */
export function ticketOf(flow: Flow, path: string): string | null {
  const tickets = flow.tickets
  if (!tickets) return null
  if (tickets.files === null) return MATT_TICKET_FILE.exec(path)?.[1] ?? null
  if (!globPattern(tickets.files).test(path)) return null
  return /(?:^|\/)(\d+)-[^/]*$/.exec(path)?.[1] ?? null
}

/** The first of the flow's ticket files a sub-agent's prompt names, as Claude hands one ticket to each; null for none. */
export function ticketIn(flow: Flow, prompt: string): string | null {
  for (const word of prompt.split(/[\s'"`()[\]<>]+/)) {
    // A path that ends a sentence or a clause: `…/03-rules.md.` or `…/03-rules.md,`.
    const path = word.replace(/[.,;:!?]+$/, '')
    if (ticketOf(flow, path) !== null) return path
  }
  return null
}

const STAGE_NAME = /^[a-z][a-z0-9-]{0,15}$/
const SKILL_NAME = /^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)?$/
const STAGE_EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh']
const MIN_STAGES = 2
const MAX_STAGES = 10

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The first key of `value` not among `known`, said as the place it stands at; null when all are known. */
function unknownKey(value: Record<string, unknown>, known: readonly string[], at: string): string | null {
  const key = Object.keys(value).find(k => !known.includes(k))
  return key === undefined ? null : `${at}${at ? '.' : ''}${key} is not a setting open-effort knows`
}

/** One stage of the file, or what is wrong with it. */
function stageFrom(value: unknown, at: string): FlowStage | string {
  if (!isRecord(value)) return `${at} must be an object with name, skills and effort`
  const extra = unknownKey(value, ['name', 'skills', 'effort'], at)
  if (extra) return extra
  const { name, skills, effort } = value
  if (typeof name !== 'string' || !STAGE_NAME.test(name) || name === 'done') {
    return `${at}.name must be up to 16 lower-case letters, digits or dashes, starting with a letter (not "done")`
  }
  if (!Array.isArray(skills) || skills.length === 0 || !skills.every(s => typeof s === 'string' && SKILL_NAME.test(s))) {
    return `${at}.skills must list one or more skill names, as the skill list shows them (my-skill or plugin:my-skill)`
  }
  if (typeof effort !== 'string' || !(STAGE_EFFORTS as readonly string[]).includes(effort)) return `${at}.effort must be low, medium, high or xhigh`
  return { name, skills: skills as string[], effort: effort as Effort }
}

/** Where the file's tickets are written and worked, or what is wrong with it. */
function ticketsFrom(value: unknown, names: readonly string[]): FlowTickets | string {
  if (!isRecord(value)) return 'tickets must be an object with write, work and files'
  const extra = unknownKey(value, ['write', 'work', 'files'], 'tickets')
  if (extra) return extra
  const { write, work, files } = value
  if (typeof write !== 'string' || !names.includes(write)) return 'tickets.write must name the stage that writes the tickets'
  if (typeof work !== 'string' || !names.includes(work)) return 'tickets.work must name the stage that works the tickets'
  if (names.indexOf(write) >= names.indexOf(work)) return 'tickets.write must be a stage before tickets.work'
  if (typeof files !== 'string' || files.trim() === '' || files.trim().startsWith('/')) return 'tickets.files must be a glob inside the project, such as docs/tasks/*.md'
  return { write, work, files: files.trim() }
}

/**
 * A project's flow from its file's text, or what is wrong with it, said so the person can fix it. The file holds
 * settings only: a name, its stages in order (a name, the skills that run it, the effort it starts at) and, when the
 * flow has tickets, where they are written, worked and kept.
 */
export function flowFrom(text: string): { flow: Flow } | { problem: string } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { problem: 'it is not valid JSON' }
  }
  if (!isRecord(value)) return { problem: 'it must be a JSON object with name and stages' }
  const extra = unknownKey(value, ['name', 'stages', 'tickets'], '')
  if (extra) return { problem: extra }
  const { name, stages, tickets } = value
  if (typeof name !== 'string' || name.trim() === '' || name.length > 40) return { problem: 'name must be the flow\'s name, up to 40 characters' }
  if (!Array.isArray(stages) || stages.length < MIN_STAGES || stages.length > MAX_STAGES) return { problem: `stages must list ${MIN_STAGES} to ${MAX_STAGES} stages, in order` }
  const parsed: FlowStage[] = []
  for (const [i, raw] of stages.entries()) {
    const stage = stageFrom(raw, `stages[${i}]`)
    if (typeof stage === 'string') return { problem: stage }
    if (parsed.some(s => s.name === stage.name)) return { problem: `the stage name "${stage.name}" is used twice` }
    const twice = stage.skills.find(skill => stage.skills.indexOf(skill) !== stage.skills.lastIndexOf(skill))
    if (twice) return { problem: `the skill "${twice}" is listed twice in the stage "${stage.name}"` }
    const taken = stage.skills.find(skill => parsed.some(s => s.skills.includes(skill)))
    if (taken) return { problem: `the skill "${taken}" is in more than one stage` }
    parsed.push(stage)
  }
  const names = parsed.map(s => s.name)
  const where = tickets === undefined ? null : ticketsFrom(tickets, names)
  if (typeof where === 'string') return { problem: where }
  return { flow: { name: name.trim(), source: 'file', stages: parsed, tickets: where } }
}
