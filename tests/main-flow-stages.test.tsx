import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { BAND, MATT_SKILLS, PANE, PRESENTATION, bandText, engine, fail, finish, paneText, pressPane, request, start, type } from './engine'

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

test('in the flow, reading a stage skill’s SKILL.md keeps the stage and never lowers the effort', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'grill')
  await $.tool.call({ tool: 'Read', file_path: `${SKILLS}/engineering/to-tickets/SKILL.md` })

  expect(await effortNow($, sent)).toBe('high')
  expect(await bandText($)).toContain('Main Flow: grill')
})

test('in the flow, printing a later stage’s SKILL.md raises the effort to that stage’s', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'grill')
  await $.tool.call({ tool: 'Bash', command: `cat ${SKILLS}/engineering/code-review/SKILL.md` })

  expect(await effortNow($, sent)).toBe('xhigh')
})

test('a review Claude runs on its own work during implement raises the effort but keeps the implement stage', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'implement')
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:code-review' })

  expect(await effortNow($, sent)).toBe('xhigh')
  expect(await bandText($)).toContain('Main Flow: implement')
  // The next stage the stage tool names starts at its own effort.
  await stage($, 'retro')
  expect(await effortNow($, sent, 1)).toBe('medium')
})

test('a stage command the person types sets the stage', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await $.prompt.submit({ text: '/mattpocock-skills:to-tickets', command: { name: 'mattpocock-skills:to-tickets', args: '' }, wait: false, origin: { kind: 'composer' } })

  expect(await effortNow($, sent)).toBe('medium')
})

test('on direct work, a stage skill Claude reads or calls raises the effort to its stage’s, outside the flow', async ($, on) => {
  const { sent } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small' })
  await start($)
  await type($, 'review my last change')
  expect(await effortNow($, sent)).toBe('low')
  await $.tool.call({ tool: 'Read', file_path: `${SKILLS}/engineering/code-review/SKILL.md` })
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:tdd' })
  await stage($, 'review')

  // code-review's xhigh holds: tdd's high is below it, and the stage tool starts no flow uninvited.
  expect(await effortNow($, sent, 1)).toBe('xhigh')
  expect(await bandText($)).not.toContain('Main Flow')
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(drawn).toContain("Matt's skill · direct")
})

test('on direct work on a Sonnet session, a stage skill moves the task to the Main Flow’s model', async ($, on) => {
  const { sent } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small', model: 'claude-sonnet-5-5' })
  await start($)
  await request($, 'high', 0, 'claude-sonnet-5-5')
  await type($, 'fix the coupon rounding')
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:tdd' })
  await request($, 'high', 1, 'claude-sonnet-5-5')
  await type($, 'what does this regex match?')
  await request($, 'high', 2, 'claude-sonnet-5-5')

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    ['claude-sonnet-5-5', 'high'],
    ['claude-opus-5-5', 'high'],
    ['claude-sonnet-5-5', 'low'],
  ])
})

test('with the Main Flow’s model set to the session’s, a stage skill on direct work keeps the model', async ($, on) => {
  const { sent } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small', model: 'claude-sonnet-5-5', store: { flowModel: 'session' } })
  await start($)
  await request($, 'high', 0, 'claude-sonnet-5-5')
  await type($, 'fix the coupon rounding')
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:code-review' })
  await request($, 'high', 1, 'claude-sonnet-5-5')

  expect(sent.at(-1)).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'xhigh' })
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

test('after retro, new work ends the flow', async ($, on) => {
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

test('a session on a model that takes no effort still moves to the frontier model in the flow', async ($, on) => {
  const { sent } = await flow(on, { model: 'claude-sonnet-4-5' })
  await start($)
  await request($, 'none', 0, 'claude-sonnet-4-5')
  await type($, 'add coupons to checkout')
  await stage($, 'grill')
  await request($, 'none', 1, 'claude-sonnet-4-5')

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    ['claude-sonnet-4-5', undefined],
    ['claude-opus-5-5', 'high'],
  ])
})

test('in retro, a reply to its proposals stays in the flow', async ($, on) => {
  const { sent } = await flow(on, { haiku: [LARGE, 'clarity=clear hard=no risky=no size=small continue=yes'], said: 'Three changes I propose: 1, 2 and 3.' })
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'retro')
  await request($, 'high')
  await finish($)
  await type($, 'apply 1 and 3')

  expect(await effortNow($, sent, 1)).toBe('medium')
  expect(await bandText($)).toContain('Main Flow: retro')
})

test('switching the Main Flow off in the pane ends a flow under way', async ($, on) => {
  const { sent, asked } = await flow(on, { haiku: [LARGE, 'clarity=clear hard=no risky=no size=small'] })
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'implement')
  await $.ui.mount({ ...PANE, surface: 'desktop' }).then(async ui => {
    await ui.press({ key: 'flow-project-off' })
    await ui.unmount()
  })
  await type($, 'rename a variable')

  expect(asked.length).toBe(2)
  expect(await effortNow($, sent)).toBe('low')
})

