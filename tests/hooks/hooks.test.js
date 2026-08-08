const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { runAgentSort } = require("../../scripts/hooks/auto-agent-sort");

function makeTempRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-test-"));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return dir;
}

test("promotes react+vite frontend to DAILY", () => {
  const repo = makeTempRepo({
    "package.json": JSON.stringify({
      dependencies: { react: "^18.0.0", vite: "^5.0.0", zustand: "^4.0.0" },
    }),
  });
  const cachePath = path.join(repo, "cache.json");
  const result = runAgentSort(repo, cachePath);

  assert.ok(result.daily.includes("skills/frontend-patterns"));
  assert.ok(result.daily.includes("skills/client-state-patterns"));
  assert.ok(fs.existsSync(cachePath));
});

test("promotes spring-boot backend to DAILY", () => {
  const repo = makeTempRepo({
    "build.gradle": "implementation 'org.springframework.boot:spring-boot-starter-web'",
  });
  const cachePath = path.join(repo, "cache.json");
  const result = runAgentSort(repo, cachePath);

  assert.ok(result.daily.includes("rules/java-spring"));
});

test("promotes collaboration-infra when websocket starter is present", () => {
  const repo = makeTempRepo({
    "build.gradle":
      "implementation 'org.springframework.boot:spring-boot-starter-websocket'",
  });
  const cachePath = path.join(repo, "cache.json");
  const result = runAgentSort(repo, cachePath);

  assert.ok(result.daily.includes("skills/collaboration-infra"));
});

test("leaves off-stack skills in LIBRARY", () => {
  const repo = makeTempRepo({ "package.json": "{}" });
  const cachePath = path.join(repo, "cache.json");
  const result = runAgentSort(repo, cachePath);

  assert.ok(result.library.includes("skills/django-patterns"));
  assert.ok(!result.daily.includes("rules/java-spring"));
});

test("monorepo: detects frontend stack nested in a *_frontend subpackage", () => {
  const repo = makeTempRepo({
    "app_frontend/package.json": JSON.stringify({
      dependencies: { react: "^19.0.0", vite: "^5.0.0", zustand: "^5.0.0" },
    }),
  });
  const cachePath = path.join(repo, "cache.json");
  const result = runAgentSort(repo, cachePath);

  assert.ok(result.daily.includes("skills/frontend-patterns"));
  assert.ok(result.daily.includes("skills/client-state-patterns"));
});

test("monorepo: detects backend stack nested in a *_backend subpackage", () => {
  const repo = makeTempRepo({
    "app_backend/build.gradle":
      "implementation 'org.springframework.boot:spring-boot-starter-web'\nimplementation 'org.springframework.boot:spring-boot-starter-websocket'",
  });
  const cachePath = path.join(repo, "cache.json");
  const result = runAgentSort(repo, cachePath);

  assert.ok(result.daily.includes("rules/java-spring"));
  assert.ok(result.daily.includes("skills/collaboration-infra"));
});

test("monorepo: root aggregator build.gradle without websocket doesn't hide the websocket starter declared only in a *_backend subpackage", () => {
  // Regression test: an earlier version of readIfExistsAnywhere returned the
  // first match found (root) and never looked further, so a root aggregator
  // file that exists but lacks the marker would silently hide subpackage
  // evidence. This is exactly FlowMat's shape: root build.gradle has
  // spring-boot + postgres but not the websocket starter, which only
  // flowmat_backend/build.gradle declares.
  const repo = makeTempRepo({
    "build.gradle": "implementation 'org.springframework.boot:spring-boot-starter-web'\nruntimeOnly 'org.postgresql:postgresql'",
    "app_backend/build.gradle": "implementation 'org.springframework.boot:spring-boot-starter-websocket'",
  });
  const cachePath = path.join(repo, "cache.json");
  const result = runAgentSort(repo, cachePath);

  assert.ok(result.daily.includes("rules/java-spring"));
  assert.ok(result.daily.includes("skills/sql-queries"));
  assert.ok(result.daily.includes("skills/collaboration-infra"));
});

test("monorepo: detects postgres via compose.yaml nested in a *_backend subpackage", () => {
  const repo = makeTempRepo({
    "app_backend/build.gradle": "implementation 'org.springframework.boot:spring-boot-starter-web'",
    "app_backend/compose.yaml": "services:\n  db:\n    image: postgres:16\n",
  });
  const cachePath = path.join(repo, "cache.json");
  const result = runAgentSort(repo, cachePath);

  assert.ok(result.daily.includes("skills/sql-queries"));
});

test("surfaces repo-native CLAUDE.md files (root and subpackage) for the agent-sort priority rule", () => {
  const repo = makeTempRepo({
    "CLAUDE.md": "# root conventions",
    "app_backend/CLAUDE.md": "# backend conventions",
  });
  const cachePath = path.join(repo, "cache.json");
  const result = runAgentSort(repo, cachePath);

  assert.ok(result.claudeMdFiles.includes("CLAUDE.md"));
  assert.ok(result.claudeMdFiles.some((p) => p.replace(/\\/g, "/") === "app_backend/CLAUDE.md"));
});

test("claudeMdFiles is empty when no CLAUDE.md exists", () => {
  const repo = makeTempRepo({ "package.json": "{}" });
  const cachePath = path.join(repo, "cache.json");
  const result = runAgentSort(repo, cachePath);

  assert.deepStrictEqual(result.claudeMdFiles, []);
});
