import { expect, test } from 'claude-code/testing'

import { engine, fail, request, start, type } from './engine'

const GOAL = 'clarity=goal hard=no risky=no size=small'
const CLEAR = 'clarity=clear hard=no risky=no size=small sure=90'

test('two failing checks that ran at once both count toward a stall', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await fail($, bash, 1)
  // The test run and the lint run go out in one message, and both come back failing.
  bash.passes = false
  bash.ms = 20
  await Promise.all([$.tool.call({ tool: 'Bash', command: 'npm test' }), $.tool.call({ tool: 'Bash', command: 'npm run lint' })])
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['high'])
})

test('two sub-agent checks that ran at once both count', async ($, on) => {
  const { sent, bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  const ask = (index: number) => $.turn.step({ turnId: 't-a1', index, model: 'claude-opus-5-5', effort: 'medium', messageCount: 1, agentId: 'a1' })
  for await (const _ of ask(0)) {
    // the chunks are not what this test looks at
  }
  await fail($, bash, 1, 'npm test', 'a1')
  bash.passes = false
  bash.ms = 20
  await Promise.all([
    $.tool.call({ tool: 'Bash', command: 'npm test', agentId: 'a1' }),
    $.tool.call({ tool: 'Bash', command: 'npm run lint', agentId: 'a1' }),
  ])
  for await (const _ of ask(1)) {
    // the chunks are not what this test looks at
  }

  expect(sent.filter(e => e.agentId === 'a1').map(e => e.effort)).toEqual(['medium', 'high'])
})

test('a row the person did not type reads no file, lists no command and asks Haiku nothing', async ($, on) => {
  const { asked, looked } = engine(on, { haiku: CLEAR })
  await start($)
  const before = { ...looked }
  await $.prompt.submit({ text: 'The background task finished.', wait: false, origin: { kind: 'task-notification' } })
  await $.prompt.submit({ text: 'ok', wait: false, origin: { kind: 'composer' } })

  expect(looked).toEqual(before)
  expect(asked.length).toBe(0)
})

test('a new task reads the flow file and the session’s commands once', async ($, on) => {
  const { asked, looked } = engine(on, { haiku: CLEAR })
  await start($)
  const before = { ...looked }
  await type($, 'rename getUser to fetchUser')

  expect(asked.length).toBe(1)
  expect(looked).toEqual({ files: before.files + 1, commands: before.commands + 1 })
})

test('after a score that ran out of time, the next prompts wait five seconds until Haiku answers again', async ($, on) => {
  const { asked } = engine(on, { haiku: ['timeout', 'timeout', CLEAR, CLEAR] })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await type($, 'add a coupon field to checkout')
  await type($, 'write a README for the cart module')
  await type($, 'translate the README to Thai')

  expect(asked.map(a => a.timeoutMs)).toEqual([15000, 5000, 5000, 15000])
})
