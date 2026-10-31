import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { MATT_SKILLS, bandText, engine, fail, finish, paneText, pressPane, request, start, type } from './engine'

const LARGE = 'clarity=unclear hard=no risky=no size=large'
const SKILLS = '/Users/me/.claude/plugins/cache/mattpocock/mattpocock-skills/1.3.2/skills'

const STAGE_EFFORTS = [
  ['grill', 'high'],
  ['spec', 'high'],
  ['tickets', 'medium'],
  ['implement', 'high'],
  ['review', 'xhigh'],
  ['retro', 'medium'],
] as const

async function stage($: Engine, name: string) {
  return $.tool.call({ tool: 'mcp__open-effort__stage', stage: name } as never)
}

async function flow(on: Parameters<typeof engine>[0], options: Parameters<typeof engine>[1] = {}) {
  return engine(on, { haiku: LARGE, matt: MATT_SKILLS, ...options })
}

/** The effort of a main-session request sent now. */
async function effortNow($: Engine, sent: { effort?: unknown }[], index = 0) {
  await request($, 'high', index)
  return sent[sent.length - 1]?.effort
}

test('each stage the stage tool announces sets its own effort', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  const efforts: unknown[] = []
  for (const [i, [name]] of STAGE_EFFORTS.entries()) {
    await stage($, name)
    efforts.push(await effortNow($, sent, i))
  }

  expect(efforts).toEqual(STAGE_EFFORTS.map(([, effort]) => effort))
})

test('reading a stage skill’s SKILL.md moves a task in the flow to that stage', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'grill')
  await $.tool.call({ tool: 'Read', file_path: `${SKILLS}/engineering/to-tickets/SKILL.md` })

  expect(await effortNow($, sent)).toBe('medium')
})

test('printing a stage skill’s SKILL.md in Bash moves a task in the flow to that stage', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'grill')
  await $.tool.call({ tool: 'Bash', command: `cat ${SKILLS}/engineering/code-review/SKILL.md` })

  expect(await effortNow($, sent)).toBe('xhigh')
})

test('a stage skill Claude calls moves a task in the flow to that stage', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'grill')
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:to-tickets' })

  expect(await effortNow($, sent)).toBe('medium')
})

test('a stage command the person types sets the stage', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await $.prompt.submit({ text: '/mattpocock-skills:to-tickets', command: { name: 'mattpocock-skills:to-tickets', args: '' }, wait: false, origin: { kind: 'composer' } })

  expect(await effortNow($, sent)).toBe('medium')
})

test('a stage skill Claude reads or calls outside an invited flow changes nothing', async ($, on) => {
  const { sent } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small' })
  await start($)
  await type($, 'review my last change')
  await $.tool.call({ tool: 'Read', file_path: `${SKILLS}/engineering/code-review/SKILL.md` })
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:tdd' })
  await stage($, 'review')

  expect(await effortNow($, sent)).toBe('low')
})

test('when the person chose to work directly, a stage skill Claude calls or reads keeps the task out of the flow', async ($, on) => {
  const { asked } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:tdd' })
  await $.tool.call({ tool: 'Read', file_path: `${SKILLS}/engineering/code-review/SKILL.md` })
  expect(await bandText($)).not.toContain('Main Flow')

  // The next request is a task of its own, scored as any other.
  await type($, 'now rename the coupon field')
  expect(asked.length).toBe(2)
})

test('the person typing /tdd outside the flow stays in normal mode', async ($, on) => {
  const { sent, asked } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small' })
  await start($)
  await $.prompt.submit({ text: '/mattpocock-skills:tdd', command: { name: 'mattpocock-skills:tdd', args: '' }, wait: false, origin: { kind: 'composer' } })
  await type($, 'rename a variable')

  expect(asked.length).toBe(1)
  expect(await effortNow($, sent)).toBe('low')
})

test('borderline work invites the flow too, for when the person chooses it', async ($, on) => {
  const { sent } = await flow(on, { haiku: 'clarity=goal hard=no risky=no size=borderline' })
  await start($)
  await type($, 'add a coupon field and validate it on the server')
  await stage($, 'grill')
  await stage($, 'tickets')

  expect(await effortNow($, sent)).toBe('medium')
})

test('Claude Code’s own code-review is no stage', async ($, on) => {
  const { sent } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small' })
  await start($)
  await type($, 'rename a variable')
  await $.tool.call({ tool: 'Skill', skill: 'code-review' })

  expect(await effortNow($, sent)).toBe('low')
})

test('a new stage starts at its own effort, its climb left behind', async ($, on) => {
  const { sent, bash } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'implement')
  await fail($, bash)
  const climbed = await effortNow($, sent, 0)
  await stage($, 'retro')

  expect([climbed, await effortNow($, sent, 1)]).toEqual(['xhigh', 'medium'])
})

test('what the person types during the flow stays in it, unscored', async ($, on) => {
  const { sent, asked } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'grill')
  await type($, 'one coupon per order, and it cannot stack with sales')

  expect(asked.length).toBe(1)
  expect(await effortNow($, sent)).toBe('high')
})

test('the flow ends when Claude announces done, and the next request is a new task', async ($, on) => {
  const { sent, asked } = await flow(on, { haiku: [LARGE, 'clarity=clear hard=no risky=no size=small'] })
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'review')
  await stage($, 'done')
  await type($, 'rename a variable')

  expect(asked.length).toBe(2)
  expect(await effortNow($, sent)).toBe('low')
})

