# mcp-configs

Project-scoped and bundled MCP server definitions used by this harness go
here (mirrors the pattern in seolly-harness's `mcp-configs/` + `.mcp.json`).

Add one JSON file per server, e.g. `postgres.json`, `github.json`.

`my-harness.json` is this repo's own server (`mcp/server.js`) — it exposes
`list_skills`, `read_skill`, `list_agents`, `find_relevant_workflows`, and
`run_harness_audit` as MCP tools. See the root `README.md`'s "MCP server"
section for how to register it in Claude Desktop or claude.ai. The root
`.mcp.json` registers the same server for anyone working inside this repo
directly in Claude Code — no path substitution needed there since it uses a
path relative to the project root.
