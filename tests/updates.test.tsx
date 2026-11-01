import { expect, test } from 'claude-code/testing'

import { BAND, DAY_MS, PANE, SURFACES, engine, paneText, pressPane, start } from './engine'

const INSTALLED = { '.claude-plugin/plugin.json': JSON.stringify({ name: 'open-effort', version: '0.3.0' }) }
const NEWER = JSON.stringify({ name: 'open-effort', version: '0.4.0' })
const SAME = JSON.stringify({ name: 'open-effort', version: '0.3.0' })

/** The daily read runs in the background as the session starts: let it finish. */
async function settle() {
  await new Promise(resolve => setTimeout(resolve, 30))
}

test('as a session starts, the mod reads the newest version once, and shows it with the installed one', async ($, on) => {
  const { fetched } = engine(on, { files: INSTALLED, latest: NEWER })
  await start($)
  await settle()

  expect(fetched).toEqual(['https://raw.githubusercontent.com/JakkapatB/open-effort/main/.claude-plugin/plugin.json'])
  const pane = await paneText($)
  expect(pane).toContain('Installed: 0.3.0')
  expect(pane).toContain('0.4.0')
})

test('the daily read happens once a day, not every session', async ($, on) => {
  const { fetched, clock } = engine(on, { files: INSTALLED, latest: SAME })
  await start($)
  await settle()
  clock.now += 60 * 60 * 1000
  await start($)
  await settle()
  expect(fetched.length).toBe(1)
  clock.now += DAY_MS
  await start($)
  await settle()

  expect(fetched.length).toBe(2)
})

test('with the daily check switched off, nothing is read until Check is pressed', async ($, on) => {
  const { fetched } = engine(on, { files: INSTALLED, latest: SAME, store: { checkUpdates: false } })
  await start($)
  await settle()
  expect(fetched).toEqual([])
  await pressPane($, 'update-check')
  await settle()

  expect(fetched.length).toBe(1)
  expect(await paneText($)).toContain('0.3.0 is the newest')
})

test('Check reads at once, even right after the daily read', async ($, on) => {
  const { fetched } = engine(on, { files: INSTALLED, latest: SAME })
  await start($)
  await settle()
  await pressPane($, 'update-check')
  await settle()

  expect(fetched.length).toBe(2)
})

test('the switch turns the daily check off and on, kept for the machine', async ($, on) => {
  const { store } = engine(on, { files: INSTALLED, latest: SAME })
  await start($)
  await settle()
  await pressPane($, 'updates-daily-off')

  expect(store.get('checkUpdates')).toBe(false)
  expect(await paneText($)).toContain('Check for updates daily')
})

test('a failed read says nothing alarming, keeps the last result, and is tried again next session', async ($, on) => {
  const { fetched } = engine(on, { files: INSTALLED, latest: 'fail', store: { latestVersion: { at: Date.UTC(2026, 9, 29), version: '0.4.0' } } })
  await start($)
  await settle()

  expect(fetched.length).toBe(1)
  const pane = await paneText($)
  expect(pane).toContain('0.4.0')
  expect(pane).not.toMatch(/error|failed/i)
})

test('a read that never answers holds nothing: the pane draws at once', async ($, on) => {
  engine(on, { files: INSTALLED, latest: 'never' })
  await start($)

  expect(await paneText($)).toContain('Installed: 0.3.0')
})

test('the updates section speaks Thai', async ($, on) => {
  engine(on, { files: INSTALLED, latest: SAME, settings: { language: 'thai' } })
  await start($)
  await settle()

  const pane = await paneText($)
  expect(pane).toContain('ที่ติดตั้งอยู่: 0.3.0')
  expect(pane).toContain('เช็คอัปเดตวันละครั้ง')
})

/** The label of the band's button that opens the pane. */
async function paneButton($: Parameters<typeof start>[0]) {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return /"key":"pane","label":"([^"]*)"/.exec(drawn)?.[1]
}

test('a newer version shows a card at the top of the pane and a dot on the band’s ≡', async ($, on) => {
  engine(on, { files: INSTALLED, latest: NEWER })
  await start($)
  await settle()

  const pane = await paneText($)
  expect(pane).toContain('0.4.0 is out · you have 0.3.0')
  expect(pane.indexOf('0.4.0 is out · you have 0.3.0')).toBeLessThan(pane.indexOf('Switch'))
  expect(pane).toContain('github.com/JakkapatB/open-effort/releases')
  expect(await paneButton($)).toBe('≡ ●')
})

for (const [name, latest] of [['the same version', SAME], ['an older version', JSON.stringify({ version: '0.2.0' })]] as const) {
  test(`${name} shows no card and no dot`, async ($, on) => {
    engine(on, { files: INSTALLED, latest })
    await start($)
    await settle()

    expect(await paneText($)).not.toContain('is out · you have')
    expect(await paneButton($)).toBe('≡')
  })
}

test('switching the daily check off keeps a newer version already read', async ($, on) => {
  engine(on, { files: INSTALLED, latest: NEWER })
  await start($)
  await settle()
  await pressPane($, 'updates-daily-off')

  expect(await paneText($)).toContain('0.4.0 is out · you have 0.3.0')
  expect(await paneButton($)).toBe('≡ ●')
})

