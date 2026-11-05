import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { isEffortBound } from '../hooks/policy'
import { BAND, MATT_SKILLS, PANE, bandText, engine, fail, pressPane, request, run, start, type } from './engine'

const OPUS_5 = 'claude-opus-5'
const CLEAR = 'clarity=clear hard=no risky=no size=small sure=90'
const LARGE = 'clarity=goal hard=no risky=no size=large sure=90'

async function stage($: Engine, name: string) {
  return $.tool.call({ tool: 'mcp__open-effort__stage', stage: name } as never)
}

const FLOW = { haiku: LARGE, matt: MATT_SKILLS, model: OPUS_5, store: { flowModel: 'session', mainFlow: true } }

test('a flow’s first stage sets the effort, later stages keep it, and a new task frees it', async ($, on) => {
  const { sent } = engine(on, { ...FLOW, haiku: [LARGE, CLEAR] })
  await start($)
  await type($, 'add coupons to checkout')
  await request($, 'high', 0, OPUS_5)
  await stage($, 'review')
  await request($, 'high', 1, OPUS_5)
  await stage($, 'tickets')
  await request($, 'high', 2, OPUS_5)
  expect(await bandText($)).toContain('held to keep the prompt cache')
  await stage($, 'done')
  await type($, 'rename a variable')
  await request($, 'high', 3, OPUS_5)
  expect(sent.map(e => e.effort)).toEqual(['medium', 'xhigh', 'xhigh', 'low'])
})

test('a stuck stage climbs from the effort really sent, and asks about a model only at its top', async ($, on) => {
  const { sent, bash } = engine(on, FLOW)
  await start($)
  await type($, 'add coupons to checkout')
  await request($, 'high', 0, OPUS_5)
  await stage($, 'grill')
  await request($, 'high', 1, OPUS_5)
  await stage($, 'review')
  await request($, 'high', 2, OPUS_5)
  await fail($, bash)
  await request($, 'high', 3, OPUS_5)
  expect(sent.map(e => e.effort)).toEqual(['medium', 'high', 'high', 'xhigh'])
  expect(bash.notes.join('')).not.toContain('mcp__open-effort__model')
  await fail($, bash)
  expect(bash.notes.join('')).toContain('mcp__open-effort__model')
})

test('a ticket keeps the effort too', async ($, on) => {
  const file = 'work/coupons/issues/03-rules.md'
  const { sent } = engine(on, { ...FLOW, files: { [file]: '# Rules\n\nModel: opus\nEffort: low\n' } })
  await start($)
  await type($, 'add coupons to checkout')
  await request($, 'high', 0, OPUS_5)
  await stage($, 'implement')
  await request($, 'high', 1, OPUS_5)
  await $.tool.call({ tool: 'Read', file_path: `/work/app/${file}` } as never)
  await request($, 'high', 2, OPUS_5)
  expect(sent.map(e => e.effort)).toEqual(['medium', 'high', 'high'])
})

async function step($: Engine, index: number, effort: 'low' | 'medium' | 'high', model: string, messageCount: number) {
  const stream = $.turn.step({ turnId: 't1', index, model, effort, messageCount })
  for await (const _ of stream) {
    // the chunks are not what these tests look at
  }
}

test('fewer messages than the last request means a compaction: the effort is free', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: CLEAR, model: OPUS_5 })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await step($, 0, 'high', OPUS_5, 10)
  await fail($, bash)
  await step($, 1, 'high', OPUS_5, 12)
  await run($, bash, 'npm test', true)
  await step($, 2, 'high', OPUS_5, 14)
  await step($, 3, 'high', OPUS_5, 3)
  expect(sent.map(e => e.effort)).toEqual(['low', 'medium', 'medium', 'low'])
})

test('another model frees the effort', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: CLEAR, model: OPUS_5 })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await request($, 'high', 0, OPUS_5)
  await fail($, bash)
  await request($, 'high', 1, OPUS_5)
  await run($, bash, 'npm test', true)
  await request($, 'high', 2, 'claude-opus-4-8')
  expect(sent.map(e => e.effort)).toEqual(['low', 'medium', 'low'])
})

test('a reply that goes on keeps the effort; the person’s own /effort on an unscored task frees it', async ($, on) => {
  const { sent } = engine(on, { model: OPUS_5 })
  await start($)
  await type($, 'ok')
  await request($, 'medium', 0, OPUS_5)
  await type($, 'go on')
  await request($, 'medium', 1, OPUS_5)
  await type($, 'ok')
  await request($, 'high', 2, OPUS_5)
  expect(sent.map(e => e.effort)).toEqual(['medium', 'medium', 'high'])
})

test('an effort the model does not take is never kept', async ($, on) => {
  const { sent } = engine(on, { model: 'claude-opus-4-6' })
  await start($)
  await type($, 'ok')
  await request($, 'xhigh', 0, 'claude-opus-4-6')
  await request($, 'xhigh', 1, 'claude-opus-4-6')
  expect(sent.at(-1)?.effort).toBe('high')
})

test('a request that carries no effort stays without one', async ($, on) => {
  const { sent } = engine(on, { model: OPUS_5 })
  await start($)
  await request($, 'none', 0, OPUS_5)
  await request($, 'none', 1, OPUS_5)
  expect(sent.map(e => e.effort)).toEqual([undefined, undefined])
})

test('switching the mod off and on again forgets the held effort', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: CLEAR, model: OPUS_5 })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await request($, 'high', 0, OPUS_5)
  await fail($, bash)
  await request($, 'high', 1, OPUS_5)
  await run($, bash, 'npm test', true)
  await pressPane($, 'project-off')
  await pressPane($, 'project-on')
  await request($, 'high', 2, OPUS_5)
  expect(sent.at(-1)?.effort).toBe('high')
})

test('the desktop band says held in what it draws', async ($, on) => {
  const { bash } = engine(on, { haiku: CLEAR, model: OPUS_5 })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await request($, 'high', 0, OPUS_5)
  await fail($, bash)
  await request($, 'high', 1, OPUS_5)
  await run($, bash, 'npm test', true)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(drawn).toContain('medium · held')
})

test('models measured to hold the cache are free, and every other that takes effort is held', () => {
  for (const id of ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5-20260101', 'claude-sonnet-4-5', 'claude-haiku-4-5']) expect(isEffortBound(id)).toBe(false)
  for (const id of ['claude-opus-5', 'claude-sonnet-5', 'claude-opus-4-8', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-fable-5', 'claude-fable-5-10']) expect(isEffortBound(id)).toBe(true)
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
