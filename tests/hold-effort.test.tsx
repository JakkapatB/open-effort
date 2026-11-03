import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { MATT_SKILLS, PANE, bandText, engine, fail, pressPane, request, run, start, type } from './engine'

const OPUS_5 = 'claude-opus-5'
const CLEAR = 'clarity=clear hard=no risky=no size=small sure=90'
const HARD = 'clarity=goal hard=yes risky=no size=small sure=90'
const LARGE = 'clarity=goal hard=no risky=no size=large sure=90'

async function stage($: Engine, name: string) {
  return $.tool.call({ tool: 'mcp__open-effort__stage', stage: name } as never)
}

test('on Opus 5 a stage change keeps the effort, and a new task changes it', async ($, on) => {
  const { sent } = engine(on, { haiku: [LARGE, HARD], matt: MATT_SKILLS, model: OPUS_5, store: { flowModel: 'session' } })
  await start($)
  await type($, 'add coupons to checkout')
  await stage($, 'tickets')
  await request($, 'high', 0, OPUS_5)
  await stage($, 'review')
  await request($, 'high', 1, OPUS_5)
  expect(sent.map(e => e.effort)).toEqual(['medium', 'medium'])
  expect(await bandText($)).toContain('held to keep the prompt cache')
})

test('on Opus 5 a climb raises the effort, a pass keeps it, and a new task frees it', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: CLEAR, model: OPUS_5 })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await request($, 'high', 0, OPUS_5)
  await fail($, bash)
  await request($, 'high', 1, OPUS_5)
  await run($, bash, 'npm test', true)
  await request($, 'high', 2, OPUS_5)
  await type($, 'now rename setUser to storeUser')
  await request($, 'high', 3, OPUS_5)
  expect(sent.map(e => e.effort)).toEqual(['low', 'medium', 'medium', 'low'])
})

test('on Opus 5.5 nothing is held', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: CLEAR })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await request($, 'high', 0)
  await fail($, bash)
  await request($, 'high', 1)
  await run($, bash, 'npm test', true)
  await request($, 'high', 2)
  expect(sent.map(e => e.effort)).toEqual(['low', 'medium', 'low'])
})

test('with the cache gone after an hour, the effort is free to settle', async ($, on) => {
  const { sent, bash, clock } = engine(on, { haiku: CLEAR, model: OPUS_5 })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await request($, 'high', 0, OPUS_5)
  await fail($, bash)
  await request($, 'high', 1, OPUS_5)
  await run($, bash, 'npm test', true)
  clock.now += 60 * 60 * 1000
  await request($, 'high', 2, OPUS_5)
  expect(sent.map(e => e.effort)).toEqual(['low', 'medium', 'low'])
})

test('the pane’s switch turns the hold off, and it stays off in the next session', async ($, on) => {
  const { sent, bash, store } = engine(on, { haiku: CLEAR, model: OPUS_5 })
  await start($)
  await pressPane($, 'hold-effort-off')
  expect(store.get('holdEffort')).toBe(false)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'hold-effort-on' })
  await ui.press({ key: 'hold-effort-off' })
  await ui.unmount()
  await type($, 'rename getUser to fetchUser')
  await request($, 'high', 0, OPUS_5)
  await fail($, bash)
  await request($, 'high', 1, OPUS_5)
  await run($, bash, 'npm test', true)
  await request($, 'high', 2, OPUS_5)
  expect(sent.map(e => e.effort)).toEqual(['low', 'medium', 'low'])
})
