// Leading `NAME=value` assignments before a command.
const ENV = /^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/

// What runs a tool on the command's behalf: `npx vitest`, `uv run pytest`, `python -m pytest`.
const RUNNER = /^(?:npx|bunx|pnpx|pnpm\s+(?:exec|dlx)|yarn\s+(?:exec|dlx)|uv\s+run|poetry\s+run|pipenv\s+run|python3?\s+-m)\s+/

// A package manager's workspace flags before its script: `pnpm -r test`, `npm --workspaces run test`.
const WORKSPACES = String.raw`(?:(?:-r|--recursive|-w|--workspaces?|--filter\s+\S+|--workspace\s+\S+)\s+)*`

// Test, typecheck, build and lint runs for JavaScript/TypeScript, Python, Go and Rust, monorepo runners, and the
// usual make targets.
const CHECKS: readonly RegExp[] = [
  new RegExp(String.raw`^(?:npm|pnpm|yarn|bun)\s+${WORKSPACES}(?:run\s+)?(?:test|lint|build|typecheck|type-check|check)\b`),
  /^(?:vitest|jest|mocha|ava|tsc|eslint|biome|playwright\s+test|pytest|unittest|tox|nox|mypy|pyright|ruff|flake8|pylint|golangci-lint)\b/,
  /^go\s+(?:test|build|vet)\b/,
  /^(?:node|deno|bun)\s+(?:--test|test)\b/,
  /^cargo\s+(?:test|nextest|build|check|clippy)\b/,
  /^turbo\s+(?:run\s+)?(?:test|lint|build|typecheck)\b/,
  /^nx\s+(?:test|lint|build|typecheck|run-many)\b/,
  /^make\s+(?:test|lint|build|check)\b/,
]

function runsCheck(part: string): boolean {
  // A subshell or group around it, `(npm test)` or `{ npm test; }`, does not hide it.
  const bare = part.trim().replace(/^[({!\s]+/, '').replace(/[)}\s]+$/, '').replace(ENV, '').replace(RUNNER, '')
  return CHECKS.some(check => check.test(bare))
}

/** Whether a statement negates its exit, `! npm test`: its pass is the check's failure. */
function isNegated(statement: string): boolean {
  return /^[({\s]*!\s/.test(statement)
}

/** A statement's pipeline parts: split on `|` outside quotes, not on `||` (statementsOf took those). */
function pipeParts(statement: string): string[] {
  const parts: string[] = []
  let part = ''
  let quote: string | null = null
  for (let i = 0; i < statement.length; i++) {
    const c = statement[i] ?? ''
    if (quote) {
      if (c === '\\' && quote === '"') {
        part += c + (statement[i + 1] ?? '')
        i++
        continue
      }
      if (c === quote) quote = null
      part += c
    } else if (c === "'" || c === '"') {
      quote = c
      part += c
    } else if (c === '\\') {
      part += c + (statement[i + 1] ?? '')
      i++
    } else if (c === '|') {
      parts.push(part)
      part = ''
    } else {
      part += c
    }
  }
  parts.push(part)
  return parts
}

type Operator = '&&' | '||' | ';' | '&'

/**
 * A command's statements in order, each with the operator that follows it: split on `&&`, `||`, `;`, `&` and new
 * lines outside quotes. A `&` of a redirection (`2>&1`, `&>`) is not an operator; a `|` stays in its statement.
 */
function statementsOf(command: string): { text: string; after: Operator | null }[] {
  const out: { text: string; after: Operator | null }[] = []
  let text = ''
  let quote: string | null = null
  const end = (after: Operator | null) => {
    if (text.trim()) out.push({ text, after })
    else if (out.length > 0 && after !== null && after !== ';') out[out.length - 1] = { ...out[out.length - 1]!, after }
    text = ''
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i] ?? ''
    const next = command[i + 1] ?? ''
    if (quote) {
      if (c === '\\' && quote === '"') {
        text += c + next
        i++
      } else {
        if (c === quote) quote = null
        text += c
      }
      continue
    }
    if (c === "'" || c === '"') {
      quote = c
      text += c
    } else if (c === '\\') {
      text += c + next
      i++
    } else if (c === '&' && next === '&') {
      end('&&')
      i++
    } else if (c === '|' && next === '|') {
      end('||')
      i++
    } else if (c === ';' || c === '\n') {
      end(';')
    } else if (c === '&' && command[i - 1] !== '>' && command[i - 1] !== '<' && next !== '>') {
      end('&')
    } else {
      text += c
    }
  }
  end(null)
  // A trailing `;` or new line joins nothing.
  const last = out[out.length - 1]
  if (last?.after === ';') out[out.length - 1] = { ...last, after: null }
  return out
}

/**
 * What a Bash command's exit says about the checks in it: `none` when it runs no check; `counted` when its exit is
 * the checks' pass or fail; `untrusted` when it may not be: something runs after a check whatever its result (`;`,
 * a new line, `||`), a check runs only when something before it failed (`||`), a pipe follows a check without
 * pipefail, `!` turns its exit round, or it runs in the background.
 */
export function checkRun(command: string, isBackground = false): 'none' | 'untrusted' | 'counted' {
  const statements = statementsOf(command)
  const checks = statements.flatMap((statement, at) => (pipeParts(statement.text).some(runsCheck) ? [at] : []))
  if (checks.length === 0) return 'none'
  if (isBackground) return 'untrusted'
  const first = checks[0] ?? 0
  // From the first check on, only `&&` may join what follows: then a failing check is the command's exit.
  const isFollowedSafely = statements.slice(first).every((statement, k) => statement.after === null || (statement.after === '&&' && first + k < statements.length - 1))
  const isReachedSafely = first === 0 || statements[first - 1]?.after !== '||'
  const isPipedOn = checks.some(at => {
    const parts = pipeParts(statements[at]?.text ?? '')
    return parts.findIndex(runsCheck) < parts.length - 1
  }) && !/pipefail/.test(command)
  // `! npm test` turns the check's failure into the command's pass.
  const isTurned = checks.some(at => isNegated(statements[at]?.text ?? ''))
  return isFollowedSafely && isReachedSafely && !isPipedOn && !isTurned ? 'counted' : 'untrusted'
}
