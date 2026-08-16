# ROOMS Phase 0 Audit
_Generated during Phase 0 workflow_

---

## 1. Executive summary

- **Three simultaneous sources of truth** for document content (React `elements` state, Yjs `Y.Doc`, MongoDB `Document.elements[]`) are only loosely reconciled — several concrete data-loss and corruption scenarios exist (offline edits discarded, undo/redo no-op, cross-doc snapshot restore). This is the single biggest architectural risk.
- **CLAUDE.md has drifted from reality**: it still describes Socket.io element diffs (the code moved to Yjs CRDT), understates hook/component counts, and treats BeatBoard (`ENABLE_BEATBOARD=false` in `client/src/constants/config.js:6`) as live functionality. The doc claims `elementsRef.current = elements` is an inline pattern, but `App.jsx:249-256` declares the refs with `useRef(elements)` (correct) and `App.jsx:258-289` syncs them via `useEffect` (lags one render).
- **Access control is broken in three critical places**: `GET /api/documents/:shortId` (`server/server.js:485`) has no ACL and silently auto-promotes any authenticated visitor to `editor`; `POST /restore/:historyId` (`server/server.js:544`) never verifies the history entry belongs to the target doc; the Yjs WebSocket authorizes `viewer` at connect and then accepts every subsequent write (`server/yjs-server.js:234,286`).
- **Ship-as-is candidates** (mature and safe): Comments + Suggestions workflow, PDF/FDX/Fountain export, Templates, Writing Timer/Goals, Search & Replace, Dark mode, Zoom, Multi-block clipboard, Character panel, Import FDX. These features have clean hooks, small blast radius, and no data-integrity dependencies on the collab layer.
- **Biggest opportunistic wins for Phase 1** (each low-risk, high-value): delete BOTH stale backend orphans — root-level `/Users/jeremiegalan/screenflow/server.js` (789-line V8 "Waitlist" clone, finding 4.26) and `client/server.js` (627-line V2 clone, finding 4.25); delete the empty `backend/` and `src/` directories at the repo root; delete `remoteCursorPlugin.js`, `useTypewriterSound` (inert — `setTypewriterSound` never called), and other dead code; remove the ~25 `[EDITOR]`/`[YJS]`/`[YJS-HOOK]`/`[Backspace]` `console.log` lines still in the hot editor path; fix the two access-control REST holes; add `resyncInterval` to `WebsocketProvider`; add `documentId` check to the restore route.
- **Product-completeness gaps** that block real onboarding: no `DELETE /api/documents/:shortId` route (owners cannot delete their own content — finding 5.23), no password-reset flow (finding 5.24), no email verification on register (finding 5.25). Address in Phase 2 alongside REST hardening.
- **Scale ceiling today = one instance**: Socket.io uses the in-memory adapter default and Yjs rooms are per-instance `Map`s, so a second Railway replica would silently split-brain. Any horizontal scale-out needs a Redis adapter + sticky-session-or-shared-pubsub milestone (rank-12 debt, Phase 6). Also, `constants/config.js:2` hardcodes `SERVER_URL` as a string literal — no `REACT_APP_SERVER_URL` env var exists — which is what `App.jsx:136`'s runtime reassignment is working around.
- **Zero automated tests exist today** (no `client/src/__tests__/`, no `server/__tests__/`, no `e2e/`). §8 prescribes the suite Phase 0 wants to see built — Phase 1 must first bootstrap the toolchain (Vitest / RTL / Playwright / supertest) before any spec can run.

---

## 2. Actual architecture

### 2.1 Repo-root housekeeping cruft (outside `client/`, `server/`, `electron/`)

Two full production-shaped backend clones and two empty directories sat at the repo root, all outside the tree that CLAUDE.md documents. **All four were REMOVED in Phase 1** (verified: `ls backend src` → "No such file or directory"; `grep` for `node server.js` / `client/server.js` across the tree returns only AUDIT prose, no live reference):

```
/Users/jeremiegalan/screenflow/
  server.js                              # ✅ REMOVED in Phase 1 — was a 789-line "// Server V8 - Added Waitlist feature" Express+Socket.io+Mongoose backend clone. `require('./models')` and `require('./auth')` at lines 9-10 pointed to root-level files that did not exist (models.js / auth.js live under server/), so `node server.js` from the repo root failed immediately with MODULE_NOT_FOUND. Was not referenced by any package.json script (root `package.json` scripts are `electron:*` only; `main: electron/main.js`). See finding 4.26
  backend/                               # ✅ REMOVED in Phase 1 — was empty apart from `.DS_Store` and a stale `node_modules/`
  src/                                   # ✅ REMOVED in Phase 1 — was empty apart from `.DS_Store`. Unrelated to `client/src/`
  package.json                           # Real root package: `main: electron/main.js`, scripts `electron:dev`/`electron:start`/`electron:build`/`postinstall`. Did NOT reference root server.js, so its deletion changed no script
```

> `client/server.js` (the 627-line legacy V2 clone, finding 4.25) was **REMOVED in Phase 1** as well.

### 2.2 Client (React 19 SPA)

Entry: `client/src/index.js:1` — CRA-style bootstrap through `react-dom/client`, `React.StrictMode`, no routing / providers / error boundary.

```
client/
  server.js                              # DEAD — 627-line stale V2 Express+Socket.io+Mongoose backend clone; starts "// Server V2 - Added autosave and snapshot endpoints" (line 1), listens on process.env.PORT || 3001 (line 626-627). Not referenced by client/package.json, not part of CRA build. Delete candidate — see finding 4.25 and Phase 1 step 8. Paired with the root-level 789-line server.js orphan documented in §2.1 (finding 4.26)
  craco.config.js                        # Webpack overrides for roughjs/excalidraw
  package.json                           # react 19, @tiptap v3, yjs, y-websocket, socket.io-client
  src/
    index.js                             # entry
    App.jsx                              # 1833 lines (CLAUDE.md says 1689) — orchestrator
    App.css
    index.css
    constants/                           # 5 files
      config.js                          # SERVER_URL (let), CLOUD_URL (same host), ENABLE_BEATBOARD=false, IS_DESKTOP
      elementTypes.js                    # SP_NEXT_TYPE / SP_TAB_FWD/REV, PAGE_FORMATS (us-letter=55, a4=63)
      fonts.js
      templates.js                       # 230 lines, SCRIPT_TEMPLATES
      translations.js                    # 617 lines, FR/EN
    extensions/                          # 7 files (CLAUDE.md says 5)
      ScreenplayElement.js               # 264 lines — screenplay node + tab/enter/backspace commands
      CommentMark.js                     # inline yellow style (theme-blind)
      SuggestionMark.js                  # BROKEN: injects sibling span with text inside mark body
      ExternalSpanMark.js                # UNDOCUMENTED — permissive mark to swallow Grammarly/LT
      pageBreakPlugin.js                 # widget decorations
      sceneLockPlugin.js                 # filterTransaction blocking locked-scene edits
      remoteCursorPlugin.js              # ✅ REMOVED in Phase 1 — was dead, no importers (superseded by CollaborationCaret)
    hooks/                               # 21 files after Phase 1 (was 22; CLAUDE.md still says 20 and still lists useTypewriterSound — stale, see note below)
      # DOCUMENTED IN CLAUDE.md (20):
      useAutoSave, useDocumentLoader, useSocketConnection, useTimer,
      useTypewriterSound (✅ REMOVED in Phase 1 — was inert dead code: `setTypewriterSound` was never called anywhere in `client/src/`, so `useState(false)` never flipped, the keydown listener was never registered, and the audio refs were `null` regardless. Its destructure in `App.jsx` went with it),
      useStats, useWritingGoals, useSearch,
      useUndoRedo (DEAD w/ Yjs — see finding 4.3), useChat, useOfflineMode,
      useKeyboardShortcuts, useExportHandlers, useAIRewrite, useMultiBlockClipboard,
      useScrollSync, useHighlights, useElementPositions, usePageBackgrounds, useDragSelect
      # NEW & UNDOCUMENTED IN CLAUDE.md:
      useCloudSync                       # desktop cloud push/pull
      useYjsProvider                     # Y.Doc + y-websocket + JWT via query param
    components/                          # 24 root + 7 BeatBoard subs = 31 total (see ls output)
      SingleEditor.jsx                   # 505 lines
      HeaderBar.jsx                      # 575 lines
      OutlineSidebar.jsx                 # 621 lines
      CommentsSidebar.jsx                # 1030 lines
      InlineComment.jsx                  # 582 lines
      SyncConfirmModal.jsx               # UNDOCUMENTED in CLAUDE.md
      BeatBoard/
        index.jsx                        # 409 lines — GATED, never renders
        BeatBoardCanvasView.jsx          # 485 lines
        BeatBoardGridView.jsx            # 353 lines
        BeatBoardSceneStrip.jsx          # 197 lines
        BeatBoardToolbar.jsx             # 245 lines
        BeatCard.jsx                     # 142 lines
        BeatCardEditModal.jsx            # 179 lines
      # 18 other components: LandingPage, ShareModal, TemplateModal, AIRewriteModal, etc.
    utils/
      helpers.js                         # buildDocFromElements strips inline marks (finding 4.17)
      importFDX.js                       # 112 lines
```

**Discrepancies vs CLAUDE.md**:

