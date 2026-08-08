const test = require("node:test");
const assert = require("node:assert");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = require("@modelcontextprotocol/sdk/inMemory.js");
const { createServer } = require("../../mcp/server");

async function connectedClient(server) {
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.1.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

test("registers all 5 tools with the expected names", async () => {
  const server = createServer();
  const client = await connectedClient(server);

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();

  assert.deepStrictEqual(names, [
    "find_relevant_workflows",
    "list_agents",
    "list_skills",
    "read_skill",
    "run_harness_audit",
  ]);
});

test("list_skills tool call returns the real harness's 7 skills", async () => {
  const server = createServer();
  const client = await connectedClient(server);

  const result = await client.callTool({ name: "list_skills", arguments: {} });
  const skills = JSON.parse(result.content[0].text);

  assert.strictEqual(skills.length, 7);
  assert.ok(skills.some((s) => s.name === "agent-sort"));
});

test("read_skill tool call returns SKILL.md content for a known skill", async () => {
  const server = createServer();
  const client = await connectedClient(server);

  const result = await client.callTool({ name: "read_skill", arguments: { name: "sql-queries" } });

  assert.ok(!result.isError);
  assert.ok(result.content[0].text.includes("name: sql-queries"));
});

test("read_skill tool call surfaces an error for an unknown skill", async () => {
  const server = createServer();
  const client = await connectedClient(server);

  const result = await client.callTool({ name: "read_skill", arguments: { name: "nonexistent" } });

  assert.strictEqual(result.isError, true);
});

test("list_agents tool call returns an empty list today", async () => {
  const server = createServer();
  const client = await connectedClient(server);

  const result = await client.callTool({ name: "list_agents", arguments: {} });
  assert.deepStrictEqual(JSON.parse(result.content[0].text), []);
});

test("find_relevant_workflows tool call finds matches for a real keyword", async () => {
  const server = createServer();
  const client = await connectedClient(server);

  const result = await client.callTool({
    name: "find_relevant_workflows",
    arguments: { keyword: "TanStack" },
  });
  const matches = JSON.parse(result.content[0].text);

  assert.ok(matches.some((m) => m.file === "skills/data-fetching-patterns/SKILL.md"));
});

test("run_harness_audit tool call returns a score and sub-reports", async () => {
  const server = createServer();
  const client = await connectedClient(server);

  const result = await client.callTool({ name: "run_harness_audit", arguments: {} });
  const audit = JSON.parse(result.content[0].text);

  assert.ok(typeof audit.overallScore === "number");
  assert.ok("memoryPersistence" in audit);
  assert.ok("hookTests" in audit);
  assert.ok("stackRulesCoverage" in audit);
  assert.ok("incompleteSkills" in audit);
});
