---
name: sql-queries
description: PostgreSQL + Spring Data JPA query and schema conventions for FlowMat's backend. Use when writing repositories, migrations, or raw queries against workflow/canvas data.
origin: personal (FlowMat-verified against domain/workflow/domain/entity/*.java, domain/workflow/annotation/domain/CanvasAnnotation.java, domain/workflow/annotation/application/CanvasAnnotationReconcileService.java, application/ProcessServiceImpl.java, and db/migration/V1__initial_schema.sql, V11__canvas_annotation.sql — verified 2026-08-09)
---

# SQL / Data Access Patterns (Spring Boot + PostgreSQL)

## Repository layer

- Prefer derived/`@Query` methods on Spring Data JPA repositories over raw
  JDBC; drop to raw SQL only when JPA can't express the query efficiently
  (e.g. bulk position updates, recursive graph traversal).
- Keep query methods named after what they return, not how they're
  implemented (`findActiveNodesByWorkflowId`, not `findByStatusAndWorkflow`).

## Schema conventions

- Every workflow-scoped table carries `workflow_id` with an index — confirmed
  (`idx_process_workflow_id` etc. in `V1__initial_schema.sql`). Canvas
  queries are almost always scoped to one workflow.
- Node/port/edge tables use surrogate keys: `process_id` etc. are
  `varchar(50)` columns holding a UUID string from `IdGenerator.generate()`
  (`UUID.randomUUID().toString()`), not a native Postgres `uuid` column and
  not composite keys — the frontend's `nodeMap`/`portMap` id references stay
  stable across schema changes.
- Migrations: only one migration exists so far
  (`V1__initial_schema.sql`) — there is no second migration yet to confirm an
  "additive by default" pattern is actually followed in practice. Treat
  additive-by-default as the goal, not an established, code-verified
  convention, until a real follow-up migration exists to check against.

## Collaboration/concurrency — annotation has custom versioning, nothing else does

**Current state:** there is no JPA `@Version` anywhere in this codebase
(`grep -rn "@Version" src/main/java` returns nothing) — and that stays true
even after annotations shipped. `canvas_annotation` carries `version` (int,
default 1) and `version_nonce` (long, default 1) as **plain mapped fields on
`CanvasAnnotation.java`**, not the JPA optimistic-locking annotation. They're
checked by hand in application code —
`CanvasAnnotationReconcileService.shouldDiscardIncoming(current, nextVersion,
nextVersionNonce)` — which discards an incoming write when
`current.version > nextVersion`, or when versions tie and
`current.versionNonce >= nextVersionNonce` (an excalidraw-style reconcile,
not Hibernate's built-in `OptimisticLockException` path). This is the one
table in the schema with real conflict detection.

Every other concurrent-edit-prone table (`process`, `process_connection`,
`process_io`, etc.) has **no version field of either kind**.
`ProcessServiceImpl.updateProcess` does a plain find-then-save: it loads the
entity, applies only the fields present in the request (so two concurrent
updates to *different* fields don't clobber each other), and saves — with no
version check at all. Two concurrent writes to the *same* field on these
tables are last-transaction-commits-wins, undetected. A `WorkflowLockService`
interface/impl pair exists (`domain/workflow/application/WorkflowLockService(Impl).java`)
but the impl body is still empty — a placeholder, not something to reference
as already providing locking.

**Known risk:** two users editing the same node's position or properties at
the same time can silently drop one edit on `process`/`process_connection`,
with nothing in the code or logs to detect it. If you're touching
concurrent-edit-prone paths on those tables, either extend the annotation
`version`/`version_nonce` pattern (below) or flag the gap — don't assume
version checking already exists just because it exists on annotations.

**If/when this gets extended to nodes/edges:** follow
`CanvasAnnotation`'s pattern — a plain `version` + `version_nonce` pair on
the entity, reconciled in application code via a
`CanvasAnnotationReconcileService`-shaped service — rather than introducing
JPA `@Version` for these tables. That keeps the conflict-resolution mechanism
consistent across `canvas_annotation` and whichever table adopts it next,
and matches what the annotation execution plan itself expected ("공통
유틸로 추출해서 재사용" — extract as a shared util for reuse). Batch
position/property updates from a single drag or collaboration event into one
transaction instead of one statement per field.

## When reviewing FlowMat backend data-access code, check for

- A canvas query missing a `workflow_id` filter (full-table scan risk)
- A raw SQL query where a derived JPA method would do
- Code or comments that assume `@Version`-style optimistic locking exists
  anywhere in this backend — it doesn't; only `canvas_annotation`'s custom
  `version`/`version_nonce` fields provide conflict detection, and only when
  routed through `CanvasAnnotationReconcileService`
- A concurrent-edit path on `process`/`process_connection` (or any other
  non-annotation table) assumed to already be version-protected — it isn't
