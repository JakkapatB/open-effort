<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/icon.png" width="96" alt="open-effort">
</p>

<h1 align="center">open-effort</h1>

<p align="center">
  Claude thinks as hard as the work needs: no more, no less.<br>
  A Claude Code mod that fits effort to the work, and moves to a stronger model only when it has to.
</p>

<p align="center">
  <b>English</b> · <a href="README.th.md">ภาษาไทย</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/band.png" width="760" alt="The band above the prompt: Haiku's reading, the effort climbing to high on Opus 5.5, and three sub-agents at work">
</p>

## What it does

- 🎯 **Fits the effort.** Haiku reads each new request: a clear plan starts at `low`, a hard one at `xhigh`.
- 📈 **Raises the effort when stuck.** Three failing checks in a row raise the effort one level. Past the highest level, Claude asks whether to move up one model (Sonnet → Opus → Fable 5.1), and only with your yes does it move. If checks still fail at the top, Claude stops and asks you what to do.
- 🧠 **Asks before switching models.** If the work needs a stronger model than the session's, Claude asks you first.
- 🗺️ **Runs Matt Pocock's Main Flow.** Grill to retro, every stage and every ticket at its own effort.
- 👀 **Shows what it uses, and why.** A band above the prompt shows the effort and model in use; a pane holds the switches, themes and history.

## What it changes, measured

Sessions on Opus 5.5 at `high`, the same tasks with the mod on and off (a sample shop project; 61 sessions in all):

| | Off | On |
|---|---|---|
| Cost, 5 coding tasks run twice | $5.65 | $5.00 (**−11%**) |
| Cost, the same tasks in an earlier round | $3.96 | $3.79 (**−4%**) |
| Tasks passing hidden checks | all | all |
| An Explore sub-agent's cost | $0.41 (Opus, `high`) | $0.09 (Haiku, `low`, **−78%**) |
| Main Flow: effort per stage and per ticket | — | as set, every stage and ticket |

Each task ran once or twice, so the cost figures move from run to run. Raising the effort when stuck is not yet
measured: every task passed on its first try, with and without the mod. Cost is worked out from the tokens at list
price.

## Install

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/install-en.png" width="820" alt="Three ways to install: one shell command; the /plugin line in Claude Code in the terminal; or in the desktop app, Settings, Customize, Plugins, + Add, Add marketplace, type JakkapatB/open-effort, Sync, then in the Discover tab Add to this computer and Install for me">
</p>

Pick one of the three ways:

### 1. In a shell

One line. It needs Claude Code's command-line tool, `claude`, in your shell. With only the desktop app installed, your shell has no `claude`: use way 3.

```bash
claude plugin marketplace add JakkapatB/open-effort && claude plugin install open-effort@open-effort
```

### 2. Inside Claude Code in the terminal

```
/plugin install open-effort --marketplace JakkapatB/open-effort
```

### 3. In the desktop app

1. **Settings** → **Customize** → **Plugins**
2. **+ Add** → **Add marketplace**
3. Type `JakkapatB/open-effort`, then press **Sync**
4. In the **Discover** tab, find **Open effort**
5. **Add to this computer** ▾ → **Install for me**, so it works in every project

In the desktop app, typing `/plugin install …` only searches Anthropic's plugin directory, where open-effort is not listed.

Nothing to set up: start a new session and the band appears above the prompt.

### Keep it up to date

Claude Code updates plugins by itself only from Anthropic's own marketplaces, so open-effort stays at the version you installed until you update it or turn on auto-update.

**Turn on auto-update, once.** In Claude Code in the terminal, run `/plugin`, open **Marketplaces**, pick **open-effort** and choose **Enable auto-update**. Or add this entry inside `~/.claude/settings.json` (next to any `extraKnownMarketplaces` entries already there):

```json
"extraKnownMarketplaces": {
  "open-effort": {
    "source": { "source": "github", "repo": "JakkapatB/open-effort" },
    "autoUpdate": true
  }
}
```

From then on, a few minutes into a session Claude Code fetches a new version if there is one, and the next session runs it.

**Update now.**

