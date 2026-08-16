# TESTING — ROOMS

How to run the automated tests, what each layer is responsible for, and what
still needs a one-time setup step.

This document describes the **toolchain**, which is bootstrapped and green.
The full non-regression spec list is enumerated in [`AUDIT.md`](AUDIT.md) §8.

Beyond the original smoke specs, two real layers have landed: the **client
editor specs** (typing, tab-cycle, parens, backspace) and the **server ACL
gate** (`server/__tests__/acl/`) that guards AUDIT findings 5.1 / 5.2 / 5.3.
⚠️ **The ACL gate needs a running MongoDB and skips itself silently without
one** — see §2 before trusting a green `cd server && npm test`.

---

## TL;DR

```bash
# Client — unit + integration (jsdom).  5 suites, 55 passed / 6 skipped
cd client && npm run test:ci

# Server — smoke only, DB-free.  ⚠️ silently SKIPS all 16 ACL specs
cd server && npm test

# Server — the real ACL gate.  Needs a MongoDB; 4 suites, 20 passed
cd server && TEST_MONGODB_URI="mongodb://127.0.0.1:27017/rooms-test" npm test

# E2E — browser (Playwright); needs a one-time browser install
cd e2e && npm install && npm test
```

| Layer | Location | Runner | Needs a DB? | Needs browsers? | Runtime | In CI? |
|-------|----------|--------|-------------|-----------------|---------|--------|
| Client unit/integration | `client/src/__tests__/` | Jest (via `craco test`) + React Testing Library | No | No | ~0.5 s | Yes |
| Server smoke | `server/__tests__/smoke.test.js` | Jest + supertest | No | No | ~3.5 s | Yes |
| Server **ACL gate** (findings 5.1/5.2/5.3) | `server/__tests__/acl/` | Jest + supertest + real `ws` client | **Yes — skips silently without one** | No | ~3.8 s | **No** (no `services: mongo:` in the workflow) |
| E2E / multi-tab collab | `e2e/` | Playwright | Yes, once specs are real | Yes, one-time install | n/a (skipped) | Not yet |

Every command in this document was executed and its exit code checked before the
document was written.

---

## 1. Client layer — unit + integration

**Location:** `client/src/__tests__/` &nbsp;•&nbsp; **Smoke spec:** `client/src/__tests__/smoke.test.js`

```bash
cd client
npm test        # watch mode, for local development
npm run test:ci # single run, non-watch — this is what CI runs
```

`test:ci` is deliberately **not** given `--passWithNoTests`: an empty suite must
exit `1`, so deleting a spec or breaking the `testMatch` glob turns CI red
instead of silently green. Verified: with the smoke spec moved aside,
`npm run test:ci` prints `No tests found, exiting with code 1`.

### Why Jest and not Vitest

`AUDIT.md` §8 suggested "Vitest **or** Jest via CRA's built-in support". We chose
CRA's built-in Jest deliberately: `react-scripts` already ships and configures
Jest, Babel and jsdom, and `craco test` already existed as a script. Adding
Vitest would have meant a second toolchain, a second transform pipeline and a
second config to keep in sync with `craco.config.js` — for no gain. **Zero new
runner dependencies were needed.**

### What was actually added

- `test:ci` npm script (`craco test --watchAll=false`).
- `@testing-library/dom@^10.4.1` as a devDependency. This was a genuine latent
  gap: `@testing-library/react` v16 declares `@testing-library/dom` as a *peer*
  dependency rather than bundling it, so the very first test run failed with
  `Cannot find module '@testing-library/dom'`. Nothing else was missing.

### What was removed

`client/package.json` had two pre-existing dangling scripts, `e2e`
(`playwright test`) and `e2e:ui`, plus a `@playwright/test` devDependency —
but no `playwright.config.*` in `client/`. They found nothing before; once a
Jest spec existed under `src/__tests__/`, Playwright started scanning the cwd,
picked that spec up and crashed parsing Jest syntax. The E2E layer is
self-contained in [`e2e/`](e2e/) with its own config and its own
`@playwright/test`, so both scripts and the duplicate dependency were removed.
Net effect on `client/package-lock.json`: **5 dev packages added**
(`@testing-library/dom` + 4 transitives), **4 removed** (the `@playwright/*`
tree), **0 production versions changed**.

`client/src/setupTests.js` already imported `@testing-library/jest-dom`, so
jest-dom matchers work out of the box. No file under `client/src/` was modified.

### Conventions

