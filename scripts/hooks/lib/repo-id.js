const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LOCKFILES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "build.gradle",
  "build.gradle.kts",
  "pom.xml",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
];

// Monorepos (e.g. FlowMat's flowmat_backend/ + flowmat_frontend/) keep their
// actual stack files one level below repoRoot. These patterns cover the
// common split-repo naming conventions; "apps" is expanded one level deeper
// (apps/*) since that directory itself never holds stack files directly.
const MONOREPO_SUBDIR_PATTERNS = [/^.*_frontend$/, /^.*_backend$/, /^frontend$/, /^backend$/];

/** 1-depth subdirectories worth checking for stack markers, beyond repoRoot itself. */
function listCandidateSubdirs(repoRoot) {
  let entries;
  try {
    entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    if (entry.name === "apps") {
      let appsEntries;
      try {
        appsEntries = fs.readdirSync(path.join(repoRoot, "apps"), { withFileTypes: true });
      } catch {
        appsEntries = [];
      }
      for (const appEntry of appsEntries) {
        if (appEntry.isDirectory()) candidates.push(path.join("apps", appEntry.name));
      }
      continue;
    }

    if (MONOREPO_SUBDIR_PATTERNS.some((re) => re.test(entry.name))) {
      candidates.push(entry.name);
    }
  }
  return candidates.sort();
}

/** Hash the contents of whichever lockfiles exist (repoRoot + monorepo subdirs), so a stack change busts the cache. */
function lockfileHash(repoRoot) {
  const hash = crypto.createHash("sha1");
  const dirs = [".", ...listCandidateSubdirs(repoRoot)];
  for (const dir of dirs) {
    for (const file of LOCKFILES) {
      const p = path.join(repoRoot, dir, file);
      if (fs.existsSync(p)) {
        hash.update(path.join(dir, file));
        hash.update(fs.readFileSync(p));
      }
    }
  }
  return hash.digest("hex").slice(0, 10);
}

function getRepoId(repoRoot) {
  const name = path.basename(repoRoot);
  return `${name}-${lockfileHash(repoRoot)}`;
}

function loadCache(cachePath, repoRoot) {
  if (!fs.existsSync(cachePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (data.lockfileHash !== lockfileHash(repoRoot)) return null; // stack changed
    return data;
  } catch {
    return null;
  }
}

module.exports = { getRepoId, lockfileHash, loadCache, listCandidateSubdirs };
