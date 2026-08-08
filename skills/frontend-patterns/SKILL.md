---
name: frontend-patterns
description: React + TypeScript + Vite frontend conventions using Feature-Sliced Design (FSD). Use when adding or reviewing frontend code in an FSD-structured React repo.
origin: personal (FlowMat-verified against flowmat_frontend/CLAUDE.md Module Structure and src/)
---

# Frontend Patterns (FSD)

## Layer boundaries

FlowMat uses **five** layers, not the standard six-layer FSD set — there is
no `widgets/` layer (confirmed: no `widgets/` directory anywhere under
`flowmat_frontend/src`, and `flowmat_frontend/CLAUDE.md`'s Module Structure
lists only these five):

```
app/        providers, router, global setup
pages/      route-level composition — screen ui/ + screen-local model/
entities/   domain objects, their API hooks, and canonical UI
            (e.g. workflow/model, workflow/api)
features/   user-facing actions, colocated hook+component+types
shared/     framework-agnostic utilities, UI kit, API client
```

- What a standard FSD project would put in `widgets/` (composed UI blocks
  assembled from features + entities) lives directly under the owning page's
  own `ui/` folder instead — e.g. `pages/workspace/ui/WorkflowCanvasPage.tsx`
  directly imports and composes `CanvasViewport`, `NodeInspector`,
  `ConnectionInspector`, and `NodePickerPopup` from its own `pages/workspace/ui/`,
  not from a separate widgets layer.
- Imports only flow downward (`pages` can import `entities`/`features`/`shared`,
  never the reverse).
- Cross-feature imports go through `entities` or `shared`, not feature-to-feature.
- A component that only renders a domain object's shape belongs in `entities`,
  not a page's `ui/` folder or `features/`.
- Do not introduce a `widgets/` layer to "do FSD properly" — it's a deliberate
  omission for this repo, not an oversight.

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
