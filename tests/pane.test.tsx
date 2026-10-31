import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { BAND, PANE, PRESENTATION, bandText, engine, fail, finish, paneText, pressPane, request, start, type } from './engine'

const GOAL = 'clarity=goal hard=no risky=no size=small'

async function pressBand($: Engine, key: string) {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key })
  await ui.unmount()
}

test('/open-effort opens the pane', async ($, on) => {
  const { opened } = engine(on)
  await start($)
  await $.command.run({ command: 'open-effort', args: '', origin: { kind: 'composer' }, presentation: PRESENTATION })

  expect(opened).toEqual(['open-effort'])
})

test('the band’s ≡ opens the pane, and closes it on a second press', async ($, on) => {
  const { opened } = engine(on)
  await start($)
  await pressBand($, 'pane')
  expect(opened).toEqual(['open-effort'])

  await pressBand($, 'pane')
  expect(opened).toEqual([])
})

test('a finished turn shows in the history with its effort and why', async ($, on) => {
  engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await request($, 'high')
  await finish($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const text = await paneText($, surface)
    expect(text).toContain('medium')
    expect(text).toContain('goal known')
    expect(text).toContain('Opus 5.5')
  }
})

test('the history counts climbs', async ($, on) => {
  const { bash } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await request($, 'high', 0)
  await fail($, bash)
  await request($, 'high', 1)
  await finish($)

  const text = await paneText($)
  expect(text).toContain('start medium')
  expect(text).toContain('medium → high')
  expect(text).toContain('climbed 1')
})

test('the history chart names each recent turn and counts them all', async ($, on) => {
  engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  for (let i = 0; i < 60; i++) {
    await request($, 'high', i)
    await finish($)
  }

  const text = await paneText($)
  expect(text).toContain('60 turns')
  expect(text.split('\n').filter(line => line.includes('goal known')).length).toBeGreaterThan(20)
})

test('nothing the person typed is kept', async ($, on) => {
  const { written } = engine(on, { haiku: GOAL })
  await start($)
  await type($, 'apply coupon SAVE50 for customer Somchai')
  await request($, 'high')
  await finish($)

  expect(await paneText($)).not.toContain('SAVE50')
  expect(written.length).toBeGreaterThan(0)
  expect(written.join('\n')).not.toContain('SAVE50')
  expect(written.join('\n')).not.toContain('Somchai')
})

test('the history is kept per project', async ($, on) => {
  engine(on, { haiku: GOAL })
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await type($, 'add a coupon field')
  await request($, 'high')
  await finish($)
  await $.session.start({ cwd: '/work/other', surface: 'desktop', isInteractive: true })

  expect(await paneText($)).not.toContain('goal known')

  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  expect(await paneText($)).toContain('goal known')
})

test('the history keeps the last 500 turns', async ($, on) => {
  engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  for (let i = 0; i < 502; i++) {
    await request($, 'high', i)
    await finish($)
  }

  expect(await paneText($)).toContain('500')
})

test('the pane switches the mod off for this machine', async ($, on) => {
  engine(on)
  await start($)
  await pressPane($, 'machine-off')

  expect(await bandText($)).toBeUndefined()
})

test('a project switched on wins over the machine switched off', async ($, on) => {
  engine(on)
  await start($)
  await pressPane($, 'machine-off')
  await pressPane($, 'project-on')

  expect(await bandText($)).toBeDefined()
})

test('a project switched off stays off in its next session', async ($, on) => {
  engine(on)
  await start($)
  await pressPane($, 'project-off')
  await start($)

  expect(await bandText($)).toBeUndefined()
})

test('the pane picks the language, over Claude Code’s own', async ($, on) => {
  engine(on, { settings: { language: 'english' } })
  await start($)
  await pressPane($, 'language-th')

  expect(await bandText($)).toContain('ใช้อยู่')
  expect(await paneText($)).toContain('ภาษา')
})

test('the language picked stays for the next session', async ($, on) => {
  engine(on, { settings: { language: 'thai' } })
  await start($)
  await pressPane($, 'language-en')
  await start($)

  expect(await bandText($)).toContain("session's own")
})

test('the chart draws amber only for a real climb, not for an effort changed by a new prompt', async ($, on) => {
  engine(on, { haiku: ['clarity=unclear hard=no risky=no size=small', 'clarity=goal hard=no risky=no size=small'] })
  await start($)
  await type($, 'add a coupon field')
  await request($, 'high', 0)
  await type($, 'and show it on the cart too')
  await request($, 'high', 1)
  await finish($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(drawn.match(/class=\\"bar shift\\" x=/g)?.length).toBe(2)
  expect(drawn.match(/class=\\"bar amber\\" x=/g)?.length).toBe(1)
})

test('a shell cd into another repository does not move the history', async ($, on) => {
  engine(on, { haiku: GOAL, root: '/work' })
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await type($, 'add a coupon field')
  await request($, 'high')
  await finish($)
  // The session starts again (a resume) with its working directory moved into a nested repository by a shell cd.
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })

  expect(await paneText($)).toContain('goal known')
})

test('a session moved to another project shows that project’s history from its next prompt', async ($, on) => {
  const { where } = engine(on, { haiku: GOAL })
  await $.session.start({ cwd: '/work/app', surface: 'desktop', isInteractive: true })
  await type($, 'add a coupon field')
  await request($, 'high')
  await finish($)
  // The host moves the session to another folder: no new session starts, the root changes.
  where.root = '/work/other'
  await type($, 'look at the other repo')
  expect(await paneText($)).not.toContain('goal known')

  where.root = '/work/app'
  await type($, 'and the cart too')
  expect(await paneText($)).toContain('goal known')
})

test('a finished turn joins what the store holds now, not only what the session loaded', async ($, on) => {
  const { store } = engine(on, { haiku: GOAL })
  await start($)
  // Another session in the same project writes its turn meanwhile.
  store.set('history:/work/app', [{ at: 1, mode: 'normal', score: null, stage: null, start: 'low', efforts: ['low'], models: ['claude-opus-5-5'], climbs: 0 }])
  await type($, 'add a coupon field')
  await request($, 'high')
  await finish($)

  expect((store.get('history:/work/app') as unknown[]).length).toBe(2)
})

test('the pane picks a colour theme, which the band draws in and the next session keeps', async ($, on) => {
  engine(on, { haiku: GOAL })
  await start($)
  await type($, 'add a coupon field')
  await request($, 'high')
  const drawnIn = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const drawn = JSON.stringify(await ui.drawn())
    await ui.unmount()
    return drawn
  }
  expect(await drawnIn()).toContain('#d97757')

  await pressPane($, 'theme-ocean')
  const ocean = await drawnIn()
  expect(ocean).toContain('#38bdf8')
  expect(ocean).not.toContain('#d97757')

  await start($)
  await type($, 'add a coupon field')
  await request($, 'high')
  expect(await drawnIn()).toContain('#38bdf8')
})

test('the pane lists the four themes', async ($, on) => {
  engine(on)
  await start($)
  const text = await paneText($)
  for (const name of ['Claude', 'Lime', 'Ocean', 'Rose']) expect(text).toContain(name)
})
