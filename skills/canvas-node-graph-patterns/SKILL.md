---
name: canvas-node-graph-patterns
description: Patterns for building a node-based canvas (React Flow) with real-time collaboration, informed by tldraw, excalidraw, xyflow, and yjs. Use for FlowMat's workflow canvas — node/edge rendering, ports, selection, and viewport state.
origin: personal (FlowMat-verified against pages/workspace/ui/*.tsx, entities/canvas-annotation/model/annotationLayout.ts, docs/seolly/flowmat_annotation_execution_plan.md, and docs/seolly/frontend_workspace_status_2026-07-22.md — verified 2026-08-09)
---

# Canvas / Node-Graph Patterns

Reference lineage: tldraw, excalidraw, xyflow (React Flow core), yjs — benchmarked
for FlowMat's collaboration and canvas architecture.

## Data model

- Keep node/edge data normalized: `nodeMap` and `portMap` keyed by id for O(1)
  lookup, not arrays scanned on every access (this is FlowMat's existing pattern
  from `toWorkflowCanvasViewModel`).
- Ports belong to nodes but are addressable independently — a connection
  references `(nodeId, portId)` pairs, never a nested path.
- Viewport state (zoom, pan) is UI state, not domain state — lives in Zustand
  (`useWorkspaceStore.viewport`), not in the node/edge data. See
  `client-state-patterns` for the actual store split.

## Annotation UI — planned structure vs. what actually shipped

The execution plan (`docs/seolly/flowmat_annotation_execution_plan.md` §4.1)
called for a fully decomposed FSD structure:
`entities/canvas-annotation/ui/{Shape,Text,Freehand}AnnotationNode.tsx` +
`features/annotation-create-shape/`, `features/annotation-freehand-draw/`,
`features/canvas-align/`, `features/canvas-group/`, etc. +
`widgets/canvas-toolbar/ui/CanvasToolbar.tsx`.

**What actually shipped is different:**

- A **single** node component, `pages/workspace/ui/CanvasAnnotationNode.tsx`,
  handles all annotation types — there is no per-type
  `Shape`/`Text`/`FreehandAnnotationNode` split.
- Align, group, distribute, toolbar, and permission-gating logic are all
  **inlined into `WorkflowCanvasPage.tsx` and `CanvasViewport.tsx`** — there
  is no `widgets/canvas-toolbar/`, no `features/annotation-*/`, no
  `features/canvas-align/`. (There is also no `widgets/` layer in this repo
  at all — see `frontend-patterns`.)
- The one piece of the plan that *did* land exactly as specified: the pure
  layout math. `entities/canvas-annotation/model/annotationLayout.ts` holds
  `computeSelectionBounds`, `computeAlignedPosition` (6-direction align:
  left/centerX/right/top/centerY/bottom), and `computeDistributedPositions`
  (horizontal/vertical even spacing) as standalone pure functions, with a
  colocated test file (`annotationLayout.test.ts`) — matching the plan's
  explicit requirement that `computeAlignedPosition` be "분리되어 있어야"
  (must be separated out) for testability.

When working on annotation UI: don't go looking for
`ShapeAnnotationNode.tsx` or a `CanvasToolbar` widget — they don't exist.
New annotation-type-specific rendering branches inside the existing
`CanvasAnnotationNode.tsx`, new align/group logic inside
`WorkflowCanvasPage.tsx`/`CanvasViewport.tsx`. If you're deciding whether new
logic should be a pure function pulled out to `annotationLayout.ts` (or a
sibling file) versus inlined in the page component: pure coordinate/geometry
math goes in the model file (matches the one thing the plan got adopted
faithfully); interaction/orchestration logic stays inline in the page,
matching the actual pattern, not the originally planned split.

## React Flow integration — deliberately not using standard state hooks

The workspace does **not** use React Flow's `useNodesState`/`useEdgesState`.
It maintains a custom local nodes/edges state integration instead. This is a
documented, deliberate tradeoff
(`docs/seolly/frontend_workspace_status_2026-07-22.md`), not an oversight to
"fix" by migrating to the standard hooks:

- The custom state integrates remote graph-change patching (see
  `collaboration-infra`'s `sinceSeq` sync) directly into the same state
  update path a local edit uses.
- It supports inline-edit conflict deferral — deferring/blocking a field
  another user is actively editing (`NODE_EDITING` presence) — which the
  standard hooks have no hook for.
- Custom canvas behaviors (annotation align/group inline logic, node picker
  popup insertion) are threaded through the same local state.

If a future React Flow upgrade makes `useNodesState`/`useEdgesState`
expressive enough to cover remote patching + conflict deferral + the custom
behaviors above, revisiting this is reasonable — but don't propose the
migration as a simplification without accounting for those three
requirements; they're why the custom integration exists, not accidental
complexity.

## Rendering

- React Flow custom node components should be pure renderers of a ViewModel
  node — no data fetching, no direct store writes inside a node component.
- Selection state is derived (a `Set<nodeId>`), not stored per-node on each
  node object — avoids re-rendering the whole graph on selection change.
- Large graphs: virtualize or cull nodes outside the viewport before they hit
  React Flow's render path, not after. FlowMat already wires `MiniMap`,
  `snapToGrid`, and `onlyRenderVisibleElements` into the viewport
  (`docs/seolly/frontend_workspace_status_2026-07-22.md`).

## Collaboration (informed by yjs, actual implementation in `collaboration-infra`)

- Annotations use real version/versionNonce reconciliation
  (`CanvasAnnotationReconcileService`) for concurrent edits — see
  `collaboration-infra` for the full mechanism. Nodes/edges still resolve
  concurrent edits as last-write-wins; that's a documented known gap, not
  something to assume is already CRDT-merged.
- Keep the "local optimistic update -> server reconciliation" path explicit:
  apply the user's edit to local state immediately, then reconcile when the
  server/collaboration event arrives, rather than waiting for round-trip.
- Cursor/presence data (including in-progress `ANNOTATION_DRAWING` freehand
  preview) is ephemeral and must not share a persistence path with actual
  document state (position/connections/completed annotations) — see
  `collaboration-infra`'s "Separate the three data classes."

## When reviewing FlowMat canvas code, check for

- A node component reading from a global store directly instead of props
- Position updates that don't distinguish "my own drag" from "remote update"
- O(n) scans over all nodes/edges where `nodeMap`/`portMap` should be used
- New annotation UI code written against the planned-but-nonexistent
  `ShapeAnnotationNode.tsx` / `CanvasToolbar` widget paths instead of the
  actual `CanvasAnnotationNode.tsx` + inline `WorkflowCanvasPage.tsx`/`CanvasViewport.tsx` structure
- A proposal to migrate to `useNodesState`/`useEdgesState` that doesn't
  account for remote patching, inline-edit conflict deferral, and the
  custom canvas behaviors the current integration already handles
- Node/edge conflict-handling code assumed to already be as robust as
  annotations' version/versionNonce reconciliation — it isn't yet
