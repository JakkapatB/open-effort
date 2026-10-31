import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { BAND, PRESENTATION, SURFACES, bandText, engine, fail, request, run, start } from './engine'

test('the band shows the effort the session is using', async ($, on) => {
  engine(on)
  await start($)
  await request($, 'high')

  for (const surface of SURFACES) {
    expect(await bandText($, surface)).toContain('high')
  }
})

test('a new session does not show the last session’s effort', async ($, on) => {
  engine(on)
  await start($)
  await request($, 'xhigh')
  await start($)

  expect(await bandText($)).not.toContain('xhigh')
})

test('the band speaks Thai when Claude Code is set to Thai', async ($, on) => {
  engine(on, { settings: { language: 'thai' } })
  await start($)
  await request($, 'medium')

  expect(await bandText($)).toContain('ใช้อยู่')
})

test('a request goes out with the effort and model it came with', async ($, on) => {
  const { sent } = engine(on)
  await start($)
  await request($, 'low')

  expect(sent.map(e => [e.model, e.effort])).toEqual([['claude-opus-5-5', 'low']])
})

test('the person turns the mod off, and the band then draws nothing of the mod', async ($, on) => {
  engine(on)
  await start($)
  await request($, 'high')

  await $.command.run({ command: 'open-effort', args: 'off', origin: { kind: 'composer' }, presentation: PRESENTATION })

  expect(await bandText($)).toBeUndefined()
})

test('a mod switched off in an earlier session stays off', async ($, on) => {
  engine(on, { store: { isOn: false } })
  await start($)
  await request($, 'high')

  expect(await bandText($, 'terminal')).toBeUndefined()
})

test('only the person can turn the mod off', async ($, on) => {
  engine(on)
  await start($)
  await request($, 'high')

  await $.command.run({ command: 'open-effort', args: 'off', origin: { kind: 'plugin', name: 'someone-else' }, presentation: PRESENTATION })

  expect(await bandText($)).toBeDefined()
})

test('a narrow band always keeps the effort', async ($, on) => {
  engine(on, { haiku: 'clarity=goal hard=no risky=no size=small' })
  await start($)
  await $.prompt.submit({ text: 'add a coupon field', wait: false, origin: { kind: 'composer' } })
  for (const bodyColumns of [120, 40, 16]) {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, bodyColumns } })
    const drawn = JSON.stringify(await ui.drawn())
    await ui.unmount()
    expect(drawn).toContain('Effort')
  }
})

test('a failing check loops back into the effort rather than adding a step, and only the loop animates in', async ($, on) => {
  const { bash, clock } = engine(on, { haiku: 'clarity=goal hard=no risky=no size=small' })
  await start($)
  await $.prompt.submit({ text: 'add a coupon field', wait: false, origin: { kind: 'composer' } })
  clock.now += 5000
  await run($, bash, 'npm test', false)

  const drawn = await bandDrawn($)
  expect(drawn).toContain('Check failed 1/3')
  expect(drawn).toContain('class=\\"loop alert')
  expect(drawn.split('class=\\"pop\\"').length - 1).toBe(0)
  expect(drawn.split('class=\\"fade\\"').length - 1).toBe(1)
})

test('a climb changes the effort in place, its loop fading away, and the flow is back to two steps', async ($, on) => {
  const { bash, clock } = engine(on, { haiku: 'clarity=goal hard=no risky=no size=small' })
  await start($)
  await $.prompt.submit({ text: 'add a coupon field', wait: false, origin: { kind: 'composer' } })
  await request($, 'high')
  await fail($, bash)

  const now = await bandDrawn($)
  expect(now).not.toContain('Check failed')
  expect(now).toContain('Climbed ↑ high')
  expect(now).toContain('class=\\"leave\\"')
  expect(now).toContain('↑ from medium')

  clock.now += 5000
  const later = await bandDrawn($)
  expect(later).not.toContain('Climbed ↑')
  expect(later).toContain('↑ from medium')
  expect(later.split('class=\\"card ').length - 1).toBe(2)
})

