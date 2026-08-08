const fs = require("fs");
const path = require("path");

// agents/ is empty today (just .gitkeep) — this mirrors listSkills' shape so
// it's a drop-in once agent definitions actually land here.
function listAgents(harnessRoot) {
  const agentsDir = path.join(harnessRoot, "agents");
  if (!fs.existsSync(agentsDir)) return [];

  return fs
    .readdirSync(agentsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || (entry.isFile() && entry.name !== ".gitkeep"))
    .map((entry) => entry.name)
    .sort();
}

module.exports = { listAgents };
