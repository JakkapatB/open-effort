/** Where the newest released version is read: plugin.json on main, which only the release pull request raises. */
export const UPDATE_URL = 'https://raw.githubusercontent.com/JakkapatB/open-effort/main/.claude-plugin/plugin.json'

/** What each version changes. */
export const RELEASES_URL = 'https://github.com/JakkapatB/open-effort/releases'

/** The shell line that updates the plugin, for a machine where the pane cannot run it. */
export const UPDATE_COMMAND = 'claude plugin marketplace update open-effort && claude plugin update open-effort@open-effort'

/** Claude Code's own steps, after the binary: refresh the marketplace, then update the plugin. */
export const UPDATE_STEPS: readonly (readonly string[])[] = [
  ['plugin', 'marketplace', 'update', 'open-effort'],
  ['plugin', 'update', 'open-effort@open-effort'],
]

/** How often the daily read runs: once every 24 hours per machine. */
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000

/** How long a read may take before it is given up, so a slow network holds nothing. */
export const CHECK_TIMEOUT_MS = 5000

/** How long one update step may run. */
export const UPDATE_TIMEOUT_MS = 120_000

/** The `version` a plugin.json's text names, as `x.y.z`; null for text that names none. */
export function versionOf(text: string): string | null {
  try {
    const version = (JSON.parse(text) as { version?: unknown }).version
    return typeof version === 'string' && /^\d+\.\d+\.\d+/.test(version) ? version : null
  } catch {
    return null
  }
}

/** Whether `latest` is a later version than `current`, by their numbers (`0.10.0` is after `0.9.0`). */
export function isNewer(latest: string, current: string): boolean {
  const parts = (v: string) => v.split(/[.-]/).slice(0, 3).map(n => Number.parseInt(n, 10) || 0)
  const a = parts(latest)
  const b = parts(current)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

/** The last line a failed step wrote, to say why in a line; a generic reason when it wrote nothing. */
export function reasonOf(stderr: string, stdout: string, exitCode: number): string {
  const line = [stderr, stdout].map(s => s.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? '').find(Boolean)
  return line ? line.slice(0, 200) : `exit code ${exitCode}`
}
