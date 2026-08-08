const fs = require("fs");
const path = require("path");

const NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

// Minimal frontmatter parser for this repo's flat `key: value` SKILL.md
// headers — not a general YAML parser, just enough for name/description/origin.
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: content };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { data, body: content.slice(match[0].length) };
}

function listSkills(harnessRoot) {
  const skillsDir = path.join(harnessRoot, "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const skills = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;

    const { data } = parseFrontmatter(fs.readFileSync(skillPath, "utf8"));
    skills.push({
      name: data.name || entry.name,
      description: data.description || "",
      origin: data.origin || null,
      path: `skills/${entry.name}/SKILL.md`,
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function readSkill(harnessRoot, name) {
  if (typeof name !== "string" || !NAME_PATTERN.test(name)) {
    throw new Error(`Invalid skill name: ${JSON.stringify(name)}`);
  }
  const skillPath = path.join(harnessRoot, "skills", name, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    throw new Error(`No SKILL.md found for skill "${name}"`);
  }
  return fs.readFileSync(skillPath, "utf8");
}

module.exports = { parseFrontmatter, listSkills, readSkill };