- Jest picks up **any** file under `src/**/__tests__/` plus `*.test.js` /
  `*.spec.js` anywhere in `src/`. Because the first pattern matches *every* file
  in a `__tests__` directory, put shared helpers and fixtures in
  `src/__tests__/helpers/` only if they are also valid test files — otherwise
  keep them outside `__tests__` (e.g. `src/test-utils/`).
- The smoke spec renders an inline component rather than `App.jsx`, so it stays
  green while the app is being refactored.

### What this layer covers

From `AUDIT.md` §8 — everything that runs in jsdom:

§8.1 editor typing state machine (E1–E14) • §8.2 autocomplete (E15–E18) •
§8.3 local undo/redo (E19–E20) • §8.7 client auth (A1, A8) • §8.9 export
round-trips (F2, F3, F5, F6) • §8.10 pagination (P1–P4) • §8.11 comment offset
drift (CO3) • §8.12 search, clipboard, theme, zoom, templates, timer, chat
isolation (M1–M8).

---

## 2. Server layer — API

**Location:** `server/__tests__/` &nbsp;•&nbsp; **Smoke spec:** `server/__tests__/smoke.test.js`

```bash
cd server
npm test
```

### What was added

- `jest@^29` and `supertest@^7` as devDependencies.
- A `jest` block in `server/package.json` (`testEnvironment: "node"`).
- The `test` script: `jest --runInBand --forceExit`.

Installing those pulled in 286 dev packages and, unavoidably, **bumped three
already-present transitive packages by a patch version**:

| Package | Before | After | Forced by |
|---------|--------|-------|-----------|
| `hasown` | 2.0.2 | 2.0.4 | `form-data@4.0.6` (← supertest → superagent) requires `^2.0.4` |
| `side-channel` | 1.1.0 | 1.1.1 | `qs@6.15.3` (← superagent) requires `^1.1.1` |
| `side-channel-list` | 1.0.0 | 1.0.1 | `side-channel@1.1.1` requires `^1.0.1` |

These are **not** avoidable resolution drift — pinning them back was attempted
and produces a semver-invalid tree, because `form-data@4.0.6` genuinely refuses
`hasown@2.0.2`. They are hoisted, so the production tree sees them too; both
production consumers accept the newer versions (`get-intrinsic` wants
`hasown ^2.0.2`, `qs` wants `side-channel ^1.1.0`). All direct production pins
are byte-identical: express 4.22.1, mongoose 8.20.2, socket.io 4.8.1,
jsonwebtoken 9.0.3, bcryptjs 2.4.3, yjs 13.6.30, ws 8.20.0, cors 2.8.5,
uuid 9.0.1, y-mongodb-provider 0.2.1, express-rate-limit 8.2.1,
@anthropic-ai/sdk 0.71.2. Nothing was removed or downgraded.

### The one change to `server.js`

`server.js` called `server.listen()` at module scope, so any `require()` of it
would bind port 3001 and fight with supertest. The **only** modification made
was a listen guard plus an export at the very bottom of the file:

```js
if (require.main === module) {
  server.listen(PORT, () => console.log('Server running on port ' + PORT));
}

module.exports = { app, server, io };
```

`npm start` behaves exactly as before. Nothing else in `server.js` was touched.

### Database decision: no DB by default, opt-in when needed

`AUDIT.md` §8 suggested `mongodb-memory-server`. **It was evaluated and rejected
as the default**, on measured evidence:

| | Result |
|---|---|
| `npm install mongodb-memory-server` | 53 s, 49 extra packages |
| mongod binary downloaded into `node_modules/.cache/` | **141 MB** |
| Boot time once the binary is cached | 2.6 s |

It *works* on this machine, but it puts a 141 MB arch-specific binary download
on the critical path of every fresh checkout and every cold CI run — the classic
source of "the test suite is broken and nobody knows why" (proxy blocks, CDN
outages, musl/Alpine mismatches). That is a bad trade for a suite whose job is to
catch regressions quickly.

**The approach used instead is tiered:**

1. **Default — no database.** The smoke spec asserts only on code paths that
   return *before* touching Mongo:
   - `POST /api/waitlist` with a malformed email → `400` (validation runs ahead
     of any query, and still exercises cors → JSON body parser → rate limiter →
     route handler),
   - an unknown route → `404`,
   - `/api/health` → `503` with `{status:'error'}`, proving the handler degrades
     cleanly instead of hanging.

   The suite sets `mongoose.set('bufferTimeoutMS', 1000)` so an absent database
   fails fast rather than buffering for the default 10 s.

