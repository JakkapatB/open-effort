import type { TurnStepInput } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { MATT_SKILLS, engine, fail, request, run, spawn, start, type } from './engine'

const LARGE = 'clarity=unclear hard=no risky=no size=large sure=90'
const T3 = 'work/coupons/issues/03-coupon-rules.md'
const T4 = 'work/coupons/issues/04-coupon-copy.md'
const FILES = {
  [T3]: '# Coupon rules\n\nModel: Sonnet 5.5\nEffort: high\n\nApply one coupon per cart.',
  [T4]: '# Coupon copy\n\n**Effort:** low\n\nReword the coupon field label.',
  'work/coupons/issues/05-unlabelled.md': '# Stack coupons\n\nLet two coupons stack.',
  'work/coupons/issues/06-model-only.md': '# Coupon audit log\n\nModel: opus\n\nRecord every coupon applied.',
}

async function stage($: Engine, name: string) {
  return $.tool.call({ tool: 'mcp__open-effort__stage', stage: name } as never)
}

/** A session in the Main Flow's implement stage, on Opus 5.5. */
async function implementing($: Engine) {
  await start($)
  await request($, 'high', 0)
  await type($, 'add coupons to checkout')
  await stage($, 'implement')
}

/** One request of a sub-agent's loop, on the model and effort its Agent call gave it. */
async function agentStep($: Engine, agentId: string, model: string, effort: NonNullable<TurnStepInput['effort']>, index: number) {
  const stream = $.turn.step({ turnId: `t-${agentId}`, index, model, effort, messageCount: 1, agentId })
  for await (const _ of stream) {
    // the chunks are not what these tests look at
  }
}

test('the tickets stage asks Claude to name each ticket’s model and effort', async ($, on) => {
  engine(on, { haiku: LARGE, matt: MATT_SKILLS })
  const session = mock.session(on)
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'tickets')

  const notes = session.appended().map(row => JSON.stringify(row.message)).filter(m => m.includes('open-effort'))
  expect(notes.length).toBe(1)
  expect(notes[0]).toContain('Model:')
  expect(notes[0]).toContain('Effort:')
})

test('the implement stage tells Claude to read a ticket and to name it when handing it on', async ($, on) => {
  engine(on, { haiku: LARGE, matt: MATT_SKILLS })
  const session = mock.session(on)
  await implementing($)

  const notes = session.appended().map(row => JSON.stringify(row.message)).join('\n')
  expect(notes).toContain('file path in the Agent prompt')
})

test('Claude working a ticket itself takes its effort and keeps the task’s model', async ($, on) => {
  const { sent } = engine(on, { haiku: LARGE, matt: MATT_SKILLS, files: FILES })
  await implementing($)
  await $.tool.call({ tool: 'Read', file_path: T4 } as never)
  await request($, 'high', 1)

  expect([sent.at(-1)?.model, sent.at(-1)?.effort]).toEqual(['claude-opus-5-5', 'low'])
})

test('a ticket with no Model or Effort line is read by Haiku', async ($, on) => {
  const { sent, asked } = engine(on, { haiku: [LARGE, 'clarity=clear hard=no risky=no size=small model=sonnet sure=90'], matt: MATT_SKILLS, files: FILES })
  await implementing($)
  await $.tool.call({ tool: 'Read', file_path: 'work/coupons/issues/05-unlabelled.md' } as never)
  await request($, 'high', 1)

  expect(asked.at(-1)?.prompt).toContain('Stack coupons')
  expect(sent.at(-1)?.effort).toBe('low')
})

test('a sub-agent handed a ticket runs on the ticket’s model and effort', async ($, on) => {
  const { calls } = engine(on, { haiku: LARGE, matt: MATT_SKILLS, files: FILES })
  await implementing($)
  await $.tool.call({ tool: 'Agent', description: 'ticket 03', prompt: `Implement ${T3} with TDD.` } as never)

  const agentCall = calls.find(c => c.tool === 'Agent')
  expect([agentCall?.model, agentCall?.effort]).toEqual(['sonnet', 'high'])
})

test('a ticket’s sub-agent climbs its effort to xhigh, then a model up', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: LARGE, matt: MATT_SKILLS, files: FILES })
  await implementing($)
  await $.tool.call({ tool: 'Agent', tool_use_id: 'tu-3', description: 'ticket 03', prompt: `Implement ${T3} with TDD.` } as never)
  await spawn($, 'tu-3', 'ticket 03', `Implement ${T3} with TDD.`)
  await $.turn.start({ text: 'work', turnId: 't-t3', agentId: 't3' })
  let index = 0
  await agentStep($, 't3', 'claude-sonnet-5-5', 'high', index++)
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 3; i++) await run($, bash, 'npm test', false, 't3')
    await agentStep($, 't3', 'claude-sonnet-5-5', 'high', index++)
  }

  expect(sent.filter(e => e.agentId === 't3').map(e => [e.model, e.effort])).toEqual([
    ['claude-sonnet-5-5', 'high'],
    ['claude-sonnet-5-5', 'xhigh'],
    ['claude-opus-5-5', 'high'],
  ])
})

