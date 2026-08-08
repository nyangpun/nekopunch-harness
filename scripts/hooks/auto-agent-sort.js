#!/usr/bin/env node
/**
 * auto-agent-sort.js
 *
 * Minimal implementation of the skills/agent-sort classification model.
 * Scans a repo for stack evidence and produces a DAILY / LIBRARY split,
 * then writes the result to hooks/memory-persistence/<repo-id>.json.
 *
 * This is intentionally simple pattern-matching, not a replacement for a
 * full LLM-driven agent-sort pass — it's a fast default so every session
 * start has *something*, and a real agent-sort run can overwrite the cache
 * with a more thorough evidence table when needed.
 */

const fs = require("fs");
const path = require("path");
const { getRepoId, lockfileHash } = require("./lib/repo-id");

function readIfExists(repoRoot, file) {
  const p = path.join(repoRoot, file);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

// Stack marker -> [skill/rule ids to promote to DAILY, human-readable evidence]
const STACK_RULES = [
  {
    id: "rules/typescript",
    test: (repoRoot) => !!readIfExists(repoRoot, "tsconfig.json"),
    evidence: "tsconfig.json present",
  },
  {
    id: "skills/frontend-patterns",
    test: (repoRoot) => {
      const pkg = readIfExists(repoRoot, "package.json");
      return !!pkg && /"react"\s*:/.test(pkg) && /"vite"\s*:/.test(pkg);
    },
    evidence: "package.json has react + vite",
  },
  {
    id: "skills/canvas-node-graph-patterns",
    test: (repoRoot) => {
      const pkg = readIfExists(repoRoot, "package.json");
      return !!pkg && /(reactflow|@xyflow\/react)/.test(pkg);
    },
    evidence: "package.json has reactflow / @xyflow/react",
  },
  {
    id: "skills/client-state-patterns",
    test: (repoRoot) => {
      const pkg = readIfExists(repoRoot, "package.json");
      return !!pkg && /"zustand"\s*:/.test(pkg);
    },
    evidence: "package.json has zustand",
  },
  {
    id: "skills/data-fetching-patterns",
    test: (repoRoot) => {
      const pkg = readIfExists(repoRoot, "package.json");
      return !!pkg && /@tanstack\/react-query/.test(pkg);
    },
    evidence: "package.json has @tanstack/react-query",
  },
  {
    id: "rules/java-spring",
    test: (repoRoot) => {
      const gradle =
        readIfExists(repoRoot, "build.gradle") ||
        readIfExists(repoRoot, "build.gradle.kts");
      const pom = readIfExists(repoRoot, "pom.xml");
      return (!!gradle && /spring-boot/.test(gradle)) || (!!pom && /spring-boot/.test(pom));
    },
    evidence: "build.gradle*/pom.xml has spring-boot",
  },
  {
    id: "skills/collaboration-infra",
    test: (repoRoot) => {
      const gradle =
        readIfExists(repoRoot, "build.gradle") ||
        readIfExists(repoRoot, "build.gradle.kts");
      const pom = readIfExists(repoRoot, "pom.xml");
      return (!!gradle && /(spring-boot-starter-websocket|spring-websocket)/.test(gradle)) ||
        (!!pom && /(spring-boot-starter-websocket|spring-websocket)/.test(pom));
    },
    evidence: "build.gradle*/pom.xml has a websocket starter",
  },
  {
    id: "skills/sql-queries",
    test: (repoRoot) => {
      const gradle =
        readIfExists(repoRoot, "build.gradle") ||
        readIfExists(repoRoot, "build.gradle.kts");
      const pom = readIfExists(repoRoot, "pom.xml");
      const compose = readIfExists(repoRoot, "docker-compose.yml");
      return [gradle, pom, compose].some((f) => f && /postgres/i.test(f));
    },
    evidence: "postgres reference in build files or docker-compose",
  },
];

// Everything not matched above stays LIBRARY by default.
const KNOWN_LIBRARY_DEFAULTS = [
  "skills/django-patterns",
  "skills/android-clean-architecture",
  "skills/accessibility",
];

function runAgentSort(repoRoot, cachePath) {
  const evidenceTable = [];
  const daily = [];

  for (const rule of STACK_RULES) {
    if (rule.test(repoRoot)) {
      daily.push(rule.id);
      evidenceTable.push({ id: rule.id, bucket: "DAILY", evidence: rule.evidence });
    } else {
      evidenceTable.push({
        id: rule.id,
        bucket: "LIBRARY",
        evidence: "no matching stack markers found",
      });
    }
  }

  const library = [
    ...evidenceTable.filter((e) => e.bucket === "LIBRARY").map((e) => e.id),
    ...KNOWN_LIBRARY_DEFAULTS,
  ];

  const result = {
    repoId: getRepoId(repoRoot),
    repoRoot,
    lockfileHash: lockfileHash(repoRoot),
    generatedAt: new Date().toISOString(),
    evidenceTable,
    daily,
    library,
  };

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));

  return result;
}

module.exports = { runAgentSort };

if (require.main === module) {
  const repoRoot = process.argv[2] || process.cwd();
  const { getRepoId: id } = require("./lib/repo-id");
  const cachePath = path.join(
    __dirname,
    "..",
    "..",
    "hooks",
    "memory-persistence",
    `${id(repoRoot)}.json`
  );
  const result = runAgentSort(repoRoot, cachePath);
  console.log(JSON.stringify(result, null, 2));
}
