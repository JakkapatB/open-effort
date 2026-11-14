import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { cacheRuleOf, cacheSeenBy, cacheSeenFrom, isEffortBound, withCacheSeen } from '../hooks/policy'
import type { CacheMark } from '../types'
import { engine, fail, paneText, run, start, type } from './engine'

const OPUS_5 = 'claude-opus-5'
const OPUS_5_5 = 'claude-opus-5-5'
const CLEAR = 'clarity=clear hard=no risky=no size=small sure=90'

const mark = (over: Partial<CacheMark> = {}): CacheMark => ({ model: OPUS_5, answered: OPUS_5, effort: 'low', at: 0, messageCount: 10, prompt: 60_000, ...over })
const after = (over: Partial<CacheMark> = {}): CacheMark => mark({ effort: 'medium', at: 60_000, messageCount: 12, prompt: 61_000, ...over })

test('after a change of effort, a request that reads the conversation from the cache kept it, and one that reads only the first prompt lost it', () => {
  expect(cacheSeenBy(mark(), 45_000, after(), 60_000)).toBe('kept')
  expect(cacheSeenBy(mark(), 45_000, after(), 45_000)).toBe('lost')
  expect(cacheSeenBy(mark(), 45_000, after(), 0)).toBe('lost')
  // Half the conversation read says neither.
  expect(cacheSeenBy(mark(), 45_000, after(), 52_500)).toBe(null)
})

test('two requests say nothing of the cache unless only the effort changed, soon after, with enough conversation to tell', () => {
  expect(cacheSeenBy(null, 45_000, after(), 60_000)).toBe(null)
  expect(cacheSeenBy(mark(), 45_000, after({ effort: 'low' }), 0)).toBe(null)
  expect(cacheSeenBy(mark(), 45_000, after({ model: OPUS_5_5 }), 0)).toBe(null)
  expect(cacheSeenBy(mark(), 45_000, after({ answered: 'claude-opus-4-8' }), 0)).toBe(null)
  // Five minutes on, the entry may have lapsed by itself.
  expect(cacheSeenBy(mark(), 45_000, after({ at: 5 * 60_000 }), 0)).toBe(null)
  // Fewer messages is a compaction.
  expect(cacheSeenBy(mark(), 45_000, after({ messageCount: 4 }), 0)).toBe(null)
  // The system prompt and tools outlive a change of effort: a short conversation reads alike either way.
  expect(cacheSeenBy(mark(), 59_000, after(), 59_000)).toBe(null)
})

test('one loss holds a model’s effort, and two keeps in a row free it again', () => {
  expect(cacheRuleOf(undefined)).toBe(null)
  const once = withCacheSeen(undefined, 'kept')
  expect(cacheRuleOf(once)).toBe(null)
  const twice = withCacheSeen(once, 'kept')
  expect(cacheRuleOf(twice)).toBe('holds')
  const lost = withCacheSeen(twice, 'lost')
  expect(cacheRuleOf(lost)).toBe('restarts')
  expect(cacheRuleOf(withCacheSeen(withCacheSeen(lost, 'kept'), 'kept'))).toBe('holds')
})

test('what a machine’s own requests showed stands over the measured list', () => {
  expect(isEffortBound(OPUS_5)).toBe(true)
  expect(isEffortBound(OPUS_5, 'holds')).toBe(false)
  expect(isEffortBound(OPUS_5_5)).toBe(false)
  expect(isEffortBound(OPUS_5_5, 'restarts')).toBe(true)
  // A model that takes no effort has none to hold, whatever was seen.
  expect(isEffortBound('claude-haiku-4-5', 'restarts')).toBe(false)
})

test('a store value of the wrong shape names no model', () => {
  expect(cacheSeenFrom(undefined)).toEqual({})
  expect(cacheSeenFrom(['x'])).toEqual({})
  expect(cacheSeenFrom({ a: { kept: 2, isLost: false }, b: { kept: 'many' }, c: null })).toEqual({ a: { kept: 2, isLost: false } })
})

/** One request of the main session, answered with what the cache did: tokens read from it and written to it. */
async function step($: Engine, api: { usage: unknown }, index: number, model: string, read: number, written: number) {
  api.usage = { input_tokens: 10, output_tokens: 50, cache_read_input_tokens: read, cache_creation_input_tokens: written }
  const stream = $.turn.step({ turnId: 't1', index, model, effort: 'high', messageCount: 2 + index * 2 })
  for await (const _ of stream) {
    // the chunks are not what these tests look at
  }
}

