# ROOMS — Collaborative Screenplay Editor

## Quick Reference

```bash
# Build client (MUST use craco, not react-scripts — roughjs/excalidraw need craco config)
cd client && npx craco build

# Dev mode
cd client && npx craco start

# Electron desktop
npm run electron:dev

# Note: npm/npx path on this machine is /usr/local/bin/npm (not in default PATH)
```

## Architecture

```
ROOMS/
  client/                   # React 19 SPA (CRA + Craco)
    src/
      App.jsx               # ~1,689 lines — orchestration (state, effects, JSX layout)
      App.css               # Screenplay element styles, CSS custom properties, themes
      index.css             # Global styles
      constants/            # Config, translations, element types, fonts, templates
      extensions/           # TipTap extensions (ScreenplayElement, marks, plugins)
      hooks/                # 20 custom hooks (see below)
      components/           # 25 extracted components (see below)
      utils/                # helpers.js, importFDX.js
    craco.config.js         # Webpack overrides for roughjs/excalidraw
    package.json            # Key deps: react 19, @tiptap/*, @excalidraw/excalidraw, socket.io-client

  server/                   # Production server (V9)
    server.js               # Express + Socket.io + Mongoose (~1,111 lines)
    models.js               # MongoDB schemas (User, Document, HistoryEntry)
    auth.js                 # JWT auth middleware

  electron/                 # Desktop app variant
    main.js                 # Electron entry point
    local-server.js         # Embedded Socket.io server (better-sqlite3 instead of MongoDB)
    local-models.js         # SQLite-backed models matching Mongoose API
    database.js             # SQLite initialization
    menu.js                 # Native menu
    preload.js              # IPC bridge
```

## Extracted Modules

### Hooks (`client/src/hooks/`)

| Hook | Purpose |
|------|---------|
| `useAutoSave` | Periodic autosave to server with dirty tracking |
| `useDocumentLoader` | Fetch document on mount, handle 404/auth errors |
| `useSocketConnection` | Socket.io connect/disconnect, room join/leave |
| `useTimer` | Writing timer with start/stop/reset |
| `useTypewriterSound` | Keystroke audio via AudioContext |
| `useStats` | Word/page/character count calculations |
| `useWritingGoals` | Daily writing goals with progress tracking |
| `useSearch` | Find & replace across screenplay elements |
| `useUndoRedo` | Undo/redo stack with snapshot management |
| `useChat` | Chat message send/receive via socket |
| `useOfflineMode` | Offline detection, queued operations |
| `useKeyboardShortcuts` | Global keyboard shortcut registration |
| `useExportHandlers` | PDF, FDX, plain text export logic |
| `useAIRewrite` | AI rewrite API calls and state |
| `useMultiBlockClipboard` | Multi-element copy/paste handling |
| `useScrollSync` | Sync scroll position across views |
| `useHighlights` | Comment/suggestion TipTap mark management |
| `useElementPositions` | Track element DOM positions for overlays |
| `usePageBackgrounds` | Per-page white rectangles with shadow |
| `useDragSelect` | Drag-to-select multiple elements |

### Components (`client/src/components/`)

| Component | Purpose |
|-----------|---------|
| `SingleEditor` | React.memo TipTap editor wrapper |
| `HeaderBar` | Top bar with title, menus, user controls (internalizes dropdown state) |
| `OutlineSidebar` | Scene outline with drag reorder, locking, assignments |
| `CommentsSidebar` | Comments list with thread/resolve UI |
| `ChatPanel` | Real-time chat sidebar |
| `BeatBoard` | Excalidraw-based scene cards + timeline |
| `LandingPage` | Document list / create / import landing |
| `ShareModal` | Share settings and collaborator management |
| `TemplateModal` | Screenplay template picker |
| `AIRewriteModal` | AI rewrite interface |
| `WritingTimerWidget` | Floating timer display |
| `ContextActionMenu` | Right-click context menu for elements |
| `AuthModal` | Login/register modal |
| `DocumentsList` | Document list with search/sort |
| `HistoryPanel` | Version history sidebar |
| `StatsPanel` | Writing statistics modal |
| `GoToSceneModal` | Jump-to-scene dialog |
| `WritingGoalsModal` | Writing goals configuration |
| `ShortcutsPanel` | Keyboard shortcuts reference |
| `InlineComment` | Inline comment bubble |
| `CharactersPanel` | Character management sidebar |
| `NoteEditorModal` | Scene note editor |
| `RenameCharacterModal` | Character rename dialog |
| `Logo` | SVG logo component |
| `UserAvatar` | User avatar with color/initials |

### Extensions (`client/src/extensions/`)

| Extension | Purpose |
|-----------|---------|
| `ScreenplayElement` | TipTap node: screenplay block with type/id attributes, split/cycle/backspace commands |
| `CommentMark` | TipTap mark for comment highlights |
| `SuggestionMark` | TipTap mark for suggestion highlights |
| `pageBreakPlugin` | ProseMirror plugin: page break decorations |
| `sceneLockPlugin` | ProseMirror plugin: blocks edits in locked scenes |

### Constants (`client/src/constants/`)

