---
name: frontend-patterns
description: React + TypeScript + Vite frontend conventions using Feature-Sliced Design (FSD). Use when adding or reviewing frontend code in an FSD-structured React repo.
origin: personal (FlowMat-verified against flowmat_frontend/CLAUDE.md Module Structure and full src/ file tree — verified 2026-08-09)
---

# Frontend Patterns (FSD)

## Layer boundaries

FlowMat's real top-level layers under `flowmat_frontend/src`:

```
app/        providers (Query, Theme, ThemeModeControl), router (AuthGuard, AdminGuard, index.tsx)
pages/      route-level composition — screen ui/ + screen-local model/
entities/   domain objects, their API hooks, and canonical UI/model
            (admin/, auth/, canvas-annotation/, catalog/, production/, project/, rule/, workflow/)
features/   user-facing actions — see caveat below, this layer is in a mixed state
shared/     framework-agnostic utilities, API client (api/, lib/, types/)
```

There is no `widgets/` layer (confirmed: no `widgets/` directory anywhere
under `flowmat_frontend/src`). What a standard FSD project would put in
`widgets/` (composed UI blocks assembled from features + entities) lives
directly under the owning page's own `ui/` folder instead — e.g.
`pages/workspace/ui/WorkflowCanvasPage.tsx` directly imports and composes
`CanvasViewport`, `NodeInspector`, `ConnectionInspector`,
`CanvasAnnotationNode`, and `NodePickerPopup` from its own
`pages/workspace/ui/`, not from a separate widgets layer. This holds for
annotation UI too — see `canvas-node-graph-patterns` for the specific
divergence from the annotation execution plan's `widgets/canvas-toolbar/`
proposal. Do not introduce a `widgets/` layer to "do FSD properly" — it's a
confirmed, repeated pattern in this repo, not an oversight.

`shared/ui` and `shared/forms` are **not present** in the actual tree, even
though `flowmat_frontend/CLAUDE.md`'s Module Structure section lists them.
Only `shared/api`, `shared/lib`, and `shared/types` exist. This is a live
example of the repo's planning docs describing a folder that was never
created — don't assume a path from `CLAUDE.md`'s Module Structure exists
without checking; if you need a shared UI component today, there's no
established home for it yet (creating `shared/ui/` from scratch is
reasonable, just know you're not following an existing convention, you're
starting one).

## `features/` is in a transitional, mixed state — check before touching auth

Two things live side by side under `features/` and `entities/` that look like
they compete for the same responsibility:

- `features/user/` — a **legacy JS** auth/user module (`authApi.js`,
  `userApi.js`, `LoginForm.jsx`, `SignupForm.jsx`, `UserTable.jsx`,
  `useAuth.js`, and page components `Login.jsx`/`Signup.jsx`/`MyPage.jsx`/etc).
  Plain `.js`/`.jsx`, no types.
- `entities/auth/` — the **current TS** auth module (`useLoginMutation.ts`,
  `useCurrentUserQuery.ts`, `useMyPermissionsQuery.ts`, `authSession.ts` —
  token storage, refresh flow, JWT decode). This is what `AuthGuard`/`AdminGuard`
  in `app/router/` actually import and use for route protection today.

There's also `features/flowmat-canvas-prototype/` — an entire standalone Vite
project (its own `package.json`, `index.html`, `vite.config.js`) sitting
inside `src/`, disconnected from the real app's build and routing. Treat it
as a reference/scratch prototype, not live code — nothing in `app/router/`
or `pages/` imports from it.

**Before starting any auth-related work:** confirm which module is actually
wired into the live route tree (`app/router/index.tsx`, `AuthGuard.tsx`) —
currently `entities/auth/` + `app/router/` is the live path, `features/user/`
is legacy. Don't extend `features/user/` assuming it's current, and don't
assume `features/user/` is dead code to delete without checking whether
anything in `router/Router.jsx` (the old, still-present router file) still
references it.

## Data boundary

- Server responses (DTOs) never cross into components directly.
- Transform DTO -> ViewModel at the query boundary (see `toWorkflowCanvasViewModel`
  pattern) so components only ever see view-shaped data.
- ViewModels own derived lookup structures (e.g. `nodeMap`, `portMap`) so
  consumers get O(1) access instead of re-deriving on every render.

## Component conventions

- Function components + hooks only (for the current TS/TSX code — the
  legacy `features/user/` JSX predates this convention and shouldn't be used
  as a style reference for new code).
- Colocate a feature's hook, component, and types in the same feature/entity
  folder.
- No inline styles for anything reused more than once — promote to a shared
  location (see the `shared/ui` gap above: there isn't one yet, so this is
  currently aspirational for genuinely reusable pieces).

## When reviewing FlowMat frontend code, check for

- A DTO leaking past the query hook into a component prop
- A `features/` component importing another `features/` component directly
- Derived state recomputed in render instead of memoized in the ViewModel
- New auth/user code added to `features/user/` (legacy JS) instead of
  `entities/auth/` (current TS, actually wired into routing)
- A review comment or new file citing `flowmat_frontend/CLAUDE.md`'s Module
  Structure (`shared/ui`, `shared/forms`, `widgets/`) as if those folders
  exist — verify against the actual tree first
