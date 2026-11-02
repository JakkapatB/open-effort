import { expect, test } from 'claude-code/testing'

import { isNewer } from '../hooks/update'
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

/** The label of the band's coloured button, when it shows one. */
async function updateButton($: Parameters<typeof start>[0], surface: (typeof SURFACES)[number] = 'desktop') {
  const ui = await $.ui.mount({ ...BAND, surface })
  const drawn = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return /"key":"update","label":"([^"]*)","variant":"primary"/.exec(drawn)?.[1] ?? /"label":"([^"]*)","variant":"primary"/.exec(drawn)?.[1]
}

/** The timer that looks for a new version comes round. */
async function tick(timers: (() => void)[]) {
  for (const fire of timers.splice(0)) fire()
  await settle()
}

test('a newer version shows a card at the top of the pane and a coloured button on the band', async ($, on) => {
  engine(on, { files: INSTALLED, latest: NEWER })
  await start($)
  await settle()

  const pane = await paneText($)
  expect(pane).toContain('0.4.0 is out · you have 0.3.0')
  expect(pane.indexOf('0.4.0 is out · you have 0.3.0')).toBeLessThan(pane.indexOf('Switch'))
  expect(pane).toContain('Releases on GitHub')
  expect(await updateButton($)).toBe('↑ Update')
  expect(await paneButton($)).toBe('≡')
})

for (const [name, latest] of [['the same version', SAME], ['an older version', JSON.stringify({ version: '0.2.0' })]] as const) {
  test(`${name} shows no card and no button`, async ($, on) => {
    engine(on, { files: INSTALLED, latest })
    await start($)
    await settle()

    expect(await paneText($)).not.toContain('is out · you have')
    expect(await updateButton($)).toBeUndefined()
    expect(await paneButton($)).toBe('≡')
  })
}

test('switching the daily check off keeps a newer version already read', async ($, on) => {
  engine(on, { files: INSTALLED, latest: NEWER })
  await start($)
  await settle()
  await pressPane($, 'updates-daily-off')

  expect(await paneText($)).toContain('0.4.0 is out · you have 0.3.0')
  expect(await updateButton($)).toBe('↑ Update')
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
    test(`on ${surface} at ${columns} columns, the band draws with the update button`, async ($, on) => {
      engine(on, { files: INSTALLED, latest: NEWER })
      await start($)
      await settle()

      const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: columns } })
      const drawn = JSON.stringify(await ui.drawn())
      await ui.unmount()
      expect(drawn).toContain('↑ Update')
      expect(drawn).toContain('≡')
    })
  }
}

// Read the day before the clock's start: the next daily read is due.
const READ_EARLIER = { latestVersion: { at: Date.UTC(2026, 9, 30, 6, 0), version: '0.4.0' } }
// Read an hour before: no daily read is due.
const READ_RECENTLY = { latestVersion: { at: Date.UTC(2026, 9, 31, 6, 0), version: '0.4.0' } }

test('versions compare by their numbers', () => {
  expect(isNewer('0.10.0', '0.9.0')).toBe(true)
  expect(isNewer('1.0.0', '0.99.99')).toBe(true)
  expect(isNewer('0.3.0', '0.3.0')).toBe(false)
  expect(isNewer('0.2.9', '0.3.0')).toBe(false)
})

test('a check that never answers gives up after a few seconds, and Check can be pressed again', async ($, on) => {
  engine(on, { files: INSTALLED, latest: 'never', store: { checkUpdates: false }, isQuick: true })
  await start($)
  await pressPane($, 'update-check')

  const pane = await paneText($)
  expect(pane).toContain('Check now')
  expect(pane).not.toContain('checking…')
})

test('a pressed Check that cannot reach GitHub says so, and keeps the newest version already known', async ($, on) => {
  engine(on, { files: INSTALLED, latest: 'fail', store: READ_RECENTLY })
  await start($)
  await settle()
  await pressPane($, 'update-check')

  const pane = await paneText($)
  expect(pane).toContain("Couldn't reach GitHub just now")
  expect(pane).toContain('0.4.0 is out')
})

test('a check that finishes during an update leaves the update alone: one update, and its Reload stays', async ($, on) => {
  const { ran } = engine(on, { files: INSTALLED, latest: 'never', store: READ_EARLIER, isQuick: true })
  await start($)
  // The daily read is still out when Update is pressed, and gives up after it.
  await pressPane($, 'update-run')
  await new Promise(resolve => setTimeout(resolve, 120))

  expect(ran.length).toBe(2)
  const pane = await paneText($)
  expect(pane).toContain('Updated to 0.4.0')
  expect(pane).toContain('Reload now')
})

