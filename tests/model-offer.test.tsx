import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { bandText, engine, fail, request, start, type } from './engine'

const NEEDS_OPUS = 'clarity=goal hard=no risky=no size=small model=opus sure=85'

/** Claude reports the person's answer to the model offer. */
function answer($: Engine, choice: string) {
  return $.tool.call({ tool: 'mcp__open-effort__model', choice } as never)
}

/** A session on Sonnet 5.5: its first request names its model. */
async function onSonnet($: Engine) {
  await start($)
  await request($, 'high', 0, 'claude-sonnet-5-5')
}

test('work Haiku says needs a more capable model asks the person first', async ($, on) => {
  const { submitted } = engine(on, { haiku: NEEDS_OPUS, model: 'claude-sonnet-5-5' })
  await onSonnet($)
  await type($, 'design the checkout service')

  const context = JSON.stringify(submitted.at(-1)?.context ?? '')
  expect(context).toContain('Opus 5.5')
  expect(context).toContain('Sonnet 5.5')
  expect(context).toContain('AskUserQuestion')
  expect(context).toContain('mcp__open-effort__model')
})

test('when the person says up, the task runs on the model offered, to its end', async ($, on) => {
  const { sent } = engine(on, { haiku: NEEDS_OPUS, model: 'claude-sonnet-5-5' })
  await onSonnet($)
  await type($, 'design the checkout service')
  await answer($, 'up')
  await request($, 'high', 1, 'claude-sonnet-5-5')
  await request($, 'high', 2, 'claude-sonnet-5-5')

  expect(sent.slice(1).map(e => [e.model, e.effort])).toEqual([
    ['claude-opus-5-5', 'medium'],
    ['claude-opus-5-5', 'medium'],
  ])
  expect(await bandText($)).toBeDefined()
})

test('when the person keeps the session model, nothing moves', async ($, on) => {
  const { sent } = engine(on, { haiku: NEEDS_OPUS, model: 'claude-sonnet-5-5' })
  await onSonnet($)
  await type($, 'design the checkout service')
  await answer($, 'keep')
  await request($, 'high', 1, 'claude-sonnet-5-5')

  expect(sent.at(-1)?.model).toBe('claude-sonnet-5-5')
})

test('a task on the model chosen for it climbs from that model, then to Fable 5.1', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: 'clarity=unclear hard=yes risky=no size=small model=opus sure=85', model: 'claude-sonnet-5-5' })
  await onSonnet($)
  await type($, 'find the race in the queue')
  await answer($, 'up')
  await request($, 'high', 1, 'claude-sonnet-5-5')
  await fail($, bash)
  await request($, 'high', 2, 'claude-sonnet-5-5')

  expect(sent.slice(1).map(e => [e.model, e.effort])).toEqual([
    ['claude-opus-5-5', 'xhigh'],
    ['claude-fable-5-1', 'high'],
  ])
})

test('no offer when the session model is already as capable, or Haiku is unsure', async ($, on) => {
  const { submitted } = engine(on, { haiku: ['clarity=goal hard=no risky=no size=small model=sonnet sure=90', 'clarity=goal hard=no risky=no size=small model=opus sure=40'], model: 'claude-sonnet-5-5' })
  await onSonnet($)
  await type($, 'add a coupon field')
  expect(JSON.stringify(submitted.at(-1)?.context ?? '')).not.toContain('mcp__open-effort__model')
  await type($, 'make it better')
  expect(JSON.stringify(submitted.at(-1)?.context ?? '')).not.toContain('mcp__open-effort__model')
})

test('an answer with no offer standing changes nothing', async ($, on) => {
  const { sent } = engine(on, { haiku: 'clarity=goal hard=no risky=no size=small', model: 'claude-sonnet-5-5' })
  await onSonnet($)
  await type($, 'add a coupon field')
  const res = await answer($, 'up')
  await request($, 'high', 1, 'claude-sonnet-5-5')

  expect(JSON.stringify(res)).toContain('no model was offered')
  expect(sent.at(-1)?.model).toBe('claude-sonnet-5-5')
})

test('the offer counts the model as /model shows it, from the first prompt and right after a switch', async ($, on) => {
  const { submitted, where } = engine(on, { haiku: NEEDS_OPUS, model: 'Sonnet 5.5' })
  await start($)
  await type($, 'design the checkout service')
  expect(JSON.stringify(submitted.at(-1)?.context ?? '')).toContain('mcp__open-effort__model')

  where.model = 'claude-opus-5-5'
  await type($, 'design the payment service')
  expect(JSON.stringify(submitted.at(-1)?.context ?? '')).not.toContain('mcp__open-effort__model')
})
