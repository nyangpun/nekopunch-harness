const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { registerSessionStartHook } = require("../../scripts/install/register-session-start-hook");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "harness-install-test-"));
}

function makeFakeHarnessDir() {
  const dir = makeTempDir();
  fs.mkdirSync(path.join(dir, "scripts", "hooks"), { recursive: true });
  fs.writeFileSync(path.join(dir, "scripts", "hooks", "session-start.js"), "// stub\n");
  return dir;
}

test("registers a correctly-shaped SessionStart hook into an empty settings.json", () => {
  const harnessDir = makeFakeHarnessDir();
  const settingsPath = path.join(makeTempDir(), "settings.json");

  const { changed, settings } = registerSessionStartHook(harnessDir, settingsPath);

  assert.strictEqual(changed, true);
  assert.strictEqual(settings.hooks.SessionStart.length, 1);
  const entry = settings.hooks.SessionStart[0];
  assert.ok("matcher" in entry);
  assert.strictEqual(entry.hooks[0].type, "command");
  assert.ok(entry.hooks[0].command.includes("session-start.js"));

  const onDisk = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  assert.deepStrictEqual(onDisk, settings);
});

test("preserves existing unrelated settings keys", () => {
  const harnessDir = makeFakeHarnessDir();
  const settingsDir = makeTempDir();
  const settingsPath = path.join(settingsDir, "settings.json");
  fs.writeFileSync(settingsPath, JSON.stringify({ theme: "dark", autoUpdatesChannel: "latest" }));

  const { settings } = registerSessionStartHook(harnessDir, settingsPath);

  assert.strictEqual(settings.theme, "dark");
  assert.strictEqual(settings.autoUpdatesChannel, "latest");
  assert.strictEqual(settings.hooks.SessionStart.length, 1);
});

test("is idempotent — running twice does not duplicate the entry", () => {
  const harnessDir = makeFakeHarnessDir();
  const settingsPath = path.join(makeTempDir(), "settings.json");

  const first = registerSessionStartHook(harnessDir, settingsPath);
  const second = registerSessionStartHook(harnessDir, settingsPath);

  assert.strictEqual(first.changed, true);
  assert.strictEqual(second.changed, false);
  assert.strictEqual(second.settings.hooks.SessionStart.length, 1);
});

test("preserves an existing SessionStart entry from another source instead of overwriting it", () => {
  const harnessDir = makeFakeHarnessDir();
  const settingsDir = makeTempDir();
  const settingsPath = path.join(settingsDir, "settings.json");
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({
      hooks: {
        SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "echo unrelated-hook" }] }],
      },
    })
  );

  const { settings } = registerSessionStartHook(harnessDir, settingsPath);

  assert.strictEqual(settings.hooks.SessionStart.length, 2);
  assert.ok(settings.hooks.SessionStart.some((e) => e.hooks[0].command === "echo unrelated-hook"));
});

test("throws when session-start.js doesn't exist at the given harness dir", () => {
  const emptyHarnessDir = makeTempDir();
  const settingsPath = path.join(makeTempDir(), "settings.json");

  assert.throws(() => registerSessionStartHook(emptyHarnessDir, settingsPath));
});
