# my-harness

Personal ECC-style engineering harness for nekopunch.

Based on the ECC (Engineering Command Center) skill model — the same lineage
seolly's `harness-engineering` repo draws from — but scoped to nekopunch's own
stack and workflow instead of the team's.

## What this is

A repo of Claude Code skills, hooks, and rules that:

1. Classifies which skills a given project actually needs (`skills/agent-sort`)
2. Auto-runs that classification when a session starts in a new repo
   (`scripts/hooks/session-start.js`, registered as a `SessionStart` hook in
   `~/.claude/settings.json` — see "Install" below)
3. Caches the classification per-repo so it doesn't re-run every session
   (`hooks/memory-persistence/`)

## Structure

```
skills/     canonical workflow surface — agent-sort lives here
hooks/      hooks.json (reference/plugin-schema copy — see note below) + memory-persistence cache
scripts/    hook implementation scripts (Node, no external deps) + scripts/install/ registration
rules/      language/stack-specific rule sets
commands/   explicit command shims
agents/     subagent definitions
mcp-configs/  MCP server definitions used by this harness
tests/      hook coverage tests
```

**Note on `hooks/hooks.json`:** this harness is installed by symlink, not as
a registered Claude Code plugin, so `hooks/hooks.json` is never read
automatically — Claude Code only loads hook config from `settings.json` (or a
real plugin's own `hooks.json`, which requires a `plugin.json` manifest and
going through plugin install, not just file presence). The file is kept as a
correct-schema reference. The actual registration happens in
`~/.claude/settings.json`, written by `scripts/install/register-session-start-hook.js`.

## Install

```bash
./install.sh      # macOS/Linux
./install.ps1      # Windows
```

This symlinks `hooks/`, `skills/`, `rules/`, `commands/`, `agents/`, and
`mcp-configs/` into `~/.claude/` (user-level, applies to every repo), then
registers the `SessionStart` hook in `~/.claude/settings.json` — idempotent,
safe to re-run. Symlinking alone does not make the hook fire; the
`settings.json` entry is what does.

## Stack coverage (starting point)

Seeded for nekopunch's actual stacks — extend as needed:

- Backend: Spring Boot + PostgreSQL (Java/Gradle or Maven)
- Frontend: React + TypeScript + Vite + TanStack Query + Zustand + React Flow, FSD structure

See `skills/agent-sort/SKILL.md` for the full evidence-based classification rules.
