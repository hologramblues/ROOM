# Server access-control (ACL) regression specs

These specs are the **regression gate for the three CRITICAL findings** in
[`AUDIT.md`](../../../AUDIT.md) §5: `5.1`, `5.2` and `5.3`.

They encode the **correct post-fix behaviour**, not today's behaviour. The
negative specs therefore *fail* against the current server — that is the point.
They are `test.skip` by default so the suite stays green, and they flip to real
assertions the moment the ACL fix lands.

> **Do not weaken an assertion here to make it pass.** If one of these starts
> failing after the fix, the fix is incomplete — or has regressed.

---

## Running them

Every spec in this directory needs real `User` / `Document` / `HistoryEntry`
records, so the whole directory is gated on `TEST_MONGODB_URI` exactly like the
policy in [`TESTING.md`](../../../TESTING.md) §2 describes. Without it the three
suites report *skipped* and the runner still exits `0`.

```bash
# 1. DB-free (what CI runs today) — everything here is skipped, exit 0
cd server && npm test

# 2. With a database — positive paths run for real
mkdir -p /tmp/rooms-test-db && mongod --dbpath /tmp/rooms-test-db &
cd server && TEST_MONGODB_URI=mongodb://localhost:27017/rooms-test npm test

# 3. Prove the holes are still open — runs the expected-fail specs; exits 1 today
cd server && TEST_MONGODB_URI=mongodb://localhost:27017/rooms-test \
             ACL_EXPECT_FAIL=1 npm test
```

`ACL_EXPECT_FAIL=1` is the honesty switch: it turns every
`expectedFailUntilAclFix` spec from `test.skip` into `test`, so anyone can
verify in one command that the vulnerability is real rather than trusting a
comment. It is never set in CI.

The specs **never drop a database**. They create uniquely-suffixed fixtures and
delete exactly those records in `afterAll`, so pointing `TEST_MONGODB_URI` at a
scratch dev database cannot destroy unrelated data.

---

## Spec inventory

Legend — **status**:
`skipped-pending-fix` = encodes correct behaviour, fails today, `test.skip`.
`passing` = passes today and must keep passing after the fix (over-block guard);
runs only when `TEST_MONGODB_URI` is set, otherwise skipped with its suite.

### `rest-document-access.test.js` — guards finding **5.1** (§8.8 spec S1)

`GET /api/documents/:shortId` (`server/server.js:485`) has no ACL and answers
`role: 'editor'` for a user who was never invited (`server.js:497`).

| # | Spec | Guards | Status | Observed today |
|---|------|--------|--------|----------------|
| A1 | rejects a non-collaborator with 403 and leaks no document content | 5.1 | **skipped-pending-fix** | `Expected: 403 / Received: 200` — full body incl. `elements` returned |
| A2 | never advertises an editor role to a non-collaborator | 5.1 | **skipped-pending-fix** | `role: 'editor'` handed to a stranger |
| D1 | owner can read their own document | over-block guard | passing | 200, `isOwner: true`, `role: 'editor'` |
| D2 | explicit editor collaborator can read the document | over-block guard | passing | 200, `role: 'editor'` |
| D3 | explicit viewer collaborator can read the document, with viewer role | over-block guard | passing | 200, `role: 'viewer'` |
| D4 | unauthenticated request is rejected with 401 | regression guard | passing | 401 |
| D5 | a malformed token is rejected with 401 | regression guard | passing | 401 |

A2 also asserts the read is side-effect free (no collaborator row appears). That
half already holds today: the DB-level auto-add lives on the Socket.io join
path (`server.js:823`), which is AUDIT §8.6 spec C6's territory, not this file's.

### `rest-history-restore.test.js` — guards finding **5.2** (§8.8 spec S2)

`POST /:shortId/restore/:historyId` (`server/server.js:544-594`) does a bare
`HistoryEntry.findById()` and never compares `entry.documentId` to `doc._id`.

| # | Spec | Guards | Status | Observed today |
|---|------|--------|--------|----------------|
| B1 | refuses a history entry that belongs to a different document | 5.2 | **skipped-pending-fix** | `Expected [400,404] / Received 200` — target overwritten with the other doc's snapshot |
| B2 | does not leak another document's content to an editor of the target document | 5.2 | **skipped-pending-fix** | attacker reads the source document's confidential line through the target |
| D6 | owner can restore a history entry that belongs to their own document | over-block guard | passing | 200 `{success:true}`, content reverts |
| D7 | a viewer-role collaborator cannot restore (403) | regression guard | passing | 403 |
| D8 | an unauthenticated restore is rejected with 401 | regression guard | passing | 401 |

B1 deliberately runs as the **owner of both documents**: that isolates the
missing `entry.documentId.equals(doc._id)` check from the ACL check, so a fix
that only tightened access control would still leave B1 red. B2 is the
confidentiality half — a legitimate editor of one document pulling another
owner's snapshot into a document they can read.

### `yjs-write-authorization.test.js` — guards finding **5.3** (§8.4 spec C3)

`yjs-server.js:234` checks `viewer` once at connect; the `ws.on('message')`
handler at `:286` then feeds every `messageSync` frame into
`readSyncMessage(..., ydoc, null)` at `:296` with no role check.

| # | Spec | Guards | Status | Observed today |
|---|------|--------|--------|----------------|
| C1 | ignores document updates sent by a viewer-role collaborator | 5.3 | **skipped-pending-fix** | `Expected: 0 / Received: 1` — the viewer's paragraph is in the shared doc |
| D9 | accepts document updates from an editor-role collaborator | over-block guard | passing | editor's text reaches the owner |
| D10 | refuses the WebSocket upgrade when no token is supplied | regression guard | passing | handshake error (raw 401) |
| D11 | refuses the WebSocket upgrade for a user with no access to the document | regression guard | passing | socket closed (1008) |

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

Verified end to end: with `ACL_EXPECT_FAIL=1` the viewer's paragraph is observed
by the owner (`fragment.length === 1`), reproducing finding 5.3 exactly.

---

## How to flip a spec after the fix

1. Land the ACL fix.
2. Run `TEST_MONGODB_URI=... ACL_EXPECT_FAIL=1 npm test` — the previously red
   specs must now be green.
3. Replace `expectedFail(...)` with plain `test(...)` in that file and delete the
   `// EXPECTED FAIL until ...` comment above it.
4. When **all** of them are converted, delete `expectedFailUntilAclFix` from
   `helpers.js` and this section.

Do not delete a spec instead of converting it.

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
| 5.10 role demotion on a live socket | C6 | `e2e/role-revocation.spec.js` |

There is also no spec asserting the status code for an **unknown** `shortId`.
That is intentional: whether the hardened route answers `404` or `403` for a
non-existent document is a policy decision Phase 2 has to make (a `404` leaks
existence, cf. finding 5.6), and a spec written now would lock in the wrong
answer.

---

## Files

| File | Role |
|------|------|
| `helpers.js` | Fixtures + the `describeWithDb` / `expectedFailUntilAclFix` gates. Not named `*.test.js`, so Jest's `testMatch` ignores it. |
| `rest-document-access.test.js` | Finding 5.1 |
| `rest-history-restore.test.js` | Finding 5.2 |
| `yjs-write-authorization.test.js` | Finding 5.3 |
