const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { STACK_RULES } = require("../../scripts/hooks/auto-agent-sort");
const { listSkills } = require("./skills");

function auditMemoryPersistence(harnessRoot) {
  const dir = path.join(harnessRoot, "hooks", "memory-persistence");
  if (!fs.existsSync(dir)) return { exists: false, repos: [] };

  const repos = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".json")) continue;
    const full = path.join(dir, entry);
    try {
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      repos.push({
        file: entry,
        repoId: data.repoId || null,
        generatedAt: data.generatedAt || null,
        dailyCount: Array.isArray(data.daily) ? data.daily.length : null,
      });
    } catch {
      repos.push({ file: entry, error: "unreadable or invalid JSON" });
    }
  }
  repos.sort((a, b) => a.file.localeCompare(b.file));
  return { exists: true, repos };
}

// Shells out to `node --test` rather than re-implementing test collection —
// this is a self-audit, so it should report what the real test runner says,
// not a parallel guess at pass/fail.
function auditHookTests(harnessRoot) {
  const testDir = path.join(harnessRoot, "tests", "hooks");
  if (!fs.existsSync(testDir)) {
    return { ran: false, pass: 0, fail: 0, summary: "tests/hooks not found" };
  }

  // Strip NODE_TEST_CONTEXT: when this audit itself runs inside `node --test`
  // (e.g. from tests/mcp/audit.test.js), Node sets that var and a child
  // `node --test` process inherits it, silently skipping its own run instead
  // of reporting real pass/fail counts.
  const { NODE_TEST_CONTEXT, ...childEnv } = process.env;
  const result = spawnSync(process.execPath, ["--test", testDir], {
    cwd: harnessRoot,
    encoding: "utf8",
    env: childEnv,
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const passMatch = output.match(/# pass (\d+)/);
  const failMatch = output.match(/# fail (\d+)/);

  return {
    ran: true,
    pass: passMatch ? parseInt(passMatch[1], 10) : 0,
    fail: failMatch ? parseInt(failMatch[1], 10) : 0,
    exitCode: result.status,
  };
}

function ruleTargetExists(harnessRoot, id) {
  const [kind, name] = id.split("/");
  if (kind === "skills") return fs.existsSync(path.join(harnessRoot, "skills", name, "SKILL.md"));
  if (kind === "rules") return fs.existsSync(path.join(harnessRoot, "rules", name, "rules.md"));
  return false;
}

function auditStackRulesCoverage(harnessRoot) {
  const coverage = STACK_RULES.map((rule) => ({
    id: rule.id,
    targetExists: ruleTargetExists(harnessRoot, rule.id),
  }));
  return {
    total: coverage.length,
    covered: coverage.filter((c) => c.targetExists).length,
    coverage,
  };
}

function auditIncompleteSkills(harnessRoot) {
  return listSkills(harnessRoot)
    .filter((s) => !s.origin || !s.description)
    .map((s) => ({
      name: s.name,
      missingOrigin: !s.origin,
      missingDescription: !s.description,
    }));
}

function runHarnessAudit(harnessRoot) {
  const memoryPersistence = auditMemoryPersistence(harnessRoot);
  const hookTests = auditHookTests(harnessRoot);
  const stackRulesCoverage = auditStackRulesCoverage(harnessRoot);
  const incompleteSkills = auditIncompleteSkills(harnessRoot);
  const skills = listSkills(harnessRoot);

  const testTotal = hookTests.pass + hookTests.fail;
  const testScore = testTotal > 0 ? hookTests.pass / testTotal : 0;
  const coverageScore = stackRulesCoverage.total > 0
    ? stackRulesCoverage.covered / stackRulesCoverage.total
    : 0;
  const completenessScore = skills.length > 0
    ? (skills.length - incompleteSkills.length) / skills.length
    : 1;

  return {
    overallScore: Math.round(((testScore + coverageScore + completenessScore) / 3) * 100),
    memoryPersistence,
    hookTests,
    stackRulesCoverage,
    incompleteSkills,
  };
}

module.exports = { runHarnessAudit };