test('outside the implement stage a ticket path in an Agent prompt changes nothing', async ($, on) => {
  const { calls } = engine(on, { haiku: LARGE, matt: MATT_SKILLS, files: FILES })
  await start($)
  await request($, 'high', 0)
  await type($, 'add coupons to checkout')
  await stage($, 'review')
  await $.tool.call({ tool: 'Agent', description: 'review 03', prompt: `Review ${T3}.`, subagent_type: 'code-reviewer' } as never)

  const agentCall = calls.find(c => c.tool === 'Agent')
  expect(agentCall?.model).toBeUndefined()
})

test('on a Sonnet session in the flow, a ticket with no Model line runs its sub-agent on the flow’s model', async ($, on) => {
  const { calls } = engine(on, { haiku: LARGE, matt: MATT_SKILLS, files: FILES, model: 'claude-sonnet-5-5' })
  await start($)
  await request($, 'high', 0, 'claude-sonnet-5-5')
  await type($, 'add coupons to checkout')
  await stage($, 'implement')
  await $.tool.call({ tool: 'Agent', description: 'ticket 04', prompt: `Implement ${T4} with TDD.` } as never)

  const agentCall = calls.find(c => c.tool === 'Agent')
  expect([agentCall?.model, agentCall?.effort]).toEqual(['opus', 'low'])
})

test('a ticket path that ends a sentence is still the ticket', async ($, on) => {
  const { calls } = engine(on, { haiku: LARGE, matt: MATT_SKILLS, files: FILES })
  await implementing($)
  await $.tool.call({ tool: 'Agent', description: 'ticket 03', prompt: `Implement ${T3}. Then report back.` } as never)

  const agentCall = calls.find(c => c.tool === 'Agent')
  expect([agentCall?.model, agentCall?.effort]).toEqual(['sonnet', 'high'])
})

test('a ticket that names only its model keeps that model, and Haiku reads its effort', async ($, on) => {
  const { calls } = engine(on, { haiku: [LARGE, 'clarity=clear hard=no risky=no size=small model=haiku sure=90'], matt: MATT_SKILLS, files: FILES })
  await implementing($)
  await $.tool.call({ tool: 'Agent', description: 'ticket 06', prompt: 'Implement work/coupons/issues/06-model-only.md with TDD.' } as never)

  const agentCall = calls.find(c => c.tool === 'Agent')
  expect([agentCall?.model, agentCall?.effort]).toEqual(['opus', 'low'])
})

test('two hand-offs under one description each keep their own ticket', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: LARGE, matt: MATT_SKILLS, files: FILES })
  await implementing($)
  // Both calls are made before either agent starts: matched by description, the second would take the first's place.
  await $.tool.call({ tool: 'Agent', tool_use_id: 'tu-a', description: 'implement ticket', prompt: `Implement ${T3}.` } as never)
  await $.tool.call({ tool: 'Agent', tool_use_id: 'tu-b', description: 'implement ticket', prompt: `Implement ${T4}.` } as never)
  const a = await spawn($, 'tu-a', 'implement ticket', `Implement ${T3}.`)
  const b = await spawn($, 'tu-b', 'implement ticket', `Implement ${T4}.`)
  expect(a).not.toBe(b)
  if (!a || !b) return
  // Each climbs from its own ticket's effort: ticket 03 from high, ticket 04 from low.
  for (const id of [a, b]) {
    await agentStep($, id, 'claude-opus-5-5', id === a ? 'high' : 'low', 0)
    await run($, bash, 'npm test', false, id)
    await run($, bash, 'npm test', false, id)
    await run($, bash, 'npm test', false, id)
    await agentStep($, id, 'claude-opus-5-5', id === a ? 'high' : 'low', 1)
  }

  expect(sent.filter(e => e.agentId === a).map(e => e.effort)).toEqual(['high', 'xhigh'])
  expect(sent.filter(e => e.agentId === b).map(e => e.effort)).toEqual(['low', 'medium'])
})

test('a ticket with no Model line, handed out after the main session climbed to Fable 5.1, runs on the task’s model', async ($, on) => {
  const { calls, bash } = engine(on, { haiku: LARGE, matt: MATT_SKILLS, files: FILES })
  await implementing($)
  // implement's high, then xhigh, then Fable 5.1.
  await fail($, bash)
  await fail($, bash)
  await $.tool.call({ tool: 'Agent', tool_use_id: 'tu-4', description: 'ticket 04', prompt: `Implement ${T4}.` } as never)

  const agentCall = calls.find(c => c.tool === 'Agent')
  expect([agentCall?.model, agentCall?.effort]).toEqual([undefined, 'low'])
})

test('Haiku reads a ticket without lines once, while its text stays the same', async ($, on) => {
  const { asked } = engine(on, { haiku: [LARGE, 'clarity=clear hard=no risky=no size=small model=sonnet sure=90'], matt: MATT_SKILLS, files: FILES })
  await implementing($)
  await $.tool.call({ tool: 'Read', file_path: 'work/coupons/issues/05-unlabelled.md' } as never)
  await $.tool.call({ tool: 'Read', file_path: T3 } as never)
  await $.tool.call({ tool: 'Read', file_path: 'work/coupons/issues/05-unlabelled.md' } as never)

  expect(asked.length).toBe(2)
})
