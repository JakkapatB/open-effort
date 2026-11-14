import { expect, test } from 'claude-code/testing'

import { answerOffer, askPerson, engine, fail, request, start, type } from './engine'

const FABLE = 'claude-fable-5-2'
const OPUS = 'claude-opus-5-5'
const NEEDS_FABLE = 'clarity=unclear hard=yes risky=no size=small model=fable sure=90'
const HARD = 'clarity=unclear hard=yes risky=no size=small sure=90'

test('a model that does not answer the first request moved to it is given up: the task goes back to the session’s model, and the person is told', async ($, on) => {
  const { sent, api, toasts, conversation, submitted } = engine(on, { haiku: NEEDS_FABLE })
  await start($)
  await type($, 'fix the race in the order queue')
  askPerson(conversation)
  await answerOffer($, 'up')
  api.down = [FABLE]
  await request($, 'high', 0)
  await request($, 'high', 1)

  expect(sent.map(e => e.model)).toEqual([FABLE, OPUS])
  expect(toasts.join('\n')).toContain('Fable 5.2 did not answer')
  // Work that needs it is no longer offered it this session.
  await type($, 'now fix the deadlock in the cart lock')
  expect(JSON.stringify(submitted.at(-1)?.context ?? '')).not.toContain('mcp__open-effort__model')
})

test('a model that answered before and misses one request keeps the task', async ($, on) => {
  const { sent, api, toasts, conversation } = engine(on, { haiku: NEEDS_FABLE })
  await start($)
  await type($, 'fix the race in the order queue')
  askPerson(conversation)
  await answerOffer($, 'up')
  await request($, 'high', 0)
  api.down = [FABLE]
  await request($, 'high', 1)
  api.down = []
  await request($, 'high', 2)

  expect(sent.map(e => e.model)).toEqual([FABLE, FABLE, FABLE])
  expect(toasts).toEqual([])
})

test('a stuck task is not offered a model that did not answer: at the top it stops and asks', async ($, on) => {
  const { sent, bash, api, conversation } = engine(on, { haiku: HARD })
  await start($)
  await type($, 'fix the race in the order queue')
  await fail($, bash)
  askPerson(conversation)
  await answerOffer($, 'up')
  api.down = [FABLE]
  await request($, 'high', 0)
  // Back on Opus 5.5 at its top effort: three more failing checks.
  await request($, 'high', 1)
  await fail($, bash)

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    [FABLE, 'high'],
    [OPUS, 'xhigh'],
  ])
  expect(bash.notes.at(-1)).toContain('Stop retrying')
  expect(bash.notes.at(-1)).not.toContain('mcp__open-effort__model')
})

test('the Main Flow stays on the session’s model when its own did not answer', async ($, on) => {
  const { sent, api, toasts } = engine(on, { haiku: 'clarity=goal hard=no risky=no size=large sure=90', matt: ['grill-with-docs', 'to-spec', 'to-tickets', 'implement', 'code-review', 'retro'], model: 'claude-sonnet-5-5' })
  await start($)
  await type($, 'add coupons to checkout')
  await $.tool.call({ tool: 'mcp__open-effort__stage', stage: 'grill' } as never)
  api.down = [OPUS]
  await request($, 'high', 0, 'claude-sonnet-5-5')
  await request($, 'high', 1, 'claude-sonnet-5-5')
  // The next task that enters the flow does not try Opus 5.5 again.
  await $.tool.call({ tool: 'mcp__open-effort__stage', stage: 'done' } as never)
  await type($, 'add gift cards to checkout')
  await $.tool.call({ tool: 'mcp__open-effort__stage', stage: 'grill' } as never)
  await request($, 'high', 2, 'claude-sonnet-5-5')

  expect(sent.map(e => e.model)).toEqual([OPUS, 'claude-sonnet-5-5', 'claude-sonnet-5-5'])
  expect(toasts.length).toBe(1)
})