test('the flow ends when the retro stage’s turn ends', async ($, on) => {
  const { sent, asked } = await flow(on, { haiku: [LARGE, 'clarity=clear hard=no risky=no size=small'] })
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'retro')
  await request($, 'high')
  await finish($)
  await type($, 'rename a variable')

  expect(asked.length).toBe(2)
  expect(await effortNow($, sent, 1)).toBe('low')
})


test('the band names the stage', async ($, on) => {
  await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'spec')

  const text = await bandText($)
  expect(text).toContain('Main Flow')
  expect(text).toContain('spec')
})

test('the history names the stage', async ($, on) => {
  await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'tickets')
  await request($, 'high')
  await finish($)

  expect(await paneText($)).toContain('Main Flow: tickets')
})

test('with the Main Flow switched off, stages change nothing', async ($, on) => {
  const { sent } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small' })
  await start($)
  await pressPane($, 'flow-machine-off')
  await type($, 'rename a variable')
  await stage($, 'review')

  expect(await effortNow($, sent)).toBe('low')
})

test('a stage skill that fails to run starts no stage', async ($, on) => {
  const { sent, bash } = await flow(on)
  // The engine answers every tool call with an error now, as it does a skill it refuses to run.
  bash.passes = false
  await start($)
  await type($, 'add coupons to checkout')
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:to-tickets' })

  expect(await effortNow($, sent)).not.toBe('medium')
})

test('the stage tool says when a task was not sent into the Main Flow', async ($, on) => {
  await flow(on, { haiku: 'clarity=goal hard=no risky=no size=small' })
  await start($)
  await type($, 'add a coupon field')

  expect(JSON.stringify(await stage($, 'implement'))).toContain('not sent into the Main Flow')
})

test('entering the Main Flow moves a Sonnet session’s task to the frontier model', async ($, on) => {
  const { sent } = await flow(on, { model: 'claude-sonnet-5-5' })
  await start($)
  await request($, 'high', 0, 'claude-sonnet-5-5')
  await type($, 'add coupons to checkout')
  await stage($, 'grill')
  await request($, 'high', 1, 'claude-sonnet-5-5')
  await stage($, 'review')
  await request($, 'high', 2, 'claude-sonnet-5-5')

  expect(sent.slice(1).map(e => [e.model, e.effort])).toEqual([
    ['claude-opus-5-5', 'high'],
    ['claude-opus-5-5', 'xhigh'],
  ])
})

test('the pane picks Fable 5.1 or the session’s model for the Main Flow, and says what each costs', async ($, on) => {
  const { sent } = await flow(on, { model: 'claude-sonnet-5-5' })
  await start($)
  await request($, 'high', 0, 'claude-sonnet-5-5')
  expect(await paneText($)).toContain('the prompt cache starts afresh')

  await pressPane($, 'flow-model-session')
  expect(await paneText($)).toContain('may come out weaker')
  await type($, 'add coupons to checkout')
  await stage($, 'grill')
  await request($, 'high', 1, 'claude-sonnet-5-5')
  expect(sent.at(-1)?.model).toBe('claude-sonnet-5-5')
  await stage($, 'done')

  await pressPane($, 'flow-model-fable')
  await type($, 'add gift cards to checkout')
  await stage($, 'grill')
  await request($, 'high', 2, 'claude-sonnet-5-5')
  expect(sent.at(-1)?.model).toBe('claude-fable-5-1')
})

test('a session already on Fable 5.1 keeps it in the Main Flow', async ($, on) => {
  const { sent } = await flow(on, { model: 'claude-fable-5-1' })
  await start($)
  await request($, 'high', 0, 'claude-fable-5-1')
  await type($, 'add coupons to checkout')
  await stage($, 'grill')
  await request($, 'high', 1, 'claude-fable-5-1')

  expect(sent.at(-1)?.model).toBe('claude-fable-5-1')
})

test('in the Main Flow on a Sonnet session, Plan and general-purpose sub-agents run on the frontier model', async ($, on) => {
  const { calls } = await flow(on, { model: 'claude-sonnet-5-5' })
  await start($)
  await request($, 'high', 0, 'claude-sonnet-5-5')
  await type($, 'add coupons to checkout')
  await stage($, 'review')
  const spawn = async (input: Record<string, unknown>) => {
    await $.tool.call({ tool: 'Agent', description: 'review', prompt: 'review the diff against the standards', ...input })
    const call = calls[calls.length - 1] ?? {}
    return { model: call.model, effort: call.effort }
  }

  expect(await spawn({ subagent_type: 'general-purpose' })).toEqual({ model: 'opus', effort: 'xhigh' })
  expect(await spawn({ subagent_type: 'Plan' })).toEqual({ model: 'opus', effort: 'high' })
  expect(await spawn({ subagent_type: 'Explore' })).toEqual({ model: 'haiku', effort: 'low' })
  expect(await spawn({ subagent_type: 'reviewer' })).toEqual({ model: undefined, effort: undefined })
})

test('calling implement-spec starts the implement stage', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'tickets')
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:implement-spec' } as never)

  expect(await effortNow($, sent, 1)).toBe('high')
})
