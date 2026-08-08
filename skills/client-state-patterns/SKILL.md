---
name: client-state-patterns
description: Zustand store conventions for UI/client state, kept separate from server state. Use when adding or reviewing state stores in FlowMat's frontend.
origin: personal (FlowMat-informed)
---

# Client State Patterns (Zustand)

## Scope

Zustand owns **UI state only**: selection, viewport (zoom/pan), open panels,
drag-in-progress, inspector tab. It never owns server-sourced data — that's
TanStack Query's job (see `data-fetching-patterns`).

## Store shape

- One store per bounded concern (e.g. `useCanvasUiStore`, `useInspectorStore`),
  not one giant global store.
- Actions live next to the state they mutate — expose intent-named actions
  (`selectNode(id)`, `clearSelection()`) rather than raw setters
  (`setSelectedIds`) so call sites read as behavior, not state manipulation.
- Derive, don't duplicate: if a value can be computed from server data +
  UI state, compute it in a selector — don't copy it into the store.

## Selectors

- Always select the narrowest slice needed (`useStore(s => s.selectedNodeIds)`),
  never the whole store, to avoid unnecessary re-renders on a canvas with
  many subscribers.

## When reviewing FlowMat state code, check for

- Server-fetched data (node definitions, workflow metadata) stored in Zustand
  instead of TanStack Query's cache
- A component subscribing to the entire store instead of a selector
- Setter-style actions (`setX`) where an intent-named action would be clearer
