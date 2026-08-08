const fs = require("fs");
const path = require("path");

const SEARCH_DIRS = ["skills", "rules", "docs"];
const SEARCH_EXTENSIONS = new Set([".md", ".mdx", ".txt"]);
const MAX_MATCHES_PER_FILE = 5;

function walk(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (SEARCH_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function findRelevantWorkflows(harnessRoot, keyword) {
  if (typeof keyword !== "string" || !keyword.trim()) {
    throw new Error("keyword must be a non-empty string");
  }
  const needle = keyword.toLowerCase();
  const files = SEARCH_DIRS.flatMap((dir) => walk(path.join(harnessRoot, dir)));

  const results = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const matches = [];
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(needle)) {
        matches.push({ line: i + 1, text: line.trim() });
      }
    });
    if (matches.length > 0) {
      results.push({
        file: path.relative(harnessRoot, file).replace(/\\/g, "/"),
        matches: matches.slice(0, MAX_MATCHES_PER_FILE),
      });
    }
  }
  return results;
}

module.exports = { findRelevantWorkflows };
