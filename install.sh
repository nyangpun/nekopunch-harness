#!/usr/bin/env bash
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${HOME}/.claude"

mkdir -p "$TARGET"

for dir in skills hooks rules commands agents mcp-configs; do
  echo "Linking $dir -> $TARGET/$dir"
  rm -rf "$TARGET/$dir"
  ln -s "$HARNESS_DIR/$dir" "$TARGET/$dir"
done

node "$HARNESS_DIR/scripts/install/register-session-start-hook.js" "$HARNESS_DIR"

echo "Installed my-harness at user level ($TARGET)."
echo "Run this from inside a project repo too — it applies globally either way."
