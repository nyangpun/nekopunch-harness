---
name: collaboration-infra
description: Real-time collaboration backend patterns for FlowMat (Spring Boot) — session/presence management, sync protocol, and conflict handling, informed by yjs. Use when working on the collaboration infrastructure nekopunch owns.
origin: personal (FlowMat-informed)
---

# Collaboration Infrastructure (Backend)

Core ownership area. Informed by yjs's CRDT approach, adapted for a
Spring Boot backend rather than a pure client-side CRDT library.

## Separate the three data classes

1. **Document state** — node/edge/port data. Needs durability, conflict
   resolution, and persistence to PostgreSQL.
2. **Presence** — who's connected, cursor position, current selection.
   Ephemeral, high-frequency, never persisted.
3. **Session/connection** — who's authenticated to which workflow room.
   Short-lived, drives access control for the other two.

Don't let these share a transport contract just because they all flow over
the same WebSocket connection — keep their message types, retention, and
persistence paths distinct.

## Conflict handling

- Field-level merge over whole-object last-write-wins where possible (e.g. a
  node's position and its label can be edited by two users concurrently
  without one clobbering the other).
- Use `@Version` optimistic locking at the persistence layer (see
  `sql-queries`) as the source of truth for "who wins" when two writes hit
  the same field simultaneously; the real-time layer applies changes
  optimistically to connected clients and reconciles against that.
- Order-sensitive operations (e.g. connecting two ports) need a deterministic
  tie-break rule (e.g. server-assigned sequence number), not client
  timestamps, since client clocks aren't trustworthy for ordering.

## Session/presence lifecycle

- Presence should expire on disconnect without requiring an explicit
  "leaving" message — assume the network drop is the common case, not the
  clean disconnect.
- Reconnection should replay only the document deltas missed, not force a
  full canvas refetch, once the room has more than a trivial node count.

## When reviewing FlowMat collaboration backend code, check for

- Presence data being persisted or backed up like document state
- A merge strategy that overwrites a whole node object instead of merging
  changed fields
- A reconnect path that always does a full refetch instead of delta replay
