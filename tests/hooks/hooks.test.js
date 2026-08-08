const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { runAgentSort } = require("../../scripts/hooks/auto-agent-sort");

function makeTempRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-test-"));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
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