test('sub-agents at work branch off the flow; where the surface can open one, each is a button to its transcript', async ($, on) => {
  const { viewed } = engine(on, { haiku: 'clarity=goal hard=no risky=no size=small' })
  await start($)
  await $.prompt.submit({ text: 'add a coupon field', wait: false, origin: { kind: 'composer' } })
  await request($, 'high')

  const quiet = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(JSON.stringify(await quiet.drawn())).not.toContain('agent-')
  await quiet.unmount()

  await $.turn.start({ text: 'look around', turnId: 'ta', agentId: 'a1' })
  await $.turn.start({ text: 'search', turnId: 'tb', agentId: 'a2' })
  const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('Effort · Opus 5.5')
  expect(drawn).toContain('general-purpose')
  expect(drawn).toContain('Explore')
  // One running line to one node saying how many work; the agents follow as buttons.
  expect(drawn.split('run fan').length - 1).toBe(1)
  expect(drawn).toContain('Sub-agents · 2 working')
  await ui.press({ key: 'agent-a2' })
  await ui.unmount()
  expect(viewed).toEqual(['a2'])

  await $.turn.complete({ turnId: 'ta', agentId: 'a1', answer: 'done', durationMs: 10, isAborted: false, reason: 'answer' })
  const after = await $.ui.mount({ ...BAND, surface: 'vscode' })
  const left = JSON.stringify(await after.drawn())
  await after.unmount()
  expect(left).not.toContain('agent-a1')
  expect(left).toContain('agent-a2')
})

async function bandDrawn($: Engine) {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return drawn
}

test('many sub-agents still make one node, their buttons wrapping to the band', async ($, on) => {
  engine(on, { haiku: 'clarity=goal hard=no risky=no size=small' })
  await start($)
  await $.prompt.submit({ text: 'add a coupon field', wait: false, origin: { kind: 'composer' } })
  await request($, 'high')
  for (const id of ['a1', 'a2', 'c1', 't3']) await $.turn.start({ text: 'work', turnId: `t-${id}`, agentId: id })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, bodyColumns: 40 } })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(drawn.split('run fan').length - 1).toBe(1)
  expect(drawn).toContain('4 working')
  expect(drawn).toContain('flexWrap')
  for (const id of ['a1', 'a2', 'c1', 't3']) expect(drawn).toContain(`agent-${id}`)
})

test('/open-effort off switches this project off, leaving the machine’s default for others', async ($, on) => {
  const { where } = engine(on)
  await start($)
  await $.command.run({ command: 'open-effort', args: 'off', origin: { kind: 'composer' }, presentation: PRESENTATION })
  expect(await bandText($)).toBeUndefined()

  where.root = '/work/other'
  await $.session.start({ cwd: '/work/other', surface: 'desktop', isInteractive: true })
  expect(await bandText($)).toBeDefined()
})

test('in the desktop app, which cannot open an agent from the band, the agents are labels from the start', async ($, on) => {
  engine(on, { haiku: 'clarity=goal hard=no risky=no size=small' })
  await start($)
  await $.prompt.submit({ text: 'add a coupon field', wait: false, origin: { kind: 'composer' } })
  await request($, 'high')
  await $.turn.start({ text: 'review', turnId: 'ta', agentId: 'a1' })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(drawn).toContain('general-purpose')
  expect(drawn.split('"type":"Button"').length - 1).toBe(1)
  expect(drawn).toContain('"type":"Box","props":{"key":"agent-a1"')
})

test('where a press finds the surface draws no main view, it says so once and the agents become plain labels', async ($, on) => {
  const { viewed } = engine(on, { haiku: 'clarity=goal hard=no risky=no size=small', viewDeny: 'no main view here' })
  await start($)
  await $.prompt.submit({ text: 'add a coupon field', wait: false, origin: { kind: 'composer' } })
  await request($, 'high')
  await $.turn.start({ text: 'review', turnId: 'ta', agentId: 'a1' })

  const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  await ui.press({ key: 'agent-a1' })
  await ui.unmount()
  expect(viewed).toEqual(['a1'])

  const after = await $.ui.mount({ ...BAND, surface: 'vscode' })
  const drawn = JSON.stringify(await after.drawn())
  await after.unmount()
  expect(drawn).toContain('general-purpose')
  // The pane's ≡ is the band's only button left; the agent is a label.
  expect(drawn.split('"type":"Button"').length - 1).toBe(1)
  expect(drawn).toContain('"type":"Box","props":{"key":"agent-a1"')
})
