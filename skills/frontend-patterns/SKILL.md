---
name: frontend-patterns
description: React + TypeScript + Vite frontend conventions using Feature-Sliced Design (FSD). Use when adding or reviewing frontend code in an FSD-structured React repo.
origin: personal (FlowMat-informed)
---

# Frontend Patterns (FSD)

## Layer boundaries

```
app/        providers, routing, global setup
pages/      route-level composition only — no business logic
widgets/    composed UI blocks made of features + entities
features/   user-facing actions (e.g. "move node", "connect port")
entities/   domain objects and their canonical UI (e.g. WorkflowNode, Port)
shared/     framework-agnostic utilities, UI kit, API client
```

- Imports only flow downward (`pages` can import `widgets`, never the reverse).
- Cross-feature imports go through `entities` or `shared`, not feature-to-feature.
- A component that only renders a domain object's shape belongs in `entities`,
  not `widgets` or `features`.

## Data boundary

- Server responses (DTOs) never cross into components directly.
- Transform DTO -> ViewModel at the query boundary (see `toWorkflowCanvasViewModel`
  pattern) so components only ever see view-shaped data.
- ViewModels own derived lookup structures (e.g. `nodeMap`, `portMap`) so
  consumers get O(1) access instead of re-deriving on every render.

## Component conventions

- Function components + hooks only.
- Colocate a feature's hook, component, and types in the same feature folder.
- No inline styles for anything reused more than once — promote to `shared/ui`.

## When reviewing FlowMat frontend code, check for

- A DTO leaking past the query hook into a component prop
- A `features/` component importing another `features/` component directly
- Derived state recomputed in render instead of memoized in the ViewModel
