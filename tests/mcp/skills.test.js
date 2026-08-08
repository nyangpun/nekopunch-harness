const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { parseFrontmatter, listSkills, readSkill } = require("../../mcp/lib/skills");

const HARNESS_ROOT = path.join(__dirname, "..", "..");

function makeTempHarness(skillFiles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-skills-test-"));
  for (const [name, content] of Object.entries(skillFiles)) {
    const filePath = path.join(dir, "skills", name, "SKILL.md");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return dir;
}

test("parseFrontmatter extracts name/description/origin from a SKILL.md header", () => {
  const { data, body } = parseFrontmatter(
    "---\nname: foo\ndescription: does a thing\norigin: personal\n---\n\n# Foo\n"
  );
  assert.strictEqual(data.name, "foo");
  assert.strictEqual(data.description, "does a thing");
  assert.strictEqual(data.origin, "personal");
  assert.ok(body.includes("# Foo"));
});

test("parseFrontmatter returns empty data when there is no frontmatter block", () => {
  const { data } = parseFrontmatter("# Just a heading\nno frontmatter here\n");
  assert.deepStrictEqual(data, {});
});

test("listSkills reads name/description/origin for every skill in a temp harness", () => {
  const harness = makeTempHarness({
    "foo": "---\nname: foo\ndescription: does foo things\norigin: personal\n---\n",
    "bar": "---\nname: bar\ndescription: does bar things\n---\n",
  });
  const skills = listSkills(harness);

  assert.strictEqual(skills.length, 2);
  const foo = skills.find((s) => s.name === "foo");
  assert.strictEqual(foo.description, "does foo things");
  assert.strictEqual(foo.origin, "personal");
  const bar = skills.find((s) => s.name === "bar");
  assert.strictEqual(bar.origin, null);
});

test("listSkills skips directories without a SKILL.md", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-skills-test-"));
  fs.mkdirSync(path.join(dir, "skills", "empty-dir"), { recursive: true });
  assert.deepStrictEqual(listSkills(dir), []);
});

test("listSkills returns empty array when skills/ doesn't exist", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-skills-test-"));
  assert.deepStrictEqual(listSkills(dir), []);
});

test("readSkill returns the raw SKILL.md content for a valid name", () => {
  const harness = makeTempHarness({ foo: "---\nname: foo\ndescription: x\n---\nbody text\n" });
  const content = readSkill(harness, "foo");
  assert.ok(content.includes("body text"));
});

test("readSkill throws for an unknown skill name", () => {
  const harness = makeTempHarness({});
  assert.throws(() => readSkill(harness, "nonexistent"), /No SKILL\.md found/);
});

test("readSkill rejects path-traversal-shaped names", () => {
  const harness = makeTempHarness({});
  assert.throws(() => readSkill(harness, "../../etc/passwd"), /Invalid skill name/);
});

test("integration: listSkills against the real harness finds all 7 current skills", () => {
  const skills = listSkills(HARNESS_ROOT);
  const names = skills.map((s) => s.name).sort();

  assert.deepStrictEqual(names, [
    "agent-sort",
    "canvas-node-graph-patterns",
    "client-state-patterns",
    "collaboration-infra",
    "data-fetching-patterns",
    "frontend-patterns",
    "sql-queries",
  ]);
  for (const skill of skills) {
    assert.ok(skill.description.length > 0, `${skill.name} should have a description`);
  }
});