test('switching the mod off and on again does not bring back the old task', async ($, on) => {
  const { sent } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'review')
  await $.command.run({ command: 'open-effort', args: 'off', origin: { kind: 'composer' }, presentation: PRESENTATION })
  await $.command.run({ command: 'open-effort', args: 'on', origin: { kind: 'composer' }, presentation: PRESENTATION })

  // The session's own effort, no stage.
  expect(await effortNow($, sent)).toBe('high')
  expect(await bandText($)).not.toContain('Main Flow')
})

test('a flow the person starts with a stage command tells Claude how to leave it', async ($, on) => {
  await flow(on)
  const session = mock.session(on)
  await start($)
  await $.prompt.submit({ text: '/mattpocock-skills:code-review', command: { name: 'mattpocock-skills:code-review', args: '' }, wait: false, origin: { kind: 'composer' } })

  const notes = session.appended().map(row => JSON.stringify(row.message)).join('\n')
  expect(notes).toContain('mcp__open-effort__stage')
  expect(notes).toContain('done')
})

test('in a resumed session, the stage tool brings back the flow the conversation shows under way', async ($, on) => {
  const { sent } = await flow(on, { history: [{ role: 'assistant', text: 'On to implement.', toolUses: [{ tool_use_id: 'tu-1', tool: 'mcp__open-effort__stage', input: { stage: 'implement' } }] }] })
  await start($)
  await stage($, 'review')

  expect(await effortNow($, sent)).toBe('xhigh')
})

test('a stage tool call with no flow asked about and none in the conversation still changes nothing', async ($, on) => {
  const { sent } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small', history: [{ role: 'assistant', text: 'Done.', toolUses: [{ tool_use_id: 'tu-1', tool: 'mcp__open-effort__stage', input: { stage: 'done' } }] }] })
  await start($)
  await type($, 'rename a variable')
  await stage($, 'review')

  expect(await effortNow($, sent)).toBe('low')
})

test('with the Main Flow switched off, a stage skill on direct work raises the effort but keeps the model', async ($, on) => {
  const { sent } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small', model: 'claude-sonnet-5-5', store: { mainFlow: false } })
  await start($)
  await request($, 'high', 0, 'claude-sonnet-5-5')
  await type($, 'fix the coupon rounding')
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:tdd' })
  await request($, 'high', 1, 'claude-sonnet-5-5')

  expect(sent.at(-1)).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'high' })
})

test('work the person chose to do without the flow is not asked about again this session, unless it is larger', async ($, on) => {
  const { submitted } = await flow(on, { haiku: ['clarity=goal hard=no risky=no size=borderline', 'clarity=goal hard=no risky=no size=borderline', 'clarity=unclear hard=no risky=no size=large'] })
  await start($)
  await type($, 'add a coupon field and validate it on the server')
  await type($, 'also add a discount field and validate it')
  expect(JSON.stringify(submitted.at(-1)?.context ?? '')).not.toContain('Main Flow')
  await type($, 'rebuild checkout with coupons, gift cards and refunds')
  expect(JSON.stringify(submitted.at(-1)?.context ?? '')).toContain('Main Flow')
})

test('a flow the person starts while a score is on its way stays when the score comes', async ($, on) => {
  const { sent } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small sure=90', haikuDelayMs: 1300 })
  await start($)
  await type($, 'rename a variable')
  await $.prompt.submit({ text: '/mattpocock-skills:to-spec', command: { name: 'mattpocock-skills:to-spec', args: '' }, wait: false, origin: { kind: 'composer' } })
  await new Promise(resolve => setTimeout(resolve, 300))

  expect(await effortNow($, sent)).toBe('high')
  expect(await bandText($)).toContain('Main Flow: spec')
})

test('Fable 5.1 a climb reached in one stage is left behind as the next stage starts', async ($, on) => {
  const { sent, bash } = await flow(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'review')
  await fail($, bash)
  expect((await effortNow($, sent))).toBe('high')
  expect(sent.at(-1)?.model).toBe('claude-fable-5-1')
  await stage($, 'retro')

  expect(await effortNow($, sent, 1)).toBe('medium')
  expect(sent.at(-1)?.model).toBe('claude-opus-5-5')
})

test('a stage’s skill on a task climbed below that stage’s effort lifts it at once', async ($, on) => {
  const { sent, bash } = await flow(on, { haiku: 'clarity=clear hard=no risky=no size=small' })
  await start($)
  await type($, 'fix the coupon rounding')
  await fail($, bash)
  expect(await effortNow($, sent)).toBe('medium')
  // The test engine's tools fail while its checks do: the skill call must succeed.
  bash.passes = true
  await $.tool.call({ tool: 'Skill', skill: 'mattpocock-skills:tdd' })

  expect(await effortNow($, sent, 1)).toBe('high')
})
