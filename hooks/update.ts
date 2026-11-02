/** Where the newest released version is read: plugin.json on main, which only the release pull request raises. */
export const UPDATE_URL = 'https://raw.githubusercontent.com/JakkapatB/open-effort/main/.claude-plugin/plugin.json'

/** What each version changes. */
export const RELEASES_URL = 'https://github.com/JakkapatB/open-effort/releases'

/** Claude Code's own steps, after the binary: refresh the marketplace, then update the plugin. */
export const UPDATE_STEPS: readonly (readonly string[])[] = [
  ['plugin', 'marketplace', 'update', 'open-effort'],
  ['plugin', 'update', 'open-effort@open-effort'],
]

/** What a shell finds as Claude Code: the variable as child processes get it, else `claude` on the PATH. */
export const FIND_CLAUDE = 'if [ -n "$CLAUDE_CODE_EXECPATH" ]; then printf %s "$CLAUDE_CODE_EXECPATH"; else command -v claude; fi'

/** What Claude is asked when the pane cannot run Claude Code itself: its Bash tool knows the binary. */
export const UPDATE_PROMPT = `Update the open-effort plugin: in Bash, run \`"$CLAUDE_CODE_EXECPATH" ${UPDATE_STEPS[0]?.join(' ')} && "$CLAUDE_CODE_EXECPATH" ${UPDATE_STEPS[1]?.join(' ')}\`, then say in one line whether it worked, and that a new session runs the new version. Do nothing else.`

/** The steps for a terminal when even Claude was refused: finds Claude Code itself, in the desktop app's folder on a Mac. */
export const MANUAL_COMMAND = `C=$(command -v claude || ls -t "$HOME/Library/Application Support/Claude/claude-code"/*/*/claude.app/Contents/MacOS/claude | head -n 1); ${UPDATE_STEPS.map(step => ['"$C"', ...step].join(' ')).join(' && ')}`

/** The same steps as one shell line, for a machine where the pane cannot run them: by the binary's path when known. */
export function updateCommand(bin?: string): string {
  const claude = !bin ? 'claude' : /\s/.test(bin) ? `"${bin}"` : bin
  return UPDATE_STEPS.map(step => [claude, ...step].join(' ')).join(' && ')
}

/** How often the daily read runs: once every 24 hours per machine. */
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000

/** How often an open session looks: at the version the machine kept, and at GitHub when the daily read is due. */
export const LOOK_EVERY_MS = 30 * 60 * 1000

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

/** The newer version than the one installed, when the last read found one; null otherwise. */
export function newerOf(versions: { latest: string | null; current: string | null }): string | null {
  return versions.latest && versions.current && isNewer(versions.latest, versions.current) ? versions.latest : null
}

/** The last line a failed step wrote, to say why in a line; its exit code when it wrote nothing. */
export function reasonOf(result: { exitCode: number; stdout: string; stderr: string }): string {
  const line = [result.stderr, result.stdout].map(s => s.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? '').find(Boolean)
  return line ? line.slice(0, 200) : `exit code ${result.exitCode}`
}
