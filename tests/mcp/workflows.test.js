const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { findRelevantWorkflows } = require("../../mcp/lib/workflows");

function makeTempHarness(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-workflows-test-"));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return dir;
}

test("finds a case-insensitive keyword match with line number and text", () => {
  const harness = makeTempHarness({
    "skills/foo/SKILL.md": "---\nname: foo\n---\nUse Zustand for client state.\n",
  });
  const results = findRelevantWorkflows(harness, "zustand");

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].file, "skills/foo/SKILL.md");
  assert.strictEqual(results[0].matches[0].line, 4);
  assert.ok(results[0].matches[0].text.includes("Zustand"));
});

test("searches across skills/, rules/, and docs/ but not other directories", () => {
  const harness = makeTempHarness({
    "skills/foo/SKILL.md": "keyword-here\n",
    "rules/bar/rules.md": "keyword-here\n",
    "docs/notes.md": "keyword-here\n",
    "scripts/hooks/unrelated.js": "keyword-here\n",
  });
  const results = findRelevantWorkflows(harness, "keyword-here");
  const files = results.map((r) => r.file).sort();

  assert.deepStrictEqual(files, ["docs/notes.md", "rules/bar/rules.md", "skills/foo/SKILL.md"]);
});

test("returns empty array when nothing matches", () => {
  const harness = makeTempHarness({ "skills/foo/SKILL.md": "nothing relevant\n" });
  assert.deepStrictEqual(findRelevantWorkflows(harness, "nonexistent-keyword"), []);
});

test("throws on an empty keyword", () => {
  const harness = makeTempHarness({});
  assert.throws(() => findRelevantWorkflows(harness, ""), /non-empty string/);
  assert.throws(() => findRelevantWorkflows(harness, "   "), /non-empty string/);
});

test("integration: finds 'zustand' in the real harness's client-state-patterns skill", () => {
  const HARNESS_ROOT = path.join(__dirname, "..", "..");
  const results = findRelevantWorkflows(HARNESS_ROOT, "zustand");
  assert.ok(results.some((r) => r.file === "skills/client-state-patterns/SKILL.md"));
});