test('Check after an update keeps its Reload button', async ($, on) => {
  engine(on, { files: INSTALLED, latest: NEWER })
  await start($)
  await settle()
  await pressPane($, 'update-run')
  await pressPane($, 'update-check')

  expect(await paneText($)).toContain('Reload now')
})

test('a failing store write during a check does not leave the pane checking', async ($, on) => {
  engine(on, { files: INSTALLED, latest: SAME, store: { checkUpdates: false }, failingKeys: ['latestVersion'] })
  await start($)
  // The press itself fails with the store; the pane is unmounted all the same.
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'update-check' }).catch(() => undefined)
  await ui.unmount()

  expect(await paneText($)).toContain('Check now')
})

test('the band’s button opens the pane, and leaves it open when it already shows', async ($, on) => {
  const { opened } = engine(on, { files: INSTALLED, latest: NEWER })
  await start($)
  await settle()
  for (const times of [1, 2]) {
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    await ui.press({ key: 'update' })
    await ui.unmount()
    expect(opened.filter(id => id === 'open-effort').length).toBe(times)
  }
})

test('a failed update still says Update on the band', async ($, on) => {
  engine(on, { files: INSTALLED, latest: NEWER, processes: [{ exitCode: 1, stderr: 'no' }] })
  await start($)
  await settle()
  await pressPane($, 'update-run')

  expect(await updateButton($)).toBe('↑ Update')
})

test('once updated, the band’s button says Reload', async ($, on) => {
  engine(on, { files: INSTALLED, latest: NEWER })
  await start($)
  await settle()
  await pressPane($, 'update-run')

  expect(await updateButton($)).toBe('↻ Reload')
})

test('the band’s button speaks Thai', async ($, on) => {
  engine(on, { files: INSTALLED, latest: NEWER, settings: { language: 'thai' } })
  await start($)
  await settle()

  expect(await updateButton($)).toBe('↑ อัปเดต')
  expect(await updateButton($, 'terminal')).toBe('↑ อัปเดต')
})

test('a version another session read reaches an open session at a tick, with no network read', async ($, on) => {
  const { fetched, store, timers } = engine(on, { files: INSTALLED, latest: SAME, store: { latestVersion: { at: Date.UTC(2026, 9, 31, 6, 0), version: '0.3.0' } } })
  await start($)
  await settle()
  expect(await updateButton($)).toBeUndefined()
  store.set('latestVersion', { at: Date.UTC(2026, 9, 31, 6, 30), version: '0.4.0' })
  await tick(timers)

  expect(await updateButton($)).toBe('↑ Update')
  expect(fetched).toEqual([])
})

test('a kept version older than what the session knows does not take its place', async ($, on) => {
  const { store, timers } = engine(on, { files: INSTALLED, latest: NEWER })
  await start($)
  await settle()
  store.set('latestVersion', { at: Date.UTC(2026, 9, 31, 7, 0), version: '0.3.0' })
  await tick(timers)

  expect(await updateButton($)).toBe('↑ Update')
})

test('an open session reads GitHub at a tick once the day is up, and not before', async ($, on) => {
  const { fetched, clock, timers } = engine(on, { files: INSTALLED, latest: NEWER, store: { latestVersion: { at: Date.UTC(2026, 9, 31, 6, 0), version: '0.3.0' } } })
  await start($)
  await settle()
  await tick(timers)
  expect(fetched.length).toBe(0)
  expect(await updateButton($)).toBeUndefined()
  clock.now += DAY_MS
  await tick(timers)

  expect(fetched.length).toBe(1)
  expect(await updateButton($)).toBe('↑ Update')
})

test('with the daily check switched off in the pane, a tick reads nothing', async ($, on) => {
  const { fetched, clock, timers } = engine(on, { files: INSTALLED, latest: NEWER, store: { latestVersion: { at: Date.UTC(2026, 9, 31, 6, 0), version: '0.3.0' } } })
  await start($)
  await settle()
  await pressPane($, 'updates-daily-off')
  clock.now += DAY_MS
  await tick(timers)

  expect(fetched).toEqual([])
})

test('a session started again keeps one timer', async ($, on) => {
  const { timers } = engine(on, { files: INSTALLED, latest: SAME })
  await start($)
  await settle()
  await start($)
  await settle()

  expect(timers.length).toBe(1)
})
