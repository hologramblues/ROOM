# Server access-control (ACL) regression specs

These specs are the **regression gate for the CRITICAL findings** in
[`AUDIT.md`](../../../AUDIT.md) §5: `5.1`, `5.1b`, `5.2` and `5.3`.

**All four are now fixed**, and every spec here is a live assertion. The
negative specs (`A1`, `A2`, `B1`, `B2`, `C1`) were `expectedFail`/`test.skip`
while the holes were open; they were flipped to plain `test` when the fix
landed, so a regression turns the suite red instead of quietly skipping.

> **Do not weaken an assertion here to make it pass.** If one of these starts
> failing, the fix is incomplete — or has regressed.

---

## Running them

Every spec in this directory needs real `User` / `Document` / `HistoryEntry`
records, so the whole directory is gated on `TEST_MONGODB_URI` exactly like the
policy in [`TESTING.md`](../../../TESTING.md) §2 describes. Without it the three
suites report *skipped* and the runner still exits `0`.

```bash
# 1. DB-free (what CI runs today) — everything here is skipped, exit 0
cd server && npm test

# 2. With a database — the real gate: 24 passed, 0 skipped
mkdir -p /tmp/rooms-test-db && mongod --dbpath /tmp/rooms-test-db &
cd server && TEST_MONGODB_URI=mongodb://localhost:27017/rooms-test npm test
```

`ACL_EXPECT_FAIL=1` — the "honesty switch" that used to un-skip the
expected-fail specs — is **gone**, together with the `expectedFailUntilAclFix`
helper it drove. The specs it guarded now run unconditionally. The variable is
inert: setting it changes nothing.

The specs **never drop a database**. They create uniquely-suffixed fixtures and
delete exactly those records in `afterAll`, so pointing `TEST_MONGODB_URI` at a
scratch dev database cannot destroy unrelated data.

---

## Spec inventory

All 24 specs **pass**. They run only when `TEST_MONGODB_URI` is set, otherwise
they are skipped with their suite.

### `rest-document-access.test.js` — guards finding **5.1** (§8.8 spec S1)

`GET /api/documents/:shortId` (`server/server.js:485`) now runs
`checkDocumentAccess(doc, req.user, 'viewer')` before answering, and reports the
role the ACL actually grants — ownership, an explicit collaborator entry, or
`publicAccess.role` — instead of the old `else userRole = 'editor'` branch.

| # | Spec | Guards | Behaviour asserted |
|---|------|--------|--------------------|
| A1 | rejects a non-collaborator with 403 and leaks no document content | 5.1 | 403, no `elements`/`title`, no secret line anywhere in the body |
| A2 | never advertises an editor role to a non-collaborator | 5.1 | `role !== 'editor'`, falsy `isOwner`, no collaborator row written |
| D1 | owner can read their own document | over-block guard | 200, `isOwner: true`, `role: 'editor'` |
| D2 | explicit editor collaborator can read the document | over-block guard | 200, `role: 'editor'` |
| D3 | explicit viewer collaborator can read the document, with viewer role | over-block guard | 200, `role: 'viewer'` |
| D4 | unauthenticated request is rejected with 401 | regression guard | 401 |
| D5 | a malformed token is rejected with 401 | regression guard | 401 |

A2 also asserts the read is side-effect free (no collaborator row appears). The
DB-level auto-add that used to defeat it lived on the Socket.io join path and is
now gone — see `socket-join-authorization.test.js` below.

### `socket-join-authorization.test.js` — guards finding **5.1b** (§8.6 specs C6a–C6c)

`join-document` (`server/server.js:837-855`) no longer auto-adds a share-link
visitor as an `editor` collaborator. It derives the role from
`doc.publicAccess.role` on every join and **persists nothing** — design (b) in
AUDIT §5.1b-rationale. That closes the path by which one handler defeated both
the 5.1 REST fix (the next `GET` read `editor` back out of the DB) and the 5.3
Yjs fix (`checkDocAccess` passed `editor` against the same row).

