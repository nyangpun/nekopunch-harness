---
name: data-fetching-patterns
description: TanStack Query + REST client conventions, including DTO-to-ViewModel transformation at the query boundary. Use when adding or reviewing data-fetching code in FlowMat's frontend.
origin: personal (FlowMat-informed)
---

# Data Fetching Patterns

## Query boundary

- Every query hook transforms its DTO response into a ViewModel before
  returning it — mirrors FlowMat's `toWorkflowCanvasViewModel` pattern for
  `GET /api/workflows/{workflowId}/canvas`.
- Raw DTO shape (snake_case fields, backend-only ids, nested wrapper objects)
  never reaches a component. Components consume ViewModels only.
- Put the transform function next to the query hook it serves
  (`entities/workflow/model/toWorkflowCanvasViewModel.ts`), not in a shared
  "utils" grab-bag.

## Query keys

- Structure keys as `[domain, resourceId, ...params]`
  (e.g. `["workflow", workflowId, "canvas"]`) so invalidation can target a
  domain or a specific resource without over-invalidating.

## Mutations

- Optimistic updates write directly to the query cache via `setQueryData`,
  then reconcile on success/error — don't wait for refetch before reflecting
  the user's action, especially for canvas edits.
- Roll back optimistic writes explicitly `onError`, don't just invalidate and
  hope the refetch fixes it.

## REST client

- One typed client function per endpoint, not a generic `apiFetch(url, opts)`
  sprinkled across hooks — keeps the DTO type attached to its endpoint.

## When reviewing FlowMat data-fetching code, check for

- A component reading `data.some_snake_case_field` directly (DTO leak)
- A query key that's too broad (invalidates more than necessary) or too
  narrow (won't get invalidated when it should)
- A mutation with no optimistic update on an interactive canvas action
