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
mcp/        this harness's own MCP server (mcp/server.js) — see "MCP server" below
mcp-configs/  MCP server definitions used by this harness
tests/      hook coverage tests + tests/mcp MCP server tests
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

## MCP server

This repo also exposes itself as an MCP server (`mcp/server.js`, built on
`@modelcontextprotocol/sdk`) so an agent can query the harness directly
instead of reading files off disk. It provides the same kind of tools as
seolly's `harness-engineering` repo:

- `list_skills` — name + description for every `skills/*/SKILL.md`
- `read_skill` — full `SKILL.md` content for a named skill
- `list_agents` — contents of `agents/` (empty today, kept for later)
- `find_relevant_workflows` — keyword search across `skills/`, `rules/`, `docs/`
- `run_harness_audit` — self-audit: `hooks/memory-persistence/` cache state,
  `tests/hooks/*.test.js` pass rate (runs `node --test`), `STACK_RULES`
  coverage (from `scripts/hooks/auto-agent-sort.js`), and any `SKILL.md`
  missing `origin` or `description` in its frontmatter

Run it directly with:

```bash
npm install   # first time only, installs @modelcontextprotocol/sdk + zod
npm run mcp   # starts the server on stdio
```

### Claude Code (this repo)

Opening this repo in Claude Code picks up the root `.mcp.json` automatically
— no extra setup needed.

### Claude Desktop

Add an entry to Claude Desktop's `claude_desktop_config.json` (macOS:
`~/Library/Application Support/Claude/claude_desktop_config.json`; Windows:
`%APPDATA%\Claude\claude_desktop_config.json`), using this repo's absolute
path:

```json
{
  "mcpServers": {
    "my-harness": {
      "command": "node",
      "args": ["<absolute-path-to-my-harness>/mcp/server.js"]
    }
  }
}
```

`mcp-configs/my-harness.json` has the same snippet as a copy/paste reference.
Restart Claude Desktop after editing the config.

### claude.ai (web)

claude.ai's web connectors expect a remotely reachable server (HTTP/SSE),
not a local process launched via stdio — `mcp/server.js` runs over stdio, so
the web app cannot spawn or reach it directly. This server is **Claude
Desktop / Claude Code only** unless it's put behind something that exposes
it remotely (e.g. a local stdio-to-HTTP bridge like `mcp-remote`, or actually
hosting it), which this repo does not set up.

## Stack coverage (starting point)

Seeded for nekopunch's actual stacks — extend as needed:

- Backend: Spring Boot + PostgreSQL (Java/Gradle or Maven)
- Frontend: React + TypeScript + Vite + TanStack Query + Zustand + React Flow, FSD structure

See `skills/agent-sort/SKILL.md` for the full evidence-based classification rules.
