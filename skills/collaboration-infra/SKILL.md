---
name: collaboration-infra
description: Real-time collaboration backend patterns for FlowMat (Spring Boot) — session/presence management, sync protocol, and conflict handling, informed by yjs. Use when working on the collaboration infrastructure nekopunch owns.
origin: personal (FlowMat-verified against docs/nekopunch/CLAUDE.md, domain/workflow/collab/*, global/security/JwtProvider.java, global/websocket/*)
---

# Collaboration Infrastructure (Backend)

Core ownership area. Informed by yjs's CRDT approach, adapted for a
Spring Boot backend rather than a pure client-side CRDT library.
`docs/nekopunch/CLAUDE.md` in the FlowMat repo is the authoritative, kept-
up-to-date log of this work (phase status, room model, message contracts) —
check it first; this skill summarizes and should be kept in sync with it,
not the other way around.

## Package layout (as of Phase 2)

```
global/websocket/    WebSocketConfig, StompAuthChannelInterceptor  (Phase 1)
domain/workflow/collab/
  WorkflowSessionRegistry          sessionId -> (userId, workflowId), in-memory
  WorkflowPresenceEventListener    SUBSCRIBE/DISCONNECT -> JOIN/LEAVE broadcast
  PresenceController               @MessageMapping(".../presence")
  NodeSyncController                @MessageMapping(".../node-move"), pure relay
  dto/PresenceMessage, dto/NodeMoveMessage
```

## Separate the three data classes

1. **Document state** — node/edge/port data. Needs durability and
   persistence to PostgreSQL. Currently persisted only via the existing REST
   path (`PUT /api/processes/{id}`); the WebSocket node-move relay never
   touches the DB.
2. **Presence** — who's connected, cursor position, current selection.
   Ephemeral, high-frequency, never persisted. Backend-only so far — no
   frontend presence subscription/render yet.
3. **Session/connection** — who's authenticated to which workflow room.
   Short-lived. See "Auth — current stub state" below before assuming this
   drives real access control.

Don't let these share a transport contract just because they all flow over
the same WebSocket connection — keep their message types, retention, and
persistence paths distinct. (Room model: broker prefix `/topic`, app prefix
`/app`, one room per `workflowId` — `/topic/workflow/{workflowId}/...`.)

Server-authority principle, enforced in both `PresenceController` and
`NodeSyncController`: client-sent `userId`/`workflowId`/`timestamp` are never
trusted — the server always overwrites them from the authenticated
Principal, the path variable, and the server clock.

## Auth — current stub state (read before touching access control)

- `JwtProvider.resolveUserId(token)` is a **full pass-through stub**: `return
  token;`. There is no JWT verification. Any string sent as the STOMP
  `Authorization: Bearer` value becomes the server-side `userId` as-is.
- The frontend has no real login yet. `useWorkflowSync.ts` generates a random
  per-tab `CLIENT_ID` (`crypto.randomUUID()`) and reuses it as both the
  Bearer token and the client-side echo-filter key.
- STOMP auth failure (missing/invalid token) currently passes through with no
  `Principal` set, rather than rejecting the connection.
- `AuthUser` has no `getName()`/`toString()` override — always cast to
  `AuthUser` and call `getUserId()`; don't call `principal.getName()`.

**Known risk / TODO:** none of this is real access control yet — anyone who
can open a STOMP connection can claim any `userId`. This is expected at the
current stage (real login isn't wired up anywhere in the app), not a
regression to fix in isolation. When real login lands, replace `CLIENT_ID` in
`useWorkflowSync.ts` with the real access token and give `JwtProvider` real
verification — update this section (and `docs/nekopunch/CLAUDE.md` §4) at
that point rather than assuming it's already secure.

## Conflict handling — current state, not `@Version`

**Current state:** there is no field-level merge and no optimistic locking
(see `sql-queries` — `grep -rn "@Version"` finds nothing in the backend).
Node position/property conflicts resolve as plain last-REST-write-wins:
the WebSocket path is a visual-only relay during a drag (no DB write), and
the drag's final position is persisted by the ordinary
`PUT /api/processes/{id}` path, which does a plain find-then-save with no
version check. A `WorkflowLockService` interface exists but is an **empty
stub** — not implemented, not something to rely on.

**Known risk:** two users dragging or editing the same node concurrently can
have one edit silently overwritten, with nothing logging or surfacing the
conflict.

**If/when this gets implemented** (Phase 3+, per `docs/nekopunch/CLAUDE.md`):
prefer field-level merge over whole-object last-write-wins (a node's position
and its label edited by two users shouldn't clobber each other), use
`@Version` at the persistence layer as the source of truth for "who wins" on
same-field conflicts, and use a deterministic server-assigned tie-break (not
client timestamps) for order-sensitive operations like connecting two ports.

## Session/presence lifecycle

- Presence expires on disconnect via `WorkflowPresenceEventListener`
  (DISCONNECT → remove + LEAVE broadcast) without requiring an explicit
  "leaving" message.
- `WorkflowSessionRegistry` is an **in-memory `ConcurrentHashMap`** — single-
  instance only. Multi-instance deployment needs migration to Redis (the
  dependency is already present in `build.gradle` but this migration has not
  been started) — otherwise presence views diverge across instances and
  JOIN/LEAVE broadcasts get dropped for users on a different instance.
- Reconnection/delta-replay and snapshot recovery are **not implemented** —
  don't assume a reconnect gets anything beyond what the normal REST canvas
  refetch provides.

## When reviewing FlowMat collaboration backend code, check for

- Presence data being persisted or backed up like document state
- Code or comments assuming `JwtProvider`/STOMP auth does real verification,
  or that `WorkflowLockService`/`@Version` already guards concurrent edits —
  none of that exists yet (see sections above)
- A reconnect path assumed to do delta replay — it doesn't; it's a full REST
  refetch or nothing
- New session/presence state being kept anywhere other than
  `WorkflowSessionRegistry` (or its future Redis replacement)
