import { expect, mock, test } from 'claude-code/testing'

import { BAND, bandText, engine, fail, request, run, start, type } from './engine'

const CLEAR = 'clarity=clear hard=no risky=no size=small'
const GOAL = 'clarity=goal hard=no risky=no size=small'
const HARD = 'clarity=unclear hard=yes risky=no size=large'


test('three failing checks in a row climb the task one rung', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await fail($, bash)
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['high'])
})

test('two failing checks are not yet a stall', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await fail($, bash, 2)
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['medium'])
})

test('a passing check starts the count again', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await fail($, bash, 2)
  await run($, bash, 'npm test', true)
  await fail($, bash, 2)
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['medium'])
})

test('commands that are not checks never climb', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await fail($, bash, 3, 'ls missing-folder')
  await fail($, bash, 3, 'cat test.log')
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['medium'])
})

const CHECKS = [
  'npm test',
  'npm run lint',
  'pnpm run typecheck',
  'yarn build',
  'bun test',
  'npx tsc --noEmit',
  'npx vitest run',
  'jest --runInBand',
  'eslint .',
  'pytest -q',
  'python -m pytest tests',
  'mypy src',
  'ruff check .',
  'go test ./...',
  'go vet ./...',
  'cargo clippy',
  'cargo build --release',
  'CI=1 npm run test',
  'cd web && npm test',
  'python -m unittest discover',
  'tox -e py312',
  'cargo nextest run',
  'pnpm -r test',
  'npm --workspaces run test',
  'turbo run test',
  'nx test api',
  'set -o pipefail; npm test 2>&1 | tail -40',
]

// Commands whose exit status does not say whether the check passed: a pipe's last command decides it, `|| true`
// hides a failure, and a run in the background has not ended.
const UNTRUSTED = ['npm test 2>&1 | tail -40', 'pytest | grep FAILED', 'npm test || true', 'go test ./... || :']

for (const command of UNTRUSTED) {
  test(`"${command}" does not count, its exit being someone else’s`, async ($, on) => {
    const { sent, bash } = engine(on, { haiku: GOAL })
    await start($)
    await type($, 'add a coupon field')
    await fail($, bash, 3, command)
    await request($, 'high')

    expect(sent.map(e => e.effort)).toEqual(['medium'])
  })
}

test('a check run in the background does not count', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  bash.passes = false
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Bash', command: 'npm test', run_in_background: true })
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['medium'])
})

for (const command of CHECKS) {
  test(`"${command}" counts as a check`, async ($, on) => {
    const { sent, bash } = engine(on, { haiku: GOAL })
    await start($)
    await type($, 'add a coupon field')
    await fail($, bash, 3, command)
    await request($, 'high')

    expect(sent.map(e => e.effort)).toEqual(['high'])
  })
}

test('the ladder climbs through every effort, then Fable 5.1, then asks the person', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: CLEAR })
  const session = mock.session(on)
  await start($)
  await type($, 'rename getUser to fetchUser')
  for (let i = 0; i < 8; i++) {
    await request($, 'high', i)
    await fail($, bash)
  }
  await request($, 'high', 8)

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    ['claude-opus-5-5', 'low'],
    ['claude-opus-5-5', 'medium'],
    ['claude-opus-5-5', 'high'],
    ['claude-opus-5-5', 'xhigh'],
    ['claude-fable-5-1', 'high'],
    ['claude-fable-5-1', 'xhigh'],
    ['claude-fable-5-1', 'max'],
    ['claude-fable-5-1', 'max'],
    ['claude-fable-5-1', 'max'],
  ])
  const notes = session.appended().filter(row => JSON.stringify(row.message).includes('open-effort'))
  expect(notes.length).toBe(1)
  expect(JSON.stringify(notes[0]?.message)).toContain('ask')
})

test('the first passing check after a climb settles back to the starting effort', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await fail($, bash)
  await request($, 'high', 0)
  await run($, bash, 'npm test', true)
  await request($, 'high', 1)

  expect(sent.map(e => e.effort)).toEqual(['high', 'medium'])
})

test('a task that reached Fable 5.1 stays on it after settling', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: HARD })
  await start($)
  await type($, 'fix the race in the order queue')
  await fail($, bash)
  await request($, 'high', 0)
  await run($, bash, 'npm test', true)
  await request($, 'high', 1)

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    ['claude-fable-5-1', 'high'],
    ['claude-fable-5-1', 'xhigh'],
  ])
})


test('a session already on Fable 5.1 climbs to max, then asks the person', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: HARD })
  const session = mock.session(on)
  await start($)
  await type($, 'fix the race in the order queue')
  await request($, 'high', 0, 'claude-fable-5-1')
  await fail($, bash)
  await request($, 'high', 1, 'claude-fable-5-1')
  await fail($, bash)
  await request($, 'high', 2, 'claude-fable-5-1')

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    ['claude-fable-5-1', 'xhigh'],
    ['claude-fable-5-1', 'max'],
    ['claude-fable-5-1', 'max'],
  ])
  expect(session.appended().filter(row => JSON.stringify(row.message).includes('open-effort')).length).toBe(1)
})

test('a task with no score climbs from the session’s own effort', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: 'timeout' })
  await start($)
  await request($, 'medium', 0)
  await type($, 'tidy the logger')
  await fail($, bash)
  await request($, 'medium', 1)

  expect(sent.map(e => e.effort)).toEqual(['medium', 'high'])
})

test('a new task leaves the last task’s climb behind', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await fail($, bash)
  await type($, 'add a gift card field')
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['medium'])
})