2. **Opt-in — a real database**, via a single environment variable:

   ```bash
   # 1. start a mongod if one is not already running (dbpath must exist)
   mkdir -p /tmp/rooms-test-db && mongod --dbpath /tmp/rooms-test-db &

   # 2. run the suite against it
   cd server && TEST_MONGODB_URI=mongodb://localhost:27017/rooms-test npm test
   ```

   > ### ⚠️ The ACL gate lives behind this variable
   >
   > `server/__tests__/acl/` holds the **16 specs that guard AUDIT findings
   > 5.1 / 5.2 / 5.3**. They are wrapped in `describeWithDb()`, which degrades to
   > `describe.skip` when `TEST_MONGODB_URI` is unset. The practical consequence:
   >
   > ```text
   > $ cd server && npm test                 # NO database
   > Test Suites: 3 skipped, 1 passed, 1 of 4 total
   > Tests:       16 skipped, 4 passed, 20 total     ← exit 0, ACL never ran
   >
   > $ cd server && TEST_MONGODB_URI=... npm test    # WITH a database
   > Test Suites: 4 passed, 4 total
   > Tests:       20 passed, 20 total                ← the real gate
   > ```
   >
   > **A green `npm test` is not evidence the ACL fixes hold.** Always pass
   > `TEST_MONGODB_URI` when validating security work. To run only that suite:
   >
   > ```bash
   > cd server && TEST_MONGODB_URI="mongodb://127.0.0.1:27017/rooms-test" \
   >   npx jest __tests__/acl --runInBand --forceExit
   > ```
   >
   > The specs **never drop a database**: they create uniquely-suffixed fixtures
   > and delete exactly those records in `afterAll`, so pointing the variable at a
   > scratch dev database cannot destroy unrelated data. `ACL_EXPECT_FAIL` — the
   > old "honesty switch" that un-skipped the expected-fail specs before the fixes
   > landed — has been **removed**; setting it now does nothing.

   When set, `/api/health` is asserted to return `200` with live counts.
   **Verified by running the two commands above verbatim against a throwaway
   `mongod`:** exit 0, 4 passed, whole suite in 0.57 s, `/api/health` answering
   in ~16 ms on the `200` branch against database `rooms-test`. This is the door for
   the DB-backed ACL and auth specs (§8.7 A2–A7, §8.8 S1–S8). A local `mongod`
   binary exists at `/opt/homebrew/bin/mongod` on this machine but is **not
   running** by default.

   > **How the single variable works — and why it must stay that way.**
   > `server.js:18-19` calls `mongoose.connect(MONGODB_URI)` at module scope on
   > the *default* mongoose connection. Mongoose 8 throws *"Can't call
   > openUri() on an active connection with different connection strings"* if
   > anything then connects that same default connection to a different URI.
   > So the spec must **not** open its own second connection.
   > Instead, before `require('../server')` it does:
   >
   > ```js
   > if (process.env.TEST_MONGODB_URI) {
   >   process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
   > }
   > const { app } = require('../server');
   > ```
   >
   > — pointing the app itself at the test database, so there is exactly one URI
   > and one connection. `beforeAll` then merely awaits
   > `mongoose.connection.asPromise()`. **New DB-backed specs must keep this
   > ordering**: set the env var before requiring the server, never call
   > `mongoose.connect()` yourself.
   >
   > If `TEST_MONGODB_URI` is set but nothing is listening, the await is raced
   > against a 10 s timer that fails with an explicit message
   > (`...but no MongoDB answered within 10s`) rather than an anonymous Jest
   > timeout.

   If a future CI runner has no Mongo at all, `mongodb-memory-server` can be
   added *at that point* and simply pointed at `TEST_MONGODB_URI` — the specs do
   not need to change.

### Why `--forceExit`

Requiring `server.js` starts a mongoose connection, the Socket.io engine and the
Yjs `MongodbPersistence` provider, all of which hold timers open. `--forceExit`
stops Jest hanging after a passing run. Relatedly, the `afterAll` hook races
`mongoose.connection.close()` against a 2 s timeout: with no MongoDB running the
connection sits in state `2` ("connecting") retrying forever and `close()` never
settles.

### What this layer covers

**Landed and passing** (all need `TEST_MONGODB_URI`): §8.8 S1 REST document
access (finding 5.1) • §8.8 S2 history-restore cross-document isolation
(finding 5.2) • §8.4 C3 Yjs write authorization (finding 5.3) — 16 specs in
`server/__tests__/acl/`, including the D1–D11 over-block guards that prove the
fixes did not lock out legitimate owners, editors and viewers.