| # | Spec | Guards | Behaviour asserted |
|---|------|--------|--------------------|
| E1 | a viewer-role public link never yields the editor role, and persists nothing | 5.1b | `role === 'viewer'`, no collaborator row in the DB, visitor absent from the roster |
| E2 | the escalation does not leak back through the REST route afterwards | 5.1b + 5.1 | after a real socket join, `GET /api/documents/:shortId` still answers `viewer` |
| E3 | revoking the link takes effect on the next join | 5.1b (design) | editor link → downgrade → `viewer` → disable → `Acces refuse` |
| D12 | an editor-role public link legitimately yields the editor role | over-block guard | `role === 'editor'`, still with no persisted row |
| D13 | a non-collaborator join is refused when public access is disabled | over-block guard | `error: 'Acces refuse'`, no row, no `document-state` ever delivered |
| D14 | an explicitly invited viewer keeps their invited role | over-block guard | invited `viewer` is not promoted by the document's `editor` link |
| D15 | the owner still joins as editor | over-block guard | `role === 'editor'`, present in the roster as `owner`, no collaborator row |
| D16 | an unauthenticated socket cannot join at all | regression guard | `error: 'Authentification requise'` |

E3 is the spec that separates the two candidate designs: under design (a)
("persist, but with the correct role") the first join writes a row that outlives
the downgrade, and `ShareModal` exposes no UI to see or delete it. E3 fails under
(a) and passes under (b).

**Which harness was used — the honest answer.** A **real Socket.io test**. It
boots the exported HTTP server on an ephemeral port (`server.listen(0)`; `io` is
bound to that same server at `server.js:16`), connects genuine `socket.io-client`
sockets carrying real JWTs from `POST /api/auth/register`, flips the share link
through the real owner-only `PUT /:shortId/public-access` route, and asserts on
the `document-state` / `error` frames the server actually emits. The persistence
half is then read back from the live database. No server internal (`activeRooms`,
the handler closure) is touched. `socket.io-client` was added as a devDependency
for this file — the package previously shipped only the server half.

The join helper **races** `document-state` against `error` rather than treating a
timeout as a refusal, so a server that merely got slower fails loudly instead of
looking like a successful deny.

Verified end to end by reverting the fix: E1, E2, E3 and D12 all go red against
the original code (`Expected "viewer", Received "editor"`, and D12 observing the
persisted `{role: 'editor'}` row), reproducing finding 5.1b exactly.

**User-visible consequence, recorded here too:** link visitors are no longer
written into `collaborators`, so a link-shared document stops appearing in a
visitor's `GET /api/documents` list, and a past visitor who is offline stops
appearing as an `@mention`/assignee candidate. Live presence is unaffected
(`activeRooms` → `users`, which both sidebars merge in). See AUDIT
§5.1b-rationale for the full cost/benefit and the suggested follow-up.

### `rest-history-restore.test.js` — guards finding **5.2** (§8.8 spec S2)

`POST /:shortId/restore/:historyId` (`server/server.js:544-594`) now rejects with
404 unless `entry.documentId.equals(doc._id)`.

| # | Spec | Guards | Behaviour asserted |
|---|------|--------|--------------------|
| B1 | refuses a history entry that belongs to a different document | 5.2 | 400/404, no `success`, target byte-for-byte untouched |
| B2 | does not leak another document's content to an editor of the target document | 5.2 | the source document's confidential line is never readable through the target |
| D6 | owner can restore a history entry that belongs to their own document | over-block guard | 200 `{success:true}`, content reverts |
| D7 | a viewer-role collaborator cannot restore (403) | regression guard | 403 |
| D8 | an unauthenticated restore is rejected with 401 | regression guard | 401 |

B1 deliberately runs as the **owner of both documents**: that isolates the
missing `entry.documentId.equals(doc._id)` check from the ACL check, so a fix
that only tightened access control would still leave B1 red. B2 is the
confidentiality half — a legitimate editor of one document pulling another
owner's snapshot into a document they can read.

### `yjs-write-authorization.test.js` — guards finding **5.3** (§8.4 spec C3)

