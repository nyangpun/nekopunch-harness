---
name: client-state-patterns
description: Zustand store conventions for UI/client state, kept separate from server state. Use when adding or reviewing state stores in FlowMat's frontend.
origin: personal (FlowMat-verified against src/pages/workspace/model/*.ts and flowmat_frontend/CLAUDE.md)
---

# Client State Patterns (Zustand)

## Scope

Zustand owns **UI/editor state only**: selection, viewport (zoom/pan), open
drawers, inline-edit target, canvas mode, undo/redo history, canvas-popup
state. It never owns server-sourced data — that's TanStack Query's job (see
`data-fetching-patterns`). Documented in `flowmat_frontend/CLAUDE.md` as:
"server data stays in TanStack Query. workspaceStore holds only editor
interaction state."

## Store shape (actual FlowMat stores)

FlowMat does **not** split one store per field or per widget. It splits by
distinct interaction subsystem, and each subsystem's store can be fairly
wide:

- `useWorkspaceStore` (`pages/workspace/model/workspaceStore.ts`) — the
  workspace screen's whole interaction state in one store: selection
  (`selectedProcessId`/`selectedConnectionId`/`selectedPortId`),
  `inspectorMode`, `canvasMode`, `pendingConnectionDraft`, drawer flags
  (`isRuleDrawerOpen`, `isTemplateDrawerOpen`), `activeColorPickerNodeId`,
  `inlineEditingNodeId`, `viewport`, `panelWidths`. These are combined
  because they're all read/written together by the same screen — selecting a
  node changes `inspectorMode` in the same action (see `selectNode`).
- `useCanvasInteractionStore` (`pages/workspace/model/canvasInteractionStore.ts`)
  — split out separately because it's a genuinely distinct subsystem: the
  on-canvas node-picker popup (`nodePicker`) and `hoveredEdgeId`. Ported from
  tldraw's `OnCanvasComponentPicker` pattern.
- `useCommandHistory` (`pages/workspace/model/commandHistory.ts`) — undo/redo
  stack (`past`/`future` of `Command`), split out because its shape and
  update pattern (stack push/pop) has nothing in common with selection or
  popup state.

When adding new UI state: put it in the existing store that already owns
that interaction subsystem. Only create a new store when the new state is a
genuinely separate subsystem (its own popup, its own history stack) — not
just because a value doesn't belong to an existing field.

## Actions

- Actions live next to the state they mutate — expose intent-named actions
  (`selectNode(id)`, `clearSelection()`, `openNodePicker(state)`) rather than
  raw setters, so call sites read as behavior, not state manipulation. This
  matches the real `useWorkspaceStore` API (`selectNode`, `selectEdge`,
  `selectPort`, `clearSelection`, `setCanvasMode`, `setConnectionDraft`,
  `openRuleDrawer`/`closeRuleDrawer`, `startInlineEdit`/`stopInlineEdit`).
- One action can update several fields atomically when they're part of the
  same intent — e.g. `selectNode` clears `selectedConnectionId` and
  `selectedPortId` and sets `inspectorMode: 'node'` in a single `set()` call,
  instead of three separate setter calls from the component.

## Selectors

- Always select the narrowest slice needed (`useWorkspaceStore(s => s.selectedProcessId)`),
  never the whole store, to avoid unnecessary re-renders on a canvas with
  many subscribers.

## When reviewing FlowMat state code, check for

- Server-fetched data (node definitions, workflow metadata) stored in Zustand
  instead of TanStack Query's cache
- A component subscribing to the entire store instead of a selector
- Setter-style actions (`setX`) where an intent-named action would be clearer
- New UI state bolted onto an unrelated store instead of its own subsystem
  store, or a brand-new store created for state that belongs in an existing
  subsystem
