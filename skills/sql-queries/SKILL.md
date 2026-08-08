---
name: sql-queries
description: PostgreSQL + Spring Data JPA query and schema conventions for FlowMat's backend. Use when writing repositories, migrations, or raw queries against workflow/canvas data.
origin: personal (FlowMat-informed)
---

# SQL / Data Access Patterns (Spring Boot + PostgreSQL)

## Repository layer

- Prefer derived/`@Query` methods on Spring Data JPA repositories over raw
  JDBC; drop to raw SQL only when JPA can't express the query efficiently
  (e.g. bulk position updates, recursive graph traversal).
- Keep query methods named after what they return, not how they're
  implemented (`findActiveNodesByWorkflowId`, not `findByStatusAndWorkflow`).

## Schema conventions

- Every workflow-scoped table carries `workflow_id` with an index — canvas
  queries are almost always scoped to one workflow.
- Node/port/edge tables use surrogate UUID keys, not composite keys, so the
  frontend's `nodeMap`/`portMap` id references stay stable across schema
  changes.
- Migrations are additive by default (new column nullable or with a default)
  — avoid destructive migrations that require simultaneous frontend deploy.

## Collaboration/concurrency

- Use optimistic locking (`@Version`) on rows that can be concurrently edited
  (node position, node properties) rather than pessimistic row locks, to
  match the CRDT-style "last-write-reconciles" approach on the frontend.
- Batch position/property updates from a single drag or collaboration event
  into one transaction instead of one statement per field.

## When reviewing FlowMat backend data-access code, check for

- A canvas query missing a `workflow_id` filter (full-table scan risk)
- A raw SQL query where a derived JPA method would do
- A concurrent-edit path with no version/optimistic-lock check
