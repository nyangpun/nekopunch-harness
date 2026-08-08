#!/usr/bin/env node
/**
 * SessionStart hook.
 *
 * On entering a repo:
 *   1. Compute a repo-id (folder name + short hash of lockfiles).
 *   2. Look for a cached classification in hooks/memory-persistence/<repo-id>.json.
 *   3. If found and lockfiles haven't changed, print the cached DAILY set and exit.
 *   4. Otherwise, run the classifier (auto-agent-sort.js) and cache the result.
 */

const path = require("path");
const { getRepoId, loadCache } = require("./lib/repo-id");
const { runAgentSort } = require("./auto-agent-sort");

function main() {
  const repoRoot = process.cwd();
  const repoId = getRepoId(repoRoot);
  const cachePath = path.join(
    __dirname,
    "..",
    "..",
    "hooks",
    "memory-persistence",
    `${repoId}.json`
  );

  const cached = loadCache(cachePath, repoRoot);

  if (cached) {
    console.log(`[harness] Using cached DAILY set for ${repoId}`);
    console.log(`[harness] DAILY: ${cached.daily.join(", ") || "(none)"}`);
    return;
  }

  console.log(`[harness] No fresh cache for ${repoId} — classifying...`);
  const result = runAgentSort(repoRoot, cachePath);
  console.log(`[harness] DAILY: ${result.daily.join(", ") || "(none)"}`);
  console.log(`[harness] LIBRARY: ${result.library.join(", ") || "(none)"}`);
  console.log(`[harness] Cached at ${cachePath}`);
}

main();
