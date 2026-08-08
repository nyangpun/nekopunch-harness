---
name: data-fetching-patterns
description: TanStack Query + REST client conventions, including DTO-to-ViewModel transformation at the query boundary. Use when adding or reviewing data-fetching code in FlowMat's frontend.
origin: personal (FlowMat-verified against flowmat_frontend/CLAUDE.md and src/entities/*/api/*.ts)
---

# Data Fetching Patterns

## Query boundary

- Every query hook transforms its DTO response into a ViewModel before
  returning it — the real example is `toWorkflowCanvasViewModel`, used by
  `useWorkflowCanvasQuery` for `GET /api/workflows/{workflowId}/canvas`.
- Raw DTO shape (backend-only ids, nested wrapper objects) never reaches a
  component. Components consume ViewModels only.
- Put the transform function next to the query hook it serves
  (`entities/workflow/model/toWorkflowCanvasViewModel.ts`), not in a shared
  "utils" grab-bag.

## Query keys — flat, resource-name first

FlowMat's query keys are **not** nested `[domain, resourceId, ...params]`
tuples. They're flat arrays starting with a resource name (hyphenated when
the resource is a sub-view), documented in `flowmat_frontend/CLAUDE.md`:

```ts
['projects']
['project', projectId]
['workflows', projectId]
['workflow', workflowId]
['workflow-canvas', workflowId]                    // primary canvas key
['flow-rules', projectId, targetType, targetId]
['process-templates']
```

Invalidation policy (also from `flowmat_frontend/CLAUDE.md`, matches actual
mutation hooks like `useUpdateProcessMutation`):

| Mutation | Invalidate |
|---|---|
| create/update/delete process, process-io, or connection | `['workflow-canvas', workflowId]` |
| create process also | `['workflow', workflowId]` |
| create/update/delete rule | `['flow-rules', projectId, targetType, targetId]` |

Guideline: invalidate the canvas root query. Avoid partial client-side graph
patching until that's proven stable.

## Mutations — current state vs. documented policy

`flowmat_frontend/CLAUDE.md`'s stated policy is that node move, node rename,
node color change, and connection label change should be **optimistic**
(write to the cache immediately, roll back `onError`) because rollback is
simple for those.

**Known gap:** as of this writing, no mutation hook under `entities/*/api/`
actually does this — `grep -rn "onMutate|setQueryData" src/entities` returns
nothing. Every mutation (e.g. `useUpdateProcessMutation`) is invalidate-on-
success only: it calls the endpoint, then `invalidateQueries` and waits for
the refetch. This means node edits currently have a round-trip delay before
the UI reflects them, contrary to the documented policy.

When adding or reviewing a mutation for node move/rename/color/connection
label: implementing the optimistic `setQueryData` + `onError` rollback closes
this gap and matches documented intent — don't assume it's already there
because the policy doc says it should be.

For mutations the policy marks non-optimistic (create node, create I/O row,
create connection, create rule, delete node — server id or validation
required), invalidate-on-success is correct as-is.

## REST client

The actual client is one small shared object
(`shared/api/httpClient.ts`) with typed generic methods —
`httpClient.get<T>(path)`, `.post<T>(path, body)`, `.put<T>(path, body)`,
`.delete<T>(path)` — called directly from each query/mutation hook with the
envelope type as the type param (e.g.
`httpClient.get<ApiEnvelope<WorkflowCanvasDto>>(...)`), then unwrapped via
`shared/api/unwrapApiResponse.ts`. There is no per-endpoint client function
layer; the DTO type lives at the call site in the hook, not in the client.

## Mutation hook naming

✅ `useCreateProcess`, `useUpdateProcess`, `useDeleteProcessIo`,
`useCreateProcessConnection` — one hook per REST operation, named after the
resource and verb.

❌ `saveCanvasEverything`, `syncWorkspaceState`, `submitProcessGraphBlob` —
no whole-canvas-blob mutations.

Each mutation hook owns: request payload building, optimistic update (where
policy calls for it), rollback, invalidation scope, and error mapping. It
does not own global selection logic, component open/close state, or
unrelated form formatting.

## When reviewing FlowMat data-fetching code, check for

- A component reading a raw DTO field directly instead of the ViewModel
- A query key that doesn't match the flat `['resource-name', ...ids]` shape,
  or an invalidation that's broader/narrower than the policy table above
- A node move/rename/color/connection-label mutation that's missing the
  optimistic update the documented policy calls for (currently the norm, not
  the exception — see "Known gap" above)
- A new per-endpoint client wrapper instead of a direct `httpClient.<verb>()`
  call from the hook
