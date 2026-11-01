import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { flowFrom, ticketOf } from '../hooks/flow'
import { MATT_SKILLS, PRESENTATION, bandText, engine, paneText, request, start, type } from './engine'

const LARGE = 'clarity=unclear hard=no risky=no size=large sure=90'
const FILE = '.claude/open-effort.json'

/** A team's own flow: four stages, tickets written in tasks and worked in build, kept in docs/tasks. */
const TEAM = {
  name: 'Team flow',
  stages: [
    { name: 'plan', skills: ['my-plan'], effort: 'high' },
    { name: 'tasks', skills: ['my-tasks'], effort: 'medium' },
    { name: 'build', skills: ['my-build', 'tdd'], effort: 'low' },
    { name: 'check', skills: ['team-kit:my-review'], effort: 'xhigh' },
  ],
  tickets: { write: 'tasks', work: 'build', files: 'docs/tasks/*.md' },
}

/** The team's skills as the session lists them: three of the person's own, one in a plugin, and tdd in another. */
const TEAM_SKILLS = [{ name: 'my-plan' }, { name: 'my-tasks' }, { name: 'my-build' }, { name: 'tdd', plugin: 'other' }, { name: 'team-kit:my-review', plugin: 'team-kit' }]

const T2 = 'docs/tasks/02-login-form.md'
const TASKS = { [T2]: '# Login form\n\nModel: sonnet\nEffort: medium\n\nAdd the form.' }

async function stage($: Engine, name: string) {
  return $.tool.call({ tool: 'mcp__open-effort__stage', stage: name } as never)
}

/** A session in a project with the team's flow file, its skills installed. */
function teamEngine(on: Parameters<typeof engine>[0], options: Parameters<typeof engine>[1] = {}) {
  return engine(on, { haiku: LARGE, skills: TEAM_SKILLS, files: { [FILE]: JSON.stringify(TEAM), ...TASKS }, ...options })
}

/** The effort of a main-session request sent now. */
async function effortNow($: Engine, sent: { effort?: unknown }[], index = 0) {
  await request($, 'high', index)
  return sent[sent.length - 1]?.effort
}

/** The notes the mod added to the last prompt, joined. */
function notes(submitted: { context?: readonly string[] }[]): string {
  return (submitted[submitted.length - 1]?.context ?? []).join('\n')
}

test('a project’s flow file asks about its own flow, with its stages and skills, for large work', async ($, on) => {
  const { submitted } = teamEngine(on)
  await start($)
  await type($, 'add a login page with tests')

  const note = notes(submitted)
  expect(note).toContain('"Team flow"')
  expect(note).toContain('plan (my-plan)')
  expect(note).toContain('Start with the plan stage')
  expect(note).not.toContain('grill-with-docs')
})

test('each stage of a project’s flow sets the effort its file names', async ($, on) => {
  const { sent } = teamEngine(on)
  await start($)
  await type($, 'add a login page with tests')
  const efforts: unknown[] = []
  for (const [i, s] of TEAM.stages.entries()) {
    await stage($, s.name)
    efforts.push(await effortNow($, sent, i))
  }

  expect(efforts).toEqual(TEAM.stages.map(s => s.effort))
  expect(await bandText($)).toContain('Team flow: check')
})

test('the stage tool refuses a stage the project’s flow does not have', async ($, on) => {
  teamEngine(on)
  await start($)
  await type($, 'add a login page with tests')

  expect(JSON.stringify(await stage($, 'grill'))).toContain('must be one of plan, tasks, build, check')
})

test('a skill of a project’s flow, typed or called, sets its stage: bare names match any plugin’s, named ones only theirs', async ($, on) => {
  const { sent } = teamEngine(on)
  await start($)
  await $.prompt.submit({ text: '/my-plan', command: { name: 'my-plan', args: '' }, wait: false, origin: { kind: 'composer' } })
  expect(await effortNow($, sent)).toBe('high')
  await $.tool.call({ tool: 'Skill', skill: 'other:tdd' })
  await stage($, 'build')
  expect(await effortNow($, sent, 1)).toBe('low')
  // Another plugin's my-review is not the team's.
  await $.tool.call({ tool: 'Skill', skill: 'elsewhere:my-review' })
  expect(await effortNow($, sent, 2)).toBe('low')
  await $.tool.call({ tool: 'Skill', skill: 'team-kit:my-review' })
  expect(await effortNow($, sent, 3)).toBe('xhigh')
})

