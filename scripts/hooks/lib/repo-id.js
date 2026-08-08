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

/** Hash the contents of whichever lockfiles exist, so a stack change busts the cache. */
function lockfileHash(repoRoot) {
  const hash = crypto.createHash("sha1");
  for (const file of LOCKFILES) {
    const p = path.join(repoRoot, file);
    if (fs.existsSync(p)) {
      hash.update(file);
      hash.update(fs.readFileSync(p));
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

module.exports = { getRepoId, lockfileHash, loadCache };
