import { expect, test } from 'claude-code/testing'

import { checkRun } from '../hooks/checks'

const CASES: readonly (readonly [string, string, 'none' | 'untrusted' | 'counted'])[] = [
  ['a plain check', 'npm test', 'counted'],
  ['a check after a cd', 'cd app && go test ./...', 'counted'],
  ['a check on a later line', 'echo run\nnpm test >/dev/null 2>&1', 'counted'],
  ['a check in a subshell', '(npm test >/dev/null 2>&1)', 'counted'],
  ['a check with a trailing new line', 'npm test\n', 'counted'],
  ['two checks joined by &&', 'npm run lint && npm test', 'counted'],
  ['a check then && echo', 'npm test && echo ok', 'counted'],
  ['a pipe with pipefail', 'set -o pipefail; npm test | tail -5', 'counted'],
  ['a check then ; echo $?', 'npm test >/dev/null 2>&1; echo exit=$?', 'untrusted'],
  ['a check then a new line and more', 'npm test\necho done', 'untrusted'],
  ['a check hidden by || echo', 'npm test || echo failed', 'untrusted'],
  ['a check hidden by || true', 'npm test || true', 'untrusted'],
  ['a check run only when something failed', 'false || npm test', 'untrusted'],
  ['a pipe without pipefail', 'npm test | tail -5', 'untrusted'],
  ['a check sent to the background', 'npm test &', 'untrusted'],
  ['a check word inside quotes', 'echo "run npm test later"', 'none'],
  ['node’s own test runner', 'node --test persist.test.js', 'counted'],
  ['no check', 'ls -la && git status', 'none'],
  ['a check with a | inside quotes', 'npm test -- -t "a|b"', 'counted'],
  ['a check whose exit ! turns round', '! npm test', 'untrusted'],
  ['a check in a group whose exit ! turns round', '! (npm test)', 'untrusted'],
]

for (const [name, command, expected] of CASES) {
  test(`checks: ${name}`, () => {
    expect(checkRun(command)).toBe(expected)
  })
}

test('checks: a run in the background is untrusted', () => {
  expect(checkRun('npm test', true)).toBe('untrusted')
})