| Claim in CLAUDE.md | Reality (file:line) |
|---|---|
| "V272 Stable — Single TipTap editor" (Socket.io sync implied) | Yjs CRDT is authoritative; Socket.io kept for metadata only (`useSocketConnection.js:7-13`) |
| "20 hooks" | 22 hooks in `hooks/` (adds `useCloudSync`, `useYjsProvider`) |
| "25 components" | 24 root + 7 BeatBoard subs = 31 (verified via `ls components/*.jsx` and `ls components/BeatBoard/*.jsx`) |
| "5 extensions" | 7 files under `extensions/` |
| App.jsx = 1689 lines | 1833 lines (`wc -l`); 82 `useState(` calls, 18 `useEffect(` calls |
| "elementsRef.current = elements" inline sync | Refs declared inline at `App.jsx:249-256`; **synced via `useEffect` at `App.jsx:258-289`** — the effect-based sync lags one render, which is the actual defect |
| BeatBoard as live functionality | Hard-disabled: `ENABLE_BEATBOARD = false` in `constants/config.js:6` |
| No mention of `client/server.js` | 627-line stale V2 Express+Socket.io+Mongoose backend clone shipped under `client/` — unreferenced by `client/package.json` and never touched by the CRA build. Pure dead legacy code (see finding 4.25) |
| A4-only pagination (`LINES_PER_PAGE = 63`) | `PAGE_FORMATS` supports both us-letter (55) and a4 (63) (`elementTypes.js:52-72`) |
| No mention of Yjs | Full CRDT provider layer (`hooks/useYjsProvider.js`, `server/yjs-server.js`) |

### 2.3 Server (Express + Socket.io + Yjs WebSocket + Mongoose, with SQLite fork)

```
server/                                  # Production (Railway)
  server.js                              # 1213 lines — Express + Socket.io
  yjs-server.js                          # Yjs WebSocket, mounts on /yjs/* via HTTP upgrade
  models.js                              # User, Document, HistoryEntry + subdoc schemas
  auth.js                                # JWT (7d), bcrypt(10), 3 middlewares
  package.json                           # y-websocket declared but unused (yjs-server uses ws directly)

electron/                                # Desktop (better-sqlite3 fork)
  main.js                                # 170 lines — spawns local-server on random port
  local-server.js                        # 820 lines — DIVERGENT: NO Yjs, still runs legacy Socket.io sync (finding 5.2)
  local-models.js                        # 479 lines — Mongoose-shim over SQLite
  database.js                            # SQLite init
  menu.js
  preload.js                             # electronAPI bridge
```

**REST inventory (25 routes, `server/server.js`)**:

| Method | Path | Auth | Line |
|---|---|---|---|
| GET | /api/health | none | 91 |
| POST | /api/waitlist | none | 106 |
| GET | /api/waitlist/count | none | 146 |
| GET | /api/waitlist | admin | 156 |
| GET | /api/waitlist/export | admin | 174 |
| DELETE | /api/waitlist/:email | admin | 206 |
| POST | /api/documents | auth | 252 |
| POST | /api/documents/import | auth | 270 |
| PUT | /api/documents/:shortId/bulk | optional | 304 |
| PUT | /api/documents/:shortId/autosave | optional | 359 |
| POST | /api/documents/:shortId/snapshot | auth | 404 |
| GET | /api/documents | auth | 469 |
| GET | /api/documents/:shortId/meta | auth (no ACL) | 477 |
| GET | /api/documents/:shortId | auth (no ACL) | 485 |
| PUT | /api/documents/:shortId/public-access | owner | 522 |
| GET | /api/documents/:shortId/history | ACL | 535 |
| POST | /api/documents/:shortId/restore/:historyId | ACL (broken) | 544 |
| POST | /api/ai/rewrite | optional | 598 |
| POST | /api/documents/:shortId/comments | ACL | 659 |
| POST | /api/documents/:shortId/comments/:commentId/replies | ACL | 683 |
| DELETE | /api/documents/:shortId/comments/:commentId | ACL | 704 |
| PUT | /api/documents/:shortId/comments/:commentId/resolve | (no ACL) | 718 |
| PUT | /api/documents/:shortId/comments/:commentId | ACL | 732 |
| POST | /api/auth/register | none | auth.js:63 |
| POST | /api/auth/login | none | auth.js:79 |
| GET | /api/auth/me | auth | auth.js:92 |

**Socket.io handlers**: 9 live (`join-document`, `title-change`, `comment-add`, `suggestion-add`, `suggestion-accept`, `suggestion-reject`, `chat-message`, `cursor-move`, `disconnect`) + 5 zombie handlers (`element-change`, `element-type-change`, `element-insert`, `element-delete`, `full-sync`) gated behind `LEGACY_SOCKET_SYNC=true` (`server/server.js:26`). Zombies early-return with a warning by default.

**Yjs WebSocket** (`server/yjs-server.js`): JWT via `?token=` query param, per-doc `Y.Doc` lazy-loaded via `y-mongodb-provider` (collection `yjs-documents`, flushSize 100), disaster-recovery snapshots every 5 min (max 20 per doc, `YjsSnapshot` inline model at line 35), room sweep every 30s destroying rooms empty >60s.

**Environment variables**: `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV`, `LEGACY_SOCKET_SYNC`, `ANTHROPIC_API_KEY`, `ADMIN_SECRET`, `PORT`. No env vars for snapshot cadence, room grace, or Anthropic model — the model id `claude-sonnet-4-20250514` is hardcoded at `server/server.js:613` (see finding 5.20 for the deprecation-risk implication).

### 2.4 Dependency snapshot (no CVE scan run)

Notable versions worth flagging (from `client/package.json` and `server/package.json`):

- `react` / `react-dom` `^19.2.1` — React 19 is very new; many third-party libraries have not yet published compatible releases.
- `@tiptap/*` `^3.13.0` — TipTap v3 is a recent major (breaking changes vs v2; `CollaborationCaret` replaces `CollaborationCursor`, see recent commit `25943a2`).
- `y-websocket` `^3.0.0` (client + server) — server actually uses raw `ws`; the client dep is real.
- `socket.io` `^4.7.2` (server) / `socket.io-client` `^4.8.1` (client) — minor drift between server/client majors within v4.
- `@testing-library/react` `^16.3.2` is declared, but no `__tests__/` directories exist anywhere in the tree — the dep is currently dead weight.

`npm audit` was NOT run in Phase 0. Phase 1 should run `npm audit --production` on both `client/` and `server/` and record CVE-affected transitive deps before locking versions.

---

## 3. Feature inventory

| Feature | Status | Evidence (file:line) | Notes |
|---|---|---|---|
| Editor (TipTap + ScreenplayElement) | works | `components/SingleEditor.jsx:1`, `extensions/ScreenplayElement.js:1` | Rebuilt on every `yjsSynced` flip — loses focus/selection (finding 4.22) |
| Element typing state machine (Enter/Tab/Backspace) | works | `extensions/ScreenplayElement.js:100-260` | Backspace on non-empty character merges instead of demoting (finding 4.21) |
| Autocomplete (character/location) | fragile | `components/SingleEditor.jsx:191-260,410-500` | Fixed-position popup ignores CSS `zoom` (finding 4.19); location filter case-sensitive against mixed-case list |
| Comments (threaded, resolve, reply, delete, edit) | works | `hooks/useHighlights.js:1`, `components/CommentsSidebar.jsx:1` | 1030-line sidebar; multi-element spans supported |
| Suggestions (accept/reject) | fragile | `extensions/SuggestionMark.js:30`, `App.jsx:1508-1561` | Mark output injects uneditable sibling span — corrupts inline offsets and can leak (finding 4.17) |
| @Mentions in comments | works | `components/CommentsSidebar.jsx:60-100`, `components/InlineComment.jsx:415` | Purely textual, no notification/inbox |
| Outline sidebar (reorder, lock, assign) | works | `components/OutlineSidebar.jsx:1`, `App.jsx:934-982` | `handleOutlineDrop` leaves an empty socket-emit branch (App.jsx:979) |
| Scene locking | works | `extensions/sceneLockPlugin.js:1` | `filterTransaction` is O(steps × ranges × nodes) per keystroke |
| Characters panel | works | `components/CharactersPanel.jsx:1`, `hooks/useStats.js:139-152` | Rename runs a bulk `elements.map` (App.jsx:800-820); no dedicated socket sync |
| Notes per element | **fragile** | `App.jsx:862-883`, `hooks/useAutoSave.js:106` | State only — autosave omits `notes`, no server schema field, no socket handler. Lost on cache clear |
| Writing timer / sprints | works | `hooks/useTimer.js:1`, `components/WritingTimerWidget.jsx:1` | data-URI wav + `alert()` on sprint end |
| Writing goals | works | `hooks/useWritingGoals.js:1` | localStorage `rooms-writing-goal` |
| Stats panel | works | `hooks/useStats.js:1`, `components/StatsPanel.jsx:1` | 300 ms debounce |
| Search / replace | works | `hooks/useSearch.js:1` | `new RegExp(q, 'i')` on plain-stripped content |
| Chat | works | `hooks/useChat.js:1`, `components/ChatPanel.jsx:1` | WebAudio notification; **localStorage-only per docId** (`useChat.js:75-90`) — no server persistence, so leaks to any operator/support user who signs into the same browser and joins the room, and is lost on cache clear. See finding 5.22 |
| Export PDF | works | `hooks/useExportHandlers.js` | Opens window + `print()` after 500 ms |
| Export FDX / Fountain / TXT / Markdown | works | `hooks/useExportHandlers.js` | Uses `TYPE_TO_FDX` |
| Import FDX | works | `utils/importFDX.js:1`, `App.jsx:1147` | Auto-opens AuthModal if no token |
| Templates | works | `constants/templates.js:1`, `App.jsx:496-524` | `templateAppliedRef` guards single-shot |
| History (snapshots + restore) | fragile | `hooks/useAutoSave.js:140`, `App.jsx:646-678` | Auto-snapshot every 15 min. Restore has cross-doc bug (finding 5.2) |
| Landing waitlist | **fragile** | `server/server.js:29-222`, `components/LandingPage.jsx:1` | Server complete; **client UI never calls it** — no email capture form |
| Share modal + publicAccess | works | `components/ShareModal.jsx:1`, `App.jsx:994-1038` | Auto-enables public access on first open by owner |
| Dark mode | works | `App.jsx:109` | Not persisted to localStorage |
| Zoom (footer slider 0.5–2.0) | works | `App.jsx:1571-1600` | localStorage `rooms-script-zoom` |
| Page format toggle (US Letter / A4) | works | `constants/elementTypes.js:52-72`, `App.jsx:111` | CSS indents hardcoded to US Letter (finding 4.20) |
| AI rewrite | works | `hooks/useAIRewrite.js:1`, `App.jsx:1753-1763` | Rate-limited 10/min per IP; **`optionalAuthMiddleware` allows anonymous invocation** (finding 5.12) |
| BeatBoard | **dead** | `constants/config.js:6`, `App.jsx:1611` | 2011 lines shipped in bundle, never rendered |
| Cloud sync (desktop) | works | `hooks/useCloudSync.js:1` | Gated on `IS_DESKTOP` |
| Offline mode | fragile | `hooks/useOfflineMode.js:1` | Offline edits silently discarded on reconnect (finding 4.1) |
| Electron desktop | works | `electron/main.js:1`, `electron/local-server.js:1` | No Yjs — divergent sync path AND no ACL (`local-server.js:37-39` stubs `checkDocumentAccess` to always return `true`). See finding 5.21 |
| Multi-block copy/paste | works | `hooks/useMultiBlockClipboard.js:1` | Guards INPUT/TEXTAREA/contenteditable |
| Drag-select multiple elements | works | `hooks/useDragSelect.js:1` | `document.elementsFromPoint` per mousemove |
| Scroll sync (script ↔ outline) | works | `hooks/useScrollSync.js:1` | 2s polling on Safari (`useScrollSync.js:181-189`) |
| Scroll sync (script ↔ comments) | fragile | `hooks/useScrollSync.js:8-11`, `hooks/useElementPositions.js` | Removed — replaced by per-comment absolute positioning (second independent system) |
| Typewriter sound | ✅ **REMOVED in Phase 1** | ~~`hooks/useTypewriterSound.js`~~ (deleted) | Was inert dead code: `setTypewriterSound` was never called anywhere (only the destructure in `App.jsx` matched), so `useState(false)` never flipped, the effect short-circuited before `window.addEventListener('keydown', ...)`, and `audio.key/enter/backspace` were hardcoded `null` regardless. Hook and its `App.jsx` destructure both deleted; no references remain in `client/src/`. **Note**: `CLAUDE.md` still lists this hook in its hooks table and `REFERENCES.md:441` still shows it as a shipped feature — both are now stale |
| Remote cursor plugin | ✅ **REMOVED in Phase 1** | ~~`extensions/remoteCursorPlugin.js`~~ (deleted) | Had no importers; superseded by `CollaborationCaret`. No references remain |
| Undo/redo | **dead-under-Yjs** | `hooks/useUndoRedo.js:44` | Snapshot-based; TipTap history disabled when `ydoc` present (finding 4.3) |
| Delete document (self-serve) | **missing** | `server/server.js` (verified `grep 'app.delete'` returns only `/api/waitlist/:email` at 206 and `/comments/:commentId` at 704) | No `DELETE /api/documents/:shortId` route exists. Owners have no server-side path to remove a document; the client has no delete UI. Documents accumulate forever, and a user who wants their content off Railway must email support. See finding 5.23 and §6 rank 11 |
| Password reset / forgot password | **missing** | `server/auth.js:63-94` (only `/register`, `/login`, `/me`); no client component references "forgot" or "reset" | A user who loses their password has no self-serve recovery. Server has no rotation endpoint, no email dispatch, no reset-token model. Blocks any real-world onboarding. See finding 5.24 |
| Email verification on register | **missing** | `server/auth.js:63-77`, `server/server.js:111` (waitlist accepts anything with an `@`) | `POST /api/auth/register` accepts any email string and never dispatches a verification. Anyone can register with someone else's email and receive collaboration invites addressed to that person. See finding 5.25 |

