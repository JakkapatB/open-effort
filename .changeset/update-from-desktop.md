---
"open-effort": patch
---

Update now works where the desktop app puts no `claude` on the PATH: the mod looks for Claude Code through a shell, and if it still cannot run it, asks Claude to run the update in the chat, and gives a terminal command in case that is refused.
