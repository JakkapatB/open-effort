# open-effort

A Claude Code mod that sets how hard Claude thinks so it fits the work in front of it, and moves to a stronger model only when the highest effort is not enough.

- **Effort that fits.** Haiku reads each new request and the task starts at the effort its plan calls for: `low` when the plan is clear, `medium` for well-scoped work, `high` when it is not clear yet, `xhigh` when it is unusually hard.
- **Climbs when the work stalls.** Three failing checks in a row (tests, typecheck, build, lint) raise the effort one rung, then move the task to Fable 5.1, then have Claude stop and ask you.
- **The right model, with your say.** When the work needs a more capable model than the session's, Claude asks you once at the task's start.
- **Matt Pocock's Main Flow, optional.** For large implementation work, Claude asks once whether to go through grill, spec, tickets, implement, review and retro, each stage and each ticket at its own effort.
- **Always visible.** A band above the prompt shows the effort, the model and why; a pane beside the chat holds the switches, the theme and a history chart.

[ภาษาไทยอยู่ด้านล่าง](#ภาษาไทย)

## Install

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `JakkapatB/open-effort`, then **Add plugin**.

At the prompt of a terminal session:

```
/plugin install open-effort --marketplace JakkapatB/open-effort
```

From a shell:

```bash
claude plugin install open-effort --marketplace JakkapatB/open-effort
```

Answer `y` to add the marketplace, then pick a scope (the user scope is first). The mod is active at once: the band appears above the prompt, with nothing to set up.

### Requirements

- A Claude Code build that loads mods (plugins with a hooks module). Built and tested on 2.1.308.
- Optional, for the Main Flow: [Matt Pocock's skills](https://github.com/mattpocock/skills). The pane says when they are missing and how to install them; the mod never installs anything.

## How it works

### Starting effort

When you type a new request, Haiku scores it at low effort. The prompt waits a moment at most: until the score comes, Claude works at the session's own effort, and a later score takes over from the next request.

| Reading | Effort |
|---|---|
| Clear plan: describable in one sentence (a rename, a known pattern across files) | `low` |
| Goal known, the way needs some thought | `medium` |
| Plan not clear yet: needs exploring or deciding | `high` |
| Unusually hard (concurrency, migrations, elusive bugs) | `xhigh` |
| Risky (auth, money, personal data, security), or Haiku is unsure | never below `medium` |

The mod never picks `max` by itself. These levels follow Anthropic's guidance on effort: start at `medium` for well-scoped work, use `low` when the plan is clear, go higher when the work stalls, and reach for Fable 5.1 when `xhigh` is not enough.

A reply such as "ok", "go on" or "ทำต่อ" stays in the task under way. With a task under way, Haiku also reads what Claude said last: a message that answers Claude or narrows the same work keeps the task, its effort and its climbs; anything else starts a new task.

### One model per task

A task keeps one model from start to end, so the prompt cache holds; only effort moves.

- **At the start:** the session's model, unless Haiku is sure the work needs a more capable one (say Opus in a Sonnet session). Claude then asks you once, and the task runs on it if you agree.
- **Past `xhigh`:** the task moves to Fable 5.1 for the rest of it.
- **Never down:** easy work on a capable model runs at a lower effort instead.

### Climbing and settling

A check is a test, typecheck, build or lint run (JavaScript/TypeScript, Python, Go, Rust, Node's test runner and the usual make targets). Three failing in a row climb the task one rung:

```
low → medium → high → xhigh → Fable 5.1 high → xhigh → max → Claude stops and asks you
```

- The first passing check after a climb settles the task back to the effort it started at. A task that reached Fable 5.1 stays on it.
- Not every model takes every effort. The current families take all five; Opus and Sonnet 4.6 have no `xhigh`; Opus 4.5 stops at `high`; Sonnet 4.5 and Haiku 4.5 take none. An effort the model does not take goes out as the nearest one below it, and the ladder skips it.
- A check counts only when the command's exit is its own: it is the last thing run, or joined to what follows only by `&&`. One followed by `;`, a new line or `||`, piped on without `set -o pipefail`, or run in the background is ignored.

### Matt Pocock's Main Flow

With the Main Flow on (the default) and Matt Pocock's skills installed, large or borderline implementation work has Claude ask you once whether to take it through the flow or do it directly. Each stage starts at its own effort:

| Stage | Skill | Effort |
|---|---|---|
| grill | grill-with-docs | `high` |
| spec | to-spec | `high` |
| tickets | to-tickets | `medium` |
| implement | implement, tdd | `high` |
| review | code-review | `xhigh` |
| retro | retro | `medium` |

The mod knows the stage from its `stage` tool, from Claude reading a stage skill's `SKILL.md`, from a stage skill Claude runs, and from a stage command you type. The flow ends when the retro turn ends or Claude says it is done.

**Tickets.** In the tickets stage, Claude puts a `Model:` and an `Effort:` line near the top of every ticket (`<feature>/issues/NN-*.md`), and you review them with the tickets. In the implement stage:

- Claude working a ticket itself takes the ticket's effort and keeps the task's model.
- A sub-agent handed a ticket (its file path in the Agent prompt) runs on the ticket's model and effort. On failing checks it climbs its effort to `xhigh`, then a model up.
- A ticket with neither line is read by Haiku.

### Sub-agents

| Sub-agent | Model and effort |
|---|---|
| Explore | Haiku · `low` |
| Plan | the session's model · `high` |
| general-purpose | the session's model · the main session's current effort |
| a type you defined, or a call that names its own model or effort | left as it is |

Sub-agents of the built-in types climb their own effort on failing checks, up to `xhigh`, never their model.

## The band and the pane

The band above the prompt draws the task as a small flow: what Haiku read (or the Main Flow stage), then the effort and model in use with a meter of the ladder. A failing check loops back into the effort; a climb changes it in place. Sub-agents at work hang off it as one node, with a button for each beneath. In the terminal the band is one line.

`/open-effort` or the band's ≡ opens the pane:

- **Switch:** the mod on or off for this project. Under **Advanced**, the default for the projects you have not switched.
- **Main Flow:** on or off for this project, and the skills that are missing with the commands to install them.
- **Language:** auto (follows Claude Code's `language` setting), ไทย or English.
- **Theme:** Claude (orange), Lime, Ocean or Rose.
- **History:** the project's last 500 turns as a chart: the effort each turn started at and climbed to, and the turns by model and effort.

`/open-effort on` and `/open-effort off` switch the mod for the project you are in. Only you can switch it: Claude has no tool or command that does.

## Data and privacy

- Everything the mod keeps is in Claude Code's plugin store on your machine: the switches, the language, the theme, and per project its history.
- The history never holds what you typed: only times, efforts, readings, stages, counts and model names.
- The mod makes no network call of its own. Its only model call is a Haiku reading, sent through Claude Code like any other request, of:
  - a new request you type, with the end of Claude's last message when a task is under way;
  - a Main Flow ticket that names no `Model:` or `Effort:` line, when Claude reads it or hands it to a sub-agent.
- The only files it reads are those tickets (`<feature>/issues/NN-*.md`), in the implement stage. It writes no files.
- It adds notes to the conversation for Claude (asking about the Main Flow or a model, writing ticket lines, stopping at the ladder's end), and registers three tools Claude can call: `stage`, `model` and `report`.

## Limits

- The mod API is new in Claude Code and may change between releases.
- Moving a task to another model starts that task's prompt cache afresh.
- A slow Haiku reading arrives during the turn, so the turn's first requests go out at the session's own effort.
- The notes the mod sends Claude (asking about the Main Flow or a model, writing ticket lines) are instructions: the mod follows what Claude announces and reads, and does not enforce them.

## Development

```bash
claude plugin test .
```

```bash
claude plugin validate .
```

| Path | What it holds |
|---|---|
| `hooks/register.tsx` | the hooks module: wiring, the band and the pane |
| `hooks/policy.ts` | starting effort, the ladder, models, sub-agents, tickets |
| `hooks/score.ts` | the Haiku reading and go-on replies |
| `hooks/checks.ts` | which commands count as checks |
| `hooks/main-flow.ts` | Main Flow stages, routing and the notes to Claude |
| `hooks/history.ts` | history entries and their store |
| `hooks/diagrams.ts` | the SVG band, stage track, history chart and themes |
| `hooks/words.ts` | English and Thai text |
| `types/index.d.ts` | the mod's state and its types |
| `tests/` | tests that drive the mod at its hooks with an engine of their own |

## Credits

The Main Flow and its skills are [Matt Pocock's](https://github.com/mattpocock/skills) (MIT). open-effort is not affiliated with Matt Pocock or Anthropic.

## License

[MIT](LICENSE)

---

## ภาษาไทย

open-effort เป็น mod ของ Claude Code ที่ปรับ effort ให้พอดีกับงานตรงหน้า และเปลี่ยนไปใช้โมเดลที่แรงกว่าก็ต่อเมื่อ effort สูงสุดยังไม่พอ

- **effort พอดีกับงาน:** Haiku อ่าน prompt ใหม่แต่ละครั้ง แผนชัดเริ่มที่ low รู้เป้าหมายเริ่มที่ medium แผนยังไม่ชัดเริ่มที่ high งานยากพิเศษเริ่มที่ xhigh
- **ไต่ขึ้นเมื่องานติด:** check ไม่ผ่าน 3 ครั้งติด (test, typecheck, build, lint) จะไต่ขึ้นทีละขั้นจนถึง Fable 5.1 แล้วให้ Claude หยุดถามคุณ ผ่านเมื่อไหร่ก็กลับลงมาที่เดิม
- **เลือกโมเดลโดยถามคุณก่อน:** ถ้างานต้องใช้โมเดลที่เก่งกว่าของ session Claude จะถามคุณครั้งเดียวตอนเริ่มงาน
- **Main Flow ของ Matt Pocock (เลือกได้):** งาน implement ใหญ่ Claude จะถามก่อนว่าจะทำผ่าน grill, spec, tickets, implement, review, retro ไหม แต่ละขั้นและแต่ละ ticket มี effort ของตัวเอง
- **เห็นตลอด:** แถบเหนือช่องพิมพ์บอก effort, โมเดล และเหตุผล ส่วน pane ข้างแชทมีสวิตช์, ธีมสี และกราฟประวัติ

ติดตั้งในแอป desktop: กด **+** ข้างช่องพิมพ์ → **Plugins** → **Add marketplace** ใส่ `JakkapatB/open-effort` → **Add plugin**

หรือจาก terminal:

```bash
claude plugin install open-effort --marketplace JakkapatB/open-effort
```

ตั้ง `language` ของ Claude Code เป็น Thai หรือเลือก "ไทย" ใน pane แล้วแถบกับ pane จะเป็นภาษาไทย ข้อมูลทั้งหมดเก็บในเครื่องของคุณ และไม่เก็บข้อความที่คุณพิมพ์
