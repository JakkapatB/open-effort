# Changelog

## 0.4.0

### Minor Changes

- 537263b: open-effort now tells you when a new version is out. Once a day (switch it off in the pane) and whenever you press Check now, it reads the newest version number from GitHub; when one is out, the band's ≡ shows a dot and the top of the pane shows Update now, which runs Claude Code's own plugin update, then Reload now. Where the update cannot run, the pane gives the command.

## 0.3.0

### Minor Changes

- f905caa: Climbing past the top effort no longer jumps to Fable 5.1 by itself. Claude stops and asks before moving the task up one model (Sonnet → Opus → Fable 5.1), and with a yes the task carries on there from high. Keeping the model means three more failing checks stop the work. A ticket's sub-agent climbs no further than Opus 5.5.

## 0.2.0

- A project can use its own flow instead of Matt Pocock's Main Flow: `.claude/open-effort.json` names its stages, the
  skills that run each, the effort each starts at, and where its tickets are written, worked and kept. `/open-effort
flow` has Claude ask you about your flow and write the file. A file with a problem keeps the flow off, and the pane
  says why.
- The pane's Main Flow section is now **Flow**, and says which flow the project uses.
- Meets the plugin directory's checks: the Haiku call lives in the hooks module's main file, and a ticket's sub-agent
  is linked at its first turn's start or from the Agent call's answer, with no `agent.spawn` hook.
- The README says what each hook does and changes, and what the mod sends where.
- The README shows how to install: one shell line, inside Claude Code in the terminal, or step by step in the desktop
  app, with a picture of all three; and a Try it section with example prompts.
- plugin.json links to the documentation, support and privacy sections.
- A code of conduct.

## 0.1.0

The first release.

- Haiku reads each new request and sets a starting effort; three failing checks in a row raise it one level, then move
  to Fable 5.1, then Claude stops and asks you.
- Asks before moving a task to a more capable model.
- Matt Pocock's Main Flow: an effort per stage, tickets with their own `Model:` and `Effort:`, sub-agents per ticket.
- Sub-agents by type: Explore on Haiku at low, Plan and general-purpose on the task's model.
- A band above the prompt and a pane with switches, the Main Flow's model, language, four themes and a history chart.
- English and Thai.
- Measured results in the README: cost with the mod on and off, sub-agents, the Main Flow.