The connection now captures its authorized role once at connect
(`checkDocAccess(doc, user, 'editor')` → `canWrite`), and the `ws.on('message')`
handler drops `SyncStep2`/`Update` frames from a read-only connection before
they reach `readSyncMessage`. `SyncStep1` (a read) and awareness frames
(cursors, presence) still pass, so viewers keep working in the collaborator UI.

| # | Spec | Guards | Behaviour asserted |
|---|------|--------|--------------------|
| C1 | ignores document updates sent by a viewer-role collaborator | 5.3 | the owner's fragment stays empty — the viewer's paragraph never lands |
| D9 | accepts document updates from an editor-role collaborator | over-block guard | editor's text reaches the owner |
| D10 | refuses the WebSocket upgrade when no token is supplied | regression guard | handshake error (raw 401) |
| D11 | refuses the WebSocket upgrade for a user with no access to the document | regression guard | socket closed (1008) |

Not covered here: **viewer awareness must keep flowing**. Verified manually
against this database (viewer presence reaches the owner, viewer write blocked,
editor write reaches the viewer). Worth a spec when awareness gets its own file.

**Which harness was used — the honest answer.** This is a **real WebSocket
test**, not a unit test and not a placeholder. It boots the exported HTTP server
on an ephemeral port (`server.listen(0)`; the Yjs upgrade handler is attached to
that same server by `server.js:22`), connects genuine `ws` clients carrying real
JWTs obtained from `POST /api/auth/register`, and speaks the real
`lib0` / `y-protocols` sync protocol. Nothing is stubbed or re-implemented.

Server-side state is observed **through the protocol**: after the viewer sends
its frame, a second client connects as the document owner and the assertion runs
against the `SyncStep2` the server hands it. That deliberately avoids reaching
into `yjs-server.js` internals (`docs`, `roomConns`, the message handler
closure), so a fix is free to restructure them without breaking this spec.

Verified end to end: before the fix the viewer's paragraph was observed by the
owner (`fragment.length === 1`), reproducing finding 5.3 exactly; after the fix
the same spec observes `fragment.length === 0`.

---

## Out of scope for this directory

Deliberately **not** covered here — tracked elsewhere in `AUDIT.md` §8:

| Finding | Spec id | Where it belongs |
|---|---|---|
| 5.5 `PUT /comments/:id/resolve` has no ACL | S3 | a comments ACL spec |
| 5.6 `GET /:shortId/meta` has no ACL | S4 | a comments/meta ACL spec |
| 5.12 anonymous `POST /api/ai/rewrite` | S5 | `server/__tests__/ai.spec.js` |
| 5.8 unbounded REST payloads | S6 | `server/__tests__/limits.spec.js` |
| 5.13 anonymous public-access asymmetry | S7 | `server/__tests__/anon-access.spec.js` |
| 5.19 `chat-message` skips the rate limiter | S8 | `server/__tests__/chat-flood.spec.js` |
| 5.10 role demotion on an **already-open** socket | C6 | `e2e/role-revocation.spec.js` |

C6 still belongs elsewhere: `socket-join-authorization.test.js` covers role
resolution **at join time** (C6a–C6c). Finding 5.10 — a socket that is already in
the room keeping its cached role after a demotion — needs a live-session test and
a server-side fix (`role-changed` push, or a re-check per write).

There is also no spec asserting the status code for an **unknown** `shortId`.
That is intentional: whether the hardened route answers `404` or `403` for a
non-existent document is a policy decision Phase 2 has to make (a `404` leaks
existence, cf. finding 5.6), and a spec written now would lock in the wrong
answer.

---

## Files

| File | Role |
|------|------|
| `helpers.js` | Fixtures + the `describeWithDb` database gate. Not named `*.test.js`, so Jest's `testMatch` ignores it. |
| `rest-document-access.test.js` | Finding 5.1 (REST half) |
| `socket-join-authorization.test.js` | Finding 5.1b (socket half) |
| `rest-history-restore.test.js` | Finding 5.2 |
| `yjs-write-authorization.test.js` | Finding 5.3 |