const BIN = '/Applications/Claude.app/Contents/Resources/claude'

test('Update runs Claude Code’s own update, both steps in order, then offers Reload, which reloads plugins', async ($, on) => {
  const { ran, commands } = engine(on, { files: INSTALLED, latest: NEWER, env: { CLAUDE_CODE_EXECPATH: BIN } })
  await start($)
  await settle()
  await pressPane($, 'update-run')

  expect(ran).toEqual([
    [BIN, 'plugin', 'marketplace', 'update', 'open-effort'],
    [BIN, 'plugin', 'update', 'open-effort@open-effort'],
  ])
  const pane = await paneText($)
  expect(pane).toContain('Updated to 0.4.0')
  expect(pane).toContain('prompt cache')
  await pressPane($, 'update-reload')
  expect(commands).toContainEqual({ command: 'reload-plugins', args: '' })
})

test('with no Claude Code binary named, Update runs `claude` from the PATH', async ($, on) => {
  const { ran } = engine(on, { files: INSTALLED, latest: NEWER })
  await start($)
  await settle()
  await pressPane($, 'update-run')

  expect(ran[0]?.[0]).toBe('claude')
})

test('a step that fails stops the update, says why, and gives the command to run', async ($, on) => {
  const { ran } = engine(on, { files: INSTALLED, latest: NEWER, env: { CLAUDE_CODE_EXECPATH: BIN }, processes: [{ exitCode: 1, stderr: 'Cloning…\nfatal: unable to access github.com' }] })
  await start($)
  await settle()
  await pressPane($, 'update-run')

  expect(ran.length).toBe(1)
  const pane = await paneText($)
  expect(pane).toContain('fatal: unable to access github.com')
  expect(pane).toContain('claude plugin marketplace update open-effort && claude plugin update open-effort@open-effort')
  expect(pane).not.toContain('Reload now')
})

test('when Claude Code cannot be run at all, the pane says so and gives the command', async ($, on) => {
  engine(on, { files: INSTALLED, latest: NEWER, processes: ['throw'] })
  await start($)
  await settle()
  await pressPane($, 'update-run')

  const pane = await paneText($)
  expect(pane).toContain('Claude Code could not be run from here')
  expect(pane).toContain('claude plugin update open-effort@open-effort')
})

test('the update card speaks Thai', async ($, on) => {
  engine(on, { files: INSTALLED, latest: NEWER, settings: { language: 'thai' } })
  await start($)
  await settle()

  const pane = await paneText($)
  expect(pane).toContain('มี 0.4.0 แล้ว · ที่ติดตั้งอยู่ 0.3.0')
  expect(pane).toContain('อัปเดตเลย')
})

/**
 * Every Box that lays several children side by side, a Button among them, either wraps them or is the pane's own
 * label-and-control row: so no row of buttons runs past a narrow pane. Returns the offending Boxes' child counts.
 */
function unwrappedButtonRows(node: unknown, found: number[] = []): number[] {
  if (Array.isArray(node)) {
    node.forEach(n => unwrappedButtonRows(n, found))
    return found
  }
  if (!node || typeof node !== 'object') return found
  const { type, props, children } = node as { type?: string; props?: Record<string, unknown>; children?: unknown }
  const kids = Array.isArray(children) ? children.flat(3).filter(Boolean) : []
  const isRow = type === 'Box' && props?.flexDirection !== 'column'
  const buttons = kids.filter(k => (k as { type?: string }).type === 'Button').length
  const isLabelAndControl = props?.justifyContent === 'space-between' && kids.length === 2
  if (isRow && kids.length > 1 && buttons > 0 && props?.flexWrap !== 'wrap' && !isLabelAndControl) found.push(kids.length)
  unwrappedButtonRows(children, found)
  return found
}

for (const surface of SURFACES) {
  for (const columns of [30, 60, 120]) {
    for (const [name, processes] of [['the card offering an update', undefined], ['the card after an update', [{ exitCode: 0 }]], ['the card after a failed update', ['throw']]] as const) {
      test(`on ${surface} at ${columns} columns, ${name} wraps every row of buttons`, async ($, on) => {
        engine(on, { files: INSTALLED, latest: NEWER, ...(processes ? { processes } : {}) })
        await start($)
        await settle()
        if (processes) await pressPane($, 'update-run')

        const ui = await $.ui.mount({ ...PANE, surface, props: { ...PANE.props, bodyColumns: columns } })
        const drawn = await ui.drawn()
        await ui.unmount()
        expect(drawn).toBeTruthy()
        expect(unwrappedButtonRows(drawn)).toEqual([])
      })
    }
  }
}

for (const surface of SURFACES) {
  for (const columns of [30, 60, 120]) {
    test(`on ${surface} at ${columns} columns, the band draws with the update dot`, async ($, on) => {
      engine(on, { files: INSTALLED, latest: NEWER })
      await start($)
      await settle()

      const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: columns } })
      const drawn = JSON.stringify(await ui.drawn())
      await ui.unmount()
      expect(drawn).toContain('≡ ●')
    })
  }
}
