# memory-persistence

Per-repo classification cache written by `scripts/hooks/auto-agent-sort.js`
and read by `scripts/hooks/session-start.js`.

Each file is named `<repo-folder-name>-<lockfile-hash>.json` so that a stack
change (new dependency, new lockfile) naturally busts the cache instead of
serving a stale DAILY set.

Do not hand-edit these files — they're regenerated automatically. If a repo's
classification looks wrong, delete its cache file and let `session-start.js`
re-run the classifier on the next session.

This directory is what closes the gap flagged in the seolly-harness audit
(`Memory Persistence: 4/8`) — without it, every session re-classifies from
scratch instead of remembering the last decision.