---

## 4. Collaboration layer

The system runs **three parallel content stores**:

| Store | Owned by | Written by | Read by |
|---|---|---|---|
| React `elements` state | `App.jsx:249` | `onElementsExtracted` in `SingleEditor.jsx:145`, undo/redo, socket handlers | UI panels (outline, stats, characters), autosave payload |
| `Y.Doc` (XmlFragment) | `hooks/useYjsProvider.js:44` | TipTap Collaboration extension, remote peers | ProseMirror view (source of truth for editor) |
| MongoDB `Document.elements[]` | `models.js:170` | REST autosave (`server.js:359`), snapshot/restore, `suggestion-accept` (`server.js:1114`) | REST loader (initial fetch, offline snapshot compare) |

### 4.1 Race conditions and data-loss risks

| # | Severity | Issue | File:line |
|---|---|---|---|
| 4.1 | **CRITICAL** | **Offline edits silently discarded on reconnect.** `pushOfflineChanges` PUTs to `/autosave` (writes only MongoDB `elements[]`). On reconnect, `SingleEditor` migration sees `fragment.length > 0` and keeps the existing Y.Doc, discarding every offline edit. | `hooks/useOfflineMode.js:96`; `components/SingleEditor.jsx:275-278` |
| 4.2 | **CRITICAL** | **First-time migration double-seed.** Two peers opening a not-yet-migrated doc both find `fragment.length === 0` and both call `editor.commands.setContent(...)`. Both seeds are appended as CRDT insertions → duplicated content persisted forever. | `components/SingleEditor.jsx:295` |
| 4.3 | HIGH | **Undo/redo is a no-op.** `useUndoRedo.undo()` calls `setElements(previous.elements)` but TipTap history is disabled (`history: !ydoc` in `SingleEditor.jsx:81`), and nothing touches the Y.Doc. React state briefly rolls back, then `onUpdate` re-extracts from Y.Doc, silently reverting the undo. | `hooks/useUndoRedo.js:44`, `components/SingleEditor.jsx:81` |
| 4.4 | HIGH | **getYDoc race on cold start.** `docs.set(...)` is synchronous but `mdb.getYDoc(...)` (line 114) is async. A second connection arriving during the load window gets the empty ydoc from the cache, sends SyncStep1 with empty state, and the client seeds — then mdb load applies persisted state on top → duplicated content. | `server/yjs-server.js:106` |
| 4.5 | HIGH | **suggestion-accept bypasses Yjs.** Handler mutates `elements.$.content` directly in Mongo and broadcasts `element-updated`. Since Yjs is authoritative and modern clients ignore `element-updated`, the Mongo elements array drifts and connected editors overwrite it on the next sync. | `server/server.js:1100-1120` |
| 4.6 | HIGH | **History restore doesn't touch Y.Doc.** `POST /restore` rewrites `doc.elements` in Mongo and broadcasts `document-restored`, but the Y.Doc in `yjs-server` is unchanged. Any subsequent Yjs update persists the pre-restore state, effectively voiding the restore. | `server/server.js:544-594` |
| 4.7 | HIGH | **Presence has two independent sources.** Socket.io `users` list vs Yjs awareness cursors — no cross-check. A user can appear as a cursor without being in the online-users list, or vice versa. | `hooks/useSocketConnection.js:60`, `server/yjs-server.js:158-183` |
| 4.8 | MED | **Yjs updates persisted fire-and-forget.** `ydoc.on('update', u => mdb.storeUpdate(...).catch(...))` broadcasts before persistence resolves. A crash between broadcast and persist loses the update; on restart the reloaded Y.Doc diverges from peers. | `server/yjs-server.js:126` |
| 4.9 | MED | **5s timeout guard races migration.** If REST is slow (>5s), `yjsSynced` flips true with `elements=[]`. Migration effect skips seeding; when elements arrive, migration reruns — but between the check and `setContent` a peer's insert can slip in → duplicated content on peer side. | `hooks/useYjsProvider.js:78` |
| 4.10 | MED | **`resyncInterval` not configured.** A one-way partition leaves the client without remote updates until TCP drops. | `hooks/useYjsProvider.js:49` |
| 4.11 | MED | **REST loader silently swallows non-200/non-401.** On 403/404/500 the loader resolves without changing elements. If the previous doc's `elements` remains in state and the new doc has an empty Y.Doc, migration will seed **doc B's Y.Doc with doc A's content** — cross-document data leak. | `hooks/useDocumentLoader.js:57` |
| 4.12 | MED | **Autosave writes elements[] as a second source of truth.** Even when Yjs is authoritative, autosave PUTs every ~10s, keeping a second Mongo source that can drift from the Y.Doc (see 4.5, 4.6). The `length + Σ content.length` signature at `useAutoSave.js:82` is only a 3-second stability debounce (lines 83-88); the actual dirty-check at lines 100-102 uses `JSON.stringify(current) !== JSON.stringify(lastSaved)`, so same-length edits are NOT missed — they may fire the debounce a hair early but still carry the correct payload. | `hooks/useAutoSave.js:82-102` |
| 4.13 | MED | **Editor recreated on every `yjsSynced` flip.** `useEditor` deps are `[ydoc, yjsSynced]`. Reconnects, doc switches, and initial sync all rebuild the ProseMirror view — losing focus, selection, IME composition, and in-flight local edits. Also numbered 4.22 in §4.4 since the fix belongs to the editor track. | `components/SingleEditor.jsx:249` |
| 4.14 | **MED** (was LOW) | **Server broadcasts each Yjs update N×(N−1) times.** Each connection registers its own `onUpdate` handler on the shared Y.Doc (`yjs-server.js:315-330`). When client A sends `messageSync`, `readSyncMessage(decoder, encoder, ydoc, null)` at line 296 applies the update with `origin=null`, so the `origin === ws` guard in each handler (line 317) **never matches for any connection** — including handlers owned by other clients. All N handlers fire; each iterates the room and sends to every `client !== ws` (that handler's own ws). Net effect for N connections in the room: one client update generates N×(N−1) `client.send()` calls, and client A even receives its own update back via each of the other N−1 handlers. Bandwidth scales quadratically with room size; the earlier "~doubled" characterisation was wrong. Impact is HIGH in a busy 5+ user room. | `server/yjs-server.js:296, 315-330` |
| 4.15 | LOW | **Yjs clientID collision has non-zero probability.** `ydoc.clientID + Math.floor(Math.random() * 1000000)` — collision would evict a peer's awareness on the other's disconnect. | `server/yjs-server.js:250` |
| 4.16 | LOW | **Snapshot interval leaks on non-cleanup paths.** `setInterval` created in `getYDoc`, cleared in sweep. If `lastDisconnectTime` is never set (all clients crash), the interval persists. | `server/yjs-server.js:132` |

### 4.2 Reconnection behavior

- `WebsocketProvider` reconnects with `maxBackoffTime: 10000` and re-syncs on connect (SyncStep1+SyncStep2 sent by server at `yjs-server.js:257-270`). Correct, but no `resyncInterval` fallback.
- `SingleEditor` is rebuilt every time `yjsSynced` flips → local UI state (selection, focus) is lost after every reconnect.
- Socket.io reconnect handled by client library defaults; `join-document` re-fires and re-broadcasts `document-state` with metadata (comments, suggestions, users).
- Offline banner and conflict modal (`App.jsx:1264-1306`) offer Overwrite / Keep online / Open compare — but only the REST path is compared; Yjs state is never part of the conflict resolution.

### 4.3 Dual source-of-truth summary

- **Editor content**: Y.Doc is authoritative for connected users; MongoDB `elements[]` is the fallback for cold start and REST-only readers. Sync between them is one-way (autosave writes Mongo, never the other direction) — leading to the drift bugs above.
- **Comments/suggestions/title/chat**: MongoDB is authoritative, Socket.io broadcasts deltas (chat is the exception — see feature-inventory row and finding 5.22).
- **Presence**: Both Socket.io and Yjs awareness track users, with no arbitration.
- **BeatBoard data** (beatCards, structureBeats, whiteboardElements, sceneSynopsis, sceneStatus): MongoDB `Document.*` fields only — no Yjs sync, no Socket.io deltas. Persisted through autosave/snapshot payloads even though the UI is hidden.

### 4.4 Editor / UX / DOM findings

These are the numbered defects referenced from §3, §7, and §8 by their `4.17`…`4.25` handles.

| # | Severity | Issue | File:line |
|---|---|---|---|
| 4.17 | HIGH | **`SuggestionMark` renders decorative text as a sibling span inside the mark body.** DOM output contains an uneditable inline pill that leaks into the plain-text content stream; `helpers.buildDocFromElements` strips inline marks unevenly, and exports (FDX/Fountain/TXT) can carry the suggested text into the output. | `extensions/SuggestionMark.js:30`, `utils/helpers.js` (buildDocFromElements) |
| 4.18 | LOW | **Page-break widget decorations don't invalidate on theme toggle.** Page numbers keep the previous theme's color until the next keystroke re-runs `computePageInfo`. | `extensions/pageBreakPlugin.js` |
| 4.19 | MED | **Autocomplete popup ignores CSS `zoom`.** The popup uses `getBoundingClientRect` in the outer viewport frame; when the wrapper's `zoom` ≠ 1.0 the popup drifts by (zoom−1)·offset. | `components/SingleEditor.jsx:191-260, 410-500` |
| 4.20 | MED | **CSS indents/margins are hardcoded to US Letter.** `PAGE_FORMATS` toggles line counts but the character/dialogue/parenthetical widths and left offsets in `App.css` are US-Letter constants; A4 mode paginates correctly on line count but visually mis-lays-out on the printed page. | `App.css` (screenplay element widths), `constants/elementTypes.js:52-72` |
| 4.21 | MED | **Backspace at start of a non-empty Character merges into the previous node** instead of demoting the current node to Action (Final Draft convention). | `extensions/ScreenplayElement.js:196-241` |
| 4.22 | MED | **Editor recreated on every `yjsSynced` flip** — same underlying defect as 4.13, tracked here because the fix belongs to the editor track (register `CollaborationCaret` as a plugin instead of rebuilding). | `components/SingleEditor.jsx:249` |
| 4.23 | LOW | **Comment silently dropped when its element content shrinks below the stored offset.** No "stale" state surfaced in the sidebar; the comment vanishes without warning. | `hooks/useHighlights.js`, `components/CommentsSidebar.jsx` |
| 4.24 | LOW | **Autocomplete "cycle to previous different character" requires ArrowDown** to reveal itself; the single-item popup does not auto-highlight the suggestion. | `components/SingleEditor.jsx:191-260` |
| 4.25 | MED | **`client/server.js` is a 627-line legacy V2 backend clone shipped in the client tree.** Full Express + Socket.io + Mongoose implementation (own `mongoose.connect` line 17, `authRouter` mount line 29, `PORT` listen at 626-627), banner comment `// Server V2 - Added autosave and snapshot endpoints`. No script in `client/package.json` references it and CRA doesn't bundle root-level Node code, so it's inert — but every reader must decide whether it's live, and any accidental `node client/server.js` starts a second production-shaped process pointing at MongoDB. Delete (Phase 1 step 8). | `client/server.js:1-627` |
| 4.26 | MED | **Root-level `/Users/jeremiegalan/screenflow/server.js` is a second, larger, newer backend orphan** (789 lines vs client/server.js's 627; banner `// Server V8 - Added Waitlist feature` at line 1 vs client/server.js's V2). Full Express + Socket.io + Mongoose implementation (`require('express')` line 2, `Anthropic` SDK line 8, `mongoose` line 6, `checkDocumentAccess` at line 189, `server.listen(PORT, ...)` at line 789). `require('./models')` and `require('./auth')` at lines 9-10 point to root-level `models.js` / `auth.js` that **do not exist** (the real ones are under `server/`), so `node server.js` from the repo root immediately throws MODULE_NOT_FOUND — the file is inert unless someone copies models.js/auth.js next to it. Not referenced by any package.json in the tree (`grep -rn 'screenflow/server\.js\|\./server\.js' package.json client/package.json server/package.json electron/main.js` returns nothing). Phase 1 step 8 originally called out only `client/server.js`; without this addition, Phase 1 would delete the smaller/older half of the dead-server cruft and leave the larger/newer half sitting at the repo root. Also a security-hygiene note: a full production-shaped backend with waitlist admin routes checked into the repo root is a soft footgun (accidental deploy, IDE search results, GitHub `Discussions` mining, etc.). Delete alongside `client/server.js`. | `/Users/jeremiegalan/screenflow/server.js:1-789` |

(Note: the earlier draft cross-referenced these as `finding 7.1`…`finding 7.20` and `finding 5.1`…`finding 5.10`, but §7 is the refactoring plan and §5 was unnumbered. This subsection and the numbering in §5 below establish real anchors.)

---

## 5. Security posture

### CRITICAL

| # | Title | File:line | Impact | Fix |
|---|---|---|---|---|
| 5.1 | ⚠️ **PARTIALLY FIXED in Phase 1** — **`GET /api/documents/:shortId` has no ACL and auto-promotes any authenticated visitor to `editor`** | `server/server.js:485`, socket auto-add `server.js:823` | Any leaked shortId (referrer, screenshot, browser history) grants read+edit to any authenticated account. shortId is only 8 hex chars (`server.js:254`) — brute-forceable | **REST half fixed**: the route now runs `checkDocumentAccess(doc, req.user, 'viewer')` and reports the role the ACL actually grants (the `else userRole = 'editor'` branch is gone). Guarded by specs A1/A2. **Socket half NOT fixed**: the `join-document` auto-add named in this finding's own File:line column still writes `role: 'editor'` unconditionally — see 5.1b |
| 5.1b | **Socket `join-document` auto-add silently escalates a public *viewer* link to a persisted `editor`** — the residue of 5.1, and it defeats both 5.1 and 5.3 | `server/server.js:838-848` | **Empirically confirmed** against a live DB: owner shares a link with `publicAccess: {enabled: true, role: 'viewer'}` → visitor's `GET` correctly returns `role: 'viewer'` (5.1 fix working) → their client emits `join-document` → server writes `{role: 'editor'}` into `collaborators` → the next `GET` returns `role: 'editor'`, `canEdit` flips true client-side, and the Yjs `canWrite` check (`checkDocAccess(doc, user, 'editor')`) now also passes, **bypassing the 5.3 fix too**. Reachable through the real UI: `ShareModal.jsx:210` exposes a viewer/editor selector for the public link. Scope: documents with a public link enabled (the auto-add branch is unreachable without `publicAccess.enabled`, since owner and explicit-collaborator are handled by earlier branches) | Auto-add with `doc.publicAccess.role`, not a hardcoded `'editor'` — or drop the auto-add and require an explicit invite. **Not attempted in Phase 1**: it changes collaboration UX and is not test-covered (the ACL suite deliberately scopes it to §8.6 spec C6). Recommended Phase 2 target |
| 5.2 | ✅ **FIXED in Phase 1** — **`POST /restore/:historyId` never verifies the entry belongs to the target doc** | `server/server.js:544-594` | Editor of doc A guesses/enumerates a `HistoryEntry._id` from doc B (MongoDB ObjectIds are time-ordered) and overwrites doc A with doc B's snapshot content — full confidentiality breach | Fixed: `if (!entry.documentId \|\| !entry.documentId.equals(doc._id)) return 404` before applying, plus an `ObjectId.isValid` guard so a malformed id returns 404 instead of a CastError-driven 500. Guarded by specs B1/B2 |
| 5.3 | ✅ **FIXED in Phase 1** — **Yjs WebSocket only checks `viewer` at connect; every subsequent message is accepted** | `server/yjs-server.js:234,286-312` | A viewer/commenter (or anonymous public-viewer) can send `messageSync` frames that mutate the shared Y.Doc | Fixed: the connection captures `canWrite = checkDocAccess(doc, user, 'editor')` at connect (defaulting to `false`), and the message handler peeks the sync sub-type on a throwaway decoder, dropping `SyncStep2`/`Update` frames from read-only connections while letting `SyncStep1` and awareness through. Guarded by spec C1. **Caveat**: `canWrite` is captured once — demoting an editor mid-session does not take effect until they reconnect. Note this fix is bypassable via 5.1b |

### HIGH

| # | Title | File:line | Impact | Fix |
|---|---|---|---|---|
| 5.4 | **JWT sent as WebSocket query param** | `hooks/useYjsProvider.js:50`, `server/yjs-server.js:193` | WSS URL (including `?token=`) is logged by nginx/CloudFront/Railway access logs and appears in DevTools Network panel. JWT is 7-day, non-revocable → 1 week of full access per leak. Amplified by the Framer-domain CORS entries (see 5.7) that expand the XSS surface for token theft | Move to `Sec-WebSocket-Protocol` header or a dedicated ephemeral token endpoint |
| 5.5 | **PUT `/comments/:commentId/resolve` has no ACL** | `server/server.js:718-730` | Any authenticated user who knows a shortId can toggle any comment's resolved state | Add `checkDocumentAccess(doc, req.user, 'commenter')` |
| 5.6 | **GET `/api/documents/:shortId/meta` has no ACL** | `server/server.js:477-483` | Leaks title + updatedAt for any shortId → project enumeration | Add ACL |
| 5.7 | **CORS accepts Framer subdomains AND Socket.io CORS is wildcard** | `server/server.js:60-78` (REST allowlist includes `/\.framer\.app$/`, `/\.framercanvas\.com$/`, `/\.framer\.website$/`, and `https://framer.com`); `server/server.js:16` (Socket.io `cors: '*'`) | The Framer entries exist because the marketing landing is Framer-hosted, but Framer subdomains are user-authored surfaces — a malicious Framer page can drive REST calls with credentials. Combined with the Socket.io wildcard and the JWT-in-query-string leak vector (5.4), a stolen token can be replayed from any browser origin. The audit found no comment in the code explaining why Framer origins are trusted at all — Phase 1 should either narrow to the specific marketing subdomain or move the marketing site behind a proxy on `writers-rooms.com` | Narrow the Framer allowlist to the single production landing origin; match Socket.io CORS to the REST allowlist |
| 5.8 | **REST save endpoints accept unbounded payloads (up to 50 MB)** | `server/server.js:304,359,404,270`, `server.js:79` | Socket handlers enforce 50 KB per element; REST path skips validation entirely. An editor pushes a 50 MB doc, forcing every collaborator's memory to load it via `document-restored` broadcast | Apply `validateElement` + `MAX_CONTENT_LENGTH` on REST too; cap total elements count |

### MEDIUM

| # | Title | File:line | Impact | Fix |
|---|---|---|---|---|
| 5.9 | JWT 7-day expiry, no refresh, no revocation, no `password_changed_at` claim | `server/auth.js:18` | Stolen token valid 7 days regardless of logout | Add refresh tokens + server-side blacklist |
| 5.10 | Cached socket role never refreshed | `server/server.js:792-836` | Demoted collaborators keep editor rights until they reconnect (Socket.io and Yjs both) | Periodically re-check role or emit `role-changed` event |
| 5.11 | Password min length = 6 chars, bcrypt cost = 10 | `server/auth.js:67,70` | Below NIST guidance | Bump to 8+ chars, cost 12 |
| 5.12 | `POST /api/ai/rewrite` allows anonymous invocation | `server/server.js:598` | Anonymous users burn Anthropic quota; only IP-rate-limited (10/min) | Require `authMiddleware` |
| 5.13 | **Anonymous public-access is asymmetric across surfaces** — server accepts it, client refuses it | `server/server.js:226-228` (`checkDocumentAccess` returns true for `publicAccess.enabled`); `client/src/App.jsx:243-247` (unconditionally forces `AuthModal` for any docId when no token) | Either the server code path is dead (client always injects a JWT before any request), OR any bypass of the client (direct REST call, alternate frontend, curl) grants anonymous editor rights when `publicAccess.role='editor'`. The two surfaces should agree — either both allow anonymous read or neither does | Decide the policy; then make client match server or vice versa. Also force `req.user` on REST write endpoints even when publicAccess allows viewer |
| 5.14 | Comment/reply content has no length limit | `server/server.js:672,694,738,1034` | Single comment can bloat a document | Apply 5000-char cap like chat |

### LOW

| # | Title | File:line | Fix |
|---|---|---|---|
| 5.15 | BeatBoard fields on `Document` have **no shape validation** — but the specific typing varies: `sceneSynopsis` (models.js:185-188) and `sceneStatus` (189-192) are `mongoose.Schema.Types.Mixed`, while `beatCards` (177-180), `structureBeats` (181-184), and `whiteboardElements` (193-196) are declared as raw `Array` (no subschema). All five accept arbitrary payloads (Mongoose does not validate untyped `Array` contents any more than it validates `Mixed`). Combined with the unbounded REST payload (5.8), a client can push arbitrarily nested/large blobs into any of these fields, then those blobs are re-broadcast via `document-restored` and reloaded on every autosave. **Note**: the earlier draft labeled all three cited fields as `Mixed`; three of them (`beatCards`, `whiteboardElements`, `structureBeats`) are actually `Array` — the shape-check point still holds for every one | `server/models.js:177-196` | Define explicit subschemas for all five fields (or drop the fields entirely if BeatBoard is deleted per Phase 7) |
| 5.16 | `POST /api/waitlist` under global apiLimiter only (120/min per IP), no captcha | `server/server.js:106` | Add per-IP hourly cap + captcha |
| 5.17 | Verbose console logs include user names and doc IDs | `server/server.js:788,830`, `yjs-server.js:118,148,239,335` | Structured logging with redaction |
| 5.18 | `y-mongodb-provider` flushSize 100 → crash window loses buffered updates | `server/yjs-server.js:58` | Trade throughput for durability (flushSize=1 or explicit flush on cleanup) |
| 5.19 | Socket handlers `join-document`, `suggestion-accept`, `suggestion-reject` **and `chat-message`** skip rate-limiter | `server/server.js:808,1080,1135, 1186-1192` — `chat-message` (verified at 1186) never calls `checkSocketRate`; it validates length and rejects if `currentDocId` is unset, then unconditionally broadcasts to every peer in the room, making it a more amplifiable DoS vector than the three write handlers already listed. `electron/local-server.js` does rate-limit `join-document` | Add `checkSocketRate(socket.id)` to all four; consider a lower-cadence bucket for chat given the broadcast fan-out |
| 5.20 | Anthropic model id `claude-sonnet-4-20250514` and the FR system prompt are hardcoded | `server/server.js:613` | Dated snapshot ids may be deprecated per Anthropic's per-model lifecycle announcements; if the model retires, `/api/ai/rewrite` starts returning 4xx with no config-only workaround. Move to `ANTHROPIC_MODEL` env var with a safe default, and factor the system prompt into a translations map so EN users get an EN prompt |
| 5.21 | **Desktop path has literally no ACL AND no Yjs** — divergent from cloud in both dimensions | `electron/local-server.js:37-39` stubs `checkDocumentAccess` to `return true` unconditionally; the same file (line ~561-757) still runs the legacy `element-*` Socket.io sync handlers | Fine on a single-user desktop with `127.0.0.1` binding, but the moment the local server is exposed on the LAN (port-forwarding, `--host` flag) any peer on the network gets editor rights to every doc. Bind to `127.0.0.1` only, refuse non-loopback origins, and document the invariant in `electron/main.js` |
| 5.22 | Chat history stored in `localStorage` per docId, not on the server | `client/src/hooks/useChat.js:75-90` | Any user who signs into the same browser and joins the room sees the previous user's chat log; incognito/private browsing loses history; contents leak to any browser-sync service the user has enabled. Either persist to the server behind ACL or add a UX warning and clear on logout |
| 5.23 | **No `DELETE /api/documents/:shortId` route** — verified via `grep 'app.delete' server/server.js` (only `/api/waitlist/:email` at line 206 and `/comments/:commentId` at line 704) | `server/server.js` | GDPR / right-to-erasure exposure: users cannot delete their own content without operator intervention. Also blocks any UI-level "trash" affordance. Add `DELETE /api/documents/:shortId` gated on `checkDocumentAccess(doc, req.user, 'editor')` with an owner-only check; cascade-remove `HistoryEntry`, `yjs-documents`, `YjsSnapshot` |
| 5.24 | **No password-reset flow** — verified `server/auth.js:63-94` exposes only `/register`, `/login`, `/me`; no client component references "forgot"/"reset" | `server/auth.js` | A user who loses their password has no path back to their account. Combined with `password_changed_at` absence (5.9), rotation is impossible even after a suspected compromise. Add `POST /forgot-password` (sends email w/ signed token), `POST /reset-password` (rotates hash, invalidates existing JWTs) |
| 5.25 | **No email verification on register** — `auth.js:63-77` accepts any string containing an `@` and issues a JWT immediately; no verification email is sent | `server/auth.js:63-77`, `server/server.js:111` | Anyone can register with someone else's email address and receive collaboration invites addressed to that person (share-modal invitations target by email). Legitimate owner has no way to reclaim the address. Add a verification-token model, send-on-register, and gate `POST /api/documents` behind `user.emailVerified === true` (grandfather existing accounts) |

---

## 6. Technical debt — top 10 (risk × effort)

| Rank | Item | Risk | Effort | Evidence |
|---|---|---|---|---|
| 1 | Three sources of truth (React / Yjs / Mongo) with unclear write authority — root cause of findings 4.1, 4.5, 4.6, 4.11, 4.12 | Critical | High | See §4 |
| 2 | Undo/redo hook still snapshots React state; TipTap history disabled → user-visible Ctrl+Z is a silent no-op | High | Med | `hooks/useUndoRedo.js:44` (finding 4.3) |
| 3 | Electron `local-server.js` still on legacy Socket.io sync path AND `checkDocumentAccess` stubbed to `return true` — client codebase must maintain two sync systems, and the desktop path has no ACL at all | High | High | `electron/local-server.js:37-39, 561-757` (findings 4.5, 5.21) |
| 4 | `SuggestionMark` renders decorative text as a sibling span inside a mark body — offset math + DOM leak bugs | High | Low (rewrite as Decoration/NodeView) | `extensions/SuggestionMark.js:30` (finding 4.17) |
| 5 | Editor recreated on every `yjsSynced` flip — poor UX (focus lost, IME dropped) | Med | Low (registerPlugin) | `components/SingleEditor.jsx:249` (findings 4.13, 4.22) |
| 6 | `App.jsx` at **1833 lines with 82 `useState` calls and 18 `useEffect` blocks** (verified via `grep -c`), prop-drilled into every hook (15-prop hooks) | Med | High | `App.jsx:1-1833` — the earlier "~90 useStates and 30+ useEffects" claim was wrong on effects (18, not 30+); the state count is close enough (82 vs "~90") |
| 7 | ✅ **PARTIALLY REMOVED in Phase 1** — **~25** tagged `console.log` lines in the hot editor path. The `SingleEditor.jsx` and `useYjsProvider.js` debug logs were deleted (one deliberate `[EDITOR] Seeding empty Y.Doc…` line kept as a migration breadcrumb, plus the existing `console.error` handlers). **The 9 `[Backspace]` logs in `ScreenplayElement.js:196-241` were NOT touched** — still outstanding | Med | Low | ~~`components/SingleEditor.jsx`~~, ~~`hooks/useYjsProvider.js`~~, `extensions/ScreenplayElement.js:196-241` (9, remaining) |
| 8 | `SERVER_URL` is a **string literal, not a build-time env var**: `constants/config.js:2` sets `let SERVER_URL = 'https://room-production-19a5.up.railway.app'`. No `REACT_APP_SERVER_URL` is read, so a staging/preview/local build requires editing source. The `let` + runtime reassignment in `App.jsx:136` is a downstream hack around the missing env var — a minifier constant-fold could silently break desktop mode. Root cause is the absent env var, not the `let` mechanic | Med | Low (introduce `REACT_APP_SERVER_URL` with the current URL as the fallback default) | `constants/config.js:2`, `App.jsx:136` |
| 9 | Waitlist server complete, client UI missing — leftover half-built landing feature | Low | Low | `components/LandingPage.jsx:1`, `server/server.js:29-222` |
| 10 | ✅ **MOSTLY REMOVED in Phase 1** — Dead code. **Deleted**: root `server.js` (789-line V8 "Waitlist" orphan, finding 4.26), `client/server.js` (627-line legacy V2 backend, finding 4.25), `remoteCursorPlugin.js`, `useTypewriterSound`, empty `backend/` and `src/` — 1,721 deletions total, with the client build and both test suites still green. **Still outstanding**: placeholder CSS with no attribute (`App.css:126`) and the unused `y-websocket` dep on the server (`server/package.json:24`) | Low | Low | ~~root `server.js`~~, ~~`client/server.js`~~, ~~`remoteCursorPlugin.js`~~, ~~`useTypewriterSound.js`~~, ~~`backend/`~~, ~~`src/`~~ — remaining: `App.css:126`, `server/package.json:24` |
| 11 | **No self-serve document deletion** — no `DELETE /api/documents/:shortId` route exists (verified via `grep 'app.delete' server/server.js`; only `/api/waitlist/:email` and `/comments/:commentId` respond to DELETE). Owners cannot remove their content; GDPR right-to-erasure requires operator intervention. See finding 5.23 | Med | Low (add route + cascade to `HistoryEntry` / `yjs-documents` / `YjsSnapshot`) | `server/server.js` |
| 12 | **Horizontal scaling not viable today**: Socket.io uses the in-memory default adapter (`server.js:16` — no `@socket.io/redis-adapter`, no `createAdapter` call), and every Yjs room is a per-instance `Map` (`yjs-server.js:62-66` — `docs`, `awarenessMap`, `roomConns`). A second Railway replica would split-brain: peers connected to different instances would not sync content, presence would flicker, and Y.Doc updates written on one instance would not reach the other until Mongo persistence + reload. Prevents any horizontal scale-out on the current stack. See §7 Phase 6 milestone | High | High (Redis adapter for Socket.io + shared-pubsub or sticky-session strategy for Yjs rooms) | `server/server.js:16`, `server/yjs-server.js:62-66` |
| 13 | **BeatBoard and its Excalidraw/Rough.js deps ship in every bundle even when `ENABLE_BEATBOARD=false`**: `App.jsx:44` `import BeatBoard from './components/BeatBoard/index'` is a static import, unlike the modal set at `App.jsx:53-58` which uses `React.lazy`. First-paint on the landing page pays for 2011 lines of BeatBoard code plus `@excalidraw/excalidraw` and `roughjs`, none of which render. Trivial mitigation: convert to `const BeatBoard = lazy(() => import('./components/BeatBoard/index'))` behind the flag (same pattern as AuthModal) | Med | Low | `client/src/App.jsx:44`, `client/src/constants/config.js:6`, `client/src/components/BeatBoard/` |

---

## 7. Incremental refactoring plan

Every phase leaves the app deployable. Each phase should be a separate commit chain and deployable independently.

### Phase 1 — Housekeeping & non-behavioral cleanup (1 sprint, no user-visible changes)

Purpose: shrink surface area before touching sync layer.

1. Delete `extensions/remoteCursorPlugin.js` (no importers).
2. Delete or disable-by-default all `[EDITOR]` / `[YJS]` / `[YJS-HOOK]` / `[Backspace]` `console.log` calls (25 total across `SingleEditor.jsx`, `useYjsProvider.js`, `ScreenplayElement.js`); gate any remaining ones behind `NODE_ENV === 'development'`.
3. Remove empty socket-emit branches (`App.jsx:723,815,856,979`, `hooks/useOfflineMode.js:103`) — replace with a code comment explaining Yjs owns content sync.
4. Delete `useTypewriterSound` (inert dead code — `setTypewriterSound` is never called anywhere, so the `useState(false)` never flips, the keydown listener at `useTypewriterSound.js:61` is never registered, and the audio refs at lines 25-27 are `null` regardless; see corrected §3 "Typewriter sound" row) or wire it up with real assets and a settings toggle that actually calls `setTypewriterSound(true)`.
5. Remove placeholder CSS rule `App.css:126` (dead — no `data-placeholder` attr).
6. Delete `y-websocket` from `server/package.json` (unused).
7. Update CLAUDE.md to reflect actual hook count (22), component count (24 root + 7 BeatBoard = 31), extension count (7), App.jsx size (1833 lines / 82 useState / 18 useEffect), ENABLE_BEATBOARD flag, and Yjs architecture.
8. **Delete both stale backend clones**: `client/server.js` (627-line V2, finding 4.25) AND root-level `/Users/jeremiegalan/screenflow/server.js` (789-line V8 "Waitlist" clone, finding 4.26). Neither is referenced by any package.json script, neither builds, and the root-level one throws MODULE_NOT_FOUND on `node server.js` because its `require('./models')`/`require('./auth')` point to files that don't exist at the repo root. If any keep-for-reference argument surfaces, move both under `docs/legacy/` instead of leaving them anywhere near the live source tree. Also delete the empty `backend/` (only `.DS_Store` + stale `node_modules`) and empty `src/` (only `.DS_Store`) directories at the repo root — see §2.1 for the inventory. Regenerate a fresh `.gitignore` entry for `.DS_Store` while at it.
9. Run `npm audit --production` in both `client/` and `server/`; record the report in a follow-up doc and gate high-severity CVEs for Phase 2.

Risk: none. Deployable after each commit.

### Phase 2 — Security REST hardening (1 sprint)

Purpose: close CRITICAL access-control holes (§5).

1. Add `checkDocumentAccess` to `GET /api/documents/:shortId` (5.1), `GET /:shortId/meta` (5.6), `PUT /comments/:commentId/resolve` (5.5).
2. Add `entry.documentId.equals(doc._id)` check to `POST /restore/:historyId` (5.2).
3. Add `authMiddleware` to `POST /api/ai/rewrite` (5.12).
4. Apply socket-side validation (`validateElement`, `MAX_CONTENT_LENGTH`) to REST bulk/autosave/snapshot/import (5.8).
5. Cap comment/reply content at 5000 chars (5.14).
6. Narrow CORS: match Socket.io CORS to REST allowlist AND drop the broad Framer regexes in favour of the single production landing origin (5.7).
7. Move JWT out of the WSS query string (proto header or ticket endpoint) (5.4).
8. Introduce a "viewer link" flag on documents so shortId sharing can be non-editor.
9. Reconcile the client/server anonymous-access asymmetry (5.13) — pick one policy and enforce it on both surfaces.
10. Add `chat-message` to the `checkSocketRate` bucket (5.19).
11. Move Anthropic model id + system prompt behind env / translations (5.20).
12. Add `DELETE /api/documents/:shortId` (owner-only) with cascade to `HistoryEntry`, `yjs-documents`, `YjsSnapshot` (finding 5.23); wire a client-side "Delete" affordance in `DocumentsList`.
13. Add password-reset flow: `POST /forgot-password` (email w/ signed token), `POST /reset-password` (rotates hash + invalidates outstanding JWTs) (finding 5.24).
14. Add email verification on register: verification-token model, send-on-register, gate `POST /api/documents` on `user.emailVerified === true` (grandfather existing accounts) (finding 5.25).
15. Introduce `REACT_APP_SERVER_URL` build-time env var (rank-8 debt), with the current Railway URL as the fallback default, so staging/preview/local builds no longer edit source.

Ships behind feature flag `STRICT_ACL=true` for one release; audit logs to catch breakage.

### Phase 3 — Yjs write authorization (1 sprint)

Purpose: close CRITICAL finding 5.3.

1. Enforce role check per `messageSync` frame in `yjs-server.js:286`.
2. Fix `getYDoc` race (finding 4.4) by making load atomic — set the ydoc in the map only after `mdb.getYDoc` resolves; queue subsequent gets to await the promise.
3. Pass `ws` as the 4th arg to `readSyncMessage` to stop the N×(N−1) rebroadcast (finding 4.14).
4. Replace random-suffix clientID with per-room counter (finding 4.15).
5. Add `resyncInterval: 30000` to `WebsocketProvider` (finding 4.10).

### Phase 4 — Kill dual-source-of-truth for content (2 sprints, biggest phase)

Purpose: end offline-loss and restore-loss bugs (findings 4.1, 4.5, 4.6, 4.11).

1. **Server-side seed**: when `getYDoc` runs and both `yjs-documents` and `YjsSnapshot` are empty, seed the Y.Doc from `Document.elements[]` inside a transaction with a `meta.migrated=true` guard. Removes the double-seed risk (finding 4.2) and moves the migration off the client.
2. **Delete client-side migration effect** in `components/SingleEditor.jsx:295` once server seed is proven.
3. **Suggestion-accept via Yjs**: replace direct Mongo `elements.$.content` write with a Yjs transaction on the shared doc. Requires the Yjs server to hold a service Y.Doc handle.
4. **History restore via Yjs**: on restore, dispatch a Yjs transaction that replaces the fragment content, then persist. Alternatively, wipe the Y.Doc + snapshots and force clients to reload.
5. **Offline mode via Yjs**: replace REST autosave-on-reconnect with `y-indexeddb` local persistence and let CRDT merge. `useOfflineMode` becomes a UI-only banner.
6. **REST autosave demoted**: no longer writes `elements[]` — becomes a fallback for read-only cold-start only. `Document.elements[]` snapshots derived from Y.Doc every N minutes on the server.
7. **Fix `useDocumentLoader` swallowed errors** (finding 4.11): explicit error surface on non-200; guard migration against stale `elements` from a prior doc.

Deployable milestones: each of 1–7 can ship independently behind a flag.

### Phase 5 — Editor stability & UX polish (1 sprint)

1. Rewrite `SuggestionMark` as a `Decoration` or `NodeView` (finding 4.17).
2. Fix Backspace-at-start-of-non-empty semantics (finding 4.21) — demote instead of merge.
3. Stop recreating the editor on `yjsSynced` flip (findings 4.13 / 4.22); use `editor.registerPlugin(CollaborationCaret.configure(...))`.
4. Replace `useUndoRedo` with `y-prosemirror` undo or a room-scoped `Y.UndoManager` (finding 4.3).
5. Parameterize CSS indents/margins from `PAGE_FORMATS` so A4 gets correct layout (finding 4.20).
6. Fix autocomplete popup positioning to account for CSS `zoom` (finding 4.19).
7. Fix page-break decoration invalidation on dark-mode toggle (finding 4.18).

### Phase 6 — Structural refactors (2+ sprints)

1. Extract `App.jsx` state into 3–4 reducers/contexts (document, collab, ui). Target: sub-1000 lines.
2. Introduce a proper routing layer (react-router) — currently no URL semantics.
3. Add an `ErrorBoundary` at the top-level.
4. Extract shared TipTap config so any secondary editor (comments, notes) uses the same schema.
5. Reconcile Electron/local-server with cloud server — either port Yjs into the desktop server or wrap the desktop store behind an interface. Bind local server to `127.0.0.1` and enforce it as an invariant (finding 5.21).
6. **Multi-instance scaling milestone** — required before any horizontal Railway scale-out (rank-12 debt). Two prerequisites: (a) mount `@socket.io/redis-adapter` (or NATS equivalent) on `server/server.js:16` so `join-document`/`title-change`/comments/suggestions/chat broadcast across replicas; (b) either give Yjs rooms a shared-pubsub backend, or enforce sticky-session routing keyed on `docId` so all connections to the same doc land on the same instance (the per-instance `Map`s in `yjs-server.js:62-66` are fine under stickiness). Ship behind `MULTI_INSTANCE=true` and validate with a two-replica load-test that opens the same doc from both sides.

### Phase 7 — Notes + waitlist decisions (small)

1. **Notes**: either promote to a real persisted feature (add server field, socket handler, autosave key) or delete the state.
2. **Waitlist**: either finish the landing UI (`components/LandingPage.jsx:1`) with an email capture form + POST, or gate/remove the server endpoint.
3. **BeatBoard**: audit whether the 2011 lines of code should be revived or deleted. If revived, add Yjs sync for `beatCards`/`whiteboardElements`. **Immediate mitigation regardless of the revive/delete decision** (rank-13 debt): convert `App.jsx:44` from a static `import BeatBoard from './components/BeatBoard/index'` to `const BeatBoard = lazy(() => import('./components/BeatBoard/index'))` behind `ENABLE_BEATBOARD`, so the ~2011 lines of BeatBoard code plus its `@excalidraw/excalidraw` and `roughjs` transitive deps stop shipping in the first-paint bundle for every user.
4. **Chat**: decide whether chat history should be server-persisted (behind ACL) or documented as ephemeral (finding 5.22).

---

## 8. Non-regression test suite to build

**Baseline (updated after Phase 1 — the earlier "zero automated tests" claim is no longer true).** The toolchain is bootstrapped and green. Measured on this machine:

| Layer | Location | Runner | Status |
|-------|----------|--------|--------|
| Client unit + integration | `client/src/__tests__/` | Jest via `craco test` + React Testing Library | **5 suites, 55 passed / 6 skipped (61 total)**, ~0.5 s — `cd client && npm run test:ci` |
| Server ACL gate | `server/__tests__/acl/` | Jest + supertest + a real `ws` client | **3 suites, 16 passed**, ~3.8 s — **requires a MongoDB**; skips itself silently without one |
| Server smoke | `server/__tests__/smoke.test.js` | Jest + supertest | 4 passed, DB-free |
| E2E / multi-tab collab | `e2e/` | Playwright | **scaffold only** — `smoke.spec.js` is `test.skip`; blocked on a one-time browser install, not yet in CI |

The ACL suite is the **regression gate for findings 5.1 / 5.2 / 5.3** and encodes post-fix behaviour as live assertions (specs A1, A2, B1, B2, C1 plus over-block guards D1–D11). Its DB requirement is the one sharp edge: `cd server && npm test` **passes while silently skipping all 16 ACL specs** if `TEST_MONGODB_URI` is unset. See [`TESTING.md`](TESTING.md) §2 and `server/__tests__/acl/README.md`.

Remaining scaffolding work:

- **E2E multi-tab**: Playwright is installed and configured but browsers are not downloaded; the two-tab collab fixture that boots a local server + Yjs WebSocket is still to be written.
- **CI**: `.github/workflows/test.yml` runs the client and server jobs, but the server job has no `services: mongo:` block — so **CI currently exercises none of the ACL gate**. Adding that block is the highest-leverage CI change available.

Every "**currently fails**" note below assumes the relevant §7 fix has NOT been applied — except §8.4 C3 and §8.8 S1/S2, which now pass (Phase 1).

**Layout in use**: `client/src/__tests__/` for unit + integration, `e2e/` for Playwright multi-tab scenarios, `server/__tests__/` for supertest + real-socket specs.

### 8.1 Editor — typing state machine

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| E1 | Empty doc, cursor in first Action | user types "Hello" | Element is Action, content is "Hello", cursor at end (offset 5) | `client/src/__tests__/editor/typing.spec.js` |
| E2 | Cursor at end of a non-empty Action | user presses Enter | New Action inserted after; cursor in new empty node | `client/src/__tests__/editor/typing.spec.js` |
| E3 | Cursor at end of a Scene heading | user presses Enter | New Action inserted (per `SP_NEXT_TYPE` rule) | `client/src/__tests__/editor/typing.spec.js` |
| E4 | Cursor at end of a Character | user presses Enter | New Dialogue inserted | `client/src/__tests__/editor/typing.spec.js` |
| E5 | Cursor at end of a Dialogue | user presses Enter | New Character inserted | `client/src/__tests__/editor/typing.spec.js` |
| E6 | Cursor in an empty Action | user presses Enter | Node is deleted (or leaves if only node) | `client/src/__tests__/editor/typing.spec.js` |
| E7 | Cursor in an empty Character | user presses Enter | Node converts to Action | `client/src/__tests__/editor/typing.spec.js` |
| E8 | Cursor in an Action | user presses Tab | Type cycles Action → Character | `client/src/__tests__/editor/tab-cycle.spec.js` |
| E9 | Cursor in a Dialogue | user presses Tab | Type toggles Dialogue ↔ Parenthetical (FD convention) | `client/src/__tests__/editor/tab-cycle.spec.js` |
| E10 | Cursor in a Parenthetical | user presses Shift-Tab | Type toggles back to Dialogue | `client/src/__tests__/editor/tab-cycle.spec.js` |
| E11 | Empty Parenthetical created | (no action) | Auto-inserts `()` with cursor between | `client/src/__tests__/editor/parens.spec.js` |
| E12 | Cursor at start of empty Action | user presses Backspace | Node deleted, cursor at end of previous | `client/src/__tests__/editor/backspace.spec.js` |
| E13 | Cursor at start of non-empty Character (FD spec) | user presses Backspace | Type demotes to Action (**currently fails**, finding 4.21) | `client/src/__tests__/editor/backspace.spec.js` |
| E14 | Cursor at start of first node in doc | user presses Backspace | No-op | `client/src/__tests__/editor/backspace.spec.js` |

### 8.2 Editor — autocomplete + cursor placement

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| E15 | Empty Character, previous Characters ["MARIE","JEAN"] exist | user types "M" | Popup shows filtered ["MARIE"]; ArrowDown+Enter inserts "MARIE" and creates Dialogue below | `client/src/__tests__/editor/autocomplete-character.spec.js` |
| E16 | Empty Character following recent Dialogue by MARIE | (no keystroke) | Single-item popup suggests cycling to previous different character (bug: requires ArrowDown, finding 4.24) | `client/src/__tests__/editor/autocomplete-character.spec.js` |
| E17 | Empty Scene heading | user types "INT" | Popup shows INT./INT-EXT./... location list | `client/src/__tests__/editor/autocomplete-scene.spec.js` |
| E18 | CSS zoom = 1.5 on wrapper | trigger autocomplete popup | Popup position aligns with caret (**currently fails**, finding 4.19) | `client/src/__tests__/editor/autocomplete-position.spec.js` |

### 8.3 Editor — undo/redo (currently broken)

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| E19 | Doc with "Hello" typed | user presses Cmd+Z | Content reverts to "" and doc reflects it visually | `client/src/__tests__/editor/undo.spec.js` |
| E20 | After E19 | user presses Cmd+Shift+Z | Content restored to "Hello" | `client/src/__tests__/editor/undo.spec.js` |
| E21 | E19 with two collaborators typing simultaneously | user A undoes | Only A's insertion is undone; B's edits preserved (needs `Y.UndoManager` scoped to clientID) | `e2e/collab-undo.spec.js` |

### 8.4 Collab — 2-tab simulation

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| C1 | Two tabs open same doc, both synced | Tab A types "Hello" | Tab B shows "Hello" within 500 ms; awareness in B shows A's cursor position | `e2e/collab-basic.spec.js` |
| C2 | Two tabs both open a not-yet-migrated doc from cold start | Both connect within 100 ms | Y.Doc contains the seed exactly ONCE (**currently fails**, finding 4.2) | `e2e/collab-migration.spec.js` |
| C3 | Tab A editor role, Tab B viewer role, both connected | Tab B sends a Yjs update via raw WS | Server rejects/ignores it; Tab A does not see the change (**currently fails**, finding 5.3) | `e2e/collab-viewer-write-block.spec.js` |
| C4 | Two tabs typing simultaneously same paragraph | Both insert at same offset | Both insertions preserved (CRDT merge); no lost characters | `e2e/collab-concurrent-edit.spec.js` |
| C7 | 5 tabs open same doc, all synced | Tab A sends one keystroke | Server issues at most 4 `send()` calls total (not 20) — verifies the N×(N−1) rebroadcast is fixed (**currently fails**, finding 4.14) | `e2e/collab-rebroadcast-fanout.spec.js` |

### 8.5 Collab — offline / reconnect

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| O1 | Doc open, WS drops | User types 3 lines while offline | Offline banner shown; edits saved to localStorage | `e2e/offline-basic.spec.js` |
| O2 | After O1, WS reconnects | User waits for sync | 3 lines present in Y.Doc + broadcast to peer (**currently fails**, finding 4.1) | `e2e/offline-reconnect.spec.js` |
| O3 | User is offline, peer edits while user is offline | User reconnects | Merged content: both offline user's edits + peer's edits present | `e2e/offline-merge.spec.js` |
| O4 | One-way partition (server drops responses) | 30 s passes | Client detects and resyncs via `resyncInterval` (**not configured**, finding 4.10) | `e2e/offline-partition.spec.js` |

### 8.6 Collab — cross-document state leak

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| C5 | User opens doc A (100 elements), then navigates to doc B where REST returns 403 | User waits | No content from A appears in B; error shown (**currently fails**, finding 4.11) | `e2e/cross-doc-leak.spec.js` |
| C6 | User was editor on doc, owner demotes to viewer via /public-access | User keeps typing on already-open socket | Server rejects new writes (**currently silent-accept**, finding 5.10) | `e2e/role-revocation.spec.js` |

### 8.7 Auth

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| A1 | Landing page, no token | User submits register with valid email + 8-char password | 201 + token stored + auto-login | `client/src/__tests__/auth/register.spec.js` |
| A2 | Register with password of 5 chars | POST /register | 400 with clear error | `server/__tests__/auth.spec.js` |
| A3 | Register with email already in use | POST /register | 400 with error | `server/__tests__/auth.spec.js` |
| A4 | Valid credentials | POST /login | 200 + token | `server/__tests__/auth.spec.js` |
| A5 | Wrong password | POST /login | 401 | `server/__tests__/auth.spec.js` |
| A6 | Expired token | GET /api/auth/me | 401 with error code "expired" | `server/__tests__/auth.spec.js` |
| A7 | Malformed token | GET /api/auth/me | 401 with error code "invalid" | `server/__tests__/auth.spec.js` |
| A8 | Logged-in user clicks logout | (client) | localStorage token cleared; navigation to landing page; subsequent /me returns 401 | `client/src/__tests__/auth/logout.spec.js` |

### 8.8 REST access control (post-fix)

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| S1 | User X not a collaborator on doc D | GET /api/documents/D | 403 (**currently 200 + auto-editor**, finding 5.1) | `server/__tests__/acl.spec.js` |
| S2 | Editor of doc A guesses HistoryEntry id belonging to doc B | POST /A/restore/entryFromB | 404 (**currently 200**, finding 5.2) | `server/__tests__/acl.spec.js` |
| S3 | Non-collaborator | PUT /D/comments/:id/resolve | 403 (**currently 200**, finding 5.5) | `server/__tests__/acl.spec.js` |
| S4 | Non-collaborator | GET /D/meta | 403 (**currently leaks title+updatedAt**, finding 5.6) | `server/__tests__/acl.spec.js` |
| S5 | Anonymous user | POST /api/ai/rewrite | 401 (**currently 200 + burns quota**, finding 5.12) | `server/__tests__/ai.spec.js` |
| S6 | Editor pushes 60 MB elements array | PUT /D/bulk | 413 (**currently 200**, finding 5.8) | `server/__tests__/limits.spec.js` |
| S7 | Anonymous client posts autosave to doc with `publicAccess.role='editor'` | PUT /D/autosave | Behaviour matches whatever Phase 2 decides — either 401 everywhere or 200 everywhere. Test locks in the chosen policy (**currently asymmetric**, finding 5.13) | `server/__tests__/anon-access.spec.js` |
| S8 | Anonymous client floods `chat-message` at 1000/s in a room | (measure) | Server rate-limits after N msgs (**currently unlimited**, finding 5.19) | `server/__tests__/chat-flood.spec.js` |

### 8.9 Format — FDX + Fountain roundtrip

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| F1 | Reference FDX file (fixtures/reference.fdx) | Import via POST /import | Server persists elements in expected order with correct types (Scene/Action/Character/Dialogue/Parenthetical/Transition) | `server/__tests__/import-fdx.spec.js` |
| F2 | After F1 | Export FDX via `useExportHandlers.exportFDX` | Output XML is byte-equivalent (or normalized-equivalent) to reference.fdx | `client/src/__tests__/export/fdx-roundtrip.spec.js` |
| F3 | Doc with inline bold/italic marks | Import FDX with `<Text Style="Bold">` runs | Marks preserved in TipTap doc | `client/src/__tests__/export/fdx-marks.spec.js` |
| F4 | Doc with 10 pages | Export PDF | PDF has 10 pages, each with correct margins and page number | `e2e/export-pdf.spec.js` |
| F5 | Doc | Export Fountain | Round-tripping back via a Fountain parser produces equivalent element list | `client/src/__tests__/export/fountain-roundtrip.spec.js` |
| F6 | Doc with `SuggestionMark` applied | Export any format | Suggested-text pill does NOT leak into exported content (**currently would**, finding 4.17) | `client/src/__tests__/export/suggestion-leak.spec.js` |

### 8.10 Pagination and page rendering

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| P1 | Doc formatted for A4 with 200 action lines | `computePageInfo` runs | Page count matches manual calculation using A4 CPL (58 for action) and 63 lines/page | `client/src/__tests__/pagination/a4.spec.js` |
| P2 | Doc formatted for US Letter, same content | switch `pageFormat` to us-letter | Page count updates to 55 lines/page basis; CSS margins update (currently CSS is hardcoded US Letter → visual A4 tests may pass but layout fails, finding 4.20) | `client/src/__tests__/pagination/us-letter.spec.js` |
| P3 | Scene heading in last 3 lines of a page | (no user action) | Orphan protection pushes it to next page | `client/src/__tests__/pagination/orphan.spec.js` |
| P4 | Dark mode toggled | Page break widgets already rendered | Page number color updates immediately (**currently stale until keystroke**, finding 4.18) | `client/src/__tests__/pagination/dark-mode.spec.js` |

### 8.11 Comments + suggestions

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| CO1 | User selects text and adds comment | (submit) | Comment appears in sidebar; highlight visible in editor; peer B sees comment appear via socket | `e2e/comments.spec.js` |
| CO2 | Comment resolved | (click resolve) | Comment hidden in sidebar toggle; peer B updates | `e2e/comments.spec.js` |
| CO3 | Element content shrinks below stored offset | (edit) | Comment silently dropped from render (**verify current behavior — may need explicit "stale" state**, finding 4.23) | `client/src/__tests__/comments/offset-drift.spec.js` |
| CO4 | Suggestion accepted | (click accept) | Original text replaced; suggestion removed; peer sees update via Yjs (**currently bypasses Yjs**, finding 4.5) | `e2e/suggestions.spec.js` |
| CO5 | Suggestion rejected | (click reject) | Original text preserved; suggestion removed | `e2e/suggestions.spec.js` |

### 8.12 Miscellaneous

| # | Given | When | Then | Spec file |
|---|---|---|---|---|
| M1 | Search "Marie", 12 matches | User navigates via ArrowDown | Each match scrollIntoView'd; active highlight visible | `client/src/__tests__/search/nav.spec.js` |
| M2 | Search + replace-all "Marie"→"Anna" | Confirm | All 12 occurrences replaced; character panel shows "Anna" | `client/src/__tests__/search/replace-all.spec.js` |
| M3 | Multi-block drag select from Scene A to Scene C | Cmd+C, click into Scene X, Cmd+V | 3 blocks pasted with fresh UUIDs, types preserved | `client/src/__tests__/clipboard/multi-block.spec.js` |
| M4 | Dark mode toggle | (click) | All panels re-theme; localStorage NOT written (current behavior) | `client/src/__tests__/theme/toggle.spec.js` |
| M5 | Zoom slider to 150% | (slide) | Wrapper style `zoom: 1.5`; localStorage key `rooms-script-zoom` = "1.5" | `client/src/__tests__/zoom/persist.spec.js` |
| M6 | Template picker → "Feature film" | (confirm) | 2 elements existed → replaced with template; title updated; peer receives title-change | `client/src/__tests__/templates/apply.spec.js` |
| M7 | Sprint timer set to 5 min | (start, wait for expiry) | Audio plays; alert shows; sessionWordCount surfaced | `client/src/__tests__/timer/sprint.spec.js` |
| M8 | User A ends chat session in doc D on shared browser; user B signs in and opens doc D | (open chat panel) | Chat history from user A must NOT be visible (**currently visible**, finding 5.22) | `client/src/__tests__/chat/localstorage-isolation.spec.js` |

---

_End of Phase 0 audit._
