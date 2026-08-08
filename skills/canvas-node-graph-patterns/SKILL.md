---
name: canvas-node-graph-patterns
description: Patterns for building a node-based canvas (React Flow) with real-time collaboration, informed by tldraw, excalidraw, xyflow, and yjs. Use for FlowMat's workflow canvas — node/edge rendering, ports, selection, and viewport state.
origin: personal (FlowMat-informed)
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
- Viewport state (zoom, pan) is UI state, not domain state — lives in Zustand,
  not in the node/edge data.

## Rendering

- React Flow custom node components should be pure renderers of a ViewModel
  node — no data fetching, no direct store writes inside a node component.
- Selection state is derived (a `Set<nodeId>`), not stored per-node on each
  node object — avoids re-rendering the whole graph on selection change.
- Large graphs: virtualize or cull nodes outside the viewport before they hit
  React Flow's render path, not after.

## Collaboration (informed by yjs)

- Prefer CRDT-style merge semantics for concurrent node position/property
  edits over last-write-wins, if multiple users can move the same node.
- Keep the "local optimistic update -> server reconciliation" path explicit:
  apply the user's edit to local state immediately, then reconcile when the
  server/collaboration event arrives, rather than waiting for round-trip.
- Cursor/presence data is ephemeral and should not share a channel or
  persistence path with actual document state (position/connections).

## When reviewing FlowMat canvas code, check for

- A node component reading from a global store directly instead of props
- Position updates that don't distinguish "my own drag" from "remote update"
- O(n) scans over all nodes/edges where `nodeMap`/`portMap` should be used
