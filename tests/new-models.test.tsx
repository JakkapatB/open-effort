import { expect, test } from 'claude-code/testing'

import { FABLE_MODEL, isFable, supportedEfforts, tierOf } from '../hooks/policy'
import { modelName } from '../hooks/words'
import { BAND, bandText, engine, fail, paneText, request, start, type } from './engine'

const FABLE_5_2 = 'claude-fable-5-2'
const HARD = 'clarity=unclear hard=yes risky=no size=small sure=90'

test('a model is named from its id, whatever its version and whatever a platform puts around it', () => {
  expect(modelName('claude-fable-5-2')).toBe('Fable 5.2')
  expect(modelName('claude-fable-5-1')).toBe('Fable 5.1')
  expect(modelName('claude-fable-5')).toBe('Fable 5')
  expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelName('claude-opus-4-5-20251101')).toBe('Opus 4.5')
  expect(modelName('claude-opus-4-20250514')).toBe('Opus 4')
  expect(modelName('global.anthropic.claude-fable-5-2')).toBe('Fable 5.2')
  expect(modelName('claude-opus-5-5[1m]')).toBe('Opus 5.5')
  expect(modelName('claude-mythos-5-2')).toBe('Mythos 5.2')
  expect(modelName(null)).toBe('session')
})

test('Fable 5.2 is the model the ladder ends on, and it takes every effort', () => {
  expect(FABLE_MODEL).toBe(FABLE_5_2)
  expect(tierOf(FABLE_5_2)).toBe('fable')
  expect(supportedEfforts(FABLE_5_2)).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
})

test('Mythos counts as Fable: the top family, with nothing above it', () => {
  expect(tierOf('claude-mythos-5-2')).toBe('fable')
  expect(isFable('claude-mythos-5-2')).toBe(true)
  expect(isFable('claude-opus-5-5')).toBe(false)
})

test('a session on Fable 5.2 is named Fable 5.2 in the band, and climbs to max on its own model', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: HARD, model: FABLE_5_2 })
  await start($)
  await type($, 'fix the race in the order queue')
  await request($, 'high', 0, FABLE_5_2)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(drawn).toContain('Effort · Fable 5.2')
  await fail($, bash)
  await request($, 'high', 1, FABLE_5_2)

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    [FABLE_5_2, 'xhigh'],
    [FABLE_5_2, 'max'],
  ])
})

test('a session on Fable 5.1 keeps its own name in the band', async ($, on) => {
  engine(on, { haiku: HARD, model: 'claude-fable-5-1' })
  await start($)
  await type($, 'fix the race in the order queue')
  await request($, 'high', 0, 'claude-fable-5-1')
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()

  expect(drawn).toContain('Effort · Fable 5.1')
  expect(await bandText($, 'terminal')).not.toContain('Fable 5.2')
})

test('the pane names the flow’s models by the ids the mod moves a task to', async ($, on) => {
  engine(on)
  await start($)
  const text = await paneText($)

  expect(text).toContain('Frontier · Opus 5.5')
  expect(text).toContain('Fable 5.2')
  expect(text).not.toContain('Fable 5.1')
})
