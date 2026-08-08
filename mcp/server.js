#!/usr/bin/env node
const path = require("path");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const { listSkills, readSkill } = require("./lib/skills");
const { listAgents } = require("./lib/agents");
const { findRelevantWorkflows } = require("./lib/workflows");
const { runHarnessAudit } = require("./lib/audit");

const HARNESS_ROOT = path.resolve(__dirname, "..");

function textResult(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }] };
}

function errorResult(err) {
  return { content: [{ type: "text", text: err.message }], isError: true };
}

function createServer(harnessRoot = HARNESS_ROOT) {
  const server = new McpServer({ name: "my-harness", version: "0.1.0" });

  server.registerTool(
    "list_skills",
    {
      title: "List skills",
      description: "List every skill in this harness with its name and description (from each SKILL.md's frontmatter).",
      inputSchema: {},
    },
    async () => textResult(listSkills(harnessRoot))
  );

  server.registerTool(
    "read_skill",
    {
      title: "Read skill",
      description: "Return the full SKILL.md content for a named skill.",
      inputSchema: { name: z.string().describe("Skill name, e.g. 'frontend-patterns'") },
    },
    async ({ name }) => {
      try {
        return textResult(readSkill(harnessRoot, name));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "list_agents",
    {
      title: "List agents",
      description: "List subagent definitions in agents/ (empty today, kept for forward compatibility).",
      inputSchema: {},
    },
    async () => textResult(listAgents(harnessRoot))
  );

  server.registerTool(
    "find_relevant_workflows",
    {
      title: "Find relevant workflows",
      description: "Keyword-search skills/, rules/, and docs/ content for matching lines.",
      inputSchema: { keyword: z.string().describe("Keyword or phrase to search for") },
    },
    async ({ keyword }) => {
      try {
        return textResult(findRelevantWorkflows(harnessRoot, keyword));
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "run_harness_audit",
    {
      title: "Run harness audit",
      description:
        "Self-audit this harness: memory-persistence cache state, tests/hooks pass rate, " +
        "STACK_RULES coverage, and SKILL.md files missing origin/description.",
      inputSchema: {},
    },
    async () => textResult(runHarnessAudit(harnessRoot))
  );

  return server;
}

module.exports = { createServer, HARNESS_ROOT };

if (require.main === module) {
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
