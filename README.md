# my-harness

Personal ECC-style engineering harness for nekopunch.

Based on the ECC (Engineering Command Center) skill model — the same lineage
seolly's `harness-engineering` repo draws from — but scoped to nekopunch's own
stack and workflow instead of the team's.

## What this is

A repo of Claude Code skills, hooks, and rules that:

1. Classifies which skills a given project actually needs (`skills/agent-sort`)
2. Auto-runs that classification when a session starts in a new repo
   (`hooks/hooks.json` → `scripts/hooks/session-start.js`)
3. Caches the classification per-repo so it doesn't re-run every session
   (`hooks/memory-persistence/`)

## Structure

```
skills/     canonical workflow surface — agent-sort lives here
hooks/      hooks.json config + memory-persistence cache
scripts/    hook implementation scripts (Node, no external deps)
rules/      language/stack-specific rule sets
commands/   explicit command shims
agents/     subagent definitions
mcp-configs/  MCP server definitions used by this harness
tests/      hook coverage tests
```

## Install

```bash
./install.sh      # macOS/Linux
./install.ps1      # Windows
```

This symlinks/copies `hooks/`, `skills/`, `rules/` into `~/.claude/` (user-level,
applies to every repo) and drops a project-scoped `.claude/` stub into the
current repo if run from inside one.

## Stack coverage (starting point)

Seeded for nekopunch's actual stacks — extend as needed:

- Backend: Spring Boot + PostgreSQL (Java/Gradle or Maven)
- Frontend: React + TypeScript + Vite + TanStack Query + Zustand + React Flow, FSD structure

See `skills/agent-sort/SKILL.md` for the full evidence-based classification rules.
