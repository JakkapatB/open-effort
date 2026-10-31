# Changelog

All notable changes to this project. Dates are in UTC.

## [0.1.0] - unreleased

The first release.

- Haiku reads each new request and sets a starting effort; three failing checks in a row raise it one level, then move
  to Fable 5.1, then Claude stops and asks you.
- Asks before moving a task to a more capable model.
- Matt Pocock's Main Flow: an effort per stage, tickets with their own `Model:` and `Effort:`, sub-agents per ticket.
- Sub-agents by type: Explore on Haiku at low, Plan and general-purpose on the task's model.
- A band above the prompt and a pane with switches, the Main Flow's model, language, four themes and a history chart.
- English and Thai.
- Measured results in the README: cost with the mod on and off, sub-agents, the Main Flow.
