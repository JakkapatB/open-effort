import { expect, mock, test } from 'claude-code/testing'

import { MATT_SKILLS, bandText, engine, fail, finish, request, start, type } from './engine'

const SCORES = [
  ['a clear plan starts at low', 'clarity=clear hard=no risky=no size=small', 'low'],
  ['a known goal starts at medium', 'clarity=goal hard=no risky=no size=small', 'medium'],
  ['an unclear plan starts at high', 'clarity=unclear hard=no risky=no size=none', 'high'],
  ['unusually hard work starts at xhigh', 'clarity=clear hard=yes risky=no size=large', 'xhigh'],
  ['risky work with a clear plan starts at medium', 'clarity=clear hard=no risky=yes size=small', 'medium'],
  ['risky work keeps a higher effort its plan gives', 'clarity=unclear hard=no risky=yes size=large', 'high'],
  ['the hardest, riskiest, least clear work starts at xhigh, never max', 'clarity=unclear hard=yes risky=yes size=large', 'xhigh'],
] as const

for (const [name, reply, effort] of SCORES) {
  test(name, async ($, on) => {
    const { sent } = engine(on, { haiku: reply })
    await start($)
    await type($, 'some request')
    await request($, 'high')

    expect(sent.map(e => e.effort)).toEqual([effort])
  })
}

test('every request of a task goes out at its starting effort, on the session model', async ($, on) => {
  const { sent } = engine(on, { haiku: 'clarity=clear hard=no risky=no size=small' })
  await start($)
  await type($, 'rename getUser to fetchUser everywhere')
  await request($, 'high', 0)
  await request($, 'high', 1)

  expect(sent.map(e => [e.model, e.effort])).toEqual([
    ['claude-opus-5-5', 'low'],
    ['claude-opus-5-5', 'low'],
  ])
})

test('Haiku is asked once, with the whole request', async ($, on) => {
  const { asked } = engine(on)
  await start($)
  await type($, 'add a coupon field to the checkout form and validate it on the server')

  expect(asked.length).toBe(1)
  expect(asked[0]?.model).toContain('haiku')
  expect(asked[0]?.prompt).toContain('add a coupon field to the checkout form and validate it on the server')
  expect(asked[0]?.timeoutMs).toBe(15000)
})

for (const reply of ['ok', 'go on', 'ทำต่อ', 'ได้เลยครับ', 'ทำต่อสิ', 'ต่อเลยจ้า', 'ทำต่อหน่อย', 'ท\u0e4d\u0e32ต่อสิ']) {
  test(`"${reply}" stays in the task under way without a new score`, async ($, on) => {
    const { sent, asked } = engine(on, { haiku: 'clarity=unclear hard=no risky=no size=none' })
    await start($)
    await type($, 'why does the cart total drift after a refresh?')
    await type($, reply)
    await request($, 'medium')

    expect(asked.length).toBe(1)
    expect(sent.map(e => e.effort)).toEqual(['high'])
  })
}

for (const haiku of ['timeout', 'fail'] as const) {
  test(`a score that ends in ${haiku} leaves the session's own effort`, async ($, on) => {
    const { sent } = engine(on, { haiku })
    await start($)
    await type($, 'tidy up the logger')
    await request($, 'medium')

    expect(sent.map(e => e.effort)).toEqual(['medium'])
  })
}

test('a new task that could not be scored does not keep the last task’s effort', async ($, on) => {
  const { sent } = engine(on, { haiku: ['clarity=clear hard=no risky=no size=small', 'timeout'] })
  await start($)
  await type($, 'rename a variable')
  await request($, 'high', 0)
  await type($, 'now design the sync protocol for offline carts')
  await request($, 'high', 1)

  expect(sent.map(e => e.effort)).toEqual(['low', 'high'])
})

test('a request to a model that takes no effort is sent with none', async ($, on) => {
  const { sent } = engine(on, { haiku: 'clarity=clear hard=no risky=no size=small' })
  await start($)
  await type($, 'rename a variable')
  await request($, 'none')

  expect(sent.map(e => e.effort)).toEqual([undefined])
})

test('the band shows the starting effort and why', async ($, on) => {
  engine(on, { haiku: 'clarity=clear hard=no risky=yes size=small' })
  await start($)
  await type($, 'change the refund rounding')
  await request($, 'high')

  const text = await bandText($)
  expect(text).toContain('medium')
  expect(text).toContain('clear plan')
  expect(text).toContain('risky')
})

test('the band gives the reason in Thai', async ($, on) => {
  engine(on, { settings: { language: 'thai' }, haiku: 'clarity=unclear hard=yes risky=no size=large' })
  await start($)
  await type($, 'ทำไม queue ถึงค้าง')
  await request($, 'high')

  const text = await bandText($)
  expect(text).toContain('xhigh')
  expect(text).toContain('ยากพิเศษ')
})

test('while the mod is off, nothing is scored and requests go out as they came', async ($, on) => {
  const { sent, asked } = engine(on, { haiku: 'clarity=clear hard=no risky=no size=small', store: { isOn: false } })
  await start($)
  await type($, 'rename a variable')
  await request($, 'high')

  expect(asked.length).toBe(0)
  expect(sent.map(e => e.effort)).toEqual(['high'])
})