test('a sub-agent’s failing checks do not climb the main session', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  for (let i = 0; i < 3; i++) await run($, bash, 'npm test', false, 'agent-1')
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['medium'])
})

test('the band says the task climbed and why', async ($, on) => {
  const { bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await fail($, bash)

  const text = await bandText($)
  expect(text).toContain('high')
  expect(text).toContain('3 failing checks')
})

test('the band names Fable 5.1 once the task is on it', async ($, on) => {
  const { bash } = engine(on, { settings: { language: 'thai' }, haiku: HARD })
  await start($)
  await type($, 'แก้ race ใน queue')
  await request($, 'high')
  await fail($, bash)

  const text = await bandText($)
  expect(text).toContain('Fable 5.1')
  expect(text).toContain('ไต่ขึ้น')
})

test('while the mod is off, failing checks change nothing', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL, store: { isOn: false } })
  await start($)
  await type($, 'add a coupon field')
  await fail($, bash)
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['high'])
})

test('an answer to Claude keeps the task under way and its climb', async ($, on) => {
  const { sent, bash, asked } = engine(on, {
    haiku: [CLEAR, 'clarity=goal hard=no risky=no size=large model=opus sure=62 continue=yes'],
    said: 'Should I also test the older models, or skip them?',
  })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await fail($, bash)
  await type($, 'ข้ามโมเดลเก่า')
  await request($, 'high')

  expect(asked.at(-1)?.prompt).toContain('Claude said last')
  expect(asked.at(-1)?.prompt).toContain('skip them')
  expect(sent.map(e => e.effort)).toEqual(['medium'])
})

test('new work after a task starts a new task, its climb left behind', async ($, on) => {
  const { sent, bash } = engine(on, {
    haiku: [CLEAR, 'clarity=unclear hard=no risky=no size=small sure=90 continue=no'],
    said: 'Renamed. Anything else?',
  })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await fail($, bash)
  await type($, 'now find why checkout is slow')
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['high'])
})

test('a first prompt goes to Haiku alone, with nothing Claude said', async ($, on) => {
  const { asked } = engine(on, { haiku: CLEAR, said: 'Hello' })
  await start($)
  await type($, 'rename getUser to fetchUser')

  expect(asked.at(-1)?.prompt).toBe('rename getUser to fetchUser')
})

test('while a new prompt waits for its score, its requests leave the last task’s climb aside', async ($, on) => {
  // Each score comes a little after the prompt's grace of 1.2 seconds.
  const { sent, bash } = engine(on, { haiku: 'clarity=clear hard=no risky=no size=small sure=90', haikuDelayMs: 1300 })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await new Promise(resolve => setTimeout(resolve, 300))
  await request($, 'high', 0)
  await fail($, bash)
  await request($, 'high', 1)
  await type($, 'now write the README')
  await request($, 'high', 2)
  await new Promise(resolve => setTimeout(resolve, 300))
  await request($, 'high', 3)

  expect(sent.map(e => e.effort)).toEqual(['low', 'medium', 'high', 'low'])
})

test('settled back on Fable 5.1, the band still names Fable 5.1', async ($, on) => {
  const { bash } = engine(on, { haiku: 'clarity=clear hard=yes risky=no size=small sure=90' })
  await start($)
  await type($, 'fix the race in the cart lock')
  await request($, 'high', 0)
  await fail($, bash)
  await run($, bash, 'npm test', true)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(drawn).toContain('Effort · Fable 5.1')
})

test('a session the person runs at max climbs to Fable 5.1 at max, never down to high', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: 'timeout' })
  await start($)
  await type($, 'fix the race in the cart lock')
  await request($, 'max', 0)
  await fail($, bash)
  await request($, 'max', 1)

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    ['claude-opus-5-5', 'max'],
    ['claude-fable-5-1', 'max'],
  ])
})

test('a climb made before the person switched to a model without xhigh goes out as that model takes it', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: 'clarity=goal hard=no risky=no size=small sure=90' })
  await start($)
  await type($, 'add a coupon field')
  await request($, 'high', 0)
  await fail($, bash)
  await fail($, bash)
  await request($, 'high', 1, 'claude-opus-4-6')

  expect(sent.at(-1)).toMatchObject({ model: 'claude-opus-4-6', effort: 'high' })
})

test('the ladder’s end stops and asks again after a pass, and the band no longer says stopped', async ($, on) => {
  const { bash } = engine(on, { haiku: 'timeout', model: 'claude-fable-5-1' })
  const session = mock.session(on)
  await start($)
  await type($, 'fix the race in the cart lock')
  await request($, 'max', 0, 'claude-fable-5-1')
  await fail($, bash)
  expect(await bandText($)).toContain('Claude will ask you')
  await run($, bash, 'npm test', true)
  expect(await bandText($)).not.toContain('Claude will ask you')
  await fail($, bash)

  const notes = session.appended().map(row => JSON.stringify(row.message)).filter(text => text.includes('Stop retrying'))
  expect(notes.length).toBe(2)
})

test('a test written just before a failing run is the red step, not a stall', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: 'clarity=clear hard=no risky=no size=small sure=90' })
  await start($)
  await type($, 'add a coupon field')
  await request($, 'high', 0)
  await $.tool.call({ tool: 'Edit', file_path: 'src/coupon.test.ts', old_string: 'a', new_string: 'b' } as never)
  await fail($, bash)
  await request($, 'high', 1)

  expect(sent.map(e => e.effort)).toEqual(['low', 'low'])
})
