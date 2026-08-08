#!/usr/bin/env node
/**
 * Registers this harness's SessionStart hook in the user's global
 * ~/.claude/settings.json.
 *
 * Symlinking hooks/hooks.json into ~/.claude/hooks/ (what install.sh /
 * install.ps1 do for skills/rules/commands/agents/mcp-configs) does NOT
 * register a hook — Claude Code only reads hook configuration from
 * settings.json (or a plugin's own hooks.json when installed through the
 * plugin marketplace/manifest flow, which this harness deliberately does not
 * use — see AGENTS.md "do not introduce a second install system"). This
 * script is the missing piece that actually makes SessionStart fire.
 *
 * Idempotent: safe to run on every install.sh/install.ps1 run. Matches on
 * the exact command string, so re-running after moving the harness directory
 * will add a second, correct entry rather than silently leaving a dead one
 * pointing at the old path — clean that up by hand if it happens.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

function registerSessionStartHook(harnessDir, settingsPath) {
  const sessionStartScript = path.join(harnessDir, "scripts", "hooks", "session-start.js");

  if (!fs.existsSync(sessionStartScript)) {
    throw new Error(`session-start.js not found at ${sessionStartScript} — aborting hook registration.`);
  }

  // Forward slashes even on Windows: unambiguous regardless of which shell
  // Claude Code uses to run the hook command, and avoids JSON backslash-escaping.
  const command = `node "${sessionStartScript.replace(/\\/g, "/")}"`;

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    const raw = fs.readFileSync(settingsPath, "utf8").trim();
    settings = raw ? JSON.parse(raw) : {};
  }

  settings.hooks = settings.hooks || {};
  settings.hooks.SessionStart = settings.hooks.SessionStart || [];

  const alreadyRegistered = settings.hooks.SessionStart.some((entry) =>
    (entry.hooks || []).some((h) => h.command === command)
  );

  if (alreadyRegistered) {
    return { settings, command, changed: false };
  }

  settings.hooks.SessionStart.push({
    matcher: "",
    hooks: [{ type: "command", command, timeout: 30 }],
  });
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  return { settings, command, changed: true };
}

module.exports = { registerSessionStartHook };

if (require.main === module) {
  const harnessDir = process.argv[2] || path.join(__dirname, "..", "..");
  const settingsPath = process.argv[3] || path.join(os.homedir(), ".claude", "settings.json");

  try {
    const { changed } = registerSessionStartHook(harnessDir, settingsPath);
    console.log(
      changed
        ? `[my-harness] Registered SessionStart hook in ${settingsPath}`
        : `[my-harness] SessionStart hook already registered in ${settingsPath}`
    );
  } catch (err) {
    console.error(`[my-harness] ${err.message}`);
    process.exit(1);
  }
}
