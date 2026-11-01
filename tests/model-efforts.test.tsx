import { expect, test } from 'claude-code/testing'

import { fitEffort, supportedEfforts } from '../hooks/policy'
import { BAND, answerOffer, askPerson, engine, fail, request, start, type } from './engine'

const CLEAR = 'clarity=clear hard=no risky=no size=small'
const HARD = 'clarity=clear hard=yes risky=no size=large'

test('each model takes the efforts its API accepts', () => {
  expect(supportedEfforts('claude-opus-5-5')).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
  expect(supportedEfforts('claude-haiku-5-5')).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
  expect(supportedEfforts('claude-opus-4-6')).toEqual(['low', 'medium', 'high', 'max'])
  expect(supportedEfforts('claude-sonnet-4-6')).toEqual(['low', 'medium', 'high', 'max'])
  expect(supportedEfforts('claude-opus-4-5-20251101')).toEqual(['low', 'medium', 'high'])
  expect(supportedEfforts('claude-sonnet-4-5')).toEqual([])
  expect(supportedEfforts('claude-haiku-4-5')).toEqual([])
  expect(supportedEfforts('us.anthropic.claude-opus-4-6-v1')).toEqual(['low', 'medium', 'high', 'max'])
})

test('an effort a model does not take becomes the nearest one below it', () => {
  expect(fitEffort('xhigh', 'claude-opus-4-6')).toBe('high')
  expect(fitEffort('xhigh', 'claude-opus-4-5')).toBe('high')
  expect(fitEffort('max', 'claude-opus-4-5')).toBe('high')
  expect(fitEffort('medium', 'claude-opus-4-6')).toBe('medium')
})

test('hard work on Opus 4.6 goes out at high, since it takes no xhigh', async ($, on) => {
  const { sent } = engine(on, { haiku: HARD })
  await start($)
  await type($, 'redesign the cache')
  await request($, 'high', 0, 'claude-opus-4-6')

  expect(sent.map(e => e.effort)).toEqual(['high'])
})

test('on Opus 4.6 the ladder skips xhigh, and after high offers Fable 5.1', async ($, on) => {
  const { sent, bash, conversation } = engine(on, { haiku: CLEAR })
  await start($)
  await type($, 'rename getUser to fetchUser')
  for (let i = 0; i < 3; i++) {
    await request($, 'high', i, 'claude-opus-4-6')
    await fail($, bash)
  }
  await request($, 'high', 3, 'claude-opus-4-6')
  askPerson(conversation)
  await answerOffer($, 'up')
  await request($, 'high', 4, 'claude-opus-4-6')

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    ['claude-opus-4-6', 'low'],
    ['claude-opus-4-6', 'medium'],
    ['claude-opus-4-6', 'high'],
    ['claude-opus-4-6', 'high'],
    ['claude-fable-5-1', 'high'],
  ])
})

test('a model that takes no effort is left alone', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: HARD })
  await start($)
  await type($, 'redesign the cache')
  await request($, 'none', 0, 'claude-sonnet-4-5')
  await fail($, bash)
  await request($, 'none', 1, 'claude-sonnet-4-5')

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    ['claude-sonnet-4-5', undefined],
    ['claude-sonnet-4-5', undefined],
  ])
})

test('the band shows the effort that goes out, fitted to the model', async ($, on) => {
  engine(on, { haiku: HARD })
  await start($)
  await type($, 'redesign the cache')
  await request($, 'high', 0, 'claude-opus-4-6')

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(drawn).toContain('>high</text>')
  expect(drawn).not.toContain('>xhigh</text>')
})