test('a model not on the measured list is freed once its own requests keep the cache through two changes of effort', async ($, on) => {
  const { sent, bash, api, store } = engine(on, { haiku: CLEAR, model: OPUS_5 })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await step($, api, 0, OPUS_5, 0, 45_000)
  await step($, api, 1, OPUS_5, 45_010, 5_000)
  // A climb changes the effort, and the next request still reads the whole conversation from the cache: twice.
  await fail($, bash)
  await step($, api, 2, OPUS_5, 50_020, 800)
  await fail($, bash)
  await step($, api, 3, OPUS_5, 50_830, 800)
  // Free now: a passing check settles the effort back, as on a model measured to hold its cache.
  await run($, bash, 'npm test', true)
  await step($, api, 4, OPUS_5, 51_640, 800)

  expect(sent.map(e => e.effort)).toEqual(['low', 'low', 'medium', 'high', 'low'])
  expect(store.get('cacheSeen')).toEqual({ [OPUS_5]: { kept: 2, isLost: false } })
})

test('a model on the measured list is held from the first change of effort that loses its cache', async ($, on) => {
  const { sent, bash, api, store } = engine(on, { haiku: CLEAR })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await step($, api, 0, OPUS_5_5, 0, 45_000)
  await step($, api, 1, OPUS_5_5, 45_010, 5_000)
  // The climb's request reads only the first prompt: the conversation was written to the cache afresh.
  await fail($, bash)
  await step($, api, 2, OPUS_5_5, 45_010, 5_810)
  // Held from now on: a passing check no longer moves the effort back.
  await run($, bash, 'npm test', true)
  await step($, api, 3, OPUS_5_5, 50_830, 800)

  expect(sent.map(e => e.effort)).toEqual(['low', 'low', 'medium', 'medium'])
  expect(store.get('cacheSeen')).toEqual({ [OPUS_5_5]: { kept: 0, isLost: true } })
  expect(await paneText($)).toContain('Opus 5.5: a change of effort restarted the cache')
})

test('what another session saw of a model holds in the next one', async ($, on) => {
  const { sent, bash, api } = engine(on, { haiku: CLEAR, model: OPUS_5, store: { cacheSeen: { [OPUS_5]: { kept: 2, isLost: false } } } })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await step($, api, 0, OPUS_5, 0, 45_000)
  await fail($, bash)
  await step($, api, 1, OPUS_5, 45_010, 800)
  await run($, bash, 'npm test', true)
  await step($, api, 2, OPUS_5, 45_820, 800)

  expect(sent.map(e => e.effort)).toEqual(['low', 'medium', 'low'])
  expect(await paneText($)).toContain('Opus 5: kept its cache through changes of effort')
})

test('the pane says how much of the session’s prompts the cache served', async ($, on) => {
  const { api } = engine(on, { haiku: CLEAR })
  await start($)
  expect(await paneText($)).not.toContain('Prompt cache this session')
  await type($, 'rename getUser to fetchUser')
  await step($, api, 0, OPUS_5_5, 0, 40_000)
  await step($, api, 1, OPUS_5_5, 40_010, 9_980)

  // 40,010 read of 90,020 prompt tokens.
  expect(await paneText($)).toContain('Prompt cache this session: 44% read · 40.0K of 90.0K prompt tokens · 2 requests')
})

test('a request answered with no usage counts nothing and teaches nothing', async ($, on) => {
  const { sent, bash, api, store } = engine(on, { haiku: CLEAR, model: OPUS_5 })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await step($, api, 0, OPUS_5, 0, 45_000)
  api.usage = null
  await fail($, bash)
  const stream = $.turn.step({ turnId: 't1', index: 1, model: OPUS_5, effort: 'high', messageCount: 4 })
  for await (const _ of stream) {
    // the chunks are not what these tests look at
  }

  expect(sent.map(e => e.effort)).toEqual(['low', 'medium'])
  expect(store.get('cacheSeen')).toBe(undefined)
  expect(await paneText($)).toContain('1 requests')
})
