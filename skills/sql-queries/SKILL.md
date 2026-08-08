---
name: sql-queries
description: PostgreSQL + Spring Data JPA query and schema conventions for FlowMat's backend. Use when writing repositories, migrations, or raw queries against workflow/canvas data.
origin: personal (FlowMat-verified against domain/workflow/domain/entity/*.java, application/ProcessServiceImpl.java, and db/migration/V1__initial_schema.sql)
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

## Collaboration/concurrency — current state, not `@Version`

**Current state:** there is no optimistic locking anywhere in this codebase
(`grep -rn "@Version" src/main/java` returns nothing). `ProcessServiceImpl.updateProcess`
does a plain find-then-save: it loads the entity, applies only the fields
present in the request (so two concurrent updates to *different* fields don't
clobber each other), and saves — with no version check. Two concurrent writes
to the *same* field are last-transaction-commits-wins, undetected. A
`WorkflowLockService` interface/impl pair exists
(`domain/workflow/application/WorkflowLockService(Impl).java`) but is an
**empty stub** — it's a placeholder for future conflict handling, not
something to reference as already providing locking.

**Known risk:** two users editing the same node's position or properties at
the same time can silently drop one edit, with nothing in the code or logs to
detect it. If you're touching concurrent-edit-prone paths (node
position/properties), either add the `@Version` optimistic-locking approach
below or flag the gap — don't assume version checking already exists.

**If/when this gets implemented:** use `@Version` on rows that can be
concurrently edited (node position, node properties) rather than pessimistic
row locks, to match the "last-write-reconciles" approach on the real-time
layer (see `collaboration-infra`). Batch position/property updates from a
single drag or collaboration event into one transaction instead of one
statement per field.

## When reviewing FlowMat backend data-access code, check for

- A canvas query missing a `workflow_id` filter (full-table scan risk)
- A raw SQL query where a derived JPA method would do
- Code or comments that assume optimistic-lock/version protection exists on
  a concurrent-edit path — it doesn't yet (see "Current state" above)
