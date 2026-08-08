---
name: client-state-patterns
description: Zustand store conventions for UI/client state, kept separate from server state. Use when adding or reviewing state stores in FlowMat's frontend.
origin: personal (FlowMat-verified against src/pages/workspace/model/*.ts, src/app/providers/ThemeProvider.tsx, src/entities/auth/api/useMyPermissionsQuery.ts, src/pages/workspace/ui/WorkflowCanvasPage.tsx, and flowmat_frontend/CLAUDE.md — verified 2026-08-09)
---

# Client State Patterns

## Scope

Zustand owns **UI/editor state only**: selection, viewport (zoom/pan), open
drawers, inline-edit target, canvas mode, canvas-popup state. It never owns
server-sourced data — that's TanStack Query's job (see `data-fetching-patterns`).
Documented in `flowmat_frontend/CLAUDE.md` as: "server data stays in TanStack
Query. workspaceStore holds only editor interaction state."

Not all client state is Zustand, though — see "Theme state" and "Permission
state" below for the two confirmed exceptions in this codebase.

## Store shape (actual FlowMat stores)

FlowMat splits Zustand state by **distinct interaction subsystem**, not into
one combined store and not one store per field:

- `useWorkspaceStore` (`pages/workspace/model/workspaceStore.ts`) — the
  workspace screen's selection/inspector/editing state in one store:
  selection (`selectedProcessId`/`selectedConnectionId`/`selectedPortId`),
  `inspectorMode`, `canvasMode`, `pendingConnectionDraft`, `pendingRename`,
  drawer flags (`isRuleDrawerOpen`, `isTemplateDrawerOpen`),
  `activeColorPickerNodeId`, `inlineEditingNodeId`/`inlineEditingEdgeId`,
  `viewport`, `panelWidths`. These are combined because they're read/written
  together by the same screen — selecting a node changes `inspectorMode` in
  the same action (see `selectNode`).
- `useCanvasInteractionStore` (`pages/workspace/model/canvasInteractionStore.ts`)
  — a genuinely separate subsystem, split out on purpose: on-canvas node-picker
  popup state (`nodePicker`, ported from tldraw's `OnCanvasComponentPicker` /
  `insertNodeWithinConnection`), `hoveredEdgeId`, and pending-action requests
  (`pendingDeleteNodeId`/`pendingDeleteEdgeId`, `pendingDuplicateNodeId`,
  `pendingColorChange`) that a component elsewhere picks up and acts on.
- `useCommandHistory` (`pages/workspace/model/commandHistory.ts`) — undo/redo
  stack, split out because its shape and update pattern (stack push/pop) has
  nothing in common with selection or popup state.

This two/three-store split *is* the real pattern — don't consolidate these
into a single store, and don't assume the opposite either (a brand-new store
per feature). When adding new UI state: put it in the existing store that
already owns that interaction subsystem. Only create a new store when the new
state is a genuinely separate subsystem (its own popup, its own history
stack) — not just because a value doesn't cleanly belong to an existing
field.

## Theme state — Context + localStorage, not Zustand

Theme (`light`/`dark`/`system`) is **not** in a Zustand store. It's a React
Context provider: `app/providers/ThemeProvider.tsx` holds `mode` and
`resolvedTheme` in `useState`, persists `mode` to `localStorage`
(`flowmat-theme-mode`), and writes `document.documentElement.dataset.theme` /
`dataset.themeMode` for CSS to key off. Consumers read it via `useTheme()`.

This matters because the original execution plan
(`docs/seolly/flowmat_annotation_execution_plan.md` §6.1) specified a Zustand
store (`shared/store/themeStore.ts` with `persist` middleware) for this. The
actual implementation went a different way. Neither is "wrong" — the point is
**a planning doc and the shipped code can diverge**, and this repo has a
confirmed instance of it.

**Review checklist addition:** when a new piece of global/cross-cutting state
is being added (theme-like, not workspace-screen-like), don't assume a
design/execution-plan doc's proposed storage mechanism (Zustand store, Context,
etc.) is what actually landed — check the current provider tree
(`app/providers/`) and the actual hook (`useX()`) before writing review
comments or new code that assumes the planned shape.

## Permission state — two valid patterns, no dedicated store

There is no `usePermissionStore` or similar. Two patterns coexist, both
correct for their context:

1. **TanStack Query, when permission data needs its own fetch.**
   `entities/auth/api/useMyPermissionsQuery.ts` — `useQuery({ queryKey:
   ['current-user-permissions'], staleTime: 5 * 60 * 1000 })`, consumed
   directly by `AdminGuard` (`app/router/AdminGuard.tsx`) to gate the
   `/admin` route on `data?.canManageUsers`.
2. **Inline field comparison, when the permission is already embedded in a
   payload the screen already fetched.** Per-workflow annotation permission
   does **not** call a separate query — `WorkflowCanvasPage.tsx` reads
   `canvas.workflow.currentUserRole` (a field that comes back on the
   `workflow-canvas` query response) and does a plain equality check:
   `canEditAnnotations = canvas.workflow.currentUserRole === 'editor' ||
   canvas.workflow.currentUserRole === 'owner'` (`WorkflowCanvasPage.tsx:186-187`).
   This gates toolbar buttons (`disabled`, dimmed opacity, tooltip text) —
   UI-level gating only; the server-side `ProjectAccessService` check is the
   real enforcement.

When reviewing or writing permission-gated UI: don't reach for a new query or
a new store by default. If the role/permission field already rides along on
data the screen fetches for another reason, compare it inline like
`WorkflowCanvasPage` does. Only add a dedicated query when the permission
isn't already available on an existing response.

## Actions

- Actions live next to the state they mutate — expose intent-named actions
  (`selectNode(id)`, `clearSelection()`, `openNodePicker(state)`) rather than
  raw setters, so call sites read as behavior, not state manipulation. This
  matches the real `useWorkspaceStore` API (`selectNode`, `selectEdge`,
  `selectPort`, `clearSelection`, `setMultiSelect`, `setCanvasMode`,
  `setConnectionDraft`, `openRuleDrawer`/`closeRuleDrawer`,
  `startInlineEdit`/`stopInlineEdit`, `startInlineEditEdge`/`stopInlineEditEdge`,
  `commitRename`/`clearPendingRename`, `openColorPicker`/`closeColorPicker`).
- One action can update several fields atomically when they're part of the
  same intent — e.g. `selectNode` clears `selectedConnectionId` and
  `selectedPortId` and sets `inspectorMode: 'node'` in a single `set()` call,
  instead of three separate setter calls from the component.

## Selectors

- Always select the narrowest slice needed (`useWorkspaceStore(s => s.selectedProcessId)`),
  never the whole store, to avoid unnecessary re-renders on a canvas with
  many subscribers.

## When reviewing FlowMat state code, check for

- Server-fetched data (node definitions, workflow metadata, permission data
  that's already on an existing response) stored in Zustand instead of
  TanStack Query's cache
- A component subscribing to the entire store instead of a selector
- Setter-style actions (`setX`) where an intent-named action would be clearer
- New UI state bolted onto an unrelated store instead of its own subsystem
  store, or a brand-new store created for state that belongs in an existing
  subsystem
- A new global/cross-cutting state feature (theme-like) built by copying a
  design doc's proposed mechanism verbatim without checking what the
  provider tree (`app/providers/`) actually does today
- A new permission check reaching for a fresh query when the role/permission
  field is already present on data the component already fetches
