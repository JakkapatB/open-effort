import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { agentRequest, engine, fail, request, run, start, type } from './engine'

const GOAL = 'clarity=goal hard=no risky=no size=small'

/** Claude starts a sub-agent; what the Agent call went out with is the last call the engine saw. */
async function spawn($: Engine, calls: Record<string, unknown>[], input: Record<string, unknown>) {
  await $.tool.call({ tool: 'Agent', description: 'look around', prompt: 'find where coupons are applied', ...input })
  const call = calls[calls.length - 1] ?? {}
  return { model: call.model, effort: call.effort }
}

test('an Explore sub-agent runs on Haiku at low', async ($, on) => {
  const { calls } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')

  expect(await spawn($, calls, { subagent_type: 'Explore' })).toEqual({ model: 'haiku', effort: 'low' })
})

test('a Plan sub-agent runs on the session model at high', async ($, on) => {
  const { calls } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')

  expect(await spawn($, calls, { subagent_type: 'Plan' })).toEqual({ model: undefined, effort: 'high' })
})

test('a general-purpose sub-agent starts at the task’s starting effort, not at the main session’s climb', async ($, on) => {
  const { calls, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await request($, 'high')

  expect(await spawn($, calls, { subagent_type: 'general-purpose' })).toEqual({ model: undefined, effort: 'medium' })

  await fail($, bash)
  expect(await spawn($, calls, {})).toEqual({ model: undefined, effort: 'medium' })
})

test('after the main session climbed to Fable 5.1, a new sub-agent still starts on the task’s model', async ($, on) => {
  const { calls, bash } = engine(on, { haiku: 'clarity=clear hard=yes risky=no size=small' })
  await start($)
  await type($, 'fix the race in the cart lock')
  await request($, 'high')
  await fail($, bash)

  expect(await spawn($, calls, {})).toEqual({ model: undefined, effort: 'xhigh' })
})

test('a sub-agent that wrote a test does not count its first failing run', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await agentRequest($, 'a1', 'medium', 0)
  await $.tool.call({ tool: 'Write', file_path: 'src/coupon.test.ts', content: 'test', agentId: 'a1' } as never)
  await fail($, bash, 3, 'npm test', 'a1')
  await agentRequest($, 'a1', 'medium', 1)

  // Three failures, the first the red step: two counted, no climb.
  expect(sent.filter(e => e.agentId === 'a1').map(e => e.effort)).toEqual(['medium', 'medium'])
})

test('an Agent call that names a model or an effort is left as it is', async ($, on) => {
  const { calls } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')

  expect(await spawn($, calls, { subagent_type: 'Explore', model: 'sonnet' })).toEqual({ model: 'sonnet', effort: undefined })
  expect(await spawn($, calls, { subagent_type: 'Plan', effort: 'max' })).toEqual({ model: undefined, effort: 'max' })
})

test('a sub-agent type of the person’s own is left as it is', async ($, on) => {
  const { calls } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')

  expect(await spawn($, calls, { subagent_type: 'code-reviewer' })).toEqual({ model: undefined, effort: undefined })
})

test('a sub-agent’s stall climbs its own effort, never its model', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await agentRequest($, 'a1', 'low', 0)
  for (let i = 0; i < 3; i++) await run($, bash, 'npm test', false, 'a1')
  await agentRequest($, 'a1', 'low', 1)

  expect(sent.filter(e => e.agentId === 'a1').map(e => [e.model, e.effort])).toEqual([
    ['claude-opus-5-5', 'low'],
    ['claude-opus-5-5', 'medium'],
  ])
})

test('a sub-agent climbs no higher than xhigh', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await agentRequest($, 'a1', 'high', 0)
  for (let i = 0; i < 9; i++) await run($, bash, 'npm test', false, 'a1')
  await agentRequest($, 'a1', 'high', 1)

  expect(sent.filter(e => e.agentId === 'a1').map(e => [e.model, e.effort])).toEqual([
    ['claude-opus-5-5', 'high'],
    ['claude-opus-5-5', 'xhigh'],
  ])
})

test('a sub-agent of the person’s own type never climbs', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await agentRequest($, 'c1', 'low', 0)
  for (let i = 0; i < 3; i++) await run($, bash, 'npm test', false, 'c1')
  await agentRequest($, 'c1', 'low', 1)

  expect(sent.filter(e => e.agentId === 'c1').map(e => e.effort)).toEqual(['low', 'low'])
})

test('one sub-agent’s climb leaves the others and the main session alone', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  for (let i = 0; i < 3; i++) await run($, bash, 'npm test', false, 'a1')
  await agentRequest($, 'a2', 'low')
  await request($, 'high')

  expect(sent.map(e => [e.agentId ?? 'main', e.effort])).toEqual([
    ['a2', 'low'],
    ['main', 'medium'],
  ])
})

test('while the mod is off, sub-agents are left as they are', async ($, on) => {
  const { calls } = engine(on, { haiku: GOAL, store: { isOn: false } })
  await start($)
  await type($, 'add a coupon field')

  expect(await spawn($, calls, { subagent_type: 'Explore' })).toEqual({ model: undefined, effort: undefined })
})

test('a sub-agent on a model without xhigh climbs from high to max in its place', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await agentRequest($, 'a1', 'medium', 0, 'claude-opus-4-6')
  for (let round = 1; round <= 2; round++) {
    await fail($, bash, 3, 'npm test', 'a1')
    await agentRequest($, 'a1', 'medium', round, 'claude-opus-4-6')
  }

  expect(sent.filter(e => e.agentId === 'a1').map(e => e.effort)).toEqual(['medium', 'high', 'max'])
})
