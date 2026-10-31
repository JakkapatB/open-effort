# Security

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub: the **Security** tab of this repository →
**Report a vulnerability**. You will get an answer within 7 days.

Include what an attacker could do, how to reproduce it, and the Claude Code version you used.

## What the mod touches

So you can judge what counts as a vulnerability:

- It reads only ticket files (`<feature>/issues/NN-*.md`) in the Main Flow's implement stage, and writes no files.
- It makes no network calls of its own. Its only model calls are Haiku readings of new requests and of tickets, sent
  through Claude Code.
- It keeps its settings and history in Claude Code's plugin store on your machine; the history never holds what you
  typed.
- It adds notes for Claude to the conversation and registers three tools: `stage`, `model` and `report`.

A way to make the mod read or send something outside this list, or to make Claude act on a note the mod did not send,
is a vulnerability.

## Supported versions

Only the latest release is supported.