- **Desktop app:** **Settings** → **Customize** → **Plugins** → **Open effort** → **Update**. If the button stays grey, use the shell line below.
- **Shell:**

  ```bash
  claude plugin marketplace update open-effort && claude plugin update open-effort@open-effort
  ```

Then start a new session. What each version changes is in the [CHANGELOG](CHANGELOG.md) and on the [Releases](https://github.com/JakkapatB/open-effort/releases) page; on GitHub, **Watch** → **Custom** → **Releases** tells you when a new one comes out.

## Try it

Type these in a project of your own, and watch the band above the prompt. Haiku reads each request afresh, so a reading can differ a little from what is shown here.

| You type | The band shows |
|---|---|
| `Rename getUser to fetchUser everywhere` | **Haiku read it · clear plan** → **Effort `low`** |
| `Add a discount code field to checkout and check it on the server` | **goal known** → **Effort `medium`** |
| `Two orders can both take the last item in stock. Find the race and fix it` | **unusually hard** → **Effort `xhigh`** |
| `Add gift cards: a balance, an expiry date, paying part of an order, with tests` | Claude first asks whether to take it through the Main Flow (with Matt Pocock's skills installed). If you say yes, the band shows the stage track: **grill → spec → tickets → implement → review → retro**, each at its own effort |

When a test run fails, the effort card shows **Check failed 1/3**, then **2/3**. On the third failure in a row the effort goes up one level, and the card says where it came from (**↑ from low**). The next passing run brings it back.

## How it works

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/flow-en.png" width="900" alt="The whole flow: a request is kept in the task or read by Haiku; a new task gets a starting effort, Claude asks about a stronger model and the flow (Matt's Main Flow, or the project's own from .claude/open-effort.json), Claude works, a passing check returns to the starting effort, three failures raise it one level, past xhigh Claude asks to move up one model, Fable 5.1 at the top, and still failing at max Claude stops and asks you; the flow's stages (Matt's by default), tickets, sub-agents and history are shown beside it">
</p>

### The ladder

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/ladder-en.png" width="820" alt="low, medium, high, xhigh on the task's model; then, only with your yes, one model up at high (Sonnet 5.5, Opus 5.5, Fable 5.1); on Fable 5.1 high, xhigh and max; if checks still fail, Claude stops and asks you">
</p>

When a check passes, the effort goes back to the level the task started at.

At the top effort of its model the task never moves up by itself. Claude stops and asks you whether to move it up one model, which costs more. Yes moves the task there at `high`, for the rest of the task, and the ladder goes on from there. No keeps the model, and three more failing checks stop the work. A ticket's sub-agent cannot ask you, so it climbs no further than Opus 5.5.

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/states.png" width="760" alt="The band in each state: scored, a failing check, a climb, Fable 5.1, and stopped at the top">
</p>

### Starting effort

| Haiku reads | Effort |
|---|---|
| You know what to do and how (a rename, a known pattern) | `low` |
| A known goal, the way needs thought | `medium` |
| The plan is not clear yet | `high` |
| Unusually hard (concurrency, migrations) | `xhigh` |
| Risky, or Haiku is unsure | at least `medium` |

The mod never picks `max` by itself.

### Matt Pocock's Main Flow

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/main-flow.png" width="760" alt="The Main Flow track at the implement stage, working ticket 03 at high">
</p>

| Stage | grill | spec | tickets | implement | review | retro |
|---|---|---|---|---|---|---|
| Effort | `high` | `high` | `medium` | `high` | `xhigh` | `medium` |

- The flow starts only when you choose it, when Claude asks, or when you type a stage's command. It ends when Claude says it is done, when you switch the Main Flow off, or with the first new work after retro.
- Claude moves the flow from stage to stage with the `stage` tool. A stage's skill Claude uses on its own (a review of its own work during implement) only raises the effort: it does not move the flow.
- Work you choose to do directly keeps the same care: when Claude uses one of the flow's skills on it (code-review, tdd), the task keeps at least that stage's effort and, while the Main Flow is on, moves to the flow's model, for the rest of the task. The band shows it as "Matt's skill · direct".
- If you turn the flow or a stronger model down, you are not asked again this session for work no larger, or for a model no more capable.
- A model a climb moved to in the flow, Fable 5.1 included, lasts until the next stage or ticket.
- The flow runs on **Opus 5.5** by default. Pick **Fable 5.1** or **the session's model** in the pane.
- Each ticket can set its own `Model:` and `Effort:`. A sub-agent given a ticket uses the model and effort the ticket sets.
- Needs [Matt Pocock's skills](https://github.com/mattpocock/skills). The pane says which are missing.

#### Your own flow

A project can use its own flow instead of Matt's. Put it in `.claude/open-effort.json` at the project's root, or type `/open-effort flow`: Claude asks you about your flow and writes the file once you agree.

```json
{
  "name": "Team flow",
  "stages": [
    { "name": "plan",   "skills": ["my-plan"],          "effort": "high" },
    { "name": "tasks",  "skills": ["my-tasks"],         "effort": "medium" },
    { "name": "build",  "skills": ["my-build", "tdd"],  "effort": "high" },
    { "name": "review", "skills": ["my-review"],        "effort": "xhigh" }
  ],
  "tickets": { "write": "tasks", "work": "build", "files": "docs/tasks/*.md" }
}
```

- **One flow per project.** With no file, the project uses Matt Pocock's Main Flow. With one, its flow replaces Matt's. Commit the file and your team shares the flow.
- **Stages.** 2 to 10, in order. A name is up to 16 lower-case letters, digits or dashes. Each stage lists the skills that run it, as Claude Code's skill list names them (`my-skill`, or `plugin:my-skill` for that plugin's alone), and the effort it starts at: `low`, `medium`, `high` or `xhigh`. A skill belongs to one stage only.
- **Tickets** are optional: the stage that writes them, a later stage that works them, and a glob for their files, whose names start with their number (`01-login.md`). They then work as in the Main Flow: `Model:` and `Effort:` at the top of each.
- **It runs as the Main Flow does.** Large work has Claude ask you first, or you type a stage's command. Claude goes through the stages in order, using each stage's skills. The flow's model is still picked in the pane, and its switch is the same.
- **The file holds settings only**, no instructions for Claude.
- **Changes count from the next new task.** A flow under way keeps the file it started with.
- **A file with a problem**, or a stage with none of its skills installed, keeps the flow off, and the pane says what is wrong. A stage's skills are ways to run it: one installed is enough. Everything else works as before.

#### Sub-agents in the flow

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/sub-agents-en.png" width="820" alt="Which sub-agents each Main Flow stage starts, and how each gets its model and effort: implement hands a ticket to a sub-agent at the ticket's Model and Effort; code-review runs two reviewers at xhigh on the Main Flow's model; otherwise Explore runs on Haiku at low, Plan on the task's model at high, general-purpose on the task's model at the stage's effort, and your own types are left as they are">
</p>

A general-purpose sub-agent's effort follows the stage it runs in: the code-review reviewers run at `xhigh` because the review stage does. Plan and general-purpose sub-agents run on the task's model, so in the Main Flow they use its model (Opus 5.5 by default) even on a Sonnet session. Explore always runs on Haiku, and a ticket's sub-agent runs on the ticket's model. A new sub-agent starts where the task started, not at a climb the main session made.

## Which model and effort, when

| Model | When it runs |
|---|---|
| **Your session's model** (the one you picked with `/model`) | Everything, unless a row below says otherwise |
| **A stronger model Haiku suggests** | The whole task, only if you say yes when Claude asks at the start |
| **Opus 5.5** | The whole Main Flow (change it in the pane), and direct work once Claude uses one of the flow's skills on it. A session already on a stronger model keeps it |
| **One model up** (Sonnet → Opus → Fable 5.1) | When checks keep failing at the top effort of the task's model, and you say yes when Claude asks; for the rest of the task (in a flow, to the next stage or ticket) |
| **Fable 5.1** | One model up from Opus, with your yes; in the Main Flow if you pick it; for a ticket that says `Model: fable` |
| **Haiku** | Reading each new request and each ticket without `Model:` and `Effort:` lines; Explore sub-agents; tickets that say `Model: haiku` |
| **A ticket's `Model:`** | The sub-agent that works that ticket. When Claude works a ticket itself, it keeps the task's model |

| Effort | When it is used |
|---|---|
| `low` | You know what to do and how; Explore sub-agents; Haiku's own reading |
| `medium` | A known goal whose way needs thought; the lowest for risky work or when Haiku is unsure; the tickets and retro stages |
| `high` | The plan is not clear yet; the grill, spec and implement stages; Plan sub-agents; the first step on a model a climb moved to |
| `xhigh` | Unusually hard work; the review stage; the highest a sub-agent climbs to (one working a ticket then moves a model up, as far as Opus 5.5) |
| `max` | On Fable 5.1, after `high` and `xhigh` there still fail; for a sub-agent on a model with no `xhigh` (Opus or Sonnet 4.6), in its place; or when you set your session to `max` yourself. The mod never picks it at the start |

Three failing checks in a row raise the effort one level; a passing check brings it back to where the task started. A ticket's `Effort:` overrides the stage's effort for that ticket.

## The pane

Open it with `/open-effort` or the band's **≡**.

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/history.png" width="520" alt="The history chart: the effort each turn started at and climbed to, and turns by model and effort">
</p>

- **On or off** for this project (`/open-effort on|off` does the same).
- **Flow**: which flow the project uses (Matt's Main Flow or its own file), on or off, and its model.
- **Language:** auto, ไทย or English.
- **Theme:** Claude, Lime, Ocean or Rose.
- **History:** the last 500 turns of this project.

<p align="center">
  <img src="https://raw.githubusercontent.com/JakkapatB/open-effort/main/docs/images/themes.png" width="640" alt="The four themes: Claude, Lime, Ocean and Rose">
</p>

<details>
<summary><b>More details</b></summary>

### One model per task

A task keeps one model from start to end, so the prompt cache holds. It changes only when you agree to a stronger model at the start, when it enters the Main Flow, when Claude uses one of the flow's skills on work you do directly, or when its checks keep failing at the top effort and you agree to move it up one model. It never switches to a weaker model by itself, and moves to a stronger one you were offered only after Claude asked you.

### Models and effort

The current models take all five efforts. Opus and Sonnet 4.6 have no `xhigh`, Opus 4.5 stops at `high`, and Sonnet 4.5 and Haiku 4.5 take none. An effort a model does not take goes out as the nearest one below it. On a model that takes no effort the ladder does not climb, but a model the task moves to (the Main Flow's, or one you accepted) still applies.

### What counts as a check

Test, typecheck, build and lint runs (JavaScript/TypeScript, Python, Go, Rust, Node's test runner, make). A check counts only when its result is the command's result: not after `;` or `||`, not piped without `set -o pipefail`, not behind `!`, not in the background. The first failing run after Claude writes a test is the red step of test-first work, and does not count.

### Data and privacy

- Everything stays in Claude Code's plugin store on your machine.
- The history never keeps what you typed: only times, efforts, readings, counts and model names.
- **What it sends, and where.** The mod makes no network calls of its own. It sends text to one place: Claude's Haiku model, through Claude Code's own model call (`$.model.complete`), on your account, like any other Claude Code request. It sends:
  - each new request you type, and the last 800 characters of Claude's last message when a task is under way, to read how hard the work is;
  - the text of a ticket file without `Model:` and `Effort:` lines, to read the same for the ticket.
- **Notes to Claude.** It adds short notes for Claude to the conversation (`$.session.append`, and context on your prompt): to ask you about a stronger model or the flow, how to name a ticket's model and effort, and when to stop and ask you. They go to Claude with the conversation, as your messages do. `/open-effort flow` sends Claude one prompt of its own (`$.prompt.submit`) asking it to help you write the flow file; it names your installed skills and commands.
- It reads two kinds of file: the project's flow file, `.claude/open-effort.json`, when there is one, and ticket files in the stage that works them (`<feature>/issues/NN-*.md` in the Main Flow, or where your flow's file says). It writes no files: `/open-effort flow` has Claude write the flow file once you agree, as Claude writes any file.
- It registers three tools of its own, `stage`, `model` and `report`, and the `/open-effort` command.

### What each hook does

| Hook | What it does | What it changes |
|---|---|---|
| `turn.step` | Sets each model request's effort, and its model when the task moved to another one | The request's `effort` and `model` |
| `tool.call` on `Agent` | Sets a sub-agent's model and effort by its type, or from a ticket handed to it | The call's `model` and `effort`, only when the call names neither |
| `prompt.submit` | Reads the project's flow file for each new task; has Haiku read a new request; adds the notes above when there is a question for you | Adds context to the prompt; the prompt's text is never changed |
| `tool.call` on `Bash` | Counts test, lint, build and typecheck runs as passing or failing checks | Nothing |
| `tool.call` on `Read`, `Skill`, `Edit`, `Write` | Notices a stage's skill being used, a ticket being read, a test being written | Nothing |
| `tool.call` on `mcp__open-effort__stage`, `__model`, `__report` | Answers the mod's own three tools | They are the mod's own tools |
| `turn.start`, `turn.complete`, `session.start`, `session.end` | Tracks sub-agents at work, the turn's history entry, the project's switches | Nothing |
| `command.run` on `open-effort` | Answers the mod's own `/open-effort` command: opens the pane, switches the mod, or, with `flow`, sends Claude the prompt to help write the flow file | It is the mod's own command; `flow` starts a turn of its own |
| `ui.render` | Draws the band above the prompt and the pane | Adds the band and the pane |

**Other calls.** Pressing a sub-agent's name in the band calls `$.ui.view`, which switches Claude Code's own view to that sub-agent's transcript, as its task list does. It sends nothing anywhere. The desktop app has no such view, so there the names are labels and nothing is called.

**Another plugin.** The Main Flow is Matt Pocock's `mattpocock-skills` plugin. The mod lists your installed commands to see whether it is there, and reacts when Claude uses one of its skills. It never calls that plugin's code.

### Limits

- The mod API is new in Claude Code and may change.
- Switching a task's model starts its prompt cache afresh.
- A slow Haiku reading arrives during the turn; until it does, requests use the session's own effort, on the task's model.
- A command typed with words after it (`/fix-typo the title`) counts as a new request; a command alone keeps the task.
- A resumed session starts with no task; the flow comes back when Claude names its stage.
- `/open-effort flow` hands Claude its prompt a moment after the command, as a turn of its own.
- If Haiku cannot read a message (it times out or fails), the message starts a new task at the session's own effort, even when it was a reply.
- Ticket lines work with ticket files on disk (`<feature>/issues/NN-*.md`, or where your flow's file says). Tickets kept in GitHub or Linear get none of this.
- In the stage that works tickets (implement, in the Main Flow), each ticket file Claude reads sets the effort Claude works at: the mod takes it as the ticket Claude works next.
- The notes to Claude are instructions, not enforcement.
- The desktop app cannot open a sub-agent from the band, so there the band lists them as labels, not buttons.

</details>

<details>
<summary><b>Development</b></summary>

```bash
claude plugin test .
claude plugin validate .
```

| Path | What it holds |
|---|---|
| `hooks/register.tsx` | wiring, the band and the pane |
| `hooks/policy.ts` | effort, the ladder, models, sub-agents, tickets |
| `hooks/score.ts` | the Haiku reading |
| `hooks/checks.ts` | which commands count as checks |
| `hooks/flow.ts` | the flow: Matt's Main Flow, a project's own file, its skills and tickets |
| `hooks/main-flow.ts` | the notes and tools for the flow |
| `hooks/history.ts` | history entries |
| `hooks/diagrams.ts` | the band, chart and themes as SVG |
| `hooks/words.ts` | English and Thai text |
| `tests/` | tests that drive the mod at its hooks |

Built and tested on Claude Code 2.1.308.

</details>

## Credits

The Main Flow and its skills are [Matt Pocock's](https://github.com/mattpocock/skills) (MIT). open-effort is not affiliated with Matt Pocock or Anthropic.

## License

[MIT](LICENSE)