test('reading a project flow skill’s SKILL.md on direct work raises the effort to its stage’s', async ($, on) => {
  const { sent } = teamEngine(on, { haiku: 'clarity=clear hard=no risky=no size=small' })
  await start($)
  await type($, 'tidy the login copy')
  expect(await effortNow($, sent)).toBe('low')
  await $.tool.call({ tool: 'Read', file_path: '/work/app/.claude/skills/my-plan/SKILL.md' })

  expect(await effortNow($, sent, 1)).toBe('high')
})

test('a project’s flow writes tickets where its file says, and works them on their own settings', async ($, on) => {
  const { sent, calls } = teamEngine(on)
  const session = mock.session(on)
  await start($)
  await type($, 'add a login page with tests')
  await stage($, 'tasks')
  const written = session.appended().map(row => JSON.stringify(row.message)).join('\n')
  expect(written).toContain('Model:')
  expect(written).toContain('docs/tasks/*.md')

  await stage($, 'build')
  await $.tool.call({ tool: 'Read', file_path: `/work/app/${T2}` } as never)
  expect(await effortNow($, sent, 1)).toBe('medium')
  await $.tool.call({ tool: 'Agent', subagent_type: 'general-purpose', description: 'ticket 03', prompt: `Do /work/app/${T2}.`, tool_use_id: 'u1' } as never)
  const handed = calls.filter(c => c.tool === 'Agent').at(-1)
  expect([handed?.model, handed?.effort]).toEqual(['sonnet', 'medium'])
})

test('the project’s last stage is where a reply stays in the flow and new work ends it', async ($, on) => {
  const { sent } = teamEngine(on, { haiku: [LARGE, 'clarity=clear hard=no risky=no size=small continues=no'] })
  await start($)
  await type($, 'add a login page with tests')
  await stage($, 'check')
  await type($, 'rename the settings page')

  expect(await effortNow($, sent)).toBe('low')
  expect(await bandText($)).not.toContain('Team flow')
})

test('a flow file with a problem keeps the flow off and the pane says what is wrong', async ($, on) => {
  const broken = { ...TEAM, stages: [{ name: 'plan', skills: ['my-plan'], effort: 'max' }, TEAM.stages[1]] }
  const { submitted } = teamEngine(on, { files: { [FILE]: JSON.stringify(broken) } })
  await start($)
  await type($, 'add a login page with tests')

  expect(notes(submitted)).not.toContain('AskUserQuestion whether to take it')
  const pane = await paneText($)
  expect(pane).toContain('stages[0].effort must be low, medium, high or xhigh')
  expect(pane).not.toContain('Main Flow · from')
  expect(pane).not.toContain('Missing skills')
})

test('a flow file naming a skill not installed keeps the flow off, the pane listing it without Matt’s install lines', async ($, on) => {
  teamEngine(on, { skills: TEAM_SKILLS.filter(s => s.name !== 'my-tasks') })
  await start($)
  const pane = await paneText($)

  expect(pane).toContain('Missing skills: my-tasks')
  expect(pane).not.toContain('mattpocock/skills')
  expect(pane).toContain('Team flow · from .claude/open-effort.json')
})

test('a stage of a project’s flow needs one of its skills installed, not all', async ($, on) => {
  teamEngine(on, { skills: TEAM_SKILLS.filter(s => s.name !== 'my-build') })
  await start($)

  expect(await paneText($)).not.toContain('Missing skills')
})

test('new work typed in the last stage reads the flow file again before asking about the flow', async ($, on) => {
  const files: Record<string, string> = { [FILE]: JSON.stringify(TEAM) }
  const { submitted } = engine(on, { haiku: LARGE, skills: TEAM_SKILLS, files })
  await start($)
  await type($, 'add a login page with tests')
  await stage($, 'check')
  files[FILE] = JSON.stringify({ ...TEAM, name: 'Renamed flow' })
  await type($, 'add a signup page with tests')

  expect(notes(submitted)).toContain('"Renamed flow"')
})

test('a project without a flow file uses Matt Pocock’s Main Flow, as before', async ($, on) => {
  const { submitted } = engine(on, { haiku: LARGE, matt: MATT_SKILLS })
  await start($)
  await type($, 'add coupons to checkout')

  expect(notes(submitted)).toContain('grill-with-docs')
  expect(await paneText($)).toContain("Matt Pocock's Main Flow · built in")
})

