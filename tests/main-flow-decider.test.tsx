import { expect, test } from 'claude-code/testing'

import { MATT_SKILLS, bandText, engine, paneText, pressPane, start, type } from './engine'

const LARGE = 'clarity=goal hard=no risky=no size=large'
const BORDERLINE = 'clarity=goal hard=no risky=no size=borderline'
const SMALL = 'clarity=goal hard=no risky=no size=small'
const NONE = 'clarity=unclear hard=no risky=no size=none'

/** The notes the mod added to the last prompt, joined. */
function notes(submitted: { context?: readonly string[] }[]): string {
  return (submitted[submitted.length - 1]?.context ?? []).join('\n')
}

test('large implementation work asks the person once whether to take it through the Main Flow', async ($, on) => {
  const { submitted } = engine(on, { haiku: LARGE, matt: MATT_SKILLS })
  await start($)
  await type($, 'add coupons to checkout, with rules, admin screens and tests')

  const note = notes(submitted)
  expect(note).toContain('ask the person once')
  expect(note).toContain('grill-with-docs')
  expect(note).toContain('SKILL.md')
})

test('borderline work has Claude ask the person once, with a recommendation', async ($, on) => {
  const { submitted } = engine(on, { haiku: BORDERLINE, matt: MATT_SKILLS })
  await start($)
  await type($, 'add a coupon field and validate it on the server')

  const note = notes(submitted)
  expect(note).toContain('AskUserQuestion')
  expect(note).toContain('recommend')
})

for (const [name, reply] of [['small work', SMALL], ['work that changes no code', NONE]] as const) {
  test(`${name} stays in normal mode`, async ($, on) => {
    const { submitted } = engine(on, { haiku: reply, matt: MATT_SKILLS })
    await start($)
    await type($, 'some request')

    expect(notes(submitted)).not.toContain('Main Flow')
  })
}

test('without Matt Pocock’s skills, large work stays in normal mode', async ($, on) => {
  const { submitted } = engine(on, { haiku: LARGE })
  await start($)
  await type($, 'add coupons to checkout')

  expect(notes(submitted)).not.toContain('Main Flow')
})

test('Claude Code’s own code-review is not taken for Matt Pocock’s', async ($, on) => {
  const { submitted } = engine(on, { haiku: LARGE, matt: MATT_SKILLS.filter(s => s !== 'code-review') })
  await start($)
  await type($, 'add coupons to checkout')

  expect(notes(submitted)).not.toContain('Main Flow')
})

test('the pane lists the missing Main Flow skills and how to install them', async ($, on) => {
  engine(on, { matt: ['to-spec'] })
  await start($)

  const text = await paneText($)
  for (const skill of MATT_SKILLS.filter(s => s !== 'to-spec')) expect(text).toContain(skill)
  expect(text).toContain('claude plugin marketplace add mattpocock/skills')
  expect(text).toContain('claude plugin install mattpocock-skills@mattpocock')
})

test('the pane lists nothing missing once the skills are installed', async ($, on) => {
  engine(on, { matt: MATT_SKILLS })
  await start($)

  expect(await paneText($)).not.toContain('claude plugin install')
})

test('the Main Flow switched off for this machine keeps large work in normal mode', async ($, on) => {
  const { submitted } = engine(on, { haiku: LARGE, matt: MATT_SKILLS })
  await start($)
  await pressPane($, 'flow-machine-off')
  await type($, 'add coupons to checkout')

  expect(notes(submitted)).not.toContain('Main Flow')
})

test('a project’s Main Flow switch wins over the machine’s, and is kept', async ($, on) => {
  const { submitted } = engine(on, { haiku: LARGE, matt: MATT_SKILLS })
  await start($)
  await pressPane($, 'flow-machine-off')
  await pressPane($, 'flow-project-on')
  await start($)
  await type($, 'add coupons to checkout')

  expect(notes(submitted)).toContain('Main Flow')
})

test('the Main Flow switch and the mod switch are kept apart', async ($, on) => {
  engine(on, { matt: MATT_SKILLS })
  await start($)
  await pressPane($, 'flow-project-off')

  expect(await bandText($)).toBeDefined()
})

test('while the mod is off, nothing enters the Main Flow', async ($, on) => {
  const { submitted } = engine(on, { haiku: LARGE, matt: MATT_SKILLS, store: { isOn: false } })
  await start($)
  await type($, 'add coupons to checkout')

  expect(notes(submitted)).not.toContain('Main Flow')
})
