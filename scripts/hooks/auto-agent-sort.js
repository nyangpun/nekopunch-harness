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
const { getRepoId, lockfileHash, listCandidateSubdirs } = require("./lib/repo-id");

function readIfExists(repoRoot, file) {
  const p = path.join(repoRoot, file);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

// Like readIfExists, but also checks 1-depth monorepo subdirs (flowmat_backend/,
// flowmat_frontend/, apps/*, etc. — see lib/repo-id.js#listCandidateSubdirs).
// Stack files in a split-repo layout live one level below repoRoot, not at it.
//
// Concatenates every match instead of returning the first one found: a repo
// can have a root aggregator file (e.g. FlowMat's root build.gradle, which
// has spring-boot + postgres but *not* the websocket starter that only
// flowmat_backend/build.gradle declares) — stopping at the first hit would
// silently hide evidence that only exists in a subpackage's file.
function readIfExistsAnywhere(repoRoot, file) {
  const contents = [];
  const direct = readIfExists(repoRoot, file);
  if (direct !== null) contents.push(direct);
  for (const dir of listCandidateSubdirs(repoRoot)) {
    const content = readIfExists(path.join(repoRoot, dir), file);
    if (content !== null) contents.push(content);
  }
  return contents.length > 0 ? contents.join("\n") : null;
}

// Compose files that may carry a postgres service reference. Checked at
// repoRoot and in monorepo subdirs (e.g. flowmat_backend/compose.yaml).
const COMPOSE_FILENAMES = ["docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"];

function readComposeFilesAnywhere(repoRoot) {
  return COMPOSE_FILENAMES.map((name) => readIfExistsAnywhere(repoRoot, name)).filter(Boolean);
}

// Stack marker -> [skill/rule ids to promote to DAILY, human-readable evidence]
const STACK_RULES = [
  {
    id: "rules/typescript",
    test: (repoRoot) => !!readIfExistsAnywhere(repoRoot, "tsconfig.json"),
    evidence: "tsconfig.json present (repo root or subpackage)",
  },
  {
    id: "skills/frontend-patterns",
    test: (repoRoot) => {
      const pkg = readIfExistsAnywhere(repoRoot, "package.json");
      return !!pkg && /"react"\s*:/.test(pkg) && /"vite"\s*:/.test(pkg);
    },
    evidence: "package.json has react + vite (repo root or subpackage)",
  },
  {
    id: "skills/canvas-node-graph-patterns",
    test: (repoRoot) => {
      const pkg = readIfExistsAnywhere(repoRoot, "package.json");
      return !!pkg && /(reactflow|@xyflow\/react)/.test(pkg);
    },
    evidence: "package.json has reactflow / @xyflow/react (repo root or subpackage)",
  },
  {
    id: "skills/client-state-patterns",
    test: (repoRoot) => {
      const pkg = readIfExistsAnywhere(repoRoot, "package.json");
      return !!pkg && /"zustand"\s*:/.test(pkg);
    },
    evidence: "package.json has zustand (repo root or subpackage)",
  },
  {
    id: "skills/data-fetching-patterns",
    test: (repoRoot) => {
      const pkg = readIfExistsAnywhere(repoRoot, "package.json");
      return !!pkg && /@tanstack\/react-query/.test(pkg);
    },
    evidence: "package.json has @tanstack/react-query (repo root or subpackage)",
  },
  {
    id: "rules/java-spring",
    test: (repoRoot) => {
      const gradle =
        readIfExistsAnywhere(repoRoot, "build.gradle") ||
        readIfExistsAnywhere(repoRoot, "build.gradle.kts");
      const pom = readIfExistsAnywhere(repoRoot, "pom.xml");
      return (!!gradle && /spring-boot/.test(gradle)) || (!!pom && /spring-boot/.test(pom));
    },
    evidence: "build.gradle*/pom.xml has spring-boot (repo root or subpackage)",
  },
  {
    id: "skills/collaboration-infra",
    test: (repoRoot) => {
      const gradle =
        readIfExistsAnywhere(repoRoot, "build.gradle") ||
        readIfExistsAnywhere(repoRoot, "build.gradle.kts");
      const pom = readIfExistsAnywhere(repoRoot, "pom.xml");
      return (!!gradle && /(spring-boot-starter-websocket|spring-websocket)/.test(gradle)) ||
        (!!pom && /(spring-boot-starter-websocket|spring-websocket)/.test(pom));
    },
    evidence: "build.gradle*/pom.xml has a websocket starter (repo root or subpackage)",
  },
  {
    id: "skills/sql-queries",
    test: (repoRoot) => {
      const gradle =
        readIfExistsAnywhere(repoRoot, "build.gradle") ||
        readIfExistsAnywhere(repoRoot, "build.gradle.kts");
      const pom = readIfExistsAnywhere(repoRoot, "pom.xml");
      const composeFiles = readComposeFilesAnywhere(repoRoot);
      return [gradle, pom, ...composeFiles].some((f) => f && /postgres/i.test(f));
    },
    evidence: "postgres reference in build files or compose/docker-compose file (repo root or subpackage)",
  },
];

// Everything not matched above stays LIBRARY by default.
const KNOWN_LIBRARY_DEFAULTS = [
  "skills/django-patterns",
  "skills/android-clean-architecture",
  "skills/accessibility",
];

// A repo's own CLAUDE.md (root or subpackage) documents its *actual, current*
// conventions and should outrank this harness's generic SKILL.md content when
// the two disagree — see skills/agent-sort/SKILL.md "Prefer repo-native docs".
function findClaudeMdFiles(repoRoot) {
  const found = [];
  if (readIfExists(repoRoot, "CLAUDE.md") !== null) found.push("CLAUDE.md");
  for (const dir of listCandidateSubdirs(repoRoot)) {
    if (readIfExists(path.join(repoRoot, dir), "CLAUDE.md") !== null) {
      found.push(path.join(dir, "CLAUDE.md"));
    }
  }
  return found;
}

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
    claudeMdFiles: findClaudeMdFiles(repoRoot),
  };

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));

  return result;
}

module.exports = { runAgentSort, STACK_RULES };

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
