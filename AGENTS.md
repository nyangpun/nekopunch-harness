# AGENTS.md

This repo is nekopunch's personal engineering harness. If you are an agent
operating inside a project that has this harness installed:

1. Check `hooks/memory-persistence/` for a cached classification of the
   current repo before assuming which skills apply.
2. If no cache exists, run `skills/agent-sort/SKILL.md`'s workflow to build
   one, using `rules/` and `skills/` in this repo as the candidate pool.
3. Prefer skills/rules already classified DAILY for this repo over generic
   defaults.
4. Do not introduce a second install/config system — extend this one.
