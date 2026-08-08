---
name: collaboration-infra
description: Real-time collaboration backend patterns for FlowMat (Spring Boot) — session/presence management, sync protocol, and conflict handling, informed by yjs. Use when working on the collaboration infrastructure nekopunch owns.
origin: personal (FlowMat-verified against domain/workflow/collab/*, domain/workflow/annotation/application/CanvasAnnotationReconcileService.java, global/security/JwtProvider.java, global/websocket/StompAuthChannelInterceptor.java, entities/workflow/api/useWorkflowSync.ts, and docs/nekopunch/collab_status_2026-07-23.md — verified 2026-08-09)
---

# Collaboration Infrastructure (Backend)

Core ownership area. Informed by yjs's CRDT approach, adapted for a Spring
Boot backend rather than a pure client-side CRDT library.
`docs/nekopunch/collab_status_2026-07-23.md` is the latest status snapshot in
the repo (it explicitly supersedes `collab_status_2026-07-22.md` — see
`agent-sort`'s drift-check rule for how to handle dated status docs like
this). This skill summarizes and should be kept in sync with the newest one,
not the other way around.

This is a real, shipped implementation as of this verification — not a stub
or prototype. The sections below describe what actually runs.

## Package layout

```
global/websocket/            WebSocketConfig, StompAuthChannelInterceptor
domain/workflow/collab/
  WorkflowSessionRegistry     sessionId -> (userId, workflowId, cursor, editingProcessId), Redis-backed
  WorkflowPresenceCleanupService   @Scheduled sweep of stale sessions
  WorkflowPresenceEventListener
  PresenceController          @MessageMapping(".../presence") — relay + session touch
  GraphSyncService            broadcast() + getChangesSince() — durable graph change log
  RedisGraphChangeStore       graphSeq/sinceSeq sequence log, Redis ZSET-indexed
  WorkflowCollabProperties    @ConfigurationProperties(prefix = "app.workflow-collab")
  dto/{PresenceMessage, GraphChangeMessage, GraphEntityPayload,
       AnnotationPresencePayload, GraphAnnotationPayload, NodeMoveMessage}
domain/workflow/annotation/application/
  CanvasAnnotationReconcileService   version/versionNonce conflict check for annotations
domain/workflow/application/
  WorkflowLockService(Impl)   interface + impl exist, impl body is still empty — see "Known gap" below
```

## Separate the three data classes

1. **Document state** — node/edge/port/annotation data. Durable, persisted to
   PostgreSQL via the ordinary REST path (`PUT /api/processes/{id}`,
   `POST/PATCH /workflows/{id}/annotations/{annotationId}`, etc.). The
   WebSocket layer never writes documents directly — `GraphSyncService.broadcast()`
   is called *after* a REST mutation commits, loads the fresh entity, and
   fans it out over `/topic/workflow/{workflowId}/graph`.
2. **Presence** — who's connected, cursor position, editing target, live
   freehand-draw preview. Ephemeral, high-frequency, **never persisted to
   Postgres**, backed by Redis with a TTL only (see below).
3. **Graph change log** — the durable-but-bounded sequence log that lets a
   reconnecting client catch up without a full canvas refetch. Also
   Redis-backed, with its own retention policy, distinct from presence.

Don't let these share a retention/persistence policy just because they flow
over the same WebSocket connection — presence and the graph change log have
different Redis TTLs for a reason (see "Operational controls" below).

Room model: broker prefix `/topic`, app prefix `/app`, one room per
`workflowId` — `/topic/workflow/{workflowId}/{presence,node-move,graph}`.

Server-authority principle, enforced in `PresenceController` and
`StompAuthChannelInterceptor`: client-sent `userId`/`workflowId`/`timestamp`
are never trusted for anything security-relevant — the server overwrites them
from the authenticated `Principal`, the path variable, and the server clock
(`PresenceMessage.withServerValues(userId, workflowId)`). The client's
`clientId` (a per-tab UUID) is the one exception — it's relayed unchanged and
used only for client-side echo filtering, never for auth.

## Auth — real JWT verification, not a stub

- `JwtProvider` issues and verifies signed JWTs (`io.jsonwebtoken`, HS256,
  `jwt.secret` must be ≥32 bytes). `resolveUserId(token)` parses and verifies
  the token's signature/expiry before returning the `sub` claim — it is not a
  pass-through.
- `StompAuthChannelInterceptor.preSend()` requires a `Bearer` token on the
  STOMP `CONNECT` frame, calls `jwtProvider.validate(token)` (throws
  `UNAUTHORIZED`/`TOKEN_INVALID`/`TOKEN_EXPIRED` on failure), rejects
  non-access tokens (`TOKEN_TYPE_INVALID`), and sets a real
  `UsernamePasswordAuthenticationToken(AuthUser, ...)` as the STOMP principal.
  It further gates every `SEND`/`SUBSCRIBE` to a `/topic/workflow/{id}/...`
  or `/app/workflow/{id}/...` destination through
  `ProjectAccessService.requireWorkflowReadAccess` (subscribe) or
  `requireWorkflowWriteAccess` (send) — unauthenticated or unauthorized
  frames are rejected, not silently passed through.
  (The class-level Javadoc comment in this file still says "현재는
  pass-through 스텁 상태" — that comment is stale relative to the code below
  it; don't trust the comment, trust the `preSend` body.)
- The frontend sends the real access token: `useWorkflowSync.ts` reads
  `tokenStorage.getAccess()` and sets it as the STOMP `connectHeaders.Authorization`.
  The per-tab `CLIENT_ID` (`crypto.randomUUID()`) is separate from the auth
  token and used purely for echo filtering (`payload.clientId === CLIENT_ID
  → ignore`), same as documented in `client-state-patterns`' pattern of
  keeping concerns separated.

## Presence — Redis-backed, with real lifecycle management

- `WorkflowSessionRegistry` stores each session as a Redis hash
  (`ws:session:{sessionId}` — `userId`, `workflowId`, `clientId`, `cursorX`,
  `cursorY`, `editingProcessId`, `lastSeenAt`), TTL 24 hours, tracked in a
  Redis set (`ws:sessions:active`) for enumeration. This is multi-instance
  safe by construction (unlike an in-process map).
- Message types: `JOIN`, `LEAVE`, `CURSOR_MOVED`, `NODE_EDITING`, `HEARTBEAT`,
  `ANNOTATION_DRAWING`. `PresenceController.relay()` touches the session
  registry on every non-`LEAVE`/non-`HEARTBEAT` message and removes it on
  `LEAVE`; `HEARTBEAT` updates `lastSeenAt` but is not rebroadcast to other
  clients.
- `WorkflowPresenceCleanupService` runs on a configurable
  `@Scheduled(fixedDelayString = "${app.workflow-collab.presence.cleanup-interval}")`
  sweep, finds sessions past the heartbeat timeout, removes them, and
  broadcasts a synthetic `LEAVE` for each — so a client that dropped without
  sending `LEAVE` still disappears from other clients' presence view.
- New/reconnecting clients don't wait for future events to know who's already
  in the room: `GET /workflows/{workflowId}/presence` (`WorkflowController`)
  returns a snapshot built from `WorkflowSessionRegistry.listWorkflowSessions()`,
  fetched by the frontend via `fetchWorkflowPresenceSnapshot`
  (`entities/workflow/api/workflowPresenceSnapshot.ts`).
- `ANNOTATION_DRAWING` (in-progress freehand stroke preview) is relayed like
  other presence messages but is **intentionally never persisted** — no Redis
  storage beyond the session's transient fields, no DB row. Only a completed
  stroke, submitted through the ordinary `POST /workflows/{id}/annotations`
  or `PATCH .../annotations/{id}` REST path, becomes durable document state.
  Don't let a "let's also cache the in-progress points" change blur this
  line — see "Separate the three data classes" above.

## Sync — Redis sequence log with catch-up, not full-refetch-on-every-change

- `GraphSyncService.broadcast(type, workflowId, entityId, userId)` loads the
  fresh entity, calls `RedisGraphChangeStore.append(...)` to assign the next
  `graphSeq` for that workflow and persist the change, then publishes to
  `/topic/workflow/{workflowId}/graph`.
- `RedisGraphChangeStore` keeps, per workflow: an incrementing sequence
  counter (`ws:graph:seq:{workflowId}`), a ZSET indexed by seq
  (`ws:graph:by-seq:{workflowId}`), a ZSET indexed by timestamp
  (`ws:graph:by-time:{workflowId}`, used to prune by retention age), and a
  hash of seq → serialized `GraphChangeMessage`
  (`ws:graph:data:{workflowId}`).
- Reconnect flow: client calls `getChangesSince(workflowId, sinceSeq)`. If
  the requested `sinceSeq` is still within the retained window, it returns
  only the missed changes (`resetRequired=false`). If the oldest retained seq
  has already advanced past what the client needs, it returns
  `resetRequired=true` with no changes, and the frontend does a full canvas
  reload instead of trying to patch a gap it can't fill.
- Change types cover node/port/connection/workflow **and annotation**
  (`ANNOTATION_CREATED`/`ANNOTATION_UPDATED`/`ANNOTATION_DELETED` in
  `GraphChangeMessage.Type` — `GraphSyncService.loadPayload()` has a case for
  each). Deletes carry no payload (`null`) by design — the client removes by
  id.
- Local canvas mutations patch the React Query cache directly instead of
  forcing a full `workflow-canvas` refetch on every remote change (per
  `docs/nekopunch/collab_status_2026-07-23.md`).

## Conflict handling — real for annotations, a known gap for nodes/edges

**Annotations (implemented):** `canvas_annotation` rows carry `version` (int)
and `version_nonce` (long) — **plain entity fields checked in application
code, not JPA's `@Version` annotation** (there is no `@Version` anywhere in
this backend — see `sql-queries`). `CanvasAnnotationReconcileService.shouldDiscardIncoming(current,
nextVersion, nextVersionNonce)` implements an excalidraw-style reconcile:
discard the incoming write if `current.version > nextVersion`, or if versions
tie and `current.versionNonce >= nextVersionNonce`. This is the accepted,
shipped conflict-resolution path for shape/text/freehand/align/group edits.

**Nodes/edges (known gap, not yet implemented):** no field-level merge and no
optimistic locking. A node's position/property write goes through the
ordinary `PUT /api/processes/{id}` — plain find-then-save, no version check.
The WebSocket node-move relay during a drag never writes the DB (visual-only
until the drag ends and a REST call persists the final position), so
concurrent-node-edit conflicts resolve as last-REST-write-wins with nothing
logging or surfacing the collision. `WorkflowLockService`/`WorkflowLockServiceImpl`
exist as files but the impl body is empty — a placeholder, not something to
treat as already providing locking.

**Known risk:** two users editing the *same* node's position or properties at
the same time can have one edit silently dropped. This is documented as a
remaining risk in `docs/seolly/frontend_workspace_status_2026-07-22.md`
("Conflict deferral currently protects the main inline edit flows, but future
editable fields should follow the same rule before shipping") — the frontend
mitigates by deferring/blocking edits on a field another user is actively
editing (`NODE_EDITING` presence), but that's UI-level avoidance, not a
server-side merge guarantee.

**If/when node/edge conflict handling gets built:** the annotation
`version`/`versionNonce` pattern in `CanvasAnnotationReconcileService` is the
template to extend to `process`/`process_connection` rather than reinventing
a new scheme — it's already written in a form the annotation plan doc
expected to be reused (`flowmat_annotation_execution_plan.md` §3.4: "excalidraw
reconcile 패턴을 그대로 적용... 공통 유틸로 추출해서 재사용").

## Operational controls (externalized, not hardcoded)

Backend (`WorkflowCollabProperties`, prefix `app.workflow-collab`):

| Variable | Default |
|---|---|
| `APP_WORKFLOW_COLLAB_GRAPH_RETENTION` | 31 days |
| `APP_WORKFLOW_COLLAB_GRAPH_KEY_TTL` | 35 days |
| `APP_WORKFLOW_COLLAB_PRESENCE_HEARTBEAT_TIMEOUT` | 45 seconds |
| `APP_WORKFLOW_COLLAB_PRESENCE_CLEANUP_INTERVAL` | 15 seconds |

Frontend (`useWorkflowSync.ts`):

| Variable | Default |
|---|---|
| `VITE_WORKFLOW_SYNC_HEARTBEAT_MS` | 15 000 ms |
| `VITE_WORKFLOW_SYNC_RECONNECT_DELAY_MS` | 3 000 ms |

## When reviewing FlowMat collaboration backend code, check for

- Presence or `ANNOTATION_DRAWING` in-progress data being persisted or backed
  up like document state — it must stay ephemeral/relay-only
- Code or comments assuming `JwtProvider`/STOMP auth is still a stub (it
  isn't — verify against `StompAuthChannelInterceptor.preSend()`, not the
  stale class Javadoc)
- Code or comments assuming node/edge position or property conflicts are
  already merge-safe — they aren't; only annotations have real
  version/versionNonce reconciliation
- A new concurrent-edit-prone field being added to `process`/`process_connection`
  without either using the `CanvasAnnotationReconcileService` pattern or
  explicitly flagging the last-write-wins gap
- A reconnect path that assumes `sinceSeq` catch-up always succeeds — handle
  `resetRequired=true` (full reload), don't assume the retained window is
  infinite
- New session/presence state being kept anywhere other than
  `WorkflowSessionRegistry`'s Redis-backed store