| File | Purpose |
|------|---------|
| `config.js` | API URL, socket URL, feature flags |
| `translations.js` | FR/EN translation strings |
| `elementTypes.js` | Screenplay element type definitions and maps |
| `fonts.js` | Font configuration |
| `templates.js` | Screenplay templates |

### Utils (`client/src/utils/`)

| File | Purpose |
|------|---------|
| `helpers.js` | `buildDocFromElements`, `extractElementsFromDoc`, `elementsEqual`, shared utilities |
| `importFDX.js` | Final Draft XML import parser |

## Key Patterns

### Refs mirror state
State variables read in intervals, timers, or socket handlers have a corresponding ref to avoid stale closures:
```js
const [elements, setElements] = useState([]);
const elementsRef = useRef(elements);
elementsRef.current = elements; // sync on every render
```
Always use refs in `setInterval`, `setTimeout`, and socket event handlers.

### Functional state updaters
Use `setState(prev => ...)` pattern to avoid depending on stale state:
```js
setUndoStack(prev => [...prev, snapshot]);
```

### isStale flag for socket cleanup
When switching documents, socket handlers from the old document might still fire:
```js
useEffect(() => {
  let isStale = false;
  socket.on('event', data => { if (isStale) return; /* ... */ });
  return () => { isStale = true; };
}, [docId]);
```

### Single TipTap editor (V272)
The entire screenplay is one ProseMirror document with `screenplayElement` nodes. Each node has `elementType` (scene/action/character/dialogue/parenthetical/transition) and `elementId` attributes. Page breaks are decorations, not real nodes.

## Page Rendering

### Page break calculation
`computePageInfo()` estimates where page breaks should occur:
- `LINES_PER_PAGE = 63` (calibrated for A4: 297mm - 28mm margins = 269mm content)
- `getLines()` uses **type-specific chars-per-line**: scene/action=58, dialogue=34, parenthetical=24, character=20
- Accounts for `line-height: 1.1` on action/dialogue elements
- Orphan protection: scene headings and character names don't strand at page bottom

### Page backgrounds
`usePageBackgrounds` hook creates per-page white rectangles:
- Uses `offsetTop` chain (NOT `getBoundingClientRect`) for zoom-agnostic positioning
- `MutationObserver` + `ResizeObserver` keep backgrounds in sync
- Watches `style` attribute changes to catch zoom updates
- Each page = absolute-positioned div with background + box-shadow inside a `page-bg-container`

### CSS zoom
The script wrapper uses `zoom: scriptZoom` (0.5 to 2.0). All position calculations inside the wrapper must use the internal coordinate system (offsetTop), not viewport coordinates (getBoundingClientRect), to avoid precision issues.

## Screenplay Element CSS (App.css)

```css
/* Base: 12pt Courier, line-height: 1 */
/* Scene:        100% width, margin-top: 2em, margin-bottom: 0.5em, bold, uppercase */
/* Action:       100% width, margin-top: 1em, line-height: 1.1 */
/* Character:    35% width, margin-left: 33%, margin-top: 1em, uppercase */
/* Dialogue:     58% width, margin-left: 17%, line-height: 1.1 */
/* Parenthetical: 42% width, margin-left: 25%, italic */
/* Transition:   100% width, margin-top: 1em, right-aligned, uppercase */
```

## Tab Behavior (Final Draft)
- In dialogue/parenthetical: Tab toggles between dialogue and parenthetical only
- Other types: Tab cycles through the full ring (scene > action > character > parenthetical > dialogue > transition)
- Enter from dialogue: creates new character element
- Enter on empty element: converts to action (or deletes if already action)

## Scene Locking
- `lockedScenes` state = `Set<elementId>` of locked scene heading IDs
- Lock toggled in outline sidebar
- Enforced via `sceneLockPlugin` (`filterTransaction`) — blocks any transaction touching nodes in a locked scene
- Visual feedback: locked elements get `opacity: 0.55` via decorations

## Zoom Footer
- Full-width bar at bottom, same style as header (`#333333` dark / `white` light)
- Slider right-aligned, range 50%-200%
- Persisted to `localStorage` key `rooms-script-zoom`
- Only visible in script view (hidden in beat board)

## Server Security (Applied)
All server security issues have been resolved in server/server.js and electron/local-server.js:
- **Rate limiting**: 100 events/sec/socket throttle on all socket handlers
- **Input validation**: element type allowlist, content length (50K), title length (200), chat text (5K) + userName (100)
- **Atomic operations**: suggestion-accept/reject use `findOneAndUpdate` + `$pull` (no race conditions)
- **Auth**: anonymous connections refused on private docs; JWT uses `crypto.randomBytes(32)` fallback in dev, `process.exit(1)` in prod
- **Data safety**: check-before-push on comments/suggestions, CSV injection protection, default public access disabled

## Version History (Milestones)
- **V272 Stable** (current) — Single TipTap editor, accurate A4 pagination, scene locking, zoom slider, per-page backgrounds, modular architecture (20 hooks, 25 components)
- **V271** — Multi-wrapper page rendering (replaced by V272 single-wrapper approach)
- **V237** — CSS content-visibility smooth scroll, multi-editor approach (replaced by V272)
- **V2** — FDX import, history, comments, PDF export, document list
- **V1** — Initial collaborative editor
