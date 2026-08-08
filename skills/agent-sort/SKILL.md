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
cat package.json          # React/TS/Vite frontend
cat build.gradle*         # Spring Boot backend (Gradle)
cat pom.xml               # Spring Boot backend (Maven)
rg -n "react-flow|zustand|@tanstack/react-query" package.json
rg -n "org.springframework.boot" build.gradle* pom.xml
rg -n "postgresql" build.gradle* pom.xml docker-compose*.yml
```

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

Languages, frameworks, package manager, test stack, lint/format stack,
deployment surface, existing operator integrations.

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
re-classification on the next session unless the stack changed.
