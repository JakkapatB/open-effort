import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'

import { agentRequest, engine, fail, request, run, start, type } from './engine'

const GOAL = 'clarity=goal hard=no risky=no size=small'

/** Claude starts a sub-agent; what the Agent call went out with is the last call the engine saw. */
async function spawn($: EngineInterface, calls: Record<string, unknown>[], input: Record<string, unknown>) {
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

test('a general-purpose sub-agent runs at the main session’s current effort', async ($, on) => {
  const { calls, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await request($, 'high')

  expect(await spawn($, calls, { subagent_type: 'general-purpose' })).toEqual({ model: undefined, effort: 'medium' })

  await fail($, bash)
  expect(await spawn($, calls, {})).toEqual({ model: undefined, effort: 'high' })
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