test('an edited flow file counts from the next new task, not in a flow under way', async ($, on) => {
  const files: Record<string, string> = { [FILE]: JSON.stringify(TEAM) }
  const { sent } = engine(on, { haiku: LARGE, skills: TEAM_SKILLS, files })
  await start($)
  await type($, 'add a login page with tests')
  await stage($, 'plan')
  files[FILE] = JSON.stringify({ ...TEAM, stages: TEAM.stages.map(s => ({ ...s, effort: 'medium' })) })
  await type($, 'and keep the old layout')
  await stage($, 'tasks')
  await stage($, 'plan')

  expect(await effortNow($, sent)).toBe('high')
})

test('/open-effort flow has Claude ask the person and write the file, listing the installed skills', async ($, on) => {
  const { submitted } = engine(on, { skills: TEAM_SKILLS })
  await start($)
  const res = await $.command.run({ command: 'open-effort', args: 'flow', origin: { kind: 'composer' }, presentation: PRESENTATION })

  expect(res.text).toContain('.claude/open-effort.json')
  // The prompt goes in once the command is done, as its own turn.
  await new Promise(resolve => setTimeout(resolve, 150))
  const prompt = submitted.at(-1)?.text ?? ''
  expect(prompt).toContain('AskUserQuestion')
  expect(prompt).toContain('my-plan')
  expect(prompt).toContain('team-kit:my-review')
  expect(prompt).not.toContain('code-review,')
})

test('only the person can ask for their own flow', async ($, on) => {
  const { submitted } = engine(on)
  await start($)
  const res = await $.command.run({ command: 'open-effort', args: 'flow', origin: { kind: 'plugin', name: 'other' }, presentation: PRESENTATION })

  expect(res.text).toContain('only the person')
  expect(submitted).toEqual([])
})

test('a flow file is read for its settings only, and says what is wrong in a way the person can fix', () => {
  expect('flow' in flowFrom(JSON.stringify(TEAM))).toBe(true)
  const problems = [
    ['{', 'not valid JSON'],
    [JSON.stringify({ ...TEAM, notes: 'do this' }), 'notes is not a setting'],
    [JSON.stringify({ ...TEAM, stages: [TEAM.stages[0]] }), '2 to 10 stages'],
    [JSON.stringify({ ...TEAM, stages: [TEAM.stages[0], { ...TEAM.stages[1], name: 'plan' }] }), 'used twice'],
    [JSON.stringify({ ...TEAM, stages: [TEAM.stages[0], { ...TEAM.stages[1], skills: ['my-plan'] }] }), 'more than one stage'],
    [JSON.stringify({ ...TEAM, stages: [TEAM.stages[0], { ...TEAM.stages[1], name: 'Done Now' }] }), 'lower-case'],
    [JSON.stringify({ ...TEAM, tickets: { ...TEAM.tickets, write: 'build', work: 'tasks' } }), 'before tickets.work'],
    [JSON.stringify({ ...TEAM, tickets: { ...TEAM.tickets, files: '/etc/*.md' } }), 'inside the project'],
    [JSON.stringify({ ...TEAM, tickets: { ...TEAM.tickets, files: ' /etc/*.md' } }), 'inside the project'],
    [JSON.stringify({ ...TEAM, stages: [TEAM.stages[0], { ...TEAM.stages[1], skills: ['my-tasks', 'my-tasks'] }] }), 'listed twice'],
  ] as const
  for (const [text, said] of problems) {
    const parsed = flowFrom(text)
    expect('problem' in parsed ? parsed.problem : '').toContain(said)
  }
})

test('a project flow’s ticket is a file its glob matches whose name starts with its number', () => {
  const parsed = flowFrom(JSON.stringify({ ...TEAM, tickets: { ...TEAM.tickets, files: 'docs/**/*.md' } }))
  if (!('flow' in parsed)) throw new Error(parsed.problem)
  expect(ticketOf(parsed.flow, '/work/app/docs/tasks/02-login-form.md')).toBe('02')
  expect(ticketOf(parsed.flow, '/work/app/docs/02-top.md')).toBe('02')
  expect(ticketOf(parsed.flow, '/work/app/docs/tasks/login-form.md')).toBeNull()
  expect(ticketOf(parsed.flow, '/work/app/src/02-login-form.md')).toBeNull()
})
