# Contributing to open-effort

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Before you start

- For a bug, open an issue with the bug form. Include what the band showed and, if you can, the output of the mod's
  `report` tool (ask Claude: "call mcp__open-effort__report and show me the result").
- For a larger change, open an issue or a discussion first, so we agree on the behaviour before you write it.

## Set up

You need [Claude Code](https://claude.com/claude-code) 2.1.308 or later. The plugin has no dependencies; the release
tooling (`package.json`, changesets) needs Node.js 22 and `npm install`, and only to add a changeset.

```bash
git clone https://github.com/JakkapatB/open-effort.git
cd open-effort
claude plugin test .
claude plugin validate .
```

To try your copy in a real session, load it as a dev mod from Claude Code, or install it from your fork with
`/plugin install open-effort --marketplace <you>/open-effort`.

## Making a change

- **Tests first for behaviour.** Every change to what the mod does comes with a test in `tests/` that fails without the
  change. The test engine is in `tests/engine.tsx`.
- **Both READMEs.** If the change is visible to users, update `README.md` and `README.th.md` together, in plain words.
- **Keep it small.** One change per pull request.
- **Checks pass.** `claude plugin test .` and `claude plugin validate .` both pass before you open the pull request.
- **A changeset for users.** A change to `hooks/`, `types/` or `.claude-plugin/plugin.json` comes with a changeset: run
  `npx changeset`, pick patch (a fix), minor (a feature) or major (a breaking change), and write one line for users.
  CI fails without one, because without a new version installed copies never get the change. Docs need none.

## Releases

Nobody edits version numbers by hand. When changesets reach `main`, the Release workflow opens a pull request titled
**chore: release** that raises the version in `package.json` and `.claude-plugin/plugin.json` (Claude Code reads the
second to tell an update) and writes the notes into `CHANGELOG.md`. Merging it tags `vX.Y.Z` and publishes the GitHub
release.

## Commit messages

One line saying what changed and why it matters, prefixed with its kind:

```
fix: a stage skill Claude calls no longer pulls declined work into the Main Flow
feat: run Plan and general-purpose sub-agents on the task's model
docs: list which model and which effort run when
```

Kinds: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`. Add detail in the body when the line is not enough.

## Where things are

| Path | What it holds |
|---|---|
| `hooks/register.tsx` | wiring, the band and the pane |
| `hooks/policy.ts` | effort, the ladder, models, sub-agents, tickets |
| `hooks/score.ts` | the Haiku reading |
| `hooks/checks.ts` | which commands count as checks |
| `hooks/flow.ts` | the flow: Matt's Main Flow, a project's own file, its skills and tickets |
| `hooks/main-flow.ts` | the notes and tools sent to Claude for the flow |
| `hooks/diagrams.ts` | the band, chart and themes as SVG |
| `hooks/words.ts` | English and Thai text |
| `types/index.d.ts` | the mod's state contract |
| `tests/` | tests that drive the mod at its hooks |
| `.changeset/`, `package.json`, `scripts/` | release tooling: changesets and the version sync |

## Licence

By contributing you agree that your work is released under the [MIT licence](LICENSE).
