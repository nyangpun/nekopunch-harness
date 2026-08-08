const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { listAgents } = require("../../mcp/lib/agents");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-agents-test-"));
}

test("listAgents returns empty array when only .gitkeep is present", () => {
  const dir = makeTempDir();
  fs.mkdirSync(path.join(dir, "agents"));
  fs.writeFileSync(path.join(dir, "agents", ".gitkeep"), "");

  assert.deepStrictEqual(listAgents(dir), []);
});

test("listAgents lists agent subdirectories once they exist", () => {
  const dir = makeTempDir();
  fs.mkdirSync(path.join(dir, "agents", "reviewer"), { recursive: true });
  fs.mkdirSync(path.join(dir, "agents", "planner"), { recursive: true });

  assert.deepStrictEqual(listAgents(dir), ["planner", "reviewer"]);
});

test("listAgents returns empty array when agents/ doesn't exist", () => {
  const dir = makeTempDir();
  assert.deepStrictEqual(listAgents(dir), []);
});

test("integration: listAgents against the real harness is empty today", () => {
  const HARNESS_ROOT = path.join(__dirname, "..", "..");
  assert.deepStrictEqual(listAgents(HARNESS_ROOT), []);
});
