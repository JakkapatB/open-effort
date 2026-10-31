# Changelog

All notable changes to this project. Dates are in UTC.

## [Unreleased]

- Meets the plugin directory's checks: the Haiku call lives in the hooks module's main file, and a ticket's sub-agent
  is linked at its first turn's start or from the Agent call's answer, with no `agent.spawn` hook.
- The README says what each hook does and changes, and what the mod sends where.

## [0.1.0] - 2026-11-01

The first release.

- Haiku reads each new request and sets a starting effort; three failing checks in a row raise it one level, then move
  to Fable 5.1, then Claude stops and asks you.
- Asks before moving a task to a more capable model.
- Matt Pocock's Main Flow: an effort per stage, tickets with their own `Model:` and `Effort:`, sub-agents per ticket.
- Sub-agents by type: Explore on Haiku at low, Plan and general-purpose on the task's model.
- A band above the prompt and a pane with switches, the Main Flow's model, language, four themes and a history chart.
- English and Thai.
- Measured results in the README: cost with the mod on and off, sub-agents, the Main Flow.