test('Haiku scores at low effort and says how sure it is', async ($, on) => {
  const { asked, sent } = engine(on, { haiku: 'clarity=clear hard=no risky=no size=small sure=90' })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await request($, 'high')

  expect(asked[0]?.effort).toBe('low')
  expect(asked[0]?.system).toContain('sure=')
  expect(sent.map(e => e.effort)).toEqual(['low'])
})

test('a reading Haiku is unsure of never starts below medium, and says so', async ($, on) => {
  const { sent } = engine(on, { haiku: 'clarity=clear hard=no risky=no size=small sure=40' })
  await start($)
  await type($, 'fix it')
  await request($, 'high')

  expect(sent.map(e => e.effort)).toEqual(['medium'])
  expect(await bandText($)).toContain('unsure')
})

test('the prompt does not wait for a slow score; its requests take the score once it comes', async ($, on) => {
  const { sent } = engine(on, { haiku: 'clarity=goal hard=no risky=no size=small sure=90', haikuDelayMs: 1500 })
  await start($)
  await type($, 'add a coupon field')
  await request($, 'high', 0)
  await new Promise(resolve => setTimeout(resolve, 1700))
  await request($, 'high', 1)

  expect(sent.map(e => e.effort)).toEqual(['high', 'medium'])
})

test('a slow score sends its question for Claude as a row once it comes', async ($, on) => {
  engine(on, { haiku: 'clarity=goal hard=no risky=no size=large sure=90', haikuDelayMs: 1500, matt: MATT_SKILLS })
  const session = mock.session(on)
  await start($)
  await type($, 'add coupons to checkout')
  await $.turn.start({ text: 'add coupons to checkout', turnId: 't1' })
  await new Promise(resolve => setTimeout(resolve, 1700))

  expect(session.appended().map(row => JSON.stringify(row.message)).join('\n')).toContain('ask the person once')
})

test('a slow score that comes after the turn ended sends no question', async ($, on) => {
  engine(on, { haiku: 'clarity=goal hard=no risky=no size=large sure=90', haikuDelayMs: 1500, matt: MATT_SKILLS })
  const session = mock.session(on)
  await start($)
  await type($, 'add coupons to checkout')
  await $.turn.start({ text: 'add coupons to checkout', turnId: 't1' })
  await finish($)
  await new Promise(resolve => setTimeout(resolve, 1700))

  expect(session.appended().map(row => JSON.stringify(row.message)).join('\n')).not.toContain('ask the person once')
})

test('a Haiku call that throws still ends the wait for its score', async ($, on) => {
  const { sent } = engine(on, { haiku: 'throw', matt: MATT_SKILLS })
  await start($)
  await type($, 'rename a variable')
  await $.prompt.submit({ text: '/mattpocock-skills:to-spec', command: { name: 'mattpocock-skills:to-spec', args: '' }, wait: false, origin: { kind: 'composer' } })
  await request($, 'low', 0)

  // Not left waiting for a score that never comes: the stage's effort, not the session's own.
  expect(sent.map(e => e.effort)).toEqual(['high'])
})

test('a command typed with words after it is new work, scored like a prompt', async ($, on) => {
  const { sent, asked, bash } = engine(on, { haiku: ['clarity=clear hard=yes risky=no size=small', 'clarity=clear hard=no risky=no size=small'] })
  await start($)
  await type($, 'fix the race in the cart lock')
  await request($, 'high', 0)
  await fail($, bash)
  await $.prompt.submit({ text: '/fix-typo the README title', command: { name: 'fix-typo', args: 'the README title' }, wait: false, origin: { kind: 'composer' } })
  await request($, 'high', 1)

  expect(asked.length).toBe(2)
  expect(sent.map(e => [e.model, e.effort])).toEqual([
    ['claude-opus-5-5', 'xhigh'],
    ['claude-opus-5-5', 'low'],
  ])
})


test('a message typed over a running turn stays in the task under way', async ($, on) => {
  const { asked, sent } = engine(on, { haiku: 'clarity=clear hard=no risky=no size=small sure=90' })
  await start($)
  await type($, 'rename getUser to fetchUser')
  await $.prompt.submit({ text: 'do not ask me, check it yourself', wait: false, origin: { kind: 'composer' }, turnId: 't1' })
  await request($, 'high')

  expect(asked.length).toBe(1)
  expect(sent.map(e => e.effort)).toEqual(['low'])
})

test('a score asked for before the session started again does not reach the new session', async ($, on) => {
  engine(on, { haiku: 'clarity=goal hard=no risky=no size=large sure=90', haikuDelayMs: 1500, matt: MATT_SKILLS })
  const session = mock.session(on)
  await start($)
  await type($, 'add coupons to checkout')
  await start($)
  await $.turn.start({ text: 'hello', turnId: 't2' })
  await new Promise(resolve => setTimeout(resolve, 1700))

  expect(session.appended().map(row => JSON.stringify(row.message)).join('\n')).not.toContain('ask the person once')
  expect(await bandText($)).not.toContain('goal known')
})