**Not yet written**: §8.7 auth endpoints (A2–A7) • the rest of §8.8 (S3–S8) •
§8.9 F1 FDX import • §8.6 C6 — the Socket.io `join-document` auto-add, which is
the untested half of finding 5.1 (see AUDIT.md finding 5.1b).

---

## 3. E2E layer — Playwright

**Location:** `e2e/` &nbsp;•&nbsp; **Smoke spec:** `e2e/smoke.spec.js` (skipped)

```bash
cd e2e
npm install
npm test
```

Installed as a self-contained package (`e2e/package.json`) with
`@playwright/test@^1.58.2`, rather than in the root `package.json` — the root
package is the Electron desktop app and mixing E2E deps into it would be noise.
This is also the **only** place Playwright lives now; the unused copy and the
`e2e` / `e2e:ui` scripts in `client/package.json` were removed (see §1).

### ⚠️ Browsers are NOT installed

This is the one outstanding manual step. `npm install` in `e2e/` skips the
browser download (~150 MB per browser). Before un-skipping any spec:

```bash
cd e2e && npm run install:browsers   # playwright install chromium
```

> A Playwright browser cache already exists at `~/Library/Caches/ms-playwright`
> on the current dev machine, so this may be instant there. On a fresh machine or
> in CI it is a real download.

`e2e/smoke.spec.js` is marked `test.skip`, so `npm test` today reports
`1 skipped` and exits 0 **without** browsers — the config and runner are
verified, the browser dependency is not yet incurred.

### App under test

`webServer` is commented out in `e2e/playwright.config.js` on purpose: booting
`server/server.js` requires MongoDB, so enabling it would break `playwright test`
on any machine without a database — even for skipped specs. Start the stack
manually for now (`cd server && npm start`, `cd client && npx craco start`), or
set `E2E_BASE_URL`.

### What this layer covers

The scenarios jsdom cannot express — above all two real browser contexts on one
Yjs WebSocket server: §8.3 E21 collab undo • §8.4 C1–C7 multi-tab collab •
§8.5 O1–O4 offline/reconnect • §8.6 C5–C6 cross-document leak • §8.9 F4 PDF
export • §8.11 CO1/CO2/CO4/CO5 comments and suggestions.

---

## 4. Continuous integration

**File:** [`.github/workflows/test.yml`](.github/workflows/test.yml)

Before this, nothing ran the suites automatically. The workflow runs on pushes
to `main`, on every pull request, and on manual dispatch, in two parallel jobs:

| Job | Steps |
|-----|-------|
| `client` | `npm ci` → `npm run test:ci` → `npx craco build` (the golden rule, guarded) |
| `server` | `npm ci` → `npm test` (DB-free) |

Both jobs use Node 20 with npm caching keyed on the respective lockfile. Both
lockfiles were checked with `npm ci --dry-run`, which succeeds — so CI will not
trip on a lock/manifest mismatch.

The E2E layer is intentionally **not** in CI yet: every spec is skipped, and
un-skipping requires both a Playwright browser download and a live MongoDB. Add
a third job when the first real E2E spec lands. Likewise, when the DB-backed
server specs (§8.7 A2–A7, §8.8 S1–S8) arrive, add a `services: mongo:` block to
the `server` job and set `TEST_MONGODB_URI` there — no spec changes needed.

> The workflow YAML was parse-checked locally, but GitHub Actions has not
> executed it yet (it lands with this change). Until the first run on
> `origin/main` goes green, treat the local commands above as the source of
> truth.

---

## Outstanding setup

| Item | Needed for | Command |
|------|-----------|---------|
| Playwright browsers | Any un-skipped E2E spec | `cd e2e && npm run install:browsers` |
| A MongoDB instance | **The 16-spec ACL gate** (5.1/5.2/5.3) + DB-backed specs (§8.7, §8.8) | run `mongod`, then `TEST_MONGODB_URI=... npm test` |
| `services: mongo:` in CI | Making the ACL gate actually run on push/PR — **today CI exercises none of it** | add the block to the `server` job in `.github/workflows/test.yml` and set `TEST_MONGODB_URI` |
| `webServer` in Playwright config | Automated E2E boot | uncomment once a DB fixture exists |
| First green Actions run | Confidence CI works | push to `main` / open a PR |

## Production build

The client production build is unaffected by any of the above and must keep
passing — it is also step 3 of the `client` CI job:

```bash
cd client && CI=true npx craco build
```
