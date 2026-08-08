---
name: agent-sort
description: Build an evidence-backed harness install plan for a specific repo by sorting skills, commands, rules, hooks, and extras into DAILY vs LIBRARY buckets using repo-aware evidence. Use when the harness should be trimmed to what a project actually needs instead of loading the full bundle.
origin: ECC (adapted from seolly-harness for nekopunch's personal harness)
---

# Agent Sort

Use this skill when a repo needs a project-specific harness surface instead of
the default full install.

The goal is not to guess what "feels useful." The goal is to classify
components with evidence from the actual codebase.

## When to Use

- A project only needs a subset of the harness and full installs are too noisy
- The repo stack is clear, but nobody wants to hand-curate skills one by one
- A repeatable install decision is needed, backed by grep evidence instead of opinion
- Daily-load surfaces need to be separated from searchable library/reference surfaces
- A repo has drifted into the wrong language, rule, or hook set and needs cleanup

## Non-Negotiable Rules

- Use the current repository as the source of truth, not generic preferences
- Every DAILY decision must cite concrete repo evidence
- LIBRARY does not mean "delete"; it means "keep accessible without loading by default"
- Do not install hooks, rules, or scripts that the current repo cannot use
- Prefer harness-native surfaces; do not introduce a second install system
- **Prefer repo-native docs over this harness's SKILL.md content.** If the
  target repo has its own `CLAUDE.md` (at repo root or in a subpackage —
  `session-start.js` surfaces these via the cache's `claudeMdFiles` field),
  that document reflects the repo's actual, current conventions and
  supersedes this harness's SKILL.md content wherever they disagree. A
  SKILL.md here was written from a point-in-time read of the repo (or from
  inference before the repo existed, as with FlowMat's original skills) and
  can drift stale; a repo's own CLAUDE.md is maintained alongside the code it
  describes. When they conflict, follow the repo's CLAUDE.md and flag the
  SKILL.md as needing an update — don't silently pick the harness's version.

## Drift Check — dated status docs

When a repo's own docs directory (e.g. FlowMat's `docs/nekopunch/`,
`docs/seolly/`) contains multiple status/plan documents on the same topic
with different dates in the filename (e.g. `collab_status_2026-07-22.md` and
`collab_status_2026-07-23.md`), and the newer one states that it supersedes
the older one (look for explicit language like "supersedes
`collab_status_2026-07-22.md`" or "이 문서가 이전 버전을 대체한다"), treat
that self-declaration as authoritative:

- Read and cite only the newest superseding document.
- Do not average, merge, or split the difference between the old and new
  versions — the older one is superseded, not "still partially valid."
- Still keep the older file in LIBRARY (searchable) rather than deleting it —
  it's historical record, just not the current source of truth.
- If a doc doesn't explicitly say it supersedes an earlier one but shares a
  topic and has a later date, prefer the later date but flag the ambiguity
  in the evidence table rather than silently picking one.

This applies to any DAILY skill whose `origin:` frontmatter cites a
repo-native doc for verification — when that doc gets superseded, the skill
needs re-verification against the new one, not just a date bump.

## Outputs

1. DAILY inventory
2. LIBRARY inventory
3. install plan
4. verification report
5. cache entry written to `hooks/memory-persistence/<repo-id>.json`

## Classification Model

Two buckets only:

- `DAILY` — should load every session for this repo; strongly matched to the
  repo's language, framework, workflow, or operator surface
- `LIBRARY` — useful to retain, but not worth loading by default; reachable
  through search or selective manual use

## Evidence Sources (seeded for nekopunch's stacks)

```bash
rg --files
find . -maxdepth 2 -iname CLAUDE.md         # check this FIRST — see Non-Negotiable Rules
cat package.json */package.json             # React/TS/Vite frontend — repo root or 1-depth subpackage
cat build.gradle* */build.gradle*           # Spring Boot backend (Gradle)
cat pom.xml */pom.xml                       # Spring Boot backend (Maven)
rg -n "react-flow|zustand|@tanstack/react-query" package.json */package.json
rg -n "org.springframework.boot" build.gradle* pom.xml */build.gradle* */pom.xml
rg -n "postgresql" build.gradle* pom.xml compose.y*ml docker-compose*.yml */compose.y*ml */docker-compose*.yml
```

Monorepos/split repos (e.g. FlowMat's `flowmat_backend/` + `flowmat_frontend/`)
keep their real stack files one level below repo root — always check 1-depth
subpackages (`*_frontend`, `*_backend`, `frontend/`, `backend/`, `apps/*`),
not just repo root. This is what `scripts/hooks/auto-agent-sort.js`'s
`readIfExistsAnywhere` does automatically; do the same by hand when running
this skill's workflow manually instead of via the hook.

Stack → DAILY skill hints:

```text
build.gradle*/pom.xml + spring-boot-starter    -> spring-boot backend skills
package.json + react + vite                    -> frontend-design, react patterns
package.json + @tanstack/react-query            -> data-fetching / query patterns
package.json + zustand                          -> client-state patterns
package.json + reactflow / @xyflow/react        -> canvas/node-graph patterns
postgresql in compose/build files               -> sql-queries, db migration skills
```

## Core Workflow

### 1. Read the repo

Check for a repo-native `CLAUDE.md` first (root and 1-depth subpackages) —
if one exists, it's the priority source for conventions, not this skill's
SKILL.md content (see Non-Negotiable Rules). Then read: languages,
frameworks, package manager, test stack, lint/format stack, deployment
surface, existing operator integrations — at repo root and in 1-depth
subpackages for monorepos.

### 2. Build the evidence table

```text
skills/frontend-patterns   | skill | DAILY   | package.json has react+vite+reactflow | core frontend stack
skills/spring-data-jpa     | skill | DAILY   | build.gradle has spring-boot-starter-data-jpa | active backend stack
skills/django-patterns     | skill | LIBRARY | no .py files, no pyproject.toml       | not active in this repo
rules/typescript/*         | rules | DAILY   | package.json + tsconfig.json           | active TS repo
rules/java-spring/*        | rules | DAILY   | build.gradle + spring-boot-starter     | active Java/Spring repo
```

### 3. Decide DAILY vs LIBRARY

Promote to DAILY when the repo clearly uses the matching stack and the
component is general enough to help every session. Demote to LIBRARY when
off-stack or only occasionally relevant.

### 4. Build the install plan

- DAILY skills -> keep in `.claude/skills/` for that repo
- DAILY rules -> install only matching language sets
- DAILY hooks/scripts -> keep only compatible ones
- LIBRARY surfaces -> keep accessible through search only

### 5. Write the cache entry

Write the evidence table + install plan to
`hooks/memory-persistence/<repo-id>.json` (repo-id = repo folder name + a
short hash of its lockfile) so `scripts/hooks/session-start.js` can skip
re-classification on the next session unless the stack changed. Include
`claudeMdFiles` (paths to any repo-native `CLAUDE.md` found) so
`session-start.js` can print the "prefer repo docs" notice on every session,
not just the first one.
