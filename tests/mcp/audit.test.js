const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { runHarnessAudit } = require("../../mcp/lib/audit");

const HARNESS_ROOT = path.join(__dirname, "..", "..");

function writeFile(root, relPath, content) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function makeTempHarness() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-audit-test-"));
}

const PASSING_TEST = 'const test = require("node:test");\nconst assert = require("node:assert");\ntest("passes", () => { assert.ok(true); });\n';
const FAILING_TEST = 'const test = require("node:test");\nconst assert = require("node:assert");\ntest("fails", () => { assert.ok(false); });\n';

test("auditMemoryPersistence: reports cached repos and flags invalid JSON", () => {
  const harness = makeTempHarness();
  writeFile(
    harness,
    "hooks/memory-persistence/repo-a.json",
    JSON.stringify({ repoId: "repo-a", generatedAt: "2026-08-09T00:00:00.000Z", daily: ["x"] })
  );
  writeFile(harness, "hooks/memory-persistence/repo-b.json", "{not valid json");

  const result = runHarnessAudit(harness);

  assert.strictEqual(result.memoryPersistence.exists, true);
  assert.strictEqual(result.memoryPersistence.repos.length, 2);
  const a = result.memoryPersistence.repos.find((r) => r.file === "repo-a.json");
  assert.strictEqual(a.repoId, "repo-a");
  assert.strictEqual(a.dailyCount, 1);
  const b = result.memoryPersistence.repos.find((r) => r.file === "repo-b.json");
  assert.ok(b.error);
});

test("auditHookTests: runs node --test against tests/hooks and reports pass/fail", () => {
  const harness = makeTempHarness();
  writeFile(harness, "tests/hooks/sample.test.js", PASSING_TEST);

  const result = runHarnessAudit(harness);

  assert.strictEqual(result.hookTests.ran, true);
  assert.strictEqual(result.hookTests.pass, 1);
  assert.strictEqual(result.hookTests.fail, 0);
  assert.strictEqual(result.hookTests.exitCode, 0);
});

test("auditHookTests: reports failures without throwing", () => {
  const harness = makeTempHarness();
  writeFile(harness, "tests/hooks/sample.test.js", FAILING_TEST);

  const result = runHarnessAudit(harness);

  assert.strictEqual(result.hookTests.pass, 0);
  assert.strictEqual(result.hookTests.fail, 1);
  assert.notStrictEqual(result.hookTests.exitCode, 0);
});

test("auditHookTests: ran is false when tests/hooks doesn't exist", () => {
  const harness = makeTempHarness();
  const result = runHarnessAudit(harness);
  assert.strictEqual(result.hookTests.ran, false);
});

test("stack rules coverage and incomplete skills reflect the given harnessRoot's files", () => {
  const harness = makeTempHarness();
  // Only 2 of the 8 real STACK_RULES targets exist in this fixture.
  writeFile(
    harness,
    "skills/frontend-patterns/SKILL.md",
    "---\nname: frontend-patterns\ndescription: covered\norigin: test\n---\n"
  );
  writeFile(harness, "rules/typescript/rules.md", "# ts rules\n");
  writeFile(harness, "skills/incomplete-skill/SKILL.md", "---\nname: incomplete-skill\ndescription: no origin here\n---\n");

  const result = runHarnessAudit(harness);

  assert.strictEqual(result.stackRulesCoverage.total, 8);
  assert.strictEqual(result.stackRulesCoverage.covered, 2);
  assert.ok(result.stackRulesCoverage.coverage.find((c) => c.id === "skills/frontend-patterns").targetExists);
  assert.ok(result.stackRulesCoverage.coverage.find((c) => c.id === "rules/typescript").targetExists);
  assert.ok(!result.stackRulesCoverage.coverage.find((c) => c.id === "skills/sql-queries").targetExists);

  assert.strictEqual(result.incompleteSkills.length, 1);
  assert.strictEqual(result.incompleteSkills[0].name, "incomplete-skill");
  assert.strictEqual(result.incompleteSkills[0].missingOrigin, true);

  assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
});

test("integration: real harness has full stack-rule coverage, no incomplete skills, and passing hook tests", () => {
  const result = runHarnessAudit(HARNESS_ROOT);

  assert.strictEqual(result.stackRulesCoverage.total, 8);
  assert.strictEqual(result.stackRulesCoverage.covered, 8);
  assert.deepStrictEqual(result.incompleteSkills, []);
  assert.strictEqual(result.hookTests.ran, true);
  assert.strictEqual(result.hookTests.fail, 0);
  assert.ok(result.hookTests.pass > 0);
  assert.strictEqual(result.memoryPersistence.exists, true);
  assert.strictEqual(result.overallScore, 100);
});
